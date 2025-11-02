# Radio Royal Mixer

Aplicação front-end para mixagem de trilhas de fundo, faixas principais e microfone utilizando a Web Audio API. O projeto inclui integração com a YouTube IFrame API (via `react-player`) para monitoramento de eventos, persistência de playlists em `localStorage` e interface responsiva construída com React e Vite.

## Estrutura do projeto

```
frontend/
├── index.html
├── package.json
├── src/
│   ├── App.jsx
│   ├── components/
│   ├── hooks/
│   ├── main.jsx
│   └── styles.css
└── vite.config.js

streaming-relay/
├── package.json
└── server.js
```

## Funcionalidades principais

- **Layout responsivo** com duas colunas principais (player de fundo e player principal) e seções auxiliares para microfone, saída do mix e gerenciamento de playlists.
- **Mixagem via Web Audio API**, utilizando `GainNode` dedicado para cada player e para o microfone, além de um `MediaStreamDestination` para a saída final.
- **Captura de microfone** com controle de volume independente.
- **Integração YouTube IFrame API**, registrando eventos de play/pause para sincronização de estado.
- **Persistência local** de playlists, índice das faixas e ajustes de volume.
- **Transmissão via FFmpeg para Owncast** através de um relay WebSocket simples incluso no repositório.
- **Controles intuitivos** para trocar faixas, iniciar/parar reprodução, ajustar volumes e visualizar níveis de áudio.

## Pré-requisitos

- Node.js 18 ou superior.
- NPM 9 ou superior.

> **Nota:** O ambiente de execução deve permitir acesso à internet para instalação das dependências declaradas no `package.json`.

## Instalação e execução

```bash
cd frontend
npm install
npm run dev
```

O servidor de desenvolvimento será iniciado em `http://localhost:5173`.

Para gerar uma build de produção:

```bash
npm run build
npm run preview
```

## Transmissão Owncast com FFmpeg

O repositório inclui um relay mínimo em Node.js que recebe o `MediaStream` gerado no painel administrativo e o envia para o Owncast (ou qualquer destino RTMP) utilizando o FFmpeg.

### Execução integrada (Owncast + relay + frontend)

Para subir todo o stack de desenvolvimento com um único comando, use o script utilitário:

```bash
./scripts/run-stack.sh
```

Ele irá:

- Garantir que as dependências do frontend e do relay estejam instaladas;
- Iniciar o Owncast local com uma stream key temporária (`royal-demo`, personalizável via `STREAM_KEY`);
- Publicar o relay WebSocket apontando para o Owncast (`RTMP_URL` pode ser sobrescrita);
- Iniciar o frontend (Vite) nas rotas pública (`/`) e administrativa (`/admin`).

Variáveis úteis:

- `STREAM_KEY` — define a chave de transmissão temporária do Owncast (padrão `royal-demo`);
- `OWNCAST_WEB_IP`, `OWNCAST_WEB_PORT`, `RELAY_PORT`, `FRONTEND_PORT` — IP/portas dos serviços (por padrão Owncast em `0.0.0.0:8080`, relay em `8081`, frontend em `5173`);
- `FFMPEG_BIN` — caminho alternativo para o binário do FFmpeg;
- `RTMP_URL` — URL completa de ingest (sobrepõe a montagem automática `rtmp://127.0.0.1:1935/live/<STREAM_KEY>`);
- `VIDEO_RESOLUTION`, `VIDEO_FRAME_RATE`, `VIDEO_COLOR` etc. — ajustes do quadro gerado automaticamente para satisfazer o Owncast (veja `streaming-relay/server.js`).
- `MEDIA_CHUNK_INTERVAL_MS` — intervalo padrão (em ms) dos blocos enviados pelo navegador ao relay (padrão `500`, respeita o mínimo configurável no painel).

Ao finalizar, pressione `Ctrl+C` para encerrar todos os serviços — os logs são gravados em `.runtime/logs/`.

1. **Prepare o Owncast** (ou outro servidor compatível com RTMP) e anote:
   - URL de ingestão RTMP, por exemplo `rtmp://meuservidor/live/stream-key`;
   - URL pública do player (HLS), por exemplo `https://meuservidor/hls/stream.m3u8`.
2. **Instale dependências do relay**:
   ```bash
   cd streaming-relay
   npm install
   ```
3. **Execute o relay apontando para o destino RTMP** (o FFmpeg precisa estar no `PATH`):
   ```bash
   RTMP_URL="rtmp://meuservidor/live/stream-key" node server.js
   ```
   Você pode personalizar as variáveis `PORT`, `FFMPEG_PATH`, `AUDIO_BITRATE`, `AUDIO_SAMPLE_RATE` e `AUDIO_CHANNELS` conforme necessário.
4. **Abra o painel administrativo (`/admin`)** e, na seção “Informações públicas da transmissão”, informe a URL pública do Owncast (HLS). Na seção “Transmissão Owncast” configure o endereço do relay (por padrão `ws://localhost:8081`) e clique em “Iniciar transmissão”.
5. A página pública (`/`) passará a tocar automaticamente o stream publicado no Owncast sempre que a transmissão estiver ativa.

> Dica: durante o desenvolvimento local você pode rodar o Owncast na mesma máquina e usar `rtmp://localhost:1935/live/<stream-key>` como `RTMP_URL`.

## Página pública

A rota principal (`/`) exibe o player público com as informações de locutor, faixa atual, fila programada e chat. Todos os dados são atualizados em tempo real via `BroadcastChannel`/`localStorage`. Caso o navegador bloqueie o autoplay, o usuário precisa apenas clicar no player para liberar o áudio.

## Fluxo de trabalho com Git

O branch `develop` já está disponível como base para novos desenvolvimentos. Para começar a trabalhar nele, basta alternar o bra
nch localmente e seguir com suas alterações normalmente:

```bash
git fetch --all            # garante que o branch remoto esteja atualizado
git checkout develop       # alterna para o branch de integração
```

No primeiro envio, use `git push -u origin develop` para associar o branch local ao remoto.

## Playlists e fontes de áudio

Por padrão o projeto inclui faixas públicas da SoundHelix, que possuem CORS habilitado para uso em testes. Para adicionar novas músicas, utilize URLs com suporte a streaming direto (`.mp3`, `.aac`, etc.) que não possuam restrições de DRM.

Conteúdos provenientes de players externos baseados em `<iframe>` (como YouTube) não podem ser roteados diretamente para a Web Audio API devido a restrições de CORS, mas os eventos de controle (play/pause) ficam disponíveis para automatizações.

## Permissões e limitações

- Navegadores modernos exigem interação do usuário para iniciar o `AudioContext` e para conceder acesso ao microfone.
- Caso a permissão seja negada, o aplicativo exibirá mensagens de erro na seção do microfone.
- Algumas fontes de streaming podem não permitir a captura de áudio para mixagem.

## Licença

Este projeto é distribuído sob a licença MIT. Consulte o arquivo `LICENSE` (se disponível) ou adapte conforme necessário.
