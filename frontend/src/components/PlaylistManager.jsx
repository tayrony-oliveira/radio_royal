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
    <section className="playlist-manager">
      <h2>Gerenciar Playlists</h2>
      <form onSubmit={handleSubmit} className="playlist-manager__form">
        <label>
          Título
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
        </label>
        <label>
          URL (MP3 ou streaming com CORS liberado)
          <input
            type="url"
            value={form.url}
            placeholder="https://"
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            required
          />
        </label>
        <label>
          Destino
          <select
            value={form.target}
            onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
          >
            <option value="background">Player de fundo</option>
            <option value="main">Player principal</option>
          </select>
        </label>
        <button type="submit">Adicionar faixa</button>
      </form>
      <div className="playlist-manager__lists">
        {['background', 'main'].map((key) => (
          <div key={key} className="playlist-manager__list">
            <h3>{key === 'background' ? 'Fundo' : 'Principal'}</h3>
            {playlists[key].length ? (
              <ul>
                {playlists[key].map((track) => (
                  <li key={track.id}>
                    <span>{track.title}</span>
                    <button type="button" onClick={() => onRemoveTrack(key, track.id)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma faixa cadastrada.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
