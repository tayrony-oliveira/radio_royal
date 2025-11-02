import { useEffect, useRef, useState } from 'react';

const UPDATE_INTERVAL = 1000 / 24;

export default function LevelMeter({ analyser, label }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    if (!analyser) {
      setLevel(0);
      return undefined;
    }

    analyser.smoothingTimeConstant = 0.8;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!analyser || !dataArrayRef.current) {
        return;
      }
      analyser.getByteFrequencyData(dataArrayRef.current);
      const maxValue = dataArrayRef.current.reduce((max, value) => Math.max(max, value), 0);
      setLevel(Math.round((maxValue / 255) * 100));
      rafRef.current = window.setTimeout(updateLevel, UPDATE_INTERVAL);
    };

    updateLevel();

    return () => {
      if (rafRef.current) {
        clearTimeout(rafRef.current);
      }
    };
  }, [analyser]);

  return (
    <div className="d-flex align-items-center gap-2" aria-label={label} title={label}>
      <div className="progress flex-grow-1 level-meter__progress" role="progressbar" aria-valuenow={level} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar level-meter__bar" style={{ width: `${level}%` }} />
      </div>
      <span className="text-muted small fw-semibold">{level}%</span>
    </div>
  );
}
