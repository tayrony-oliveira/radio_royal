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
```

## Funcionalidades principais

- **Layout responsivo** com duas colunas principais (player de fundo e player principal) e seções auxiliares para microfone, saída do mix e gerenciamento de playlists.
- **Mixagem via Web Audio API**, utilizando `GainNode` dedicado para cada player e para o microfone, além de um `MediaStreamDestination` para a saída final.
- **Captura de microfone** com controle de volume independente.
- **Integração YouTube IFrame API**, registrando eventos de play/pause para sincronização de estado.
- **Persistência local** de playlists, índice das faixas e ajustes de volume.
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
