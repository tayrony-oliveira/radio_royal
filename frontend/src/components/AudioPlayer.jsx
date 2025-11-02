import { forwardRef, useEffect, useRef } from 'react';
import LevelMeter from './LevelMeter.jsx';

const AudioPlayer = forwardRef(function AudioPlayer(
  {
    title,
    playlist,
    currentTrackIndex,
    onSelectTrack,
    playing,
    onTogglePlay,
    volume,
    onVolumeChange,
    analyser,
    registerElement,
    onNextTrack,
    onPreviousTrack
  },
  ref
) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.crossOrigin = 'anonymous';
    const cleanup = registerElement?.(audioRef.current);
    if (typeof ref === 'function') {
      ref(audioRef.current);
    } else if (ref) {
      ref.current = audioRef.current;
    }
    return cleanup;
  }, [ref, registerElement]);

  const track = playlist[currentTrackIndex] || null;

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (track) {
      const currentSrc = audioRef.current.getAttribute('src');
      if (currentSrc !== track.url) {
        audioRef.current.src = track.url;
        audioRef.current.load();
      }
      if (playing) {
        audioRef.current
          .play()
          .catch((error) => {
            console.warn('Falha ao iniciar reprodução da faixa.', error);
          });
      }
    } else {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [playing, track]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (!playing) {
      audioRef.current.pause();
    } else {
      audioRef.current
        .play()
        .catch((error) => {
          console.warn('Falha ao iniciar reprodução da faixa.', error);
        });
    }
  }, [playing]);

  return (
    <section className="audio-player">
      <header className="audio-player__header">
        <h2>{title}</h2>
        <LevelMeter analyser={analyser} label={`Nível de ${title}`} />
      </header>
      <div className="audio-player__controls">
        <button type="button" onClick={onPreviousTrack} disabled={!playlist.length}>
          ◀︎
        </button>
        <button type="button" onClick={onTogglePlay} disabled={!track}>
          {playing ? 'Pausar' : 'Tocar'}
        </button>
        <button type="button" onClick={onNextTrack} disabled={!playlist.length}>
          ▶︎
        </button>
      </div>
      <div className="audio-player__info">
        {track ? (
          <>
            <strong>{track.title}</strong>
            <small>{track.url}</small>
          </>
        ) : (
          <p>Selecione uma faixa para começar.</p>
        )}
      </div>
      <label className="audio-player__slider">
        Volume: {Math.round(volume * 100)}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </label>
      <div className="audio-player__playlist">
        <h3>Playlist</h3>
        {playlist.length ? (
          <ul>
            {playlist.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={index === currentTrackIndex ? 'is-active' : ''}
                  onClick={() => onSelectTrack(index)}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Adicione faixas na playlist.</p>
        )}
      </div>
      <audio ref={audioRef} preload="auto" />
    </section>
  );
});

export default AudioPlayer;
