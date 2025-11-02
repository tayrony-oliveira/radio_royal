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
    <section className="microphone-control">
      <header>
        <h2>Microfone</h2>
        <LevelMeter analyser={analyser} label="Nível do microfone" />
      </header>
      <button type="button" onClick={handleToggle} disabled={pending}>
        {microphoneActive ? 'Desligar microfone' : 'Ativar microfone'}
      </button>
      <label className="microphone-control__slider">
        Volume: {Math.round(volume * 100)}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </label>
      {pending && <p className="status status--pending">Solicitando permissão...</p>}
      {microphoneActive && <p className="status status--active">Microfone ativo.</p>}
      {error && <p className="status status--error">{error}</p>}
    </section>
  );
}
