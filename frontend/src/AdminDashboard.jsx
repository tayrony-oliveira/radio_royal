import { useEffect, useMemo, useState } from "react";
import { useAudioMixer } from "./hooks/useAudioMixer.js";
import { useBroadcastMetadata } from "./hooks/useBroadcastMetadata.js";

const isYouTubeUrl = (value) => {
  try {
    const url = new URL(value);
    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be"
    ].includes(url.hostname);
  } catch (error) {
    return false;
  }
};

const normalizeYouTubeUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : value;
    }
    const videoId = url.searchParams.get("v");
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : value;
  } catch (error) {
    return value;
  }
};

const normalizeTrackUrl = (value, relayHttp) => {
  if (!value) return "";
  if (value.includes("/youtube?url=")) return value;
  if (isYouTubeUrl(value)) {
    const normalized = normalizeYouTubeUrl(value);
    return `${relayHttp}/youtube?url=${encodeURIComponent(normalized)}`;
  }
  return value;
};

const isPlaylistUrl = (value) => {
  try {
    const url = new URL(value);
    return url.searchParams.has("list");
  } catch (error) {
    return false;
  }
};

const fetchYouTubeTitle = async (relayHttp, url) => {
  const response = await fetch(
    `${relayHttp}/youtube/info?url=${encodeURIComponent(url)}`
  );
  if (!response.ok) {
    throw new Error("Falha ao obter titulo.");
  }
  const data = await response.json();
  return data.title || "";
};

const getTrackLabel = (value) => {
  if (!value) return "Nenhuma";
  try {
    const url = new URL(value);
    if (url.pathname === "/youtube" && url.searchParams.get("url")) {
      const original = url.searchParams.get("url");
      return `YouTube: ${original}`;
    }
    return url.toString();
  } catch (error) {
    return value;
  }
};

const isActiveTrack = (trackUrl, currentUrl) => {
  return trackUrl && currentUrl && trackUrl === currentUrl;
};

const getLibraryLabel = (trackUrl, library) => {
  if (!trackUrl) return "Nenhuma";
  const match = (library || []).find((item) => item.url === trackUrl);
  return match?.label || getTrackLabel(trackUrl);
};

const normalizePlaylistItems = (items) => {
  const seen = new Set();
  return (items || [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        return { label: item, url: item };
      }
      return {
        label: item.label || item.url || "Sem titulo",
        url: item.url || ""
      };
    })
    .filter((item) => item && item.url)
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
};

const mergeUniqueByUrl = (base, incoming) => {
  const seen = new Set();
  const result = [];
  [...base, ...incoming].forEach((item) => {
    if (!item?.url || seen.has(item.url)) return;
    seen.add(item.url);
    result.push(item);
  });
  return result;
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function AdminDashboard() {
  const {
    error,
    broadcasting,
    micEnabled,
    tracks,
    loadTrack,
    toggleTrack,
    toggleMic,
    setTrackGain,
    seekTrack,
    playTrack,
    startBroadcast,
    stopBroadcast
  } = useAudioMixer();
  const { metadata, updateMetadata, updatePartialMetadata } = useBroadcastMetadata();
  const [form, setForm] = useState(metadata);
  const [newBedUrl, setNewBedUrl] = useState("");
  const [newMainUrl, setNewMainUrl] = useState("");
  const [bedLoading, setBedLoading] = useState(false);
  const [mainLoading, setMainLoading] = useState(false);
  const [bedError, setBedError] = useState("");
  const [mainError, setMainError] = useState("");
  const relayHttp = useMemo(() => {
    return import.meta.env.VITE_RELAY_HTTP_URL || "http://localhost:8090";
  }, []);

  useEffect(() => {
    setForm(metadata);
  }, [metadata]);


  const applyMetadata = () => {
    updateMetadata(form);
  };

  const bedLibrary = useMemo(() => {
    return normalizePlaylistItems(form.bedPlaylist);
  }, [form.bedPlaylist]);

  const mainLibrary = useMemo(() => {
    return normalizePlaylistItems(form.mainPlaylist);
  }, [form.mainPlaylist]);



  const fetchPlaylistItems = async (raw) => {
    const response = await fetch(
      `${relayHttp}/youtube/playlist?url=${encodeURIComponent(raw)}`
    );
    if (!response.ok) {
      throw new Error("Falha ao carregar playlist.");
    }
    const data = await response.json();
    return (data.items || []).map((item) => {
      const normalized = normalizeTrackUrl(item.url, relayHttp);
      return {
        label: item.title || item.id || normalized,
        url: normalized
      };
    });
  };

  const addToLibrary = async (type) => {
    const isBed = type === "bed";
    const raw = (isBed ? newBedUrl : newMainUrl).trim();
    if (!raw) return;

    if (isBed) {
      setBedError("");
    } else {
      setMainError("");
    }

    const setLoading = isBed ? setBedLoading : setMainLoading;
    const setInput = isBed ? setNewBedUrl : setNewMainUrl;
    const currentList = isBed ? bedLibrary : mainLibrary;
    const key = isBed ? "bedPlaylist" : "mainPlaylist";

    if (isPlaylistUrl(raw) && isYouTubeUrl(raw)) {
      try {
        setLoading(true);
        const items = await fetchPlaylistItems(raw);
        const baseList = isBed ? bedLibrary : mainLibrary;
        const nextList = mergeUniqueByUrl(baseList, items);
        setForm((prev) => ({
          ...prev,
          [key]: nextList
        }));
        updatePartialMetadata({ [key]: nextList });
        setInput("");
      } catch (error) {
        const message = "Nao foi possivel carregar a playlist do YouTube.";
        if (isBed) {
          setBedError(message);
        } else {
          setMainError(message);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const normalized = normalizeTrackUrl(raw, relayHttp);
    let label = getTrackLabel(normalized);
    if (isYouTubeUrl(raw)) {
      try {
        const resolved = normalizeYouTubeUrl(raw);
        const title = await fetchYouTubeTitle(relayHttp, resolved);
        if (title) {
          label = title;
        }
      } catch (error) {
        const message = "Nao foi possivel obter o titulo do YouTube.";
        if (isBed) {
          setBedError(message);
        } else {
          setMainError(message);
        }
      }
    }

    const baseList = isBed ? bedLibrary : mainLibrary;
    const nextList = mergeUniqueByUrl(baseList, [{ label, url: normalized }]);
    setForm((prev) => ({
      ...prev,
      [key]: nextList
    }));
    updatePartialMetadata({ [key]: nextList });
    setInput("");
  };

  const removeTrack = (type, track) => {
    const key = type === "bed" ? "bedPlaylist" : "mainPlaylist";
    const baseList = type === "bed" ? bedLibrary : mainLibrary;
    const nextList = baseList.filter((item) => item.url !== track.url);
    setForm((prev) => ({
      ...prev,
      [key]: nextList
    }));
    updatePartialMetadata({ [key]: nextList });
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card shadow-sm glass-card mb-4 reveal">
          <div className="card-body">
            <div className="section-title">
              <h4 className="card-title">Mixer</h4>
              <p className="text-muted small mb-0">
                Mixe trilhas e microfone antes de enviar para o relay.
              </p>
            </div>
            <div className="d-flex flex-column gap-3 mt-3">
              <div className="d-flex gap-2">
                <button
                  className={`btn ${micEnabled ? "btn-warning" : "btn-outline-warning"}`}
                  onClick={toggleMic}
                >
                  {micEnabled ? "Microfone ligado" : "Ativar microfone"}
                </button>
                <button
                  className={`btn ${broadcasting ? "btn-danger" : "btn-success"}`}
                  onClick={broadcasting ? stopBroadcast : startBroadcast}
                >
                  {broadcasting ? "Parar transmissao" : "Iniciar transmissao"}
                </button>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="now-playing">
                <div className="small text-muted">
                  Mixer pronto para transmitir.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card shadow-sm glass-card mb-4 reveal">
          <div className="card-body">
            <div className="section-title">
              <h4 className="card-title">Trilha de fundo</h4>
              <p className="text-muted small mb-0">
                Selecione, ajuste volume e controle o andamento.
              </p>
            </div>
            <div className="d-flex flex-column gap-3 mt-3">
              <div>
                <label className="form-label section-label">Tocando agora</label>
                <div className="now-row mb-2">
                  <span className="small text-muted">
                    {getLibraryLabel(tracks.bed.url, bedLibrary)}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => (tracks.bed.url ? toggleTrack("bed") : null)}
                    disabled={!tracks.bed.url}
                  >
                    {tracks.bed.playing ? "Pausar" : "Tocar"}
                  </button>
                </div>
                <label className="form-label small text-muted">Volume</label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={tracks.bed.gain}
                  onChange={(event) => setTrackGain("bed", event.target.value)}
                />
                <label className="form-label small text-muted">Tempo</label>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted">
                    {formatTime(tracks.bed.currentTime)}
                  </span>
                  <input
                    type="range"
                    className="form-range track-seek"
                    min="0"
                    max={tracks.bed.duration || 0}
                    step="1"
                    value={Math.min(tracks.bed.currentTime, tracks.bed.duration || 0)}
                    onChange={(event) => seekTrack("bed", Number(event.target.value))}
                    disabled={!tracks.bed.duration}
                  />
                  <span className="small text-muted">
                    {formatTime(tracks.bed.duration)}
                  </span>
                </div>
              </div>
            </div>
            <div className="section-title mt-4">
              <h5 className="card-title">Biblioteca - Trilha de fundo</h5>
              <p className="small text-muted mb-0">
                Cole URLs diretas de audio ou links do YouTube.
              </p>
            </div>
            <p className="small text-muted">
              Links do YouTube serao reproduzidos via relay automaticamente.
            </p>
            <div className="input-group mb-3">
              <input
                className="form-control"
                placeholder="Cole URL ou playlist do YouTube"
                value={newBedUrl}
                onChange={(event) => setNewBedUrl(event.target.value)}
              />
              <button
                className="btn btn-outline-primary"
                onClick={() => addToLibrary("bed")}
              >
                {bedLoading ? "Carregando..." : "Adicionar"}
              </button>
            </div>
            {bedError && <div className="alert alert-danger">{bedError}</div>}
            <ul className="list-group scroll-list">
              {bedLibrary.map((track) => (
                <li
                  key={track.url}
                  className={`list-group-item d-flex gap-2 ${
                    isActiveTrack(track.url, tracks.bed.url) ? "track-active" : ""
                  }`}
                >
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() =>
                      track.url === tracks.bed.url
                        ? toggleTrack("bed")
                        : playTrack("bed", track.url)
                    }
                  >
                    {track.url === tracks.bed.url && tracks.bed.playing
                      ? "Pausar"
                      : "Tocar"}
                  </button>
                  <span className="text-muted small flex-grow-1">{track.label}</span>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeTrack("bed", track)}
                  >
                    Remover
                  </button>
                </li>
              ))}
              {!bedLibrary.length && (
                <li className="list-group-item text-muted">Nenhuma URL adicionada.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card shadow-sm glass-card mb-4 reveal">
          <div className="card-body">
            <div className="section-title">
              <h4 className="card-title">Trilha principal</h4>
              <p className="text-muted small mb-0">
                Selecione, ajuste volume e controle o andamento.
              </p>
            </div>
            <div className="d-flex flex-column gap-3 mt-3">
              <div>
                <label className="form-label section-label">Tocando agora</label>
                <div className="now-row mb-2">
                  <span className="small text-muted">
                    {getLibraryLabel(tracks.main.url, mainLibrary)}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => (tracks.main.url ? toggleTrack("main") : null)}
                    disabled={!tracks.main.url}
                  >
                    {tracks.main.playing ? "Pausar" : "Tocar"}
                  </button>
                </div>
                <label className="form-label small text-muted">Volume</label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={tracks.main.gain}
                  onChange={(event) => setTrackGain("main", event.target.value)}
                />
                <label className="form-label small text-muted">Tempo</label>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted">
                    {formatTime(tracks.main.currentTime)}
                  </span>
                  <input
                    type="range"
                    className="form-range track-seek"
                    min="0"
                    max={tracks.main.duration || 0}
                    step="1"
                    value={Math.min(tracks.main.currentTime, tracks.main.duration || 0)}
                    onChange={(event) => seekTrack("main", Number(event.target.value))}
                    disabled={!tracks.main.duration}
                  />
                  <span className="small text-muted">
                    {formatTime(tracks.main.duration)}
                  </span>
                </div>
              </div>
            </div>
            <div className="section-title mt-4">
              <h5 className="card-title">Biblioteca - Trilha principal</h5>
              <p className="small text-muted mb-0">
                Cole URLs diretas de audio ou links do YouTube.
              </p>
            </div>
            <p className="small text-muted">
              Links do YouTube serao reproduzidos via relay automaticamente.
            </p>
            <div className="input-group mb-3">
              <input
                className="form-control"
                placeholder="Cole URL ou playlist do YouTube"
                value={newMainUrl}
                onChange={(event) => setNewMainUrl(event.target.value)}
              />
              <button
                className="btn btn-outline-primary"
                onClick={() => addToLibrary("main")}
              >
                {mainLoading ? "Carregando..." : "Adicionar"}
              </button>
            </div>
            {mainError && <div className="alert alert-danger">{mainError}</div>}
            <ul className="list-group scroll-list">
              {mainLibrary.map((track) => (
                <li
                  key={track.url}
                  className={`list-group-item d-flex gap-2 ${
                    isActiveTrack(track.url, tracks.main.url) ? "track-active" : ""
                  }`}
                >
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() =>
                      track.url === tracks.main.url
                        ? toggleTrack("main")
                        : playTrack("main", track.url)
                    }
                  >
                    {track.url === tracks.main.url && tracks.main.playing
                      ? "Pausar"
                      : "Tocar"}
                  </button>
                  <span className="text-muted small flex-grow-1">{track.label}</span>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeTrack("main", track)}
                  >
                    Remover
                  </button>
                </li>
              ))}
              {!mainLibrary.length && (
                <li className="list-group-item text-muted">Nenhuma URL adicionada.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
