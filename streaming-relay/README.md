# Streaming Relay

Este pequeno servidor aceita dados de áudio via WebSocket (do frontend) e passa para o FFmpeg, que faz o ingest por RTMP para um servidor (por exemplo, Owncast).

Variáveis de ambiente suportadas

- `PORT` (opcional) - porta onde o WebSocket ficará ouvindo (padrão: `8081`).
- `RTMP_URL` - URL completa do destino RTMP (ex: `rtmp://host:1935/app/streamKey`). Se setada, tem prioridade.
- `RTMP_HOST` - host do servidor RTMP (ex: `meu-owncast.local`), usado quando `RTMP_URL` não é setado.
- `RTMP_PORT` - porta do servidor RTMP (opcional, padrão 1935 se não informado).
- `RTMP_APP` - nome do app no servidor RTMP (padrão `live`).
- `RTMP_KEY` - stream key (obrigatório se usar `RTMP_HOST`).
- `FFMPEG_PATH` - caminho para binário do ffmpeg (opcional, padrão `ffmpeg`).
- `AUDIO_BITRATE`, `AUDIO_SAMPLE_RATE`, `AUDIO_CHANNELS` - parâmetros de áudio (opcionais).
- `VIDEO_RESOLUTION`, `VIDEO_FRAME_RATE`, `VIDEO_COLOR`, `VIDEO_CODEC`, `VIDEO_PRESET`, `VIDEO_TUNE`, `VIDEO_BITRATE`, `VIDEO_MAXRATE`, `VIDEO_BUFSIZE`, `VIDEO_GOP` - parâmetros do quadro de vídeo gerado artificialmente (necessário pois o Owncast rejeita streams somente de áudio).

Exemplos de configuração

1) Usando `RTMP_URL` direto:

```bash
export RTMP_URL="rtmp://owncast.local:1935/live/MinhaChave"
node server.js
```

2) Usando host/app/key:

```bash
export RTMP_HOST="owncast.local"
export RTMP_APP="live"
export RTMP_KEY="MinhaChave"
node server.js
```

Como testar com o frontend

1. Inicie este relay:

```bash
cd streaming-relay
node server.js
```

2. No frontend (configuração padrão) abra a aplicação e, em `Transmissão Owncast`, defina o `Endereço do relay` como `ws://localhost:8081` (ou o host onde o relay estiver rodando). Clique em `Iniciar transmissão`.

Depuração

- Verifique se o FFmpeg instalado suporta os codecs do navegador. Em macOS, `brew install ffmpeg` (com suporte usual) costuma funcionar.
- Logs do relay aparecem no terminal onde o `server.js` foi iniciado. Procure mensagens sobre `ffmpeg-started`, erros no FFmpeg, ou se o `FINAL_RTMP_URL` foi corretamente detectado.
- No Owncast verifique o painel de administração para ver se um stream está ativo após iniciar a transmissão.

Observações

- O fluxo atual transcodifica a entrada do navegador para `AAC` e entrega via `flv`/RTMP. Se você quiser enviar um formato diferente, ajuste os argumentos do FFmpeg em `server.js`.
