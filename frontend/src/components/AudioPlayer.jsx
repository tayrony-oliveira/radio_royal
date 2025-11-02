import { forwardRef, useEffect, useRef, useState } from 'react';
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
  const seekingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

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
    if (!track) {
      setDuration(0);
      setCurrentTime(0);
    }
  }, [track]);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const syncDuration = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const syncTime = () => {
      if (!seekingRef.current) {
        setCurrentTime(audio.currentTime || 0);
      }
    };

    const handleEnded = () => {
      setCurrentTime(audio.duration || 0);
    };

    syncDuration();
    syncTime();

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [track]);

  const formatTime = (value) => {
    if (!Number.isFinite(value) || value < 0) {
      return '00:00';
    }
    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const seekKeys = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    ' ',
    'Enter'
  ]);

  const handleSeekStart = (event) => {
    if (event?.type === 'keydown' && !seekKeys.has(event.key)) {
      return;
    }
    seekingRef.current = true;
    setIsSeeking(true);
  };

  const handleSeekChange = (event) => {
    const value = Number(event.target.value);
    setCurrentTime(value);
    if (!seekingRef.current) {
      commitSeek(value);
    }
  };

  const commitSeek = (value) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = value;
    if (playing) {
      audio
        .play()
        .catch((error) => {
          console.warn('Falha ao retomar reprodução após seek.', error);
        });
    }
  };

  const handleSeekEnd = (event) => {
    if (event?.type === 'keyup' && !seekKeys.has(event.key)) {
      return;
    }
    const value = Number(event.target.value);
    seekingRef.current = false;
    setIsSeeking(false);
    commitSeek(value);
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progressValue = safeDuration ? Math.min(currentTime, safeDuration) : 0;
  const progressPercent = safeDuration ? Math.round((progressValue / safeDuration) * 100) : 0;

  return (
    <section className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <header className="d-flex flex-column flex-lg-row gap-3 align-items-lg-center">
          <div className="flex-grow-1">
            <h2 className="h5 mb-1">{title}</h2>
            <p className="text-muted mb-0">
              {track ? track.title : 'Selecione uma faixa para começar'}
            </p>
          </div>
          <div className="flex-grow-1">
            <LevelMeter analyser={analyser} label={`Nível de ${title}`} />
          </div>
        </header>

        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between text-muted small audio-progress__time">
            <span>{formatTime(progressValue)}</span>
            <span>{formatTime(safeDuration)}</span>
          </div>
          <input
            type="range"
            className="form-range"
            min="0"
            max={safeDuration || 0}
            step="0.1"
            value={safeDuration ? progressValue : 0}
            disabled={!track || !safeDuration}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            onKeyDown={handleSeekStart}
            onKeyUp={handleSeekEnd}
          />
          <div className="progress audio-progress" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
            <div
              className={`progress-bar ${isSeeking ? 'bg-warning' : 'bg-primary'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-primary flex-fill"
            onClick={onPreviousTrack}
            disabled={!playlist.length}
          >
            ◀︎ Anterior
          </button>
          <button
            type="button"
            className="btn btn-primary flex-fill"
            onClick={onTogglePlay}
            disabled={!track}
          >
            {playing ? 'Pausar' : 'Tocar'}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary flex-fill"
            onClick={onNextTrack}
            disabled={!playlist.length}
          >
            Próxima ▶︎
          </button>
        </div>

        <div>
          {track ? (
            <small className="text-muted d-block text-truncate">{track.url}</small>
          ) : (
            <small className="text-muted">Nenhuma URL selecionada.</small>
          )}
        </div>

        <div>
          <label className="form-label fw-semibold">
            Volume: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            className="form-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </div>

        <div className="flex-grow-1">
          <h3 className="h6">Playlist</h3>
          {playlist.length ? (
            <div className="list-group">
              {playlist.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={`list-group-item list-group-item-action ${
                    index === currentTrackIndex ? 'active' : ''
                  }`}
                  onClick={() => onSelectTrack(index)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted mb-0">Adicione faixas na playlist.</p>
          )}
        </div>
      </div>
      <audio ref={audioRef} preload="auto" className="d-none" />
    </section>
  );
});

export default AudioPlayer;
