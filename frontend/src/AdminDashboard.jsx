import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AudioPlayer from './components/AudioPlayer.jsx';
import MicrophoneControl from './components/MicrophoneControl.jsx';
import MixOutput from './components/MixOutput.jsx';
import PlaylistManager from './components/PlaylistManager.jsx';
import StreamRelayControl from './components/StreamRelayControl.jsx';
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
  const hostnamePlaceholder = useMemo(
    () => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
    []
  );

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
        ...prev,
        trackTitle: 'Nenhuma faixa em reprodução',
        sourceUrl: ''
      }));
      return;
    }
    updateMetadata((prev) => ({
      ...prev,
      trackTitle: mainTrack.title,
      sourceUrl: mainTrack.url
    }));
  }, [mainTrack?.id, mainTrack?.title, mainTrack?.url, updateMetadata]);

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

  const handleLiveStateChange = useCallback(
    (live) => {
      updateMetadata((prev) => ({
        ...prev,
        isLive: live
      }));
    },
    [updateMetadata]
  );

  return (
    <div className="studio-app">
      <aside className="studio-sidebar">
        <div className="studio-logo">
          <strong>Radio Royal</strong>
          <span>Studio</span>
        </div>
        <nav className="studio-sidebar__nav">
          <a className="studio-sidebar__link" href="#public-info">
            Metadados públicos
          </a>
          <a className="studio-sidebar__link" href="#broadcast">
            Transmissão Owncast
          </a>
          <a className="studio-sidebar__link" href="#players">
            Mixer & Players
          </a>
          <a className="studio-sidebar__link" href="#microphone">
            Microfone & Saída
          </a>
          <a className="studio-sidebar__link" href="#playlists">
            Playlists
          </a>
          <a className="studio-sidebar__link" href="#extras">
            YouTube & notas
          </a>
        </nav>
        <div className="studio-sidebar__status">
          <span>Status: <strong>{metadata.isLive ? 'Transmitindo' : 'Offline'}</strong></span>
          <span>Última atualização: {formatRelativeTime(metadata.updatedAt)}</span>
        </div>
      </aside>

      <div className="studio-main">
        <header className="studio-header">
          <div className="container-xl studio-header__inner">
            <div>
              <h1 className="studio-title">Central do estúdio</h1>
              <p className="studio-subtitle">
                Ajuste players, microfone e transmissão Owncast em tempo real sem sair do navegador.
              </p>
            </div>
            <Link to="/" className="btn btn-outline-light btn-sm">
              Ver página pública
            </Link>
          </div>
        </header>

        <div className="studio-content container-xl">
          {statusMessages.length > 0 && (
            <div className="studio-alerts" role="status">
              {statusMessages.map((message) => (
                <div key={message} className="studio-alert">
                  {message}
                </div>
              ))}
            </div>
          )}

          <section id="public-info" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Informações públicas</h2>
                <p className="studio-section__description">
                  Campos exibidos na página da rádio e nos players externos conectados.
                </p>
              </div>
            </div>

            <form className="studio-form-grid" onSubmit={handleMetadataSubmit}>
              <label className="studio-label">
                Nome do locutor
                <input
                  className="studio-input"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Ex.: Dj Tay"
                />
              </label>
              <label className="studio-label">
                Programa ou quadro
                <input
                  className="studio-input"
                  value={programName}
                  onChange={(event) => setProgramName(event.target.value)}
                  placeholder="Ex.: Royal Hits"
                />
              </label>
              <label className="studio-label">
                URL do stream público
                <input
                  className="studio-input"
                  type="url"
                  value={streamUrl}
                  onChange={(event) => setStreamUrl(event.target.value)}
                  placeholder={`http://${hostnamePlaceholder}:8080/hls/stream.m3u8`}
                />
                <span className="studio-small">
                  Endereço HLS entregue pelo Owncast (ex.: http://servidor:8080/hls/stream.m3u8).
                </span>
              </label>
              <label className="studio-label">
                URL do chat incorporado (opcional)
                <input
                  className="studio-input"
                  type="url"
                  value={chatEmbedUrl}
                  onChange={(event) => setChatEmbedUrl(event.target.value)}
                  placeholder="https://iframe.chat/"
                />
                <span className="studio-small">
                  YouTube, Twitch, Discord ou qualquer serviço que ofereça um iframe público.
                </span>
              </label>
              <div className="studio-actions">
                <button type="submit" className="btn btn-primary">
                  Atualizar página pública
                </button>
              </div>
            </form>
          </section>

          <section id="broadcast" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Transmissão Owncast</h2>
                <p className="studio-section__description">
                  Configure o relay WebSocket, acompanhe os logs do FFmpeg e mantenha a ingestão estável.
                </p>
              </div>
            </div>
            <StreamRelayControl stream={mixer.mixStream} onLiveStateChange={handleLiveStateChange} />
          </section>

          <section id="players" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Mixer digital</h2>
                <p className="studio-section__description">
                  Controle trilhas de fundo e faixas principais com medidores em tempo real.
                </p>
              </div>
            </div>
            <div className="row g-4">
              <div className="col-12 col-xl-6">
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
              <div className="col-12 col-xl-6">
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
            </div>
          </section>

          <section id="microphone" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Microfone & saída final</h2>
                <p className="studio-section__description">
                  Ajuste o ganho do microfone, monitore o master e exporte o mix para verificação.
                </p>
              </div>
            </div>
            <div className="row g-4">
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
            </div>
          </section>

          <section id="playlists" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Playlists e programação</h2>
                <p className="studio-section__description">
                  Mantenha suas listas organizadas e alterne rapidamente entre faixas e trilhas.
                </p>
              </div>
            </div>
            <div className="row g-4">
              <div className="col-12 col-xl-6">
                <PlaylistManager
                  title="Trilhas de Fundo"
                  playlist={backgroundPlaylist}
                  onAddTrack={(track) => handleAddTrack('background', track)}
                  onRemoveTrack={(id) => handleRemoveTrack('background', id)}
                  onSelectTrack={selectBackgroundTrack}
                  activeId={backgroundTrack?.id || null}
                />
              </div>
              <div className="col-12 col-xl-6">
                <PlaylistManager
                  title="Faixas Principais"
                  playlist={mainPlaylist}
                  onAddTrack={(track) => handleAddTrack('main', track)}
                  onRemoveTrack={(id) => handleRemoveTrack('main', id)}
                  onSelectTrack={selectMainTrack}
                  activeId={mainTrack?.id || null}
                />
              </div>
            </div>
          </section>

          <section id="extras" className="studio-section">
            <div className="studio-section__header">
              <div>
                <h2 className="studio-section__title">Live extras</h2>
                <p className="studio-section__description">
                  Integre transmissões externas, playlists automáticas e notas operacionais.
                </p>
              </div>
            </div>
            <div className="row g-4">
              <div className="col-12 col-xl-6">
                <YouTubePanel />
              </div>
              <div className="col-12 col-xl-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column gap-3">
                    <h3 className="h5 mb-0">Observações rápidas</h3>
                    <p className="text-muted mb-0">
                      Permissões de microfone e autoplay variam entre navegadores. Prefira URLs com
                      CORS liberado e evite conteúdos com DRM.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="studio-footer container-xl">
          Radio Royal • Estúdio web em tempo real powered by Web Audio API & Owncast.
        </footer>
      </div>
    </div>
  );
}
