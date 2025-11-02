#!/usr/bin/env node
const dns = require('dns');
const { promisify } = require('util');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

const dnsLookup = promisify(dns.lookup);

// Default configuration
const PORT = Number(process.env.PORT || 8081);
const RTMP_URL = process.env.RTMP_URL || '';
const RTMP_HOST = process.env.RTMP_HOST || '';
const RTMP_APP = process.env.RTMP_APP || 'live';
const RTMP_KEY = process.env.RTMP_KEY || '';
const RTMP_PORT = process.env.RTMP_PORT || '';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

// Audio encoding settings
const AUDIO_SETTINGS = {
  bitrate: process.env.AUDIO_BITRATE || '128k',
  sampleRate: process.env.AUDIO_SAMPLE_RATE || '48000',
  channels: process.env.AUDIO_CHANNELS || '2'
};

// Minimal video settings to satisfy Owncast (requires a video stream)
const VIDEO_SETTINGS = {
  resolution: process.env.VIDEO_RESOLUTION || '1280x720',
  frameRate: process.env.VIDEO_FRAME_RATE || '30',
  color: process.env.VIDEO_COLOR || '#111111',
  codec: process.env.VIDEO_CODEC || 'libx264',
  preset: process.env.VIDEO_PRESET || 'veryfast',
  tune: process.env.VIDEO_TUNE || 'stillimage',
  bitrate: process.env.VIDEO_BITRATE || '600k',
  maxrate: process.env.VIDEO_MAXRATE || '800k',
  bufsize: process.env.VIDEO_BUFSIZE || '1200k',
  gop: process.env.VIDEO_GOP || '60'
};

// Create HTTP server for health checks and status
const httpServer = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rtmpConfigured: !!FINAL_RTMP_URL,
      rtmpUrl: FINAL_RTMP_URL ? '✓ Configurado' : '✗ Não configurado'
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Resolve the final RTMP destination
let FINAL_RTMP_URL = '';
if (RTMP_URL) {
  FINAL_RTMP_URL = RTMP_URL;
} else if (RTMP_HOST && RTMP_KEY) {
  const hostPort = RTMP_PORT ? `${RTMP_HOST}:${RTMP_PORT}` : RTMP_HOST;
  const encodedKey = typeof RTMP_KEY === 'string' ? encodeURIComponent(RTMP_KEY) : RTMP_KEY;
  FINAL_RTMP_URL = `rtmp://${hostPort}/${RTMP_APP}/${encodedKey}`;
}

if (!FINAL_RTMP_URL) {
  console.warn('[relay] ATENÇÃO: Destino RTMP não configurado. Defina RTMP_URL ou RTMP_HOST + RTMP_KEY antes de iniciar.');
} else {
  console.log('[relay] Destino RTMP configurado em:', FINAL_RTMP_URL);
}

async function validateRtmpUrl() {
  if (!FINAL_RTMP_URL) {
    throw new Error('Destino RTMP não configurado. Defina RTMP_URL ou RTMP_HOST + RTMP_KEY.');
  }
  
  try {
    const rtmpUrl = new URL(FINAL_RTMP_URL);
    if (rtmpUrl.protocol !== 'rtmp:') {
      throw new Error('URL deve começar com rtmp://');
    }
    
    // Only check DNS if not using localhost/IP
    const hostname = rtmpUrl.hostname;
    if (!/^(localhost|127\.0\.0\.1|\[::1\]|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(hostname)) {
      try {
        await dnsLookup(hostname);
      } catch (error) {
        throw new Error(`Não foi possível resolver o host ${hostname}. Use o IP do servidor ou verifique se o nome está correto e acessível.`);
      }
    }
    
    return FINAL_RTMP_URL;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('URL RTMP inválida. Verifique o formato.');
    }
    throw error;
  }
}

async function createFfmpegProcess(mimeType) {
  await validateRtmpUrl();

  const inputFormat = mimeType.includes('ogg') ? 'ogg' : 'webm';
  const colorInput = `color=c=${VIDEO_SETTINGS.color}:s=${VIDEO_SETTINGS.resolution}:r=${VIDEO_SETTINGS.frameRate}`;

  const args = [
    '-loglevel', 'info',  // Changed from error to info for more debug info
    '-re',
    '-f', inputFormat,
    '-i', 'pipe:0',
    '-f', 'lavfi',
    '-i', colorInput,
    '-shortest',
    '-map', '1:v:0',
    '-map', '0:a:0',
    '-c:v', VIDEO_SETTINGS.codec,
    '-preset', VIDEO_SETTINGS.preset,
    '-tune', VIDEO_SETTINGS.tune,
    '-pix_fmt', 'yuv420p',
    '-b:v', VIDEO_SETTINGS.bitrate,
    '-maxrate', VIDEO_SETTINGS.maxrate,
    '-bufsize', VIDEO_SETTINGS.bufsize,
    '-g', VIDEO_SETTINGS.gop,
    '-c:a', 'aac',
    '-b:a', AUDIO_SETTINGS.bitrate,
    '-ar', AUDIO_SETTINGS.sampleRate,
    '-ac', AUDIO_SETTINGS.channels,
    '-f', 'flv',
    FINAL_RTMP_URL
  ];

  console.log('[relay] Iniciando FFmpeg:', [FFMPEG_PATH, ...args].join(' '));

  const ffmpeg = spawn(FFMPEG_PATH, args, { 
    stdio: ['pipe', 'pipe', 'pipe']  // capture both stdout and stderr
  });

  let lastError = '';
  
  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message !== lastError) {  // Avoid duplicate logs
      console.log('[relay-ffmpeg]', message);
      lastError = message;
      
      // Broadcast important FFmpeg output to connected clients
      if (global.activeSocket && global.activeSocket.readyState === WebSocket.OPEN) {
        try {
          global.activeSocket.send(JSON.stringify({
            type: 'ffmpeg-output',
            message: message
          }));
        } catch (e) {
          /* ignore */
        }
      }
    }
  });

  ffmpeg.on('exit', (code, signal) => {
    if (code !== 0) {
      console.log(`[relay] FFmpeg finalizado com erro (code=${code} signal=${signal})`);
      
      // Notify clients of FFmpeg exit
      if (global.activeSocket && global.activeSocket.readyState === WebSocket.OPEN) {
        try {
          global.activeSocket.send(JSON.stringify({
            type: 'error',
            message: `FFmpeg encerrou com código ${code}${signal ? ` (signal ${signal})` : ''}`
          }));
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      console.log('[relay] FFmpeg finalizado normalmente');
    }
  });

  ffmpeg.on('error', (error) => {
    console.error('[relay] Falha ao iniciar FFmpeg:', error);
  });

  return ffmpeg;
}

const server = new WebSocket.Server({
  server: httpServer,
  handleProtocols: () => 'audio-stream'
});

// Start the HTTP server and print status once listening
httpServer.listen(PORT, () => {
  console.log(`[relay] Servidor WebSocket e HTTP aguardando conexões em 0.0.0.0:${PORT}`);
  console.log(`[relay] Status disponível em http://localhost:${PORT}/status`);
});

server.on('connection', (socket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[relay] Painel conectado de ${clientIp}. Aguardando dados...`);
  
  // Keep track of active socket for broadcasting FFmpeg output
  global.activeSocket = socket;

  let ffmpeg = null;
  let mimeType = 'audio/webm';
  let ffmpegStarting = false;
  let pendingChunks = [];

  // Send initial status
  try {
    socket.send(JSON.stringify({ 
      type: 'status', 
      message: 'connected',
      rtmpUrl: FINAL_RTMP_URL ? '✓ Configurado' : '✗ Não configurado'
    }));
  } catch (error) {
    console.warn('[relay] Erro ao enviar status inicial:', error);
  }

  const resetPendingChunks = () => {
    ffmpegStarting = false;
    pendingChunks = [];
  };

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
    resetPendingChunks();
  };

  const flushPendingChunks = () => {
    if (!ffmpeg || pendingChunks.length === 0) {
      return;
    }

    try {
      for (const chunk of pendingChunks) {
        if (!Buffer.isBuffer(chunk)) {
          continue;
        }
        if (!ffmpeg.stdin || ffmpeg.stdin.destroyed) {
          throw new Error('FFmpeg stdin indisponível ao reenviar pacotes.');
        }
        ffmpeg.stdin.write(chunk);
      }
      pendingChunks = [];
    } catch (error) {
      console.error('[relay] Erro ao reenviar pacotes pendentes ao FFmpeg:', error);
      stopFfmpeg();
      socket.close(1011, 'ffmpeg write failure');
    }
  };

  socket.on('message', async (message, isBinary) => {
    if (!isBinary) {
      try {
        const payload = JSON.parse(message.toString());
        if (payload?.type === 'start') {
          mimeType = typeof payload.mimeType === 'string' ? payload.mimeType : mimeType;
          try {
            resetPendingChunks();
            ffmpegStarting = true;
            ffmpeg = await createFfmpegProcess(mimeType);
            ffmpeg.once('exit', () => {
              ffmpeg = null;
              resetPendingChunks();
            });
            socket.send(JSON.stringify({ type: 'ack', message: 'ffmpeg-started' }));
            ffmpegStarting = false;
            flushPendingChunks();
          } catch (error) {
            resetPendingChunks();
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
      if (ffmpegStarting) {
        const chunk = Buffer.isBuffer(message) ? message : Buffer.from(message);
        pendingChunks.push(chunk);
        return;
      }
      console.warn('[relay] Dados recebidos antes do comando start. Ignorando.');
      return;
    }

    try {
      if (pendingChunks.length > 0) {
        flushPendingChunks();
      }
      ffmpeg.stdin.write(message);
    } catch (error) {
      console.error('[relay] Erro ao enviar dados para FFmpeg:', error);
      stopFfmpeg();
      socket.close(1011, 'ffmpeg write failure');
    }
  });

  socket.on('close', () => {
    console.log('[relay] Painel desconectado. Encerrando FFmpeg.');
    stopFfmpeg();
    if (global.activeSocket === socket) {
      global.activeSocket = null;
    }
  });

  socket.on('error', (error) => {
    console.error('[relay] Erro na conexão com painel:', error);
    stopFfmpeg();
    if (global.activeSocket === socket) {
      global.activeSocket = null;
    }
  });
});

// httpServer is now started above with a listen callback

server.on('error', (error) => {
  console.error('[relay] Erro no servidor WebSocket:', error);
  process.exit(1);
});
