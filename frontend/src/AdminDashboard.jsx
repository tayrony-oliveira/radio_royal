import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    lastEnded,
    loadTrack,
    toggleTrack,
    toggleMic,
    setTrackGain,
    seekTrack,
    playTrack,
    stopTrack,
    playOneShot,
    startBroadcast,
    stopBroadcast
  } = useAudioMixer();
  const { metadata, updateMetadata, updatePartialMetadata } = useBroadcastMetadata();
  const [form, setForm] = useState(metadata);
  const [newBedUrl, setNewBedUrl] = useState("");
  const [newMainUrl, setNewMainUrl] = useState("");
  const [ttsVoice, setTtsVoice] = useState(
    import.meta.env.VITE_TTS_VOICE || ""
  );
  const [ttsRate, setTtsRate] = useState(
    Number(import.meta.env.VITE_TTS_RATE || 180)
  );
  const [ttsGain, setTtsGain] = useState(0.9);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [bedLoading, setBedLoading] = useState(false);
  const [mainLoading, setMainLoading] = useState(false);
  const [bedError, setBedError] = useState("");
  const [mainError, setMainError] = useState("");
  const [autoDjEnabled, setAutoDjEnabled] = useState(false);
  const [autoDjStatus, setAutoDjStatus] = useState("");
  const [autoDjError, setAutoDjError] = useState("");
  const [autoDjVoiceOverNextTrack, setAutoDjVoiceOverNextTrack] = useState(true);
  const autoDjCountRef = useRef(0);
  const autoDjBusyRef = useRef(false);
  const autoDjIndexRef = useRef(0);
  const autoDjProgramStepRef = useRef(0);
  const autoDjPreRollRef = useRef(null);
  const autoDjSpeakRef = useRef(false);
  const prevMainPlayingRef = useRef(false);
  const bedBaseGainRef = useRef(tracks.bed.gain);
  const mainBaseGainRef = useRef(tracks.main.gain);
  const tracksRef = useRef(tracks);
  const voiceOverDelayMs = 0;
  const relayHttp = useMemo(() => {
    return import.meta.env.VITE_RELAY_HTTP_URL || "http://localhost:8090";
  }, []);

  useEffect(() => {
    setForm(metadata);
  }, [metadata]);

  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch(`${relayHttp}/tts/voices`);
        if (!response.ok) return;
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      } catch (error) {
        // ignore voice list errors
      }
    };
    loadVoices();
  }, [relayHttp]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const applyMetadata = () => {
    updateMetadata(form);
  };

  const bedLibrary = useMemo(() => {
    return normalizePlaylistItems(form.bedPlaylist);
  }, [form.bedPlaylist]);

  const mainLibrary = useMemo(() => {
    return normalizePlaylistItems(form.mainPlaylist);
  }, [form.mainPlaylist]);

  useEffect(() => {
    bedBaseGainRef.current = tracks.bed.gain;
  }, [tracks.bed.gain]);

  useEffect(() => {
    mainBaseGainRef.current = tracks.main.gain;
  }, [tracks.main.gain]);

  const getNextMainTrack = useCallback(() => {
    if (!mainLibrary.length) return null;
    const index = autoDjIndexRef.current % mainLibrary.length;
    autoDjIndexRef.current = index + 1;
    return mainLibrary[index];
  }, [mainLibrary]);

  const peekNextMainTrack = useCallback(() => {
    if (!mainLibrary.length) return null;
    const index = autoDjIndexRef.current % mainLibrary.length;
    return mainLibrary[index];
  }, [mainLibrary]);

  const waitForTrackPlaying = useCallback((slot, timeoutMs = 1600) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (tracksRef.current[slot]?.playing) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 120);
    });
  }, []);

  const sleep = useCallback((ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }, []);

  const fadeTrackGain = useCallback(
    async (slot, from, to, durationMs = 2000) => {
      const steps = 16;
      const stepTime = Math.max(50, Math.floor(durationMs / steps));
      const delta = (to - from) / steps;
      for (let i = 0; i < steps; i += 1) {
        const next = from + delta * (i + 1);
        setTrackGain(slot, Math.max(0, next));
        await sleep(stepTime);
      }
    },
    [setTrackGain, sleep]
  );

  const fadeOutAndStop = useCallback(
    (slot, from, durationMs = 800) => {
      if (durationMs <= 0) {
        stopTrack(slot);
        setTrackGain(slot, from);
        return;
      }
      fadeTrackGain(slot, from, 0, durationMs);
      setTimeout(() => {
        stopTrack(slot);
        setTrackGain(slot, from);
      }, durationMs);
    },
    [fadeTrackGain, setTrackGain, stopTrack]
  );

  const ensureBedPlaying = useCallback(async () => {
    if (!bedLibrary.length) return true;
    if (tracks.bed.playing) return true;
    const targetUrl = bedLibrary[0]?.url;
    if (!targetUrl) return false;
    setAutoDjStatus("Iniciando trilha de fundo...");
    return playTrack("bed", targetUrl);
  }, [bedLibrary, playTrack, tracks.bed.playing]);

  const isPortugueseLabel = useCallback((label) => {
    if (!label) return false;
    return /[áàâãéêíóôõúç]/i.test(label);
  }, []);

  const formatTrackMention = useCallback(
    (label, isNext = false) => {
      if (!label) return "";
      if (isPortugueseLabel(label)) {
        return isNext ? `Agora, ${label}.` : `E essa foi ${label}. `;
      }
      return isNext ? `Now playing: ${label}.` : `You just heard ${label}. `;
    },
    [isPortugueseLabel]
  );

  const getAnnouncerName = useCallback(() => {
    const voice = (ttsVoice || "").toLowerCase();
    if (voice.includes("faber")) return "Faber";
    if (voice.includes("jeff")) return "Jeff";
    if (voice.includes("edresson")) return "Edresson";
    if (voice.includes("cadu")) return "Cadu";
    return "Cadu";
  }, [ttsVoice]);

  const detectGenreTone = useCallback((label) => {
    const text = (label || "").toLowerCase();
    if (text.includes("rock")) return "rock";
    if (text.includes("disco") || text.includes("funk") || text.includes("dance")) {
      return "dance";
    }
    if (text.includes("jazz")) return "jazz";
    if (text.includes("chill") || text.includes("lounge")) return "chill";
    if (text.includes("pop")) return "pop";
    return "default";
  }, []);

  const buildAutoSpeech = useCallback((prevLabel, nextLabel) => {
    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const timeText = `${String(hour).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const announcer = getAnnouncerName();
    const tone = detectGenreTone(nextLabel);
    const introLines = [
      "seja muito bem-vindo, seja muito bem-vinda.",
      "se voce chegou agora, relaxa...",
      "fica por aqui comigo, porque o som que vem ai e daqueles."
    ];
    const energyLines = [
      "aumenta o volume porque essa aqui e sucesso absoluto.",
      "aumenta um pouquinho o volume, respira fundo...",
      "deixa tocar, deixa sentir..."
    ];
    const emotionLines = [
      "tem musica que chega devagar e entende a gente.",
      "essa musica marcou epoca, marcou historias.",
      "essa aqui toca direto no coracao."
    ];
    const outroLines = [
      "daqui a pouco tem mais, entao nao sai dai.",
      "fica por aqui, o som nao para.",
      "segue comigo que ja ja tem mais."
    ];
    const genreLines = {
      rock: "rock na veia, pra manter o clima aceso.",
      dance: "pista pronta, energia la em cima.",
      jazz: "jazz com classe, pra desacelerar com elegancia.",
      chill: "clima leve, pra deixar o tempo correr.",
      pop: "pop bem alto astral, do jeito que a gente gosta.",
      default: "uma vibe gostosa pra acompanhar o momento."
    };

    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const safePrev = formatTrackMention(prevLabel, false);
    const nextLine = formatTrackMention(nextLabel, true);
    return (
      `${greeting}... agora sao ${timeText}. ` +
      `Aqui e o ${announcer}, com ${genreLines[tone]}. ` +
      `${pick(introLines)} ` +
      `${pick(emotionLines)} ` +
      `${pick(energyLines)} ` +
      `${safePrev}` +
      `${pick(outroLines)} ` +
      `${nextLine}`
    );
  }, [detectGenreTone, formatTrackMention, getAnnouncerName]);

  const buildPreEndSpeech = useCallback(
    (currentLabel, nextLabel) => {
    const now = new Date();
    const timeText = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const currentText = currentLabel
      ? isPortugueseLabel(currentLabel)
        ? `Voce esta ouvindo ${currentLabel}. `
        : `You are listening to ${currentLabel}. `
      : "A musica ta chegando ao fim. ";
    const nextText = nextLabel
      ? isPortugueseLabel(nextLabel)
        ? `Daqui a pouco, ${nextLabel}. `
        : `Up next: ${nextLabel}. `
      : "";
    return `${currentText}${nextText}Agora sao ${timeText}. Fica aqui comigo.`;
  }, [isPortugueseLabel]);

  const speakText = useCallback(
    async (text) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      const params = new URLSearchParams({ text: trimmed });
      if (ttsVoice) params.set("voice", ttsVoice);
      if (Number.isFinite(ttsRate)) params.set("rate", String(ttsRate));
      const url = `${relayHttp}/tts?${params.toString()}`;
      await playOneShot(url, ttsGain);
    },
    [playOneShot, relayHttp, ttsGain, ttsRate, ttsVoice]
  );

  const speakOverMain = useCallback(
    async (text, delayMs = voiceOverDelayMs) => {
      if (!text) return;
      if (autoDjSpeakRef.current) return;
      autoDjSpeakRef.current = true;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      const playing = await waitForTrackPlaying("main", 3000);
      if (!playing || !tracksRef.current.main.playing) {
        autoDjSpeakRef.current = false;
        return;
      }
      const baseGain = mainBaseGainRef.current;
      await fadeTrackGain("main", baseGain, Math.min(baseGain, 0.2), 500);
      try {
        await speakText(text);
      } finally {
        await fadeTrackGain("main", Math.min(baseGain, 0.2), baseGain, 700);
        autoDjSpeakRef.current = false;
      }
    },
    [fadeTrackGain, sleep, speakText, waitForTrackPlaying]
  );

  useEffect(() => {
    if (!autoDjEnabled || !autoDjVoiceOverNextTrack) return;
    if (!tracks.main.playing || !tracks.main.duration) return;
    if (autoDjBusyRef.current) return;
    const remaining = tracks.main.duration - tracks.main.currentTime;
    if (remaining > 5) return;
    if (autoDjPreRollRef.current === tracks.main.url) return;

    autoDjPreRollRef.current = tracks.main.url;
    const currentLabel = getLibraryLabel(tracks.main.url, mainLibrary);
    const nextTrack = peekNextMainTrack();
    speakOverMain(buildPreEndSpeech(currentLabel, nextTrack?.label), 0).catch(
      () => {}
    );
  }, [
    autoDjEnabled,
    autoDjVoiceOverNextTrack,
    buildPreEndSpeech,
    mainLibrary,
    peekNextMainTrack,
    speakOverMain,
    tracks.main.currentTime,
    tracks.main.duration,
    tracks.main.playing,
    tracks.main.url
  ]);

  const programName = getAnnouncerName();
  const buildProgramOpening = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const timeText = `${String(hour).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const tone = detectGenreTone("");
    const moodLines = {
      rock: "energia la em cima, guitarra no talo.",
      dance: "pista pronta, vibração la em cima.",
      jazz: "clima elegante, som macio.",
      chill: "clima leve, som suave.",
      pop: "alto astral pra acompanhar.",
      default: "som gostoso pra te acompanhar."
    };
    return (
      `${greeting}! Agora sao ${timeText}. ` +
      "Seja muito bem-vindo, seja muito bem-vinda. " +
      "Ta comecando agora mais um programa feito pra te acompanhar, te relaxar e te fazer sentir em casa. " +
      `Eu sou ${programName}, e hoje a vibe e ${moodLines[tone]} ` +
      "Ajusta o volume, respira fundo, porque a trilha da sua noite comeca agora."
    );
  }, [detectGenreTone, programName]);

  const buildProgramOverlayOne = useCallback(() => {
    return (
      "Essa musica tem uma energia diferente. " +
      "Daquelas que chegam de mansinho e quando voce percebe ja tomaram conta do clima. " +
      "Perfeita pra quem ta chegando agora, ou pra quem ja ta curtindo desde o comeco."
    );
  }, []);

  const buildProgramTransition = useCallback(() => {
    return (
      "E se voce ta ouvindo a gente agora, seja no carro, em casa ou no fone de ouvido, " +
      "fica a vontade, esse espaco tambem e seu. " +
      "A noite ta so comecando, e ainda vem muita coisa boa por ai."
    );
  }, []);

  const buildProgramIntroTwo = useCallback(() => {
    return "Agora aumenta um pouquinho o volume... porque essa aqui e pra levantar o astral!";
  }, []);

  const buildProgramCuriosity = useCallback(() => {
    return (
      "Voce sabia que essa musica nasceu de um momento completamente inesperado do artista? " +
      "As vezes, as melhores coisas surgem assim, sem aviso, sem planejamento. " +
      "E talvez por isso ela conecte tanto com a gente."
    );
  }, []);

  const buildProgramOverlayThree = useCallback(() => {
    return (
      "Tem musica que nao precisa de explicacao. " +
      "Ela simplesmente acontece, e pronto. " +
      "Fecha os olhos, sente o momento, e deixa tocar."
    );
  }, []);

  const buildProgramClosing = useCallback(() => {
    return (
      "E infelizmente o nosso tempo vai chegando ao fim... " +
      "Mas a boa musica continua, porque ela nunca vai embora de verdade. " +
      "Obrigado pela sua companhia, pela sua sintonia, pela sua energia. " +
      `Eu sou ${programName} e esse foi mais um momento pra ficar na memoria. ` +
      "A gente se encontra de novo em breve. Ate la, cuide-se, e continue ouvindo coisa boa."
    );
  }, []);

  const runAutoDj = useCallback(
    async (prevLabel = "", forceStart = false) => {
      if ((!autoDjEnabled && !forceStart) || autoDjBusyRef.current) return;
      if (tracksRef.current.main.playing) {
        setAutoDjStatus("Aguardando termino da faixa atual...");
        return;
      }
      const next = getNextMainTrack();
      if (!next) {
        setAutoDjError("Nao ha musicas na trilha principal.");
        return;
      }

      autoDjBusyRef.current = true;
      setAutoDjError("");
      try {
        const bedOk = await ensureBedPlaying();
        if (!bedOk) {
          setAutoDjStatus("Trilha de fundo indisponivel. Seguindo sem ela.");
        } else {
          await waitForTrackPlaying("bed");
          await sleep(900);
        }

        const shouldSpeak = autoDjCountRef.current % 2 === 0;
        const programStep = autoDjProgramStepRef.current;
        autoDjCountRef.current += 1;

        if (tracksRef.current.bed.playing) {
          fadeOutAndStop("bed", bedBaseGainRef.current, 800);
        }

        let mainStarted = false;
        if (programStep === 0) {
          if (autoDjVoiceOverNextTrack) {
            setAutoDjStatus("Iniciando a primeira musica...");
            mainStarted = await playTrack("main", next.url);
            setAutoDjStatus("Abertura do programa...");
            await speakOverMain(buildProgramOpening(), 0);
          } else {
            setAutoDjStatus("Abertura do programa...");
            await speakText(buildProgramOpening());
            setAutoDjStatus("Iniciando a primeira musica...");
            mainStarted = await playTrack("main", next.url);
          }
          autoDjProgramStepRef.current = 1;
        } else if (programStep === 1) {
          if (autoDjVoiceOverNextTrack) {
            setAutoDjStatus("Iniciando a proxima musica...");
            mainStarted = await playTrack("main", next.url);
            setAutoDjStatus("Transicao do programa...");
            await speakOverMain(
              `${buildProgramTransition()} ${buildProgramIntroTwo()}`
            );
          } else {
            setAutoDjStatus("Transicao do programa...");
            await speakText(buildProgramTransition());
            await speakText(buildProgramIntroTwo());
            setAutoDjStatus("Iniciando a proxima musica...");
            mainStarted = await playTrack("main", next.url);
          }
          autoDjProgramStepRef.current = 2;
        } else if (programStep === 2) {
          if (autoDjVoiceOverNextTrack) {
            setAutoDjStatus("Iniciando a proxima musica...");
            mainStarted = await playTrack("main", next.url);
            setAutoDjStatus("Mensagem especial...");
            await speakOverMain(buildProgramCuriosity());
            await speakOverMain(buildProgramOverlayThree());
          } else {
            setAutoDjStatus("Mensagem especial...");
            await speakText(buildProgramCuriosity());
            await speakText(buildProgramOverlayThree());
            setAutoDjStatus("Iniciando a proxima musica...");
            mainStarted = await playTrack("main", next.url);
          }
          autoDjProgramStepRef.current = 3;
        } else if (programStep === 3) {
          setAutoDjStatus("Encerramento do programa...");
          await speakText(buildProgramClosing());
          setAutoDjStatus("Iniciando a proxima musica...");
          mainStarted = await playTrack("main", next.url);
          autoDjProgramStepRef.current = 4;
        } else if (shouldSpeak && autoDjVoiceOverNextTrack) {
          setAutoDjStatus("Iniciando musica com locutor...");
          mainStarted = await playTrack("main", next.url);
          if (mainStarted) {
            await speakOverMain(buildAutoSpeech(prevLabel, next.label));
          }
        } else if (shouldSpeak) {
          setAutoDjStatus("Locutor em andamento...");
          const baseGain = mainBaseGainRef.current;
          await fadeTrackGain("main", baseGain, Math.min(baseGain, 0.2), 500);
          try {
            await speakText(buildAutoSpeech(prevLabel, next.label));
          } finally {
            await fadeTrackGain("main", Math.min(baseGain, 0.2), baseGain, 700);
          }
        }

        if (!mainStarted) {
          setAutoDjStatus("Iniciando proxima musica...");
          const played = await playTrack("main", next.url);
          if (!played) {
            setAutoDjError("Falha ao tocar a faixa.");
          }
        }
      } catch (error) {
        setAutoDjError("Falha no locutor automatico.");
      } finally {
        setAutoDjStatus("");
        autoDjBusyRef.current = false;
      }
    },
    [
      autoDjEnabled,
      ensureBedPlaying,
      getNextMainTrack,
      playTrack,
      setTrackGain,
      sleep,
      speakText,
      stopTrack,
      autoDjVoiceOverNextTrack,
      fadeTrackGain,
      buildAutoSpeech,
      buildProgramClosing,
      buildProgramCuriosity,
      buildProgramIntroTwo,
      buildProgramOpening,
      buildProgramOverlayOne,
      buildProgramOverlayThree,
      buildProgramTransition,
      fadeOutAndStop,
      speakOverMain,
      waitForTrackPlaying
    ]
  );

  useEffect(() => {
    if (!autoDjEnabled) return;
    if (!lastEnded || lastEnded.slot !== "main") return;
    const prevLabel = getLibraryLabel(lastEnded.url, mainLibrary);
    runAutoDj(prevLabel);
  }, [autoDjEnabled, lastEnded, mainLibrary, runAutoDj]);

  useEffect(() => {
    const wasPlaying = prevMainPlayingRef.current;
    if (
      autoDjEnabled &&
      wasPlaying &&
      !tracks.main.playing &&
      !autoDjBusyRef.current
    ) {
      const prevLabel = getLibraryLabel(tracks.main.url, mainLibrary);
      runAutoDj(prevLabel);
    }
    prevMainPlayingRef.current = tracks.main.playing;
  }, [autoDjEnabled, mainLibrary, runAutoDj, tracks.main.playing, tracks.main.url]);

  useEffect(() => {
    if (!autoDjEnabled) return;
    const interval = setInterval(() => {
      if (autoDjBusyRef.current) return;
      if (tracksRef.current.main.playing) return;
      if (!mainLibrary.length) return;
      const prevLabel = getLibraryLabel(tracksRef.current.main.url, mainLibrary);
      runAutoDj(prevLabel);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoDjEnabled, mainLibrary, runAutoDj]);

  const handleToggleAutoDj = async () => {
    if (autoDjEnabled) {
      setAutoDjEnabled(false);
      setAutoDjStatus("");
      return;
    }
    if (!mainLibrary.length) {
      setAutoDjError("Adicione musicas na trilha principal antes de ativar.");
      return;
    }
    setAutoDjEnabled(true);
    setAutoDjError("");
    setAutoDjStatus("Iniciando Auto DJ...");
    await runAutoDj("", true);
  };



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

  const clearLibrary = (type) => {
    const key = type === "bed" ? "bedPlaylist" : "mainPlaylist";
    setForm((prev) => ({
      ...prev,
      [key]: []
    }));
    updatePartialMetadata({ [key]: [] });
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card shadow-sm glass-card mb-4 reveal">
          <div className="card-body">
            <div className="section-title">
              <h4 className="card-title">Locutor IA</h4>
              <p className="text-muted small mb-0">
                Ative o Auto DJ e escolha a voz do locutor.
              </p>
            </div>
            <div className="d-flex flex-column gap-3 mt-3">
              <div>
                <label className="form-label">Voz do locutor</label>
                <select
                  className="form-select"
                  value={ttsVoice}
                  onChange={(event) => setTtsVoice(event.target.value)}
                >
                  <option value="">Padrao do sistema</option>
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.locale})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="autoDjVoiceOverNextTrack"
                  checked={autoDjVoiceOverNextTrack}
                  onChange={(event) => setAutoDjVoiceOverNextTrack(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="autoDjVoiceOverNextTrack">
                  Falar por cima da musica que vai tocar
                </label>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <button
                  className={`btn ${
                    autoDjEnabled ? "btn-success" : "btn-outline-success"
                  }`}
                  onClick={handleToggleAutoDj}
                >
                  {autoDjEnabled ? "Auto DJ ativo" : "Ativar Auto DJ"}
                </button>
                {autoDjStatus && (
                  <span className="small text-muted">{autoDjStatus}</span>
                )}
              </div>
              {autoDjError && <div className="alert alert-danger">{autoDjError}</div>}
            </div>
          </div>
        </div>
      </div>

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
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="card-title mb-0">Biblioteca - Trilha de fundo</h5>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => clearLibrary("bed")}
                  disabled={!bedLibrary.length}
                >
                  Remover tudo
                </button>
              </div>
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
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="card-title mb-0">Biblioteca - Trilha principal</h5>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => clearLibrary("main")}
                  disabled={!mainLibrary.length}
                >
                  Remover tudo
                </button>
              </div>
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
