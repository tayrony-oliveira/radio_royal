import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicChat from './components/PublicChat.jsx';
import { getStoredBroadcast, useBroadcastMetadata } from './hooks/useBroadcastMetadata.js';

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return 'agora mesmo';
  }
  const date = new Date(timestamp);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return 'agora mesmo';
  }
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }
  const hours = Math.floor(diffSeconds / 3600);
  if (hours < 24) {
    return `há ${hours} hora${hours > 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

const DEFAULT_HLS_PATH = import.meta.env?.VITE_OWNCAST_HLS_PATH || '/hls/stream.m3u8';
const DEFAULT_OWNCAST_PORT = import.meta.env?.VITE_OWNCAST_WEB_PORT || '8080';

function getDefaultStreamUrl() {
  if (typeof window === 'undefined') {
    return '';
  }
  const host = window.location.hostname;
  return `http://${host}:${DEFAULT_OWNCAST_PORT}${DEFAULT_HLS_PATH}`;
}

function normalizeStreamUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  if (typeof window === 'undefined') {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const loopbackHosts = new Set([
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '[::1]'
    ]);

    if (loopbackHosts.has(parsed.hostname)) {
      const replacementHost = window.location.hostname;
      if (replacementHost && !loopbackHosts.has(replacementHost)) {
        parsed.hostname = replacementHost;
      }
    }

    return parsed.toString();
  } catch (error) {
    console.warn('Não foi possível normalizar a URL do stream público.', error);
    return rawUrl;
  }
}

export default function PublicRadio() {
  const { metadata } = useBroadcastMetadata();
  const fallback = getStoredBroadcast();
  const broadcast = metadata ?? fallback;

  const [owncastStatus, setOwncastStatus] = useState(null);

  const playlist = Array.isArray(broadcast.playlist) && broadcast.playlist.length
    ? broadcast.playlist
    : [];

  const rawStreamUrl = broadcast.streamUrl?.trim()
    ? broadcast.streamUrl.trim()
    : fallback.streamUrl?.trim() || getDefaultStreamUrl();

  const streamSource = useMemo(
    () => normalizeStreamUrl(rawStreamUrl),
    [rawStreamUrl]
  );

  const streamHost = useMemo(() => {
    if (!streamSource) {
      return '';
    }
    if (typeof window === 'undefined') {
      return streamSource;
    }
    try {
      return new URL(streamSource, window.location.origin).host;
    } catch (error) {
      console.warn('Falha ao derivar host da URL do stream.', error);
      return streamSource;
    }
  }, [streamSource]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    let isMounted = true;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname;
    const statusUrl = `${protocol}//${host}:${DEFAULT_OWNCAST_PORT}/api/status`;

    const fetchStatus = async () => {
      try {
        const response = await fetch(statusUrl, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isMounted) {
          setOwncastStatus(data);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Falha ao consultar status do Owncast.', error);
        }
      }
    };

    fetchStatus();
    const intervalId = window.setInterval(fetchStatus, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const isLive = owncastStatus?.online ?? broadcast.isLive;
  const liveLabel = isLive ? 'Ao vivo agora' : 'Estúdio offline';

  const embedUrl = useMemo(() => {
    if (!streamSource || typeof window === 'undefined') {
      return '';
    }
    try {
      const parsed = new URL(streamSource, window.location.origin);
      if (!parsed.pathname.startsWith('/hls/')) {
        return '';
      }
      parsed.pathname = '/embed/video';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch (error) {
      console.warn('Não foi possível derivar a URL de incorporação do Owncast.', error);
      return '';
    }
  }, [streamSource]);

  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const highlights = [
    { title: 'Siga no Instagram', description: '@radio_royal' },
    { title: 'WhatsApp da rádio', description: '(11) 99999-0000' },
    { title: 'Envie sua faixa', description: 'demo@radioroyal.fm' }
  ];

  useEffect(() => {
    const player = audioRef.current;
    if (!player) {
      return () => {};
    }

    let cleanupInteraction = null;

    if (!streamSource) {
      player.pause();
      player.removeAttribute('src');
      player.load?.();
      setAutoplayBlocked(false);
      return () => {};
    }

    if (!player.crossOrigin) {
      player.crossOrigin = 'anonymous';
    }

    if (player.dataset.streamSource !== streamSource) {
      player.src = streamSource;
      player.dataset.streamSource = streamSource;
      player.load?.();
    }

    if (isLive) {
      const attemptPlay = () =>
        player
          .play()
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch((error) => {
            if (error?.name === 'NotAllowedError') {
              setAutoplayBlocked(true);
              const unlock = () => {
                player
                  .play()
                  .then(() => {
                    setAutoplayBlocked(false);
                  })
                  .catch(() => {});
              };
              window.addEventListener('click', unlock, { once: true });
              window.addEventListener('keydown', unlock, { once: true });
              window.addEventListener('touchstart', unlock, { once: true });
              cleanupInteraction = () => {
                window.removeEventListener('click', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
              };
            } else {
              console.warn('Falha ao reproduzir stream público.', error);
            }
          });

      attemptPlay();
    } else {
      player.pause();
    }

    return () => {
      if (cleanupInteraction) {
        cleanupInteraction();
      }
    };
  }, [isLive, streamSource]);

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="container-xl public-header__inner">
          <div className="public-logo">
            <span className="public-logo__brand">Radio Royal</span>
            <span className="public-logo__tag">Broadcast</span>
          </div>
          <div className="public-header__actions">
            <a className="btn-ghost" href={streamSource} target="_blank" rel="noreferrer">
              Ouvir no próprio player
            </a>
            <Link to="/admin" className="btn btn-outline-light btn-sm">
              Área administrativa
            </Link>
          </div>
        </div>
      </header>

      <main className="container-xl public-main">
        <section className="public-hero-grid" aria-label="Status da transmissão">
          <article className="hero-card hero-card--live">
            <span className={`live-pill ${isLive ? '' : 'offline'}`}>
              {isLive ? 'Ao vivo' : 'Offline'}
            </span>
            <h1 className="hero-card__title">{broadcast.trackTitle}</h1>
            <p className="hero-card__subtitle">{broadcast.programName || 'Programação ao vivo'}</p>
            <div className="hero-card__meta">
              <div className="hero-card__meta-item">
                <span>Apresentação</span>
                <strong>{broadcast.hostName || 'Automação Royal'}</strong>
              </div>
              <div className="hero-card__meta-item">
                <span>Atualizado</span>
                <strong>{formatRelativeTime(broadcast.updatedAt)}</strong>
              </div>
              <div className="audio-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>

          <article className="hero-card">
            <h2 className="hero-card__subtitle">{liveLabel}</h2>
            <p>
              {isLive
                ? 'Conecte-se agora à transmissão com latência ultrabaixa direto do nosso estúdio.'
                : 'Estamos preparando o próximo bloco. Deixe a aba aberta para ser notificado quando começarmos.'}
            </p>
            {isLive && embedUrl ? (
              <div className="public-embed">
                <iframe
                  src={embedUrl}
                  title="Transmissão Owncast"
                  allowFullScreen
                  allow="autoplay; picture-in-picture"
                  style={{ border: 0, width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div className="public-empty" role="status">
                <strong>Estúdio offline</strong>
                Aguardando o início da transmissão. Fique por perto!
              </div>
            )}
            {streamSource && (
              <div className="public-player-audio">
                <audio ref={audioRef} controls preload="none" data-stream-source="" />
                {autoplayBlocked && (
                  <p className="text-warning small mt-2 mb-0">
                    Toque no player para liberar o áudio no seu dispositivo.
                  </p>
                )}
              </div>
            )}
            {broadcast.sourceUrl && (
              <p className="studio-small mb-0">
                Fonte atual: <code>{broadcast.sourceUrl}</code>
              </p>
            )}
          </article>

          <article className="hero-card hero-card--meta">
            <h2 className="hero-card__subtitle">Acessos rápidos</h2>
            <div className="hero-card__meta">
              <div className="hero-card__meta-item">
                <span>URL do stream</span>
                <strong>{streamHost || 'Indefinido'}</strong>
              </div>
              <div className="hero-card__meta-item">
                <span>Copiar link</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard && streamSource) {
                      navigator.clipboard.writeText(streamSource).catch(() => {});
                    }
                  }}
                >
                  Copiar URL HLS
                </button>
              </div>
              <a className="btn btn-primary" href={streamSource} target="_blank" rel="noreferrer">
                Abrir stream em outra janela
              </a>
            </div>
          </article>
        </section>

        <section className="public-grid" id="programacao">
          <article className="public-card">
            <h2>Na programação</h2>
            <p>Acompanhe a fila configurada pelo estúdio em tempo real.</p>
            {playlist.length ? (
              <ul className="public-timeline">
                {playlist.map((item) => (
                  <li
                    key={item.id}
                    className={`public-timeline__item ${item.active ? 'active' : ''}`}
                  >
                    <span className="public-timeline__marker" aria-hidden="true" />
                    <div className="public-timeline__content">
                      <p className="public-timeline__title">{item.title}</p>
                      <span className="public-timeline__badge">
                        {item.active ? 'No ar' : 'Na fila'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="public-empty">
                <strong>Nenhuma faixa agendada</strong>
                Aguarde novidades do estúdio. Atualizamos a fila o tempo todo!
              </div>
            )}
          </article>

          <article className="public-card">
            <h2>Converse com a gente</h2>
            <p>Participe ao vivo enviando suas mensagens e pedindo suas faixas preferidas.</p>
            {broadcast.chatEmbedUrl ? (
              <div className="public-embed" style={{ aspectRatio: '9 / 16' }}>
                <iframe
                  title="Chat da transmissão"
                  src={broadcast.chatEmbedUrl}
                  allow="autoplay; clipboard-write; encrypted-media"
                  style={{ border: 0, width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <PublicChat />
            )}
          </article>
        </section>

        <section className="public-card">
          <h2>Fique por perto</h2>
          <p>Escolha o seu canal favorito para acompanhar todas as novidades da Royal.</p>
          <div className="public-highlight-grid">
            {highlights.map((highlight) => (
              <div className="public-highlight-card" key={highlight.title}>
                <h3>{highlight.title}</h3>
                <span>{highlight.description}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="container-xl public-footer__inner">
          <span>© {new Date().getFullYear()} Radio Royal. Todos os direitos reservados.</span>
          <span>Produção independente • Streaming ao vivo 24/7</span>
        </div>
      </footer>
    </div>
  );
}
