FROM node:18-bullseye-slim

RUN apt-get update \
  && apt-get install -y ffmpeg yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8090

CMD ["node", "server.js"]
