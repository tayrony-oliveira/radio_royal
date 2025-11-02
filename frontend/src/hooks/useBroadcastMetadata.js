import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'radio-royal-broadcast';

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
