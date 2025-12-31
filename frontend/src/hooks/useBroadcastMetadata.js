import { useEffect, useMemo, useState } from "react";

const storageKey = "radio-royal-metadata";
const channelName = "radio-royal-metadata-channel";

const defaultMetadata = {
  host: "",
  program: "",
  chatUrl: "",
  playlist: [],
  bedPlaylist: [],
  mainPlaylist: []
};

export function useBroadcastMetadata() {
  const [metadata, setMetadata] = useState(defaultMetadata);

  const channel = useMemo(() => {
    if ("BroadcastChannel" in window) {
      return new BroadcastChannel(channelName);
    }
    return null;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setMetadata({ ...defaultMetadata, ...JSON.parse(stored) });
      } catch (error) {
        setMetadata(defaultMetadata);
      }
    }
  }, []);

  useEffect(() => {
    if (!channel) return;
    channel.onmessage = (event) => {
      if (event?.data) {
        setMetadata(event.data);
      }
    };
    return () => {
      channel.close();
    };
  }, [channel]);

  const updateMetadata = (next) => {
    setMetadata(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    channel?.postMessage(next);
  };

  const updatePartialMetadata = (partial) => {
    setMetadata((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(storageKey, JSON.stringify(next));
      channel?.postMessage(next);
      return next;
    });
  };

  return { metadata, updateMetadata, updatePartialMetadata };
}
