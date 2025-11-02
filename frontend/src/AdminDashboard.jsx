import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AudioPlayer from './components/AudioPlayer.jsx';
import MicrophoneControl from './components/MicrophoneControl.jsx';
import MixOutput from './components/MixOutput.jsx';
import PlaylistManager from './components/PlaylistManager.jsx';
import YouTubePanel from './components/YouTubePanel.jsx';
import { useAudioMixer } from './hooks/useAudioMixer.js';
import { DEMO_TRACKS } from './data/demoTracks.js';
import { useBroadcastMetadata } from './hooks/useBroadcastMetadata.js';

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

export default function AdminDashboard() {
  const mixer = useAudioMixer();
  const { metadata, updateMetadata } = useBroadcastMetadata();

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

  const [hostName, setHostName] = useState(metadata.hostName || '');
  const [programName, setProgramName] = useState(metadata.programName || '');
  const [streamUrl, setStreamUrl] = useState(metadata.streamUrl || '');
  const [chatEmbedUrl, setChatEmbedUrl] = useState(metadata.chatEmbedUrl || '');

  useEffect(() => {
    setHostName(metadata.hostName || '');
    setProgramName(metadata.programName || '');
    setStreamUrl(metadata.streamUrl || '');
    setChatEmbedUrl(metadata.chatEmbedUrl || '');
  }, [metadata.hostName, metadata.programName, metadata.streamUrl, metadata.chatEmbedUrl]);

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

  useEffect(() => {
    if (!mainTrack) {
      updateMetadata((prev) => ({
        trackTitle: 'Nenhuma faixa em reprodução',
        sourceUrl: '',
        autoStreamUrl: '',
        isPlaying: false
      }));
      return;
    }
    updateMetadata((prev) => ({
      trackTitle: mainTrack.title,
      sourceUrl: mainTrack.url,
      autoStreamUrl: mainTrack.url,
      isPlaying: mainPlaying,
      streamUrl: prev.streamUrl || '',
      hostName: prev.hostName,
      programName: prev.programName
    }));
  }, [mainTrack?.id, mainTrack?.title, mainTrack?.url, mainPlaying, updateMetadata]);

  useEffect(() => {
    const queue = mainPlaylist.map((track, index) => ({
      id: track.id,
      title: track.title,
      url: track.url,
      active: index === mainIndex
    }));
    updateMetadata((previous) => ({
      ...previous,
      playlist: queue
    }));
  }, [mainPlaylist, mainIndex, updateMetadata]);

  const ensureAudioContext = useCallback(() => mixer.ensureContext?.(), [mixer]);

  const awaitContextThen = useCallback(
    (callback) => {
      const result = ensureAudioContext();
      if (result?.then) {
        result
          ?.catch((error) => {
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

  const handleMetadataSubmit = (event) => {
    event.preventDefault();
    updateMetadata({
      hostName,
      programName,
      streamUrl,
      chatEmbedUrl
    });
  };

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-semibold">Radio Royal • Painel</span>
          <div className="d-flex gap-2">
            <Link to="/" className="btn btn-outline-primary btn-sm">
              Ver página pública
            </Link>
          </div>
        </div>
      </nav>
      <div className="container py-4 d-flex flex-column gap-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h1 className="h4 mb-2">Radio Royal Mixer</h1>
            <p className="mb-0 text-muted">
              Misture trilhas de fundo, faixas principais e microfone utilizando a Web Audio API.
              Integre players externos e mantenha suas playlists salvas no navegador.
            </p>
          </div>
        </div>

        {statusMessages.length > 0 && (
          <div className="d-flex flex-column gap-2">
            {statusMessages.map((message) => (
              <div key={message} className="alert alert-warning mb-0" role="alert">
                {message}
              </div>
            ))}
          </div>
        )}

        <section className="card border-0 shadow-sm">
          <div className="card-body">
            <h2 className="h5 mb-3">Informações públicas da transmissão</h2>
            <form className="row g-3" onSubmit={handleMetadataSubmit}>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nome do locutor</label>
                <input
                  className="form-control"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Ex.: Dj Tay"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Programa ou quadro</label>
                <input
                  className="form-control"
                  value={programName}
                  onChange={(event) => setProgramName(event.target.value)}
                  placeholder="Ex.: Royal Hits"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">URL do stream público</label>
                <input
                  className="form-control"
                  type="url"
                  value={streamUrl}
                  onChange={(event) => setStreamUrl(event.target.value)}
                  placeholder="https://"
                />
                <small className="text-muted">
                  Informe o endpoint do seu encoder/servidor Icecast ou HLS.
                </small>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">URL do chat incorporado (opcional)</label>
                <input
                  className="form-control"
                  type="url"
                  value={chatEmbedUrl}
                  onChange={(event) => setChatEmbedUrl(event.target.value)}
                  placeholder="https://iframe.chat/"
                />
                <small className="text-muted">
                  Caso utilize um serviço externo (por exemplo, YouTube ou Discord), adicione o link de incorporação.
                </small>
              </div>
              <div className="col-12 text-end">
                <button type="submit" className="btn btn-primary">
                  Atualizar página pública
                </button>
              </div>
            </form>
          </div>
        </section>

        <main className="row g-4">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
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

        <section className="row g-4">
          <div className="col-12 col-lg-4">
            <MicrophoneControl
              microphoneActive={mixer.microphoneActive}
              connectMicrophone={mixer.connectMicrophone}
              disconnectMicrophone={mixer.disconnectMicrophone}
              volume={microphoneVolume}
              onVolumeChange={setMicrophoneVolume}
              analyser={mixer.microphoneAnalyser}
            />
          </div>
          <div className="col-12 col-lg-8">
            <MixOutput stream={mixer.mixStream} />
          </div>
        </section>

        <section className="row g-4">
          <div className="col-12 col-lg-6">
            <PlaylistManager
              playlists={playlists}
              onAddTrack={handleAddTrack}
              onRemoveTrack={handleRemoveTrack}
            />
          </div>
          <div className="col-12 col-lg-6">
            <YouTubePanel />
          </div>
        </section>

        <footer>
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <p className="mb-0 text-muted">
                Permissões de microfone e reprodução automática variam entre navegadores. Utilize
                URLs com CORS habilitado para permitir roteamento de áudio. Conteúdo protegido por
                DRM não pode ser mixado com a abordagem utilizada.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
