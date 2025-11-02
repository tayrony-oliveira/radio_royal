import { useEffect, useRef } from 'react';

export default function MixOutput({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.srcObject = stream || null;
    if (stream) {
      const element = audioRef.current;
      const tryPlay = () => {
        element
          .play()
          .then(() => {
            element.removeEventListener('click', tryPlay);
          })
          .catch(() => {
            element.addEventListener('click', tryPlay, { once: true });
          });
      };
      tryPlay();
    }
  }, [stream]);

  return (
    <section className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <h2 className="h5 mb-0">Saída do Mix</h2>
        <p className="text-muted mb-0">
          Utilize este player para monitorar o mix final. Alguns navegadores exigem interação do
          usuário antes de liberar o áudio.
        </p>
        <audio ref={audioRef} controls autoPlay className="w-100" />
      </div>
    </section>
  );
}
