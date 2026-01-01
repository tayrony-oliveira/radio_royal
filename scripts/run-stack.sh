#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

ensure_dir() {
  mkdir -p "$1"
}

download_file() {
  local url="$1"
  local dest="$2"
  if [ -f "$dest" ]; then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl nao encontrado. Instale curl e tente novamente."
    exit 1
  fi
  echo "Baixando ${url}..."
  curl -L -o "$dest" "$url"
}

ensure_piper_assets() {
  local piper_dir="${ROOT_DIR}/tts/piper"
  local piper_bin="${piper_dir}/piper/piper"
  local phonemize_dir="${ROOT_DIR}/tts/piper-phonemize"
  local models_dir="${ROOT_DIR}/tts/models"

  ensure_dir "${piper_dir}"
  ensure_dir "${phonemize_dir}"
  ensure_dir "${models_dir}"

  if [ ! -x "${piper_bin}" ]; then
    download_file "https://github.com/rhasspy/piper/releases/latest/download/piper_macos_aarch64.tar.gz" "/tmp/piper_macos_aarch64.tar.gz"
    tar -xzf "/tmp/piper_macos_aarch64.tar.gz" -C "${piper_dir}"
  fi

  if [ ! -d "${phonemize_dir}/piper-phonemize/lib" ]; then
    download_file "https://github.com/rhasspy/piper-phonemize/releases/latest/download/piper-phonemize_macos_aarch64.tar.gz" "/tmp/piper_phonemize_macos_aarch64.tar.gz"
    tar -xzf "/tmp/piper_phonemize_macos_aarch64.tar.gz" -C "${phonemize_dir}"
  fi

  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx" "${models_dir}/pt_BR-cadu-medium.onnx"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx.json" "${models_dir}/pt_BR-cadu-medium.onnx.json"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx" "${models_dir}/pt_BR-faber-medium.onnx"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json" "${models_dir}/pt_BR-faber-medium.onnx.json"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/jeff/medium/pt_BR-jeff-medium.onnx" "${models_dir}/pt_BR-jeff-medium.onnx"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/jeff/medium/pt_BR-jeff-medium.onnx.json" "${models_dir}/pt_BR-jeff-medium.onnx.json"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx" "${models_dir}/pt_BR-edresson-low.onnx"
  download_file "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx.json" "${models_dir}/pt_BR-edresson-low.onnx.json"

  if [ ! -f "${ROOT_DIR}/streaming-relay/.env" ]; then
    cat <<EOF > "${ROOT_DIR}/streaming-relay/.env"
TTS_ENGINE=piper
TTS_PIPER_PATH=../tts/piper/piper/piper
TTS_PIPER_MODELS=../tts/models/pt_BR-cadu-medium.onnx,../tts/models/pt_BR-faber-medium.onnx,../tts/models/pt_BR-jeff-medium.onnx,../tts/models/pt_BR-edresson-low.onnx
TTS_PIPER_LIB_PATH=../tts/piper-phonemize/piper-phonemize/lib
EOF
  fi
}

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

is_local_host() {
  local host="$1"
  case "$host" in
    ""|localhost|127.0.0.1|0.0.0.0) return 0 ;;
  esac
  return 1
}

owncast_expected_local() {
  local owncast_host=""
  if [ -n "${VITE_OWNCAST_WEB_URL:-}" ]; then
    owncast_host="$(printf "%s" "${VITE_OWNCAST_WEB_URL}" | awk -F[/:] '{print $4}')"
  fi
  if is_local_host "$owncast_host"; then
    return 0
  fi
  if [ -z "${VITE_OWNCAST_WEB_URL:-}" ]; then
    return 0
  fi
  return 1
}

echo "Iniciando stack Radio Royal..."

ensure_piper_assets

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale Node 18+ e tente novamente."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado. Instale npm 9+ e tente novamente."
  exit 1
fi

if [ -n "${OWNCAST_BIN_PATH:-}" ]; then
  if [ "${OWNCAST_BIN_PATH#/}" = "${OWNCAST_BIN_PATH}" ]; then
    OWNCAST_BIN_PATH="${ROOT_DIR}/${OWNCAST_BIN_PATH}"
  fi
  OWNCAST_DIR="$(cd "$(dirname "${OWNCAST_BIN_PATH}")" && pwd -P)"
else
  OWNCAST_DIR="${OWNCAST_DIR:-${ROOT_DIR}/owncast}"
  if [ "${OWNCAST_DIR#/}" = "${OWNCAST_DIR}" ]; then
    OWNCAST_DIR="${ROOT_DIR}/${OWNCAST_DIR}"
  fi
  OWNCAST_DIR="$(cd "${OWNCAST_DIR}" && pwd -P)"
  OWNCAST_BIN_PATH="${OWNCAST_DIR}/owncast"
fi
if [ -n "${OWNCAST_CONFIG:-}" ]; then
  if [ "${OWNCAST_CONFIG#/}" = "${OWNCAST_CONFIG}" ]; then
    OWNCAST_CONFIG="${ROOT_DIR}/${OWNCAST_CONFIG}"
  fi
else
  OWNCAST_CONFIG="${OWNCAST_DIR}/config.yaml"
fi
OWNCAST_STREAM_KEY=${OWNCAST_STREAM_KEY:-""}
OWNCAST_ADMIN_PASSWORD=${OWNCAST_ADMIN_PASSWORD:-""}
OWNCAST_DOCKER_STARTED="0"

if ! command -v ffmpeg >/dev/null 2>&1; then
  if [ -x "${OWNCAST_DIR}/ffmpeg" ]; then
    export FFMPEG_PATH="${OWNCAST_DIR}/ffmpeg"
    echo "FFmpeg nao encontrado no PATH. Usando ${FFMPEG_PATH}."
  fi
fi

if ! command -v ffmpeg >/dev/null 2>&1 && [ -z "${FFMPEG_PATH:-}" ]; then
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

docker_ready() {
  docker info >/dev/null 2>&1
}

if [ -d "${OWNCAST_DIR}" ] && [ -f "${OWNCAST_BIN_PATH}" ] && [ ! -x "${OWNCAST_BIN_PATH}" ]; then
  chmod +x "${OWNCAST_BIN_PATH}"
fi

if [ -x "${OWNCAST_BIN_PATH}" ]; then
  echo "Iniciando Owncast..."
  OWNCAST_ARGS=()
  if [ -f "${OWNCAST_CONFIG}" ]; then
    OWNCAST_ARGS+=(--config "${OWNCAST_CONFIG}")
  else
    echo "Config do Owncast nao encontrada em ${OWNCAST_CONFIG}. Iniciando com defaults."
  fi
  if [ -n "${OWNCAST_STREAM_KEY}" ]; then
    OWNCAST_ARGS+=(--streamkey "${OWNCAST_STREAM_KEY}")
  fi
  if [ -n "${OWNCAST_ADMIN_PASSWORD}" ]; then
    OWNCAST_ARGS+=(--adminpassword "${OWNCAST_ADMIN_PASSWORD}")
  fi
  "${OWNCAST_BIN_PATH}" "${OWNCAST_ARGS[@]}" &
else
  echo "Owncast nao encontrado em ${OWNCAST_BIN_PATH}"
  if command -v docker >/dev/null 2>&1; then
    if ! docker_ready; then
      echo "Docker encontrado, mas o daemon nao esta rodando. Inicie o Docker Desktop e tente novamente."
    elif docker compose version >/dev/null 2>&1; then
      echo "Tentando iniciar Owncast via Docker Compose..."
      if (cd "${ROOT_DIR}" && docker compose up -d owncast); then
        OWNCAST_DOCKER_STARTED="1"
      else
        echo "Falha ao iniciar Owncast via Docker Compose."
      fi
    elif command -v docker-compose >/dev/null 2>&1; then
      echo "Tentando iniciar Owncast via docker-compose..."
      if (cd "${ROOT_DIR}" && docker-compose up -d owncast); then
        OWNCAST_DOCKER_STARTED="1"
      else
        echo "Falha ao iniciar Owncast via docker-compose."
      fi
    else
      echo "Docker encontrado, mas Docker Compose nao esta disponivel."
    fi
  else
    echo "Baixe o binario e coloque nessa pasta para iniciar automaticamente."
    echo "Ou defina OWNCAST_DIR/OWNCAST_BIN_PATH para apontar para o binario."
    echo "Ou use Docker Compose para iniciar o Owncast."
  fi
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

if owncast_expected_local; then
  if [ -x "${OWNCAST_BIN_PATH}" ] || [ "${OWNCAST_DOCKER_STARTED}" = "1" ]; then
    echo "Aguardando Owncast iniciar na porta 1935..."
    if ! wait_for_port "127.0.0.1" 1935; then
      echo "Owncast nao respondeu na porta 1935. Verifique se ele subiu corretamente."
      echo "Se preferir, exporte VITE_OWNCAST_WEB_URL para um Owncast remoto."
      exit 1
    fi
  else
    echo "Owncast local nao iniciou. Inicie o Docker Desktop ou aponte OWNCAST_DIR/OWNCAST_BIN_PATH para o binario."
    echo "Se preferir, exporte VITE_OWNCAST_WEB_URL para um Owncast remoto."
    exit 1
  fi
fi

export VITE_OWNCAST_WEB_URL="${VITE_OWNCAST_WEB_URL:-http://localhost:8080}"
export VITE_OWNCAST_HLS_PATH="${VITE_OWNCAST_HLS_PATH:-/hls/stream.m3u8}"
export VITE_RELAY_WS_URL="${VITE_RELAY_WS_URL:-ws://localhost:8090}"
export VITE_RELAY_HTTP_URL="${VITE_RELAY_HTTP_URL:-http://localhost:8090}"
export VITE_ADMIN_PASSWORD="${VITE_ADMIN_PASSWORD:-royal}"

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
