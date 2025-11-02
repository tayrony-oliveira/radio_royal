import { useEffect, useRef } from 'react';

export default function MixOutput({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <section className="mix-output">
      <h2>Saída do Mix</h2>
      <p>
        Utilize este player para monitorar o mix final. Alguns navegadores exigem interação do
        usuário antes de liberar o áudio.
      </p>
      <audio ref={audioRef} controls autoPlay />
    </section>
  );
}
