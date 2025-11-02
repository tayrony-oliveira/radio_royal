import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'radio-royal-broadcast';
const CHANNEL_NAME = 'radio-royal-broadcast-channel';

const DEFAULT_BROADCAST = Object.freeze({
  trackTitle: 'Nenhuma faixa em reprodução',
  hostName: '',
  programName: '',
  streamUrl: '',
  autoStreamUrl: '',
  chatEmbedUrl: '',
  sourceUrl: '',
  playlist: [],
  isPlaying: false,
  updatedAt: null
});

function loadStoredBroadcast() {
  if (typeof window === 'undefined') {
    return DEFAULT_BROADCAST;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_BROADCAST;
    }
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_BROADCAST, ...parsed };
  } catch (error) {
    console.warn('Não foi possível carregar os dados de transmissão.', error);
    return DEFAULT_BROADCAST;
  }
}

export function useBroadcastMetadata() {
  const [metadata, setMetadata] = useState(() => loadStoredBroadcast());
  const channelRef = useRef(null);
  const isInitialRenderRef = useRef(true);
  const suppressBroadcastRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.warn('Não foi possível salvar os dados de transmissão.', error);
    }
  }, [metadata]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      setMetadata(loadStoredBroadcast());
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return undefined;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (!event?.data) {
        return;
      }
      const { type, payload } = event.data;
      if (type === 'broadcast:update' && payload) {
        suppressBroadcastRef.current = true;
        setMetadata((previous) => ({ ...previous, ...payload }));
      } else if (type === 'broadcast:replace' && payload) {
        suppressBroadcastRef.current = true;
        setMetadata({ ...DEFAULT_BROADCAST, ...payload });
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }
    if (suppressBroadcastRef.current) {
      suppressBroadcastRef.current = false;
      return;
    }
    if (!channelRef.current) {
      return;
    }
    channelRef.current.postMessage({ type: 'broadcast:replace', payload: metadata });
  }, [metadata]);

  const updateMetadata = useCallback((patch) => {
    setMetadata((previous) => {
      const partial = typeof patch === 'function' ? patch(previous) : patch;
      const next = {
        ...previous,
        ...partial,
        updatedAt: new Date().toISOString()
      };
      return next;
    });
  }, []);

  const resetMetadata = useCallback(() => {
    setMetadata(DEFAULT_BROADCAST);
  }, []);

  return {
    metadata,
    updateMetadata,
    resetMetadata
  };
}

export function getStoredBroadcast() {
  return loadStoredBroadcast();
}
