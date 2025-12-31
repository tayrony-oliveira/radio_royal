import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";

const defaultOwncast =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : "http://localhost:8080";

export default function HeaderPlayer() {
  const audioRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const owncastBase = useMemo(() => {
    return import.meta.env.VITE_OWNCAST_WEB_URL || defaultOwncast;
  }, []);

  const hlsPath = useMemo(() => {
    return import.meta.env.VITE_OWNCAST_HLS_PATH || "/hls/stream.m3u8";
  }, []);

  const streamUrl = useMemo(() => {
    return new URL(hlsPath, owncastBase).toString();
  }, [hlsPath, owncastBase]);

  const statusUrl = useMemo(() => {
    const originHost =
      typeof window !== "undefined" ? window.location.hostname : "localhost";
    if (originHost === "localhost" || originHost === "127.0.0.1") {
      return "/api/status";
    }
    return new URL("/api/status", owncastBase).toString();
  }, [owncastBase]);

  useEffect(() => {
    let hls;
    const media = audioRef.current;
    if (!media) return;

    if (media.canPlayType("application/vnd.apple.mpegurl")) {
      media.src = streamUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(media);
    }

    const tryAutoplay = async () => {
      try {
        await media.play();
      } catch (error) {
        // Autoplay pode falhar sem interacao do usuario.
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime || 0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    media.addEventListener("loadedmetadata", tryAutoplay, { once: true });
    media.addEventListener("canplay", tryAutoplay, { once: true });
    media.addEventListener("loadedmetadata", handleLoadedMetadata);
    media.addEventListener("durationchange", handleLoadedMetadata);
    media.addEventListener("timeupdate", handleTimeUpdate);
    media.addEventListener("play", handlePlay);
    media.addEventListener("pause", handlePause);

    return () => {
      if (hls) {
        hls.destroy();
      }
      media.removeEventListener("loadedmetadata", tryAutoplay);
      media.removeEventListener("canplay", tryAutoplay);
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener("durationchange", handleLoadedMetadata);
      media.removeEventListener("timeupdate", handleTimeUpdate);
      media.removeEventListener("play", handlePlay);
      media.removeEventListener("pause", handlePause);
    };
  }, [streamUrl]);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const response = await fetch(statusUrl);
        if (!response.ok) {
          throw new Error("Status nao respondeu.");
        }
        const data = await response.json();
        if (!cancelled) setStatus(data);
      } catch (error) {
        try {
          const fallback = await fetch("/api/status");
          if (fallback.ok) {
            const data = await fallback.json();
            if (!cancelled) setStatus(data);
            return;
          }
        } catch (fallbackError) {
          // ignore fallback errors
        }
        if (!cancelled) setStatus(null);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statusUrl]);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleTogglePlay = async () => {
    const media = audioRef.current;
    if (!media) return;
    try {
      if (media.paused) {
        await media.play();
      } else {
        media.pause();
      }
    } catch (error) {
      // ignore play errors
    }
  };

  const handleSeek = (value) => {
    const media = audioRef.current;
    if (!media) return;
    const nextTime = Number(value);
    media.currentTime = Number.isFinite(nextTime) ? nextTime : 0;
  };

  return (
    <div className="top-air reveal">
      <div className="top-air-header">
        <span className="top-air-label">Agora no ar</span>
        <span className={`status-pill ${status?.online ? "on" : "off"}`}>
          {status?.online ? "No ar" : "Offline"}
        </span>
      </div>
      <audio ref={audioRef} className="audio-element" />
      <div className="audio-shell">
        <button className="audio-play" onClick={handleTogglePlay}>
          {isPlaying ? "Pausar" : "Play"}
        </button>
        <div className="audio-progress">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="1"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => handleSeek(event.target.value)}
            disabled={!duration}
          />
          <span className="audio-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
