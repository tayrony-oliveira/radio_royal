import fs from "node:fs";
import path from "node:path";

const [label, filename] = process.argv.slice(2);

if (!label || !filename) {
  console.log("Uso: npm run youtube:add -- \"Label\" arquivo.mp3");
  process.exit(1);
}

const publicDir = path.resolve("public");
const tracksPath = path.join(publicDir, "local-tracks.json");
const targetPath = path.join(publicDir, "youtube-tracks", filename);

if (!fs.existsSync(targetPath)) {
  console.log("Arquivo nao encontrado em public/youtube-tracks:", filename);
  process.exit(1);
}

const raw = fs.readFileSync(tracksPath, "utf-8");
const data = JSON.parse(raw);
const url = `/youtube-tracks/${filename}`;

const exists = data.tracks?.some((track) => track.url === url);
if (!exists) {
  data.tracks = data.tracks || [];
  data.tracks.push({ label, url });
  fs.writeFileSync(tracksPath, JSON.stringify(data, null, 2));
}

console.log("Faixa adicionada:", label, url);
