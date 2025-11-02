import { useState } from 'react';
import LevelMeter from './LevelMeter.jsx';

export default function MicrophoneControl({
  microphoneActive,
  connectMicrophone,
  disconnectMicrophone,
  volume,
  onVolumeChange,
  analyser
}) {
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setError(null);
    setPending(true);
    try {
      if (microphoneActive) {
        disconnectMicrophone();
      } else {
        await connectMicrophone();
      }
    } catch (err) {
      setError(err.message || 'Não foi possível acessar o microfone.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <header className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-center gap-3">
            <h2 className="h5 mb-0">Microfone</h2>
            <div className="flex-grow-1">
              <LevelMeter analyser={analyser} label="Nível do microfone" />
            </div>
          </div>
        </header>
        <button
          type="button"
          className={`btn ${microphoneActive ? 'btn-outline-danger' : 'btn-success'}`}
          onClick={handleToggle}
          disabled={pending}
        >
          {microphoneActive ? 'Desligar microfone' : 'Ativar microfone'}
        </button>
        <div>
          <label className="form-label fw-semibold">
            Volume: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            className="form-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </div>
        {pending && <p className="text-warning small mb-0">Solicitando permissão...</p>}
        {microphoneActive && <p className="text-success small mb-0">Microfone ativo.</p>}
        {error && <p className="text-danger small mb-0">{error}</p>}
      </div>
    </section>
  );
}
