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
    <div className="bg-dark-subtle min-vh-100 public-radio">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-semibold">Radio Royal</span>
          <div className="d-flex gap-2">
            <Link to="/admin" className="btn btn-outline-light btn-sm">
              Área administrativa
            </Link>
          </div>
        </div>
      </nav>

      <main className="container py-5 d-flex flex-column gap-4">
        <section className="public-hero text-white">
          <div className="row align-items-center g-4">
            <div className="col-12 col-lg-6">
              <h1 className="display-6 fw-semibold">Agora na Royal</h1>
              <p className="lead mb-4">{broadcast.programName || 'Programação ao vivo'}</p>
              <div className="card border-0 bg-dark bg-opacity-25 text-white mb-4">
                <div className="card-body d-flex flex-column gap-2">
                  <span className="text-uppercase small text-white-50">Faixa atual</span>
                  <strong className="fs-4">{broadcast.trackTitle}</strong>
                  {broadcast.hostName ? (
                    <span className="text-white-50">Com {broadcast.hostName}</span>
                  ) : (
                    <span className="text-white-50">Apresentação automática</span>
                  )}
                  <small className="text-white-50">
                    Atualizado {formatRelativeTime(broadcast.updatedAt)}
                  </small>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <a className="btn btn-primary btn-lg" href={streamSource} target="_blank" rel="noreferrer">
                  Abrir stream em outra janela
                </a>
                <div className="d-flex flex-column">
                  <span className="small text-white-50">URL do stream</span>
                  <code className="text-white-50 small text-wrap">{streamSource}</code>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-lg public-player">
                <div className="card-body">
                  <h2 className="h5 text-dark">Ouça agora</h2>
                  <p className="text-muted">
                    {isLive ? 'Transmissão ao vivo!' : 'Aguardando início da transmissão...'}
                  </p>
                  {isLive && embedUrl ? (
                    <div className="ratio ratio-16x9">
                      <iframe
                        src={embedUrl}
                        title="Owncast"
                        allowFullScreen
                        allow="autoplay; picture-in-picture"
                        style={{ backgroundColor: '#000' }}
                      />
                    </div>
                  ) : (
                    <div className="alert alert-info mb-0">
                      O estúdio está offline no momento. Aguarde o início da próxima transmissão!
                    </div>
                  )}
                  {streamSource && (
                    <div className="mt-3">
                      <audio ref={audioRef} controls className="w-100" preload="none" data-stream-source="" />
                      {autoplayBlocked && (
                        <p className="text-warning small mt-2 mb-0">
                          Clique no player para liberar o áudio da transmissão.
                        </p>
                      )}
                    </div>
                  )}
                  {broadcast.sourceUrl && (
                    <p className="text-muted small mt-2 mb-0">
                      Fonte atual: <code>{broadcast.sourceUrl}</code>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex flex-column gap-4">
                <div>
                  <h2 className="h5 mb-1">Na programação</h2>
                  <p className="text-muted mb-0">
                    Acompanhe a fila configurada pelo estúdio em tempo real.
                  </p>
                </div>
                {playlist.length ? (
                  <ul className="list-group list-group-flush">
                    {playlist.map((item) => (
                      <li
                        key={item.id}
                        className={`list-group-item d-flex justify-content-between align-items-center ${
                          item.active ? 'list-group-item-primary fw-semibold' : ''
                        }`}
                      >
                        <span className="text-truncate me-2">{item.title}</span>
                        <span className={`badge ${item.active ? 'bg-primary text-white' : 'bg-secondary-subtle text-secondary'}`}>
                          {item.active ? 'Agora' : 'Na fila'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0">Fila vazia no momento. Aguarde novidades do estúdio!</p>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            {broadcast.chatEmbedUrl ? (
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div>
                    <h2 className="h5 mb-1">Chat incorporado</h2>
                    <p className="text-muted mb-0">Interaja diretamente no serviço escolhido.</p>
                  </div>
                  <div className="ratio ratio-16x9">
                    <iframe title="Chat da transmissão" src={broadcast.chatEmbedUrl} allow="autoplay; clipboard-write" />
                  </div>
                </div>
              </div>
            ) : (
              <PublicChat />
            )}
          </div>
        </section>

        <section className="card border-0 shadow-sm">
          <div className="card-body">
            <h2 className="h5 mb-3">Fique por dentro</h2>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="public-highlight p-3 rounded">
                  <h3 className="h6">Siga no Instagram</h3>
                  <p className="mb-0 text-muted">@radio_royal</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="public-highlight p-3 rounded">
                  <h3 className="h6">WhatsApp da rádio</h3>
                  <p className="mb-0 text-muted">(11) 99999-0000</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="public-highlight p-3 rounded">
                  <h3 className="h6">Envie sua faixa</h3>
                  <p className="mb-0 text-muted">demo@radioroyal.fm</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-dark text-white-50 py-4">
        <div className="container d-flex flex-column flex-lg-row justify-content-between gap-2">
          <span>© {new Date().getFullYear()} Radio Royal. Todos os direitos reservados.</span>
          <span>Produção independente • Streaming ao vivo 24/7</span>
        </div>
      </footer>
    </div>
  );
}
