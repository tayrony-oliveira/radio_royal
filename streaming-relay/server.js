import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

const projectRoot = process.cwd();

const readEnvFile = (filename) => {
  const envPath = path.join(projectRoot, filename);
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  return content
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split("=");
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
};

const fileEnv = readEnvFile(".env");

const config = {
  port: Number(process.env.PORT || fileEnv.PORT || 8090),
  rtmpUrl:
    process.env.RTMP_URL ||
    fileEnv.RTMP_URL ||
    "rtmp://localhost:1935/live/STREAM_KEY",
  ffmpegPath: process.env.FFMPEG_PATH || fileEnv.FFMPEG_PATH || "ffmpeg",
  ytdlpPath: process.env.YTDLP_PATH || fileEnv.YTDLP_PATH || "yt-dlp",
  videoSize: process.env.VIDEO_SIZE || fileEnv.VIDEO_SIZE || "1280x720",
  videoFps: process.env.VIDEO_FPS || fileEnv.VIDEO_FPS || "30",
  audioBitrate: process.env.AUDIO_BITRATE || fileEnv.AUDIO_BITRATE || "128k"
};

const streamCache = new Map();
const cacheTtlMs = 10 * 60 * 1000;

const isYouTubeHost = (host) => {
  return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host);
};

const resolveYouTubeUrl = (value) => {
  try {
    const url = new URL(value);
    if (!isYouTubeHost(url.hostname)) {
      return null;
    }

    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    if (url.pathname.startsWith("/shorts/")) {
      const videoId = url.pathname.replace("/shorts/", "").split("/")[0];
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    const videoId = url.searchParams.get("v");
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  } catch (error) {
    return null;
  }
};

const runYtDlp = (args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ytdlpPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp finalizado com erro: ${code}`));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
};

const detectContentType = (streamUrl, fallback) => {
  if (fallback) return fallback.split(";")[0];
  if (!streamUrl) return "audio/mp4";
  if (streamUrl.includes("mime=audio%2Fwebm") || streamUrl.includes(".webm")) {
    return "audio/webm";
  }
  if (streamUrl.includes("mime=audio%2Fmp4") || streamUrl.includes(".m4a")) {
    return "audio/mp4";
  }
  return "audio/mpeg";
};

const getCachedStreamUrl = async (resolvedUrl) => {
  const cached = streamCache.get(resolvedUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const { stdout } = await runYtDlp([
    "-f",
    "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
    "--no-playlist",
    "-g",
    resolvedUrl
  ]);

  const streamUrl = stdout.split("\n").find((line) => line.trim());
  if (!streamUrl) {
    throw new Error("URL direta nao encontrada.");
  }

  const entry = {
    streamUrl,
    expiresAt: Date.now() + cacheTtlMs
  };
  streamCache.set(resolvedUrl, entry);
  return entry;
};

const proxyStream = (streamUrl, req, res) => {
  const client = streamUrl.startsWith("https") ? https : http;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const proxyReq = client.request(streamUrl, { headers }, (proxyRes) => {
    const contentType = detectContentType(streamUrl, proxyRes.headers["content-type"]);
    const responseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Accept-Ranges": proxyRes.headers["accept-ranges"] || "bytes"
    };
    if (proxyRes.headers["content-length"]) {
      responseHeaders["Content-Length"] = proxyRes.headers["content-length"];
    }
    if (proxyRes.headers["content-range"]) {
      responseHeaders["Content-Range"] = proxyRes.headers["content-range"];
    }

    res.writeHead(proxyRes.statusCode || 200, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    console.error("Erro no proxy do YouTube:", error?.message || error);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Falha ao buscar stream." }));
  });

  proxyReq.end();

  req.on("close", () => {
    proxyReq.destroy();
  });
};

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://localhost:${config.port}`);

  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        rtmpUrl: config.rtmpUrl,
        connections: wss.clients.size
      })
    );
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  if (requestUrl.pathname === "/youtube") {
    const target = requestUrl.searchParams.get("url");
    const resolvedUrl = target ? resolveYouTubeUrl(target) : null;

    if (!resolvedUrl) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "URL do YouTube invalida." }));
      return;
    }

    try {
      const cached = await getCachedStreamUrl(resolvedUrl);
      proxyStream(cached.streamUrl, req, res);
    } catch (error) {
      console.error("Erro ao buscar audio do YouTube:", error?.message || error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Falha ao buscar audio.", detail: error?.message })
      );
    }
    return;
  }

  if (requestUrl.pathname === "/youtube/info") {
    const target = requestUrl.searchParams.get("url");
    const resolvedUrl = target ? resolveYouTubeUrl(target) : null;
    if (!resolvedUrl) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "URL do YouTube invalida." }));
      return;
    }

    try {
      const { stdout } = await runYtDlp([
        "--no-playlist",
        "--print",
        "%(title)s",
        resolvedUrl
      ]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ title: stdout }));
    } catch (error) {
      console.error("Erro ao obter titulo:", error?.message || error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Falha ao obter titulo." }));
    }
    return;
  }

  if (requestUrl.pathname === "/youtube/playlist") {
    const target = requestUrl.searchParams.get("url");
    let hostOk = false;
    try {
      hostOk = target ? isYouTubeHost(new URL(target).hostname) : false;
    } catch (error) {
      hostOk = false;
    }
    if (!target || !hostOk) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "URL de playlist invalida." }));
      return;
    }

    try {
      const { stdout } = await runYtDlp(["--flat-playlist", "-J", target]);
      const data = JSON.parse(stdout);
      const items = (data.entries || []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        url: entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : entry.url
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ items }));
    } catch (error) {
      console.error("Erro ao carregar playlist:", error?.message || error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Falha ao carregar playlist." }));
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server });

const startFfmpeg = () => {
  const args = [
    "-f",
    "webm",
    "-i",
    "pipe:0",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${config.videoSize}:r=${config.videoFps}`,
    "-map",
    "1:v:0",
    "-map",
    "0:a:0",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    config.audioBitrate,
    "-ar",
    "44100",
    "-f",
    "flv",
    config.rtmpUrl
  ];

  const child = spawn(config.ffmpegPath, args, {
    stdio: ["pipe", "inherit", "inherit"]
  });

  child.on("close", (code) => {
    console.log("FFmpeg finalizado:", code);
  });

  return child;
};

wss.on("connection", (socket) => {
  console.log("Cliente conectado");
  let ffmpeg = null;

  socket.on("message", (data) => {
    if (!ffmpeg) {
      console.log("Iniciando FFmpeg...");
      ffmpeg = startFfmpeg();
    }

    if (ffmpeg?.stdin?.writable) {
      ffmpeg.stdin.write(data);
    }
  });

  socket.on("close", () => {
    console.log("Cliente desconectado");
    if (ffmpeg?.stdin) {
      ffmpeg.stdin.end();
    }
  });

  socket.on("error", () => {
    if (ffmpeg?.stdin) {
      ffmpeg.stdin.end();
    }
  });
});

server.listen(config.port, () => {
  console.log(`Relay ativo em http://localhost:${config.port}`);
});
