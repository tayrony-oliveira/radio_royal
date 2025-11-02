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

export default function PublicRadio() {
  const { metadata } = useBroadcastMetadata();
  const fallback = getStoredBroadcast();
  const broadcast = metadata ?? fallback;

  const streamSource = broadcast.streamUrl?.trim() ? broadcast.streamUrl : fallback.streamUrl;
  const playlist = Array.isArray(broadcast.playlist) && broadcast.playlist.length
    ? broadcast.playlist
    : [];

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
                    Clique em play para acompanhar a transmissão ao vivo.
                  </p>
                  <audio controls className="w-100" preload="none" src={streamSource} />
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
