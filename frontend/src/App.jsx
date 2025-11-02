import { useCallback, useEffect, useMemo, useState } from 'react';
import AudioPlayer from './components/AudioPlayer.jsx';
import MicrophoneControl from './components/MicrophoneControl.jsx';
import MixOutput from './components/MixOutput.jsx';
import PlaylistManager from './components/PlaylistManager.jsx';
import YouTubePanel from './components/YouTubePanel.jsx';
import { useAudioMixer } from './hooks/useAudioMixer.js';
import { DEMO_TRACKS } from './data/demoTracks.js';

const STORAGE_KEY = 'radio-royal-settings';

const DEFAULT_PLAYLISTS = {
  background: [DEMO_TRACKS.background],
  main: [DEMO_TRACKS.main]
};

function ensureIds(tracks) {
  return tracks.map((track) => ({
    ...track,
    id: track.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
  }));
}

export default function App() {
  const mixer = useAudioMixer();
  const [playlists, setPlaylists] = useState(() => ({
    background: ensureIds(DEFAULT_PLAYLISTS.background),
    main: ensureIds(DEFAULT_PLAYLISTS.main)
  }));
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [mainIndex, setMainIndex] = useState(0);
  const [backgroundPlaying, setBackgroundPlaying] = useState(false);
  const [mainPlaying, setMainPlaying] = useState(false);
  const [backgroundVolume, setBackgroundVolume] = useState(0.5);
  const [mainVolume, setMainVolume] = useState(0.8);
  const [microphoneVolume, setMicrophoneVolume] = useState(0.7);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPlaylists({
          background: ensureIds(parsed.playlists?.background || []),
          main: ensureIds(parsed.playlists?.main || [])
        });
        setBackgroundIndex(parsed.backgroundIndex || 0);
        setMainIndex(parsed.mainIndex || 0);
        setBackgroundVolume(parsed.backgroundVolume ?? 0.5);
        setMainVolume(parsed.mainVolume ?? 0.8);
        setMicrophoneVolume(parsed.microphoneVolume ?? 0.7);
      }
    } catch (error) {
      console.warn('Não foi possível carregar as configurações salvas.', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const payload = {
      playlists,
      backgroundIndex,
      mainIndex,
      backgroundVolume,
      mainVolume,
      microphoneVolume
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    playlists,
    backgroundIndex,
    mainIndex,
    backgroundVolume,
    mainVolume,
    microphoneVolume
  ]);

  useEffect(() => {
    mixer.setBackgroundVolume(backgroundVolume);
  }, [backgroundVolume, mixer]);

  useEffect(() => {
    mixer.setMainVolume(mainVolume);
  }, [mainVolume, mixer]);

  useEffect(() => {
    mixer.setMicrophoneVolume(microphoneVolume);
  }, [microphoneVolume, mixer]);

  useEffect(() => {
    if (!mixer.isContextReady) {
      return;
    }
    mixer.setBackgroundVolume(backgroundVolume);
    mixer.setMainVolume(mainVolume);
    mixer.setMicrophoneVolume(microphoneVolume);
  }, [
    backgroundVolume,
    mainVolume,
    microphoneVolume,
    mixer,
    mixer.isContextReady
  ]);

  const backgroundPlaylist = playlists.background;
  const mainPlaylist = playlists.main;

  const backgroundTrack = backgroundPlaylist[backgroundIndex];
  const mainTrack = mainPlaylist[mainIndex];

  const ensureAudioContext = useCallback(() => mixer.ensureContext?.(), [mixer]);

  const awaitContextThen = useCallback(
    (callback) => {
      const result = ensureAudioContext();
      if (result?.then) {
        result
          .catch((error) => {
            console.warn('Falha ao iniciar o contexto de áudio.', error);
          })
          .finally(() => {
            callback();
          });
      } else {
        callback();
      }
    },
    [ensureAudioContext]
  );

  const handleAddTrack = useCallback((target, track) => {
    setPlaylists((previous) => {
      const newTrack = {
        ...track,
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
      };
      return {
        ...previous,
        [target]: [...previous[target], newTrack]
      };
    });
  }, []);

  const handleRemoveTrack = useCallback((target, id) => {
    setPlaylists((previous) => {
      const filtered = previous[target].filter((track) => track.id !== id);
      const nextPlaylists = {
        ...previous,
        [target]: filtered
      };

      if (target === 'background') {
        setBackgroundIndex((index) => Math.min(index, Math.max(0, filtered.length - 1)));
        if (filtered.length === 0) {
          setBackgroundPlaying(false);
        }
      } else {
        setMainIndex((index) => Math.min(index, Math.max(0, filtered.length - 1)));
        if (filtered.length === 0) {
          setMainPlaying(false);
        }
      }

      return nextPlaylists;
    });
  }, []);

  const toggleBackgroundPlay = useCallback(() => {
    awaitContextThen(() => {
      setBackgroundPlaying((previous) => !previous);
    });
  }, [awaitContextThen]);

  const toggleMainPlay = useCallback(() => {
    awaitContextThen(() => {
      setMainPlaying((previous) => !previous);
    });
  }, [awaitContextThen]);

  const selectBackgroundTrack = useCallback(
    (index) => {
      awaitContextThen(() => {
        setBackgroundIndex(index);
        setBackgroundPlaying(true);
      });
    },
    [awaitContextThen]
  );

  const selectMainTrack = useCallback(
    (index) => {
      awaitContextThen(() => {
        setMainIndex(index);
        setMainPlaying(true);
      });
    },
    [awaitContextThen]
  );

  const navigateTrack = useCallback((playlist, currentIndex, direction) => {
    if (!playlist.length) {
      return 0;
    }
    const nextIndex = (currentIndex + direction + playlist.length) % playlist.length;
    return nextIndex;
  }, []);

  const nextBackground = useCallback(() => {
    awaitContextThen(() => {
      setBackgroundIndex((index) => navigateTrack(backgroundPlaylist, index, 1));
      setBackgroundPlaying(true);
    });
  }, [awaitContextThen, backgroundPlaylist, navigateTrack]);

  const prevBackground = useCallback(() => {
    awaitContextThen(() => {
      setBackgroundIndex((index) => navigateTrack(backgroundPlaylist, index, -1));
      setBackgroundPlaying(true);
    });
  }, [awaitContextThen, backgroundPlaylist, navigateTrack]);

  const nextMain = useCallback(() => {
    awaitContextThen(() => {
      setMainIndex((index) => navigateTrack(mainPlaylist, index, 1));
      setMainPlaying(true);
    });
  }, [awaitContextThen, mainPlaylist, navigateTrack]);

  const prevMain = useCallback(() => {
    awaitContextThen(() => {
      setMainIndex((index) => navigateTrack(mainPlaylist, index, -1));
      setMainPlaying(true);
    });
  }, [awaitContextThen, mainPlaylist, navigateTrack]);

  const statusMessages = useMemo(() => {
    if (mixer.contextError) {
      return [mixer.contextError];
    }
    const messages = [];
    if (!backgroundTrack) {
      messages.push('Adicione faixas ao player de fundo.');
    }
    if (!mainTrack) {
      messages.push('Adicione faixas ao player principal.');
    }
    return messages;
  }, [backgroundTrack, mainTrack, mixer.contextError]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Radio Royal Mixer</h1>
        <p>
          Misture trilhas de fundo, faixas principais e microfone utilizando a Web Audio API.
          Integre players externos e mantenha suas playlists salvas no navegador.
        </p>
      </header>
      {statusMessages.length > 0 && (
        <div className="app__status">
          {statusMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      <main className="app__layout">
        <div className="app__column">
          <AudioPlayer
            title="Player de Fundo"
            playlist={backgroundPlaylist}
            currentTrackIndex={backgroundIndex}
            onSelectTrack={selectBackgroundTrack}
            playing={backgroundPlaying}
            onTogglePlay={toggleBackgroundPlay}
            volume={backgroundVolume}
            onVolumeChange={setBackgroundVolume}
            analyser={mixer.backgroundAnalyser}
            registerElement={mixer.registerBackgroundElement}
            onNextTrack={nextBackground}
            onPreviousTrack={prevBackground}
          />
        </div>
        <div className="app__column">
          <AudioPlayer
            title="Player Principal"
            playlist={mainPlaylist}
            currentTrackIndex={mainIndex}
            onSelectTrack={selectMainTrack}
            playing={mainPlaying}
            onTogglePlay={toggleMainPlay}
            volume={mainVolume}
            onVolumeChange={setMainVolume}
            analyser={mixer.mainAnalyser}
            registerElement={mixer.registerMainElement}
            onNextTrack={nextMain}
            onPreviousTrack={prevMain}
          />
        </div>
      </main>
      <section className="app__secondary">
        <MicrophoneControl
          microphoneActive={mixer.microphoneActive}
          connectMicrophone={mixer.connectMicrophone}
          disconnectMicrophone={mixer.disconnectMicrophone}
          volume={microphoneVolume}
          onVolumeChange={setMicrophoneVolume}
          analyser={mixer.microphoneAnalyser}
        />
        <MixOutput stream={mixer.mixStream} />
      </section>
      <section className="app__footer">
        <PlaylistManager
          playlists={playlists}
          onAddTrack={handleAddTrack}
          onRemoveTrack={handleRemoveTrack}
        />
        <YouTubePanel />
      </section>
      <footer className="app__credits">
        <p>
          Permissões de microfone e reprodução automática variam entre navegadores. Utilize URLs com
          CORS habilitado para permitir roteamento de áudio. Conteúdo protegido por DRM não pode ser
          mixado com a abordagem utilizada.
        </p>
      </footer>
    </div>
  );
}
