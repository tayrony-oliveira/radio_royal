import { useState } from 'react';

export default function PlaylistManager({
  title,
  playlist,
  onAddTrack,
  onRemoveTrack,
  onSelectTrack,
  activeId,
  ctaLabel = 'Adicionar faixa'
}) {
  const [form, setForm] = useState({ title: '', url: '' });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      return;
    }
    onAddTrack({
      title: form.title.trim(),
      url: form.url.trim()
    });
    setForm({ title: '', url: '' });
  };

  return (
    <div className="studio-playlist">
      <div className="studio-playlist__header">
        <div>
          <h3 className="studio-playlist__title">{title}</h3>
          <p className="studio-playlist__subtitle">
            Insira faixas diretas (MP3/AAC) com CORS liberado para mixagem em tempo real.
          </p>
        </div>
      </div>

      <form className="studio-playlist__form" onSubmit={handleSubmit}>
        <label className="studio-label">
          Título
          <input
            className="studio-input"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Nome da faixa"
            required
          />
        </label>
        <label className="studio-label">
          URL (MP3/stream)
          <input
            className="studio-input"
            type="url"
            value={form.url}
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="https://"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary studio-playlist__submit">
          {ctaLabel}
        </button>
      </form>

      {playlist.length ? (
        <ul className="studio-playlist__list">
          {playlist.map((track, index) => {
            const isActive = activeId && activeId === track.id;
            return (
              <li
                key={track.id}
                className={`studio-playlist__item ${isActive ? 'studio-playlist__item--active' : ''}`}
              >
                <div className="studio-playlist__meta">
                  <span className="studio-playlist__index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="studio-playlist__info">
                    <strong>{track.title}</strong>
                    <span>{track.url}</span>
                  </div>
                </div>
                <div className="studio-playlist__actions">
                  {onSelectTrack ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onSelectTrack(index)}
                    >
                      Tocar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    onClick={() => onRemoveTrack(track.id)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="studio-playlist__empty">
          <strong>Nenhuma faixa cadastrada.</strong>
          Adicione tracks para este canal e deixe tudo preparado para o próximo bloco.
        </div>
      )}
    </div>
  );
}
