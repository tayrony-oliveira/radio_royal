import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'radio-royal-public-chat';

const friendlyNames = ['Visitante', 'Ouvinte', 'Royal Fan', 'Convidado'];

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

  const defaultName = useMemo(() => friendlyNames[Math.floor(Math.random() * friendlyNames.length)], []);

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
    setMessages((previous) => [payload, ...previous].slice(0, 50));
    setMessage('');
    if (!name.trim()) {
      setName(displayName);
    }
  };

  return (
    <div className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex flex-column gap-3">
        <div>
          <h2 className="h5 mb-1">Chat da audiência</h2>
          <p className="text-muted mb-0">Converse com outros ouvintes em tempo real.</p>
        </div>

        <form className="row g-2" onSubmit={handleSubmit}>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold">Seu nome</label>
            <input
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={defaultName}
            />
          </div>
          <div className="col-12 col-md-8">
            <label className="form-label fw-semibold">Mensagem</label>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Envie um alô para a rádio"
                maxLength={140}
              />
              <button type="submit" className="btn btn-primary flex-shrink-0">
                Enviar
              </button>
            </div>
            <small className="text-muted">As mensagens ficam apenas neste navegador.</small>
          </div>
        </form>

        <div className="public-chat__log border rounded p-3 bg-light overflow-auto">
          {messages.length ? (
            <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
              {messages.map((entry) => (
                <li key={entry.id} className="bg-white rounded shadow-sm p-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>{entry.author}</strong>
                    <small className="text-muted">{formatTimestamp(entry.createdAt)}</small>
                  </div>
                  <p className="mb-0">{entry.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-0">Nenhuma mensagem ainda. Seja o primeiro a comentar!</p>
          )}
        </div>
      </div>
    </div>
  );
}
