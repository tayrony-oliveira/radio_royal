import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'radio-royal-relay-settings';
const DEFAULT_CHUNK_INTERVAL =
  Number(
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_MEDIA_CHUNK_INTERVAL_MS
      : undefined
  ) || 500;

function loadStoredSettings() {
  // Default to the current host but with relay port
  const defaultUrl = typeof window !== 'undefined' 
    ? `ws://${window.location.hostname}:8081`
    : 'ws://localhost:8081';

  if (typeof window === 'undefined') {
    return {
      relayUrl: defaultUrl,
      chunkInterval: DEFAULT_CHUNK_INTERVAL
    };
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return {
      relayUrl: stored?.relayUrl || defaultUrl,
      chunkInterval: stored?.chunkInterval || DEFAULT_CHUNK_INTERVAL
    };
  } catch (error) {
    return {
      relayUrl: defaultUrl,
      chunkInterval: DEFAULT_CHUNK_INTERVAL
    };
  }
}

function saveStoredSettings(settings) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Não foi possível salvar as configurações do relay.', error);
  }
}

function getSupportedMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'audio/webm';
}

export default function StreamRelayControl({ stream, onLiveStateChange }) {
  const [settings, setSettings] = useState(() => loadStoredSettings());
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('Desconectado');
  const [error, setError] = useState('');
  const [bytesSent, setBytesSent] = useState(0);

  const websocketRef = useRef(null);
  const recorderRef = useRef(null);
  const bytesRef = useRef(0);
  const intervalIdRef = useRef(null);

  const mimeType = useMemo(() => (typeof window === 'undefined' ? 'audio/webm' : getSupportedMimeType()), []);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  const cleanupStreaming = useCallback((shouldNotify = true) => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(JSON.stringify({ type: 'stop' }));
      } catch (error) {
        /* ignore */
      }
      websocketRef.current.close();
    }
    websocketRef.current = null;

    if (shouldNotify) {
      setIsStreaming(false);
      setStatus('Desconectado');
      setError('');
      onLiveStateChange(false);
    }
  }, [onLiveStateChange]);

  const startStreaming = useCallback(() => {
    if (!stream) {
      setError('Mix final indisponível. Reproduza alguma faixa para ativar o áudio.');
      return;
    }

    if (isStreaming) {
      return;
    }

    try {
      const ws = new WebSocket(settings.relayUrl);
      ws.binaryType = 'arraybuffer';
      websocketRef.current = ws;
      setStatus('Conectando...');
      setError('');

      ws.addEventListener('open', () => {
        bytesRef.current = 0;
        setBytesSent(0);
        setStatus('Transmitindo');

        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;

        recorder.addEventListener('dataavailable', async (event) => {
          if (!event.data || event.data.size === 0) {
            return;
          }
          if (ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await event.data.arrayBuffer();
            ws.send(arrayBuffer);
            bytesRef.current += arrayBuffer.byteLength;
          }
        });

        recorder.addEventListener('stop', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop' }));
          }
        });

        ws.send(JSON.stringify({ type: 'start', mimeType }));
        recorder.start(settings.chunkInterval);
        setIsStreaming(true);
        onLiveStateChange(true);

        intervalIdRef.current = window.setInterval(() => {
          setBytesSent(bytesRef.current);
        }, 2000);
      });

      ws.addEventListener('close', () => {
        cleanupStreaming(false);
        setIsStreaming(false);
        setStatus('Desconectado');
        onLiveStateChange(false);
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'error') {
            console.error('[relay] Erro reportado:', message.message);
            setError(`Erro no relay: ${message.message}`);
            cleanupStreaming();
          }
        } catch (e) {
          // Ignore non-JSON messages (binary data)
        }
      });

      ws.addEventListener('error', (event) => {
        console.error('Falha na conexão com o relay.', event);
        setError(`Falha na conexão com o relay (${settings.relayUrl}). Verifique se o servidor está rodando e o endereço está correto.`);
        cleanupStreaming();
      });
    } catch (error) {
      console.error('Erro ao iniciar streaming', error);
      setError('Erro inesperado ao iniciar streaming. Veja o console.');
      cleanupStreaming();
    }
  }, [cleanupStreaming, isStreaming, mimeType, onLiveStateChange, settings.chunkInterval, settings.relayUrl, stream]);

  const stopStreaming = useCallback(() => {
    cleanupStreaming();
  }, [cleanupStreaming]);

  useEffect(() => {
    return () => {
      cleanupStreaming(false);
    };
  }, [cleanupStreaming]);

  const handleSettingsChange = (event) => {
    const { name, value } = event.target;
    setSettings((previous) => ({
      ...previous,
      [name]: name === 'chunkInterval' ? Number(value) : value
    }));
  };

  const humanBytes = useMemo(() => {
    const bytes = bytesSent;
    if (!bytes) {
      return '0 KB';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  }, [bytesSent]);

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h2 className="h5 mb-1">Transmissão Owncast</h2>
            <p className="text-muted mb-0">
              Envie o mix final para o servidor Owncast utilizando FFmpeg como encoder.
            </p>
          </div>
          <span className={`badge ${isStreaming ? 'bg-success' : 'bg-secondary'}`}>{status}</span>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <label className="form-label fw-semibold">Endereço do relay (WebSocket)</label>
            <input
              type="url"
              name="relayUrl"
              className="form-control"
              value={settings.relayUrl}
              onChange={handleSettingsChange}
              placeholder="ws://localhost:8081"
              disabled={isStreaming}
              required
            />
            <small className="text-muted">
              É o endereço do servidor Node que repassa o áudio ao Owncast.
            </small>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Intervalo dos pacotes (ms)</label>
            <input
              type="number"
              name="chunkInterval"
              className="form-control"
              value={settings.chunkInterval}
              onChange={handleSettingsChange}
              min={200}
              max={5000}
              step={100}
              disabled={isStreaming}
            />
          </div>
          <div className="col-12 col-lg-3 d-flex align-items-end gap-2">
            {isStreaming ? (
              <button type="button" className="btn btn-outline-danger w-100" onClick={stopStreaming}>
                Encerrar transmissão
              </button>
            ) : (
              <button type="button" className="btn btn-success w-100" onClick={startStreaming}>
                Iniciar transmissão
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 align-items-center">
          <div>
            <strong className="me-1">Formato</strong>
            <code>{mimeType}</code>
          </div>
          <div>
            <strong className="me-1">Dados enviados</strong>
            <span>{humanBytes}</span>
          </div>
        </div>

        {error && <div className="alert alert-danger mb-0">{error}</div>}
      </div>
    </section>
  );
}
