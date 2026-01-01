import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const defaultRelay = "ws://localhost:8090";

const createAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return new AudioContextClass();
};

export function useAudioMixer() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [tracks, setTracks] = useState({
    bed: { url: "", playing: false, gain: 0.6, currentTime: 0, duration: 0 },
    main: { url: "", playing: false, gain: 0.8, currentTime: 0, duration: 0 }
  });
  const [lastEnded, setLastEnded] = useState(null);

  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const gainsRef = useRef({});
  const audioElementsRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const ttsElementRef = useRef(null);
  const wsRef = useRef(null);

  const relayUrl = useMemo(() => {
    return import.meta.env.VITE_RELAY_WS_URL || defaultRelay;
  }, []);

  const ensureContext = useCallback(() => {
    if (!audioContextRef.current) {
      const context = createAudioContext();
      const destination = context.createMediaStreamDestination();
      const bedGain = context.createGain();
      const mainGain = context.createGain();
      const micGain = context.createGain();
      const voiceGain = context.createGain();

      bedGain.gain.value = tracks.bed.gain;
      mainGain.gain.value = tracks.main.gain;
      micGain.gain.value = 1;
      voiceGain.gain.value = 1;

      bedGain.connect(destination);
      mainGain.connect(destination);
      micGain.connect(destination);
      voiceGain.connect(destination);

      bedGain.connect(context.destination);
      mainGain.connect(context.destination);
      micGain.connect(context.destination);
      voiceGain.connect(context.destination);

      gainsRef.current = { bed: bedGain, main: mainGain, mic: micGain, voice: voiceGain };
      audioContextRef.current = context;
      destinationRef.current = destination;
    }
    return audioContextRef.current;
  }, [tracks.bed.gain, tracks.main.gain]);

  const attachAudioElement = useCallback(
    (slot, url) => {
      const context = ensureContext();
      let element = audioElementsRef.current[slot];
      if (!element) {
        element = new Audio();
        element.crossOrigin = "anonymous";
        audioElementsRef.current[slot] = element;

        const source = context.createMediaElementSource(element);
        source.connect(gainsRef.current[slot]);

        element.addEventListener("timeupdate", () => {
          setTracks((prev) => ({
            ...prev,
            [slot]: {
              ...prev[slot],
              currentTime: element.currentTime
            }
          }));
        });
        element.addEventListener("loadedmetadata", () => {
          setTracks((prev) => ({
            ...prev,
            [slot]: {
              ...prev[slot],
              duration: Number.isFinite(element.duration) ? element.duration : 0
            }
          }));
        });
        element.addEventListener("ended", () => {
          setTracks((prev) => ({
            ...prev,
            [slot]: { ...prev[slot], playing: false }
          }));
          setLastEnded({
            slot,
            url: element.src || "",
            at: Date.now()
          });
        });
      }
      element.src = url;
      return element;
    },
    [ensureContext]
  );

  const setTrackGain = useCallback((slot, value) => {
    const next = Number(value);
    setTracks((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], gain: next }
    }));
    if (gainsRef.current[slot]) {
      gainsRef.current[slot].gain.value = next;
    }
  }, []);

  const loadTrack = useCallback(
    (slot, url) => {
      const element = attachAudioElement(slot, url);
      setTracks((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], url }
      }));
      element.load();
    },
    [attachAudioElement]
  );

  const toggleTrack = useCallback(
    async (slot) => {
      try {
        const context = ensureContext();
        if (context.state !== "running") {
          await context.resume();
        }

        const element = audioElementsRef.current[slot];
        if (!element?.src) {
          return;
        }

        if (element.paused) {
          await element.play();
          setTracks((prev) => ({
            ...prev,
            [slot]: { ...prev[slot], playing: true }
          }));
        } else {
          element.pause();
          setTracks((prev) => ({
            ...prev,
            [slot]: { ...prev[slot], playing: false }
          }));
        }
      } catch (err) {
        setError("Falha ao tocar a faixa.");
      }
    },
    [ensureContext]
  );

  const playTrack = useCallback(
    async (slot, url) => {
      try {
        if (!url) return false;
        const context = ensureContext();
        if (context.state !== "running") {
          await context.resume();
        }

        const element = attachAudioElement(slot, url);
        if (!element) return false;

        element.currentTime = 0;
        element.load();
        await element.play();
        setTracks((prev) => ({
          ...prev,
          [slot]: { ...prev[slot], url, playing: true }
        }));
        return true;
      } catch (err) {
        setError("Falha ao tocar a faixa.");
        return false;
      }
    },
    [attachAudioElement, ensureContext]
  );

  const stopTrack = useCallback((slot) => {
    const element = audioElementsRef.current[slot];
    if (!element) return;
    element.pause();
    setTracks((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], playing: false }
    }));
  }, []);

  const seekTrack = useCallback((slot, time) => {
    const element = audioElementsRef.current[slot];
    if (!element || !Number.isFinite(time)) return;
    element.currentTime = time;
    setTracks((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], currentTime: time }
    }));
  }, []);

  const toggleMic = useCallback(async () => {
    try {
      const context = ensureContext();
      if (context.state !== "running") {
        await context.resume();
      }

      if (!micEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = context.createMediaStreamSource(stream);
        source.connect(gainsRef.current.mic);
        micStreamRef.current = stream;
        micSourceRef.current = source;
        setMicEnabled(true);
      } else {
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        micSourceRef.current = null;
        setMicEnabled(false);
      }
    } catch (err) {
      setError("Falha ao acessar o microfone.");
    }
  }, [ensureContext, micEnabled]);

  const startBroadcast = useCallback(async () => {
    try {
      const context = ensureContext();
      if (context.state !== "running") {
        await context.resume();
      }

      if (!destinationRef.current) {
        throw new Error("Sem destino de audio.");
      }

      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const recorder = new MediaRecorder(destinationRef.current.stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm"
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setBroadcasting(true);
      };

      ws.onerror = () => {
        setError("Falha na conexao com o relay.");
        setBroadcasting(false);
      };

      ws.onclose = () => {
        setBroadcasting(false);
      };
    } catch (err) {
      setError("Falha ao iniciar a transmissao.");
    }
  }, [ensureContext, relayUrl]);

  const stopBroadcast = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setBroadcasting(false);
  }, []);

  const playOneShot = useCallback(
    async (url, gain = 1) => {
      try {
        if (!url) return;
        const context = ensureContext();
        if (context.state !== "running") {
          await context.resume();
        }

        if (ttsElementRef.current) {
          ttsElementRef.current.pause();
          ttsElementRef.current.src = "";
          ttsElementRef.current = null;
        }

        const element = new Audio();
        element.crossOrigin = "anonymous";
        const source = context.createMediaElementSource(element);
        if (gainsRef.current.voice) {
          gainsRef.current.voice.gain.value = gain;
          source.connect(gainsRef.current.voice);
        }

        const finished = new Promise((resolve) => {
          element.addEventListener("ended", () => {
            element.src = "";
            resolve(true);
          });
        });

        element.src = url;
        await element.play();
        ttsElementRef.current = element;
        await finished;
      } catch (err) {
        setError("Falha ao reproduzir o locutor IA.");
        throw err;
      }
    },
    [ensureContext]
  );

  useEffect(() => {
    setReady(true);
    return () => {
      stopBroadcast();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (ttsElementRef.current) {
        ttsElementRef.current.pause();
        ttsElementRef.current.src = "";
        ttsElementRef.current = null;
      }
      audioContextRef.current?.close();
    };
  }, [stopBroadcast]);

  return {
    ready,
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
    stopTrack,
    playOneShot,
    startBroadcast,
    stopBroadcast,
    lastEnded
  };
}
