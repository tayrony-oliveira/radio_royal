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
    <section className="youtube-panel">
      <h2>YouTube (somente monitoramento)</h2>
      <p>
        O player abaixo utiliza a YouTube IFrame API. Eventos de play/pause são capturados para que
        você integre o estado da transmissão. O áudio do YouTube não pode ser roteado para o mix por
        limitações de CORS.
      </p>
      <label>
        URL ou ID do vídeo
        <input value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
      </label>
      {videoUrl ? (
        <ReactPlayer
          className="youtube-panel__player"
          url={videoUrl}
          controls
          playing={false}
          onPlay={() => appendEvent('play')}
          onPause={() => appendEvent('pause')}
        />
      ) : (
        <p>Informe uma URL ou ID válido do YouTube.</p>
      )}
      <div className="youtube-panel__events">
        <h3>Eventos recentes</h3>
        {events.length ? (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.type}</strong> - {event.timestamp}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum evento registrado.</p>
        )}
      </div>
    </section>
  );
}
