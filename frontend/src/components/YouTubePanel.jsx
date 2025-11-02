import { useMemo, useState } from 'react';
import ReactPlayer from 'react-player/youtube';

function extractVideoId(value) {
  if (!value) {
    return '';
  }

  const url = value.trim();
  const directIdMatch = url.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directIdMatch) {
    return directIdMatch[0];
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu')) {
      if (parsed.searchParams.get('v')) {
        return parsed.searchParams.get('v');
      }
      const segments = parsed.pathname.split('/');
      return segments.pop() || segments.pop() || '';
    }
  } catch (error) {
    return '';
  }

  return '';
}

export default function YouTubePanel() {
  const [inputValue, setInputValue] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [events, setEvents] = useState([]);

  const videoId = useMemo(() => extractVideoId(inputValue), [inputValue]);
  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';

  const appendEvent = (type) => {
    setEvents((previous) => [
      { id: Date.now(), type, timestamp: new Date().toLocaleTimeString() },
      ...previous
    ]);
  };

  return (
    <section className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <div>
          <h2 className="h5 mb-2">YouTube (somente monitoramento)</h2>
          <p className="text-muted mb-0">
            O player abaixo utiliza a YouTube IFrame API. Eventos de play/pause são capturados para
            que você integre o estado da transmissão. O áudio do YouTube não pode ser roteado para o
            mix por limitações de CORS.
          </p>
        </div>
        <div>
          <label className="form-label fw-semibold">URL ou ID do vídeo</label>
          <input
            className="form-control"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
        </div>
        {videoUrl ? (
          <div className="ratio ratio-16x9">
            <ReactPlayer
              className="w-100 h-100"
              url={videoUrl}
              controls
              playing={false}
              onPlay={() => appendEvent('play')}
              onPause={() => appendEvent('pause')}
            />
          </div>
        ) : (
          <p className="text-muted mb-0">Informe uma URL ou ID válido do YouTube.</p>
        )}
        <div>
          <h3 className="h6">Eventos recentes</h3>
          {events.length ? (
            <ul className="list-group">
              {events.map((event) => (
                <li key={event.id} className="list-group-item d-flex justify-content-between">
                  <strong className="text-capitalize">{event.type}</strong>
                  <span className="text-muted">{event.timestamp}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-0">Nenhum evento registrado.</p>
          )}
        </div>
      </div>
    </section>
  );
}
