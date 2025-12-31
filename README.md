# Radio Royal

Projeto web de radio com pagina publica e painel administrativo.

## Requisitos
- Node 18+ e npm 9+
- FFmpeg no PATH
- yt-dlp no PATH (para tocar URLs do YouTube)
- Owncast instalado localmente (binario) ou via Docker

## Estrutura
- frontend/ (React + Vite)
- streaming-relay/ (Node + ws + FFmpeg)
- owncast/ (binario/config local)
- scripts/ (orquestracao)

## Passo a passo

### 1) Configure o Owncast
Coloque o binario do Owncast em `owncast/owncast` e o config em `owncast/config.yaml`.

No config, use o mesmo `STREAM_KEY` do relay e a porta 8080.

### 2) Inicie tudo

Em um terminal:

```bash
cd radio-royal
./scripts/run-stack.sh
```

Isso vai:
- iniciar o Owncast (se o binario existir)
- iniciar o relay em `http://localhost:8090`
- iniciar o frontend em `http://localhost:5173`

### 3) Fluxo de uso
- Acesse `http://localhost:5173/` para o player publico
- Acesse `http://localhost:5173/admin` para o painel

## Autenticacao do admin
O `/admin` pede uma senha simples armazenada no navegador. Defina em `frontend/.env`:

```
VITE_ADMIN_PASSWORD=royal
```

## Rodar com Docker Compose

```bash
cd radio-royal
docker compose up --build
```

Portas:
- frontend: `http://localhost:5173`
- relay: `http://localhost:8090`
- owncast: `http://localhost:8080`

## Variaveis de ambiente (opcionais)

Relay (`streaming-relay/.env`):
- `PORT=8090`
- `RTMP_URL=rtmp://localhost:1935/live/STREAM_KEY`
- `FFMPEG_PATH=ffmpeg`
- `YTDLP_PATH=yt-dlp`
- `VIDEO_SIZE=1280x720`
- `VIDEO_FPS=30`
- `AUDIO_BITRATE=128k`

Owncast (via `run-stack.sh`):
- `OWNCAST_STREAM_KEY=localdev`
- `OWNCAST_ADMIN_PASSWORD=sua_senha`

Frontend (`frontend/.env`):
- `VITE_OWNCAST_WEB_URL=http://localhost:8080`
- `VITE_OWNCAST_HLS_PATH=/hls/stream.m3u8`
- `VITE_RELAY_WS_URL=ws://localhost:8090`
- `VITE_RELAY_HTTP_URL=http://localhost:8090`
- `VITE_ADMIN_PASSWORD=royal`

## Playlist por URL
O painel admin aceita URLs diretas de audio (mp3/aac/ogg) e links do YouTube.
Se voce colar uma URL de playlist, o relay importa todos os videos e voce consegue trocar as faixas dentro da lista.
O relay tambem faz proxy com suporte a seek, entao o controle de andamento funciona.
Para links individuais do YouTube, o admin tenta buscar o titulo automaticamente via relay.
