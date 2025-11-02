import { useState } from 'react';

const emptyForm = {
  title: '',
  url: '',
  target: 'background'
};

export default function PlaylistManager({ playlists, onAddTrack, onRemoveTrack }) {
  const [form, setForm] = useState(emptyForm);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title || !form.url) {
      return;
    }
    onAddTrack(form.target, {
      title: form.title,
      url: form.url
    });
    setForm(emptyForm);
  };

  return (
    <section className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-4">
        <div>
          <h2 className="h5 mb-3">Gerenciar Playlists</h2>
          <form onSubmit={handleSubmit} className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Título</label>
              <input
                type="text"
                className="form-control"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">URL (MP3 ou streaming com CORS liberado)</label>
              <input
                type="url"
                className="form-control"
                value={form.url}
                placeholder="https://"
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                required
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Destino</label>
              <select
                className="form-select"
                value={form.target}
                onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
              >
                <option value="background">Player de fundo</option>
                <option value="main">Player principal</option>
              </select>
            </div>
            <div className="col-12 col-md-6 d-flex align-items-end">
              <button type="submit" className="btn btn-primary w-100">
                Adicionar faixa
              </button>
            </div>
          </form>
        </div>

        <div className="row g-3">
          {['background', 'main'].map((key) => (
            <div key={key} className="col-12 col-md-6">
              <h3 className="h6">
                {key === 'background' ? 'Playlist de fundo' : 'Playlist principal'}
              </h3>
              {playlists[key].length ? (
                <div className="list-group">
                  {playlists[key].map((track) => (
                    <div key={track.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <span className="me-2 text-truncate">{track.title}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onRemoveTrack(key, track.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">Nenhuma faixa cadastrada.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
