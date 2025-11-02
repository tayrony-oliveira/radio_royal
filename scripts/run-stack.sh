#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
LOG_DIR="${RUNTIME_DIR}/logs"

STREAM_KEY="${STREAM_KEY:-royal-demo}"
OWNCAST_WEB_PORT="${OWNCAST_WEB_PORT:-8080}"
OWNCAST_WEB_IP="${OWNCAST_WEB_IP:-0.0.0.0}"
OWNCAST_HLS_PATH="${OWNCAST_HLS_PATH:-/hls/stream.m3u8}"
MEDIA_CHUNK_INTERVAL_MS="${MEDIA_CHUNK_INTERVAL_MS:-500}"
RELAY_PORT="${RELAY_PORT:-8081}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

RTMP_URL_DEFAULT="rtmp://127.0.0.1:1935/live/${STREAM_KEY}"
RTMP_URL="${RTMP_URL:-${RTMP_URL_DEFAULT}}"
HLS_URL="http://localhost:${OWNCAST_WEB_PORT}/hls/stream.m3u8"
RELAY_URL="ws://localhost:${RELAY_PORT}"

OWNCAST_LOG="${LOG_DIR}/owncast.log"
RELAY_LOG="${LOG_DIR}/streaming-relay.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"

mkdir -p "${RUNTIME_DIR}" "${LOG_DIR}" "${ROOT_DIR}/owncast/data/logs" "${ROOT_DIR}/owncast/data/backups"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Erro: dependência obrigatória '$1' não encontrada no PATH." >&2
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local service_name="$2"
  local log_path="$3"
  local attempts="${4:-60}"

  for attempt in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "✓ ${service_name} disponível em ${url}"
      return 0
    fi
    sleep 1
  done

  echo "Erro: ${service_name} não respondeu em tempo hábil. Confira os logs em ${log_path}." >&2
  exit 1
}

ensure_node_modules() {
  if [ ! -d "${ROOT_DIR}/frontend/node_modules" ]; then
    echo "Instalando dependências do frontend..."
    (cd "${ROOT_DIR}/frontend" && npm install)
  fi

  if [ ! -d "${ROOT_DIR}/streaming-relay/node_modules" ]; then
    echo "Instalando dependências do relay..."
    (cd "${ROOT_DIR}/streaming-relay" && npm install)
  fi
}

PIDS=()

cleanup() {
  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo ""
    echo "Encerrando serviços..."
    for pid in "${PIDS[@]}"; do
      if kill -0 "${pid}" >/dev/null 2>&1; then
        kill "${pid}" >/dev/null 2>&1 || true
        wait "${pid}" >/dev/null 2>&1 || true
      fi
    done
  fi
}

trap cleanup EXIT

require_command node
require_command npm
require_command curl

FFMPEG_BIN_DEFAULT="${ROOT_DIR}/owncast/ffmpeg"
if [ -z "${FFMPEG_BIN:-}" ]; then
  if [ -x "${FFMPEG_BIN_DEFAULT}" ]; then
    FFMPEG_BIN="${FFMPEG_BIN_DEFAULT}"
  else
    FFMPEG_BIN="$(command -v ffmpeg || true)"
    if [ -z "${FFMPEG_BIN}" ]; then
      echo "Erro: FFmpeg não encontrado. Instale o FFmpeg ou defina a variável FFMPEG_BIN com o caminho para o binário." >&2
      exit 1
    fi
  fi
fi

ensure_node_modules

start_owncast() {
  echo "Iniciando Owncast (porta web ${OWNCAST_WEB_PORT})..."
  (cd "${ROOT_DIR}/owncast" && \
    ./owncast \
      -webserverip "${OWNCAST_WEB_IP}" \
      -webserverport "${OWNCAST_WEB_PORT}" \
      -streamkey "${STREAM_KEY}" \
      -logdir "${ROOT_DIR}/owncast/data/logs" \
      -backupdir "${ROOT_DIR}/owncast/data/backups" \
      -database "${ROOT_DIR}/owncast/data/owncast.db") \
      >"${OWNCAST_LOG}" 2>&1 &

  local pid=$!
  PIDS+=("${pid}")
  wait_for_http "http://localhost:${OWNCAST_WEB_PORT}/" "Owncast" "${OWNCAST_LOG}"
}

start_streaming_relay() {
  echo "Iniciando relay WebSocket (porta ${RELAY_PORT})..."
  (cd "${ROOT_DIR}/streaming-relay" && \
    PORT="${RELAY_PORT}" \
    RTMP_URL="${RTMP_URL}" \
    FFMPEG_PATH="${FFMPEG_BIN}" \
    node server.js) \
      >"${RELAY_LOG}" 2>&1 &

  local pid=$!
  PIDS+=("${pid}")
  wait_for_http "http://localhost:${RELAY_PORT}/status" "Relay" "${RELAY_LOG}"
}

start_frontend() {
  echo "Iniciando frontend (porta ${FRONTEND_PORT})..."
  (cd "${ROOT_DIR}/frontend" && \
    VITE_OWNCAST_WEB_PORT="${OWNCAST_WEB_PORT}" \
    VITE_OWNCAST_HLS_PATH="${OWNCAST_HLS_PATH}" \
    VITE_MEDIA_CHUNK_INTERVAL_MS="${MEDIA_CHUNK_INTERVAL_MS}" \
    npm run dev -- --host --port "${FRONTEND_PORT}") \
      >"${FRONTEND_LOG}" 2>&1 &

  local pid=$!
  PIDS+=("${pid}")
  wait_for_http "http://localhost:${FRONTEND_PORT}/" "Frontend" "${FRONTEND_LOG}"
}

start_owncast
start_streaming_relay
start_frontend

cat <<EOF

============================================================
Stack Radio Royal em execução
------------------------------------------------------------
 Relay (WebSocket):   ${RELAY_URL}
 Ingest RTMP:         ${RTMP_URL}
 HLS público:         ${HLS_URL}
 Painel Owncast:      http://localhost:${OWNCAST_WEB_PORT}/admin
 Frontend público:    http://localhost:${FRONTEND_PORT}/
 Frontend admin:      http://localhost:${FRONTEND_PORT}/admin

Stream key configurada nesta sessão: ${STREAM_KEY}

Logs:
 - Owncast:         ${OWNCAST_LOG}
 - Streaming relay: ${RELAY_LOG}
 - Frontend:        ${FRONTEND_LOG}

Pressione Ctrl+C para encerrar todos os serviços.
============================================================

EOF

wait
