import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CONTEXT_NOT_SUPPORTED_ERROR = 'Web Audio API não é suportada neste navegador.';

export function useAudioMixer() {
  const contextRef = useRef(null);
  const destinationRef = useRef(null);
  const masterGainRef = useRef(null);
  const backgroundGainRef = useRef(null);
  const mainGainRef = useRef(null);
  const microphoneGainRef = useRef(null);
  const backgroundAnalyserRef = useRef(null);
  const mainAnalyserRef = useRef(null);
  const microphoneAnalyserRef = useRef(null);
  const sourcesRef = useRef(new Map());
  const microphoneStreamRef = useRef(null);
  const [contextError, setContextError] = useState(null);
  const [isContextReady, setIsContextReady] = useState(false);
  const [microphoneActive, setMicrophoneActive] = useState(false);

  const createContextGraph = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      setContextError(CONTEXT_NOT_SUPPORTED_ERROR);
      return null;
    }

    if (!contextRef.current) {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      const backgroundGain = context.createGain();
      const mainGain = context.createGain();
      const microphoneGain = context.createGain();
      const backgroundAnalyser = context.createAnalyser();
      const mainAnalyser = context.createAnalyser();
      const microphoneAnalyser = context.createAnalyser();
      const destination = context.createMediaStreamDestination();

      backgroundGain.connect(backgroundAnalyser);
      mainGain.connect(mainAnalyser);
      microphoneGain.connect(microphoneAnalyser);

      backgroundAnalyser.connect(masterGain);
      mainAnalyser.connect(masterGain);
      microphoneAnalyser.connect(masterGain);

      masterGain.connect(destination);
      masterGain.connect(context.destination);

      masterGain.gain.value = 1;
      backgroundGain.gain.value = 0.5;
      mainGain.gain.value = 0.8;
      microphoneGain.gain.value = 0.7;

      backgroundAnalyser.fftSize = 256;
      mainAnalyser.fftSize = 256;
      microphoneAnalyser.fftSize = 256;

      contextRef.current = context;
      destinationRef.current = destination;
      masterGainRef.current = masterGain;
      backgroundGainRef.current = backgroundGain;
      mainGainRef.current = mainGain;
      microphoneGainRef.current = microphoneGain;
      backgroundAnalyserRef.current = backgroundAnalyser;
      mainAnalyserRef.current = mainAnalyser;
      microphoneAnalyserRef.current = microphoneAnalyser;
      setIsContextReady(true);
    }

    return contextRef.current;
  }, []);

  const ensureContext = useCallback(async () => {
    const context = createContextGraph();
    if (!context) {
      return null;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    return context;
  }, [createContextGraph]);

  const connectElement = useCallback(
    (element, channel) => {
      if (!element) {
        return () => {};
      }

      element.crossOrigin = element.crossOrigin || 'anonymous';
      const connect = async () => {
        const context = await ensureContext();
        if (!context) {
          return;
        }

        if (sourcesRef.current.has(element)) {
          return;
        }

        try {
          const sourceNode = context.createMediaElementSource(element);
          const gainNode = channel === 'background' ? backgroundGainRef.current : mainGainRef.current;
          sourceNode.connect(gainNode);
          sourcesRef.current.set(element, sourceNode);
        } catch (error) {
          console.error('Erro ao conectar elemento de áudio', error);
        }
      };

      connect();

      return () => {
        const sourceNode = sourcesRef.current.get(element);
        if (sourceNode) {
          try {
            sourceNode.disconnect();
          } catch (error) {
            console.warn('Erro ao desconectar fonte de áudio', error);
          }
          sourcesRef.current.delete(element);
        }
      };
    },
    [ensureContext]
  );

  const setVolume = useCallback((channel, value) => {
    const gainNode =
      channel === 'background'
        ? backgroundGainRef.current
        : channel === 'main'
        ? mainGainRef.current
        : microphoneGainRef.current;

    if (gainNode) {
      gainNode.gain.value = value;
    }
  }, []);

  const connectMicrophone = useCallback(async () => {
    const context = await ensureContext();
    if (!context) {
      throw new Error(contextError || CONTEXT_NOT_SUPPORTED_ERROR);
    }

    if (microphoneActive) {
      return microphoneStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = context.createMediaStreamSource(stream);
      source.connect(microphoneGainRef.current);
      microphoneStreamRef.current = stream;
      setMicrophoneActive(true);
      return stream;
    } catch (error) {
      console.error('Falha ao conectar microfone', error);
      throw error;
    }
  }, [contextError, ensureContext, microphoneActive]);

  const disconnectMicrophone = useCallback(() => {
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    }
    setMicrophoneActive(false);
  }, []);

  useEffect(() => {
    return () => {
      sourcesRef.current.forEach((sourceNode) => {
        try {
          sourceNode.disconnect();
        } catch (error) {
          console.warn('Erro ao desconectar fonte ao desmontar', error);
        }
      });
      sourcesRef.current.clear();
      disconnectMicrophone();
      if (contextRef.current) {
        contextRef.current.close();
      }
    };
  }, [disconnectMicrophone]);

  return useMemo(
    () => ({
      ensureContext,
      contextError,
      isContextReady,
      registerBackgroundElement: (element) => connectElement(element, 'background'),
      registerMainElement: (element) => connectElement(element, 'main'),
      setBackgroundVolume: (value) => setVolume('background', value),
      setMainVolume: (value) => setVolume('main', value),
      setMicrophoneVolume: (value) => setVolume('microphone', value),
      connectMicrophone,
      disconnectMicrophone,
      microphoneActive,
      backgroundAnalyser: backgroundAnalyserRef.current,
      mainAnalyser: mainAnalyserRef.current,
      microphoneAnalyser: microphoneAnalyserRef.current,
      mixStream: destinationRef.current ? destinationRef.current.stream : null
    }),
    [
      connectElement,
      connectMicrophone,
      contextError,
      disconnectMicrophone,
      ensureContext,
      isContextReady,
      microphoneActive,
      setVolume
    ]
  );
}
