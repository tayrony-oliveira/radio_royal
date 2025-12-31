#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

detect_stream_key() {
  local config_path="$1"
  local key=""
  if [ -f "$config_path" ]; then
    if command -v rg >/dev/null 2>&1; then
      key=$(rg -n "(stream.?key|streamKey)" "$config_path" 2>/dev/null | head -n 1 | awk -F':' '{print $2}' | tr -d ' "\r')
    else
      key=$(grep -E "(stream.?key|streamKey)" "$config_path" 2>/dev/null | head -n 1 | awk -F':' '{print $2}' | tr -d ' "\r')
    fi
  fi
  echo "$key"
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local retries=120
  local count=0
  until nc -z "$host" "$port" >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge "$retries" ]; then
      return 1
    fi
    sleep 0.5
  done
  return 0
}

echo "Iniciando stack Radio Royal..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale Node 18+ e tente novamente."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado. Instale npm 9+ e tente novamente."
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Instalando FFmpeg via brew..."
    brew install ffmpeg
  else
    echo "FFmpeg nao encontrado. Instale e tente novamente."
    exit 1
  fi
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Instalando yt-dlp via brew..."
    brew install yt-dlp
  else
    echo "yt-dlp nao encontrado. Instale e tente novamente."
    exit 1
  fi
fi

OWNCAST_CONFIG="${ROOT_DIR}/owncast/config.yaml"
OWNCAST_STREAM_KEY=${OWNCAST_STREAM_KEY:-""}
OWNCAST_ADMIN_PASSWORD=${OWNCAST_ADMIN_PASSWORD:-""}

if [ -x "${ROOT_DIR}/owncast/owncast" ]; then
  echo "Iniciando Owncast..."
  OWNCAST_ARGS=()
  if [ -f "${OWNCAST_CONFIG}" ]; then
    OWNCAST_ARGS+=(--config "${OWNCAST_CONFIG}")
  fi
  if [ -n "${OWNCAST_STREAM_KEY}" ]; then
    OWNCAST_ARGS+=(--streamkey "${OWNCAST_STREAM_KEY}")
  fi
  if [ -n "${OWNCAST_ADMIN_PASSWORD}" ]; then
    OWNCAST_ARGS+=(--adminpassword "${OWNCAST_ADMIN_PASSWORD}")
  fi
  (cd "${ROOT_DIR}/owncast" && ./owncast "${OWNCAST_ARGS[@]}") &
else
  echo "Owncast nao encontrado em ${ROOT_DIR}/owncast/owncast"
  echo "Baixe o binario e coloque nessa pasta para iniciar automaticamente."
fi

if [ -z "${STREAM_KEY}" ]; then
  STREAM_KEY=$(detect_stream_key "${OWNCAST_CONFIG}")
fi

if [ -z "${STREAM_KEY}" ]; then
  STREAM_KEY="${OWNCAST_STREAM_KEY:-localdev}"
fi

if [ -z "${RTMP_URL}" ]; then
  RTMP_URL="rtmp://localhost:1935/live/${STREAM_KEY}"
fi

export STREAM_KEY
export RTMP_URL

if [ -x "${ROOT_DIR}/owncast/owncast" ]; then
  echo "Aguardando Owncast iniciar na porta 1935..."
  if ! wait_for_port "127.0.0.1" 1935; then
    echo "Owncast nao respondeu na porta 1935. Verifique se ele subiu corretamente."
  fi
fi

echo "Usando STREAM_KEY=${STREAM_KEY}"
echo "Usando RTMP_URL=${RTMP_URL}"

if [ ! -d "${ROOT_DIR}/streaming-relay/node_modules" ]; then
  echo "Instalando dependencias do relay..."
  (cd "${ROOT_DIR}/streaming-relay" && npm install)
else
  echo "Atualizando dependencias do relay..."
  (cd "${ROOT_DIR}/streaming-relay" && npm install)
fi

if [ ! -d "${ROOT_DIR}/frontend/node_modules" ]; then
  echo "Instalando dependencias do frontend..."
  (cd "${ROOT_DIR}/frontend" && npm install)
else
  echo "Atualizando dependencias do frontend..."
  (cd "${ROOT_DIR}/frontend" && npm install)
fi

echo "Iniciando relay..."
(cd "${ROOT_DIR}/streaming-relay" && node server.js) &

echo "Iniciando frontend..."
(cd "${ROOT_DIR}/frontend" && npm run dev)
