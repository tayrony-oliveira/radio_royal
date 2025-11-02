#!/usr/bin/env node
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 8081);
const RTMP_URL = process.env.RTMP_URL || '';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

if (!RTMP_URL) {
  console.warn('[relay] Variável de ambiente RTMP_URL não configurada. Defina-a antes de iniciar.');
}

function createFfmpegProcess(mimeType) {
  if (!RTMP_URL) {
    throw new Error('Destino RTMP não configurado. Defina a variável RTMP_URL.');
  }

  const inputFormat = mimeType.includes('ogg') ? 'ogg' : 'webm';

  const args = [
    '-loglevel', 'error',
    '-re',
    '-f', inputFormat,
    '-i', 'pipe:0',
    '-c:a', 'aac',
    '-b:a', process.env.AUDIO_BITRATE || '128k',
    '-ar', process.env.AUDIO_SAMPLE_RATE || '48000',
    '-ac', process.env.AUDIO_CHANNELS || '2',
    '-f', 'flv',
    RTMP_URL
  ];

  console.log('[relay] Iniciando FFmpeg:', [FFMPEG_PATH, ...args].join(' '));

  const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpeg.on('exit', (code, signal) => {
    console.log(`[relay] FFmpeg finalizado (code=${code} signal=${signal})`);
  });

  ffmpeg.on('error', (error) => {
    console.error('[relay] Falha ao iniciar FFmpeg:', error);
  });

  return ffmpeg;
}

const server = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[relay] Servidor WebSocket aguardando conexões na porta ${PORT}.`);
});

server.on('connection', (socket) => {
  console.log('[relay] Painel conectado. Aguardando dados...');

  let ffmpeg = null;
  let mimeType = 'audio/webm';

  const stopFfmpeg = () => {
    if (ffmpeg) {
      try {
        ffmpeg.stdin.end();
      } catch (error) {
        /* noop */
      }
      ffmpeg.kill('SIGINT');
      ffmpeg = null;
    }
  };

  socket.on('message', (message, isBinary) => {
    if (!isBinary) {
      try {
        const payload = JSON.parse(message.toString());
        if (payload?.type === 'start') {
          mimeType = typeof payload.mimeType === 'string' ? payload.mimeType : mimeType;
          try {
            ffmpeg = createFfmpegProcess(mimeType);
            socket.send(JSON.stringify({ type: 'ack', message: 'ffmpeg-started' }));
          } catch (error) {
            console.error('[relay] Erro ao iniciar FFmpeg:', error.message);
            socket.send(JSON.stringify({ type: 'error', message: error.message }));
            socket.close(1011, 'ffmpeg start failure');
          }
        }
        if (payload?.type === 'stop') {
          stopFfmpeg();
        }
      } catch (error) {
        console.warn('[relay] Mensagem inválida recebida:', error);
      }
      return;
    }

    if (!ffmpeg) {
      console.warn('[relay] Dados recebidos antes do comando start. Ignorando.');
      return;
    }

    ffmpeg.stdin.write(message);
  });

  socket.on('close', () => {
    console.log('[relay] Painel desconectado. Encerrando FFmpeg.');
    stopFfmpeg();
  });

  socket.on('error', (error) => {
    console.error('[relay] Erro na conexão com painel:', error);
    stopFfmpeg();
  });
});

server.on('error', (error) => {
  console.error('[relay] Erro no servidor WebSocket:', error);
  process.exit(1);
});
