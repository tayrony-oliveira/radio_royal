import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'radio-royal-public-chat';
const friendlyNames = ['Visitante', 'Ouvinte', 'Royal Fan', 'Convidado', 'Night Owl'];

function loadMessages() {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Não foi possível carregar as mensagens locais.', error);
    return [];
  }
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }
  try {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '';
  }
}

export default function PublicChat() {
  const [messages, setMessages] = useState(() => loadMessages());
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const defaultName = useMemo(
    () => friendlyNames[Math.floor(Math.random() * friendlyNames.length)],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.warn('Não foi possível salvar as mensagens locais.', error);
    }
  }, [messages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    const displayName = name.trim() || defaultName;
    const payload = {
      id: `${Date.now()}-${Math.random()}`,
      author: displayName,
      content: message.trim(),
      createdAt: new Date().toISOString()
    };
    setMessages((previous) => [payload, ...previous].slice(0, 60));
    setMessage('');
    if (!name.trim()) {
      setName(displayName);
    }
  };

  return (
    <div className="public-chat">
      <header className="public-chat__header">
        <div>
          <h2>Chat da audiência</h2>
          <p>As mensagens ficam apenas neste dispositivo. Participe do papo ao vivo!</p>
        </div>
        <span className="public-chat__counter">
          {messages.length ? `${messages.length} mensagens armazenadas` : 'Sem mensagens'}
        </span>
      </header>

      <form className="public-chat__form" onSubmit={handleSubmit}>
        <div className="public-chat__field">
          <label>Seu nome</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={defaultName}
            className="public-chat__input"
          />
        </div>
        <div className="public-chat__field public-chat__field--message">
          <label>Mensagem</label>
          <div className="public-chat__input-wrapper">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Envie um alô para a rádio"
              maxLength={160}
              className="public-chat__input"
            />
            <button type="submit" className="btn btn-primary">
              Enviar
            </button>
          </div>
        </div>
      </form>

      <div className="public-chat__log">
        {messages.length ? (
          <ul className="public-chat__messages">
            {messages.map((entry) => (
              <li key={entry.id} className="public-chat__message">
                <div className="public-chat__message-meta">
                  <strong>{entry.author}</strong>
                  <span>{formatTimestamp(entry.createdAt)}</span>
                </div>
                <p>{entry.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="public-chat__empty">
            <strong>Nenhuma mensagem ainda.</strong>
            Seja o primeiro a comentar e contar pra gente de onde está ouvindo!
          </div>
        )}
      </div>
    </div>
  );
}
