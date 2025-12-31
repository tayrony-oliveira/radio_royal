import { useEffect, useMemo, useState } from "react";

const storageKey = "radio-royal-admin-token";

export default function AdminGate({ children }) {
  const adminPassword = useMemo(() => {
    return import.meta.env.VITE_ADMIN_PASSWORD || "royal";
  }, []);

  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(storageKey);
    if (token && token === adminPassword) {
      setAuthorized(true);
    }
  }, [adminPassword]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (password.trim() === adminPassword) {
      localStorage.setItem(storageKey, adminPassword);
      setAuthorized(true);
      setError("");
      setPassword("");
      return;
    }
    setError("Senha incorreta.");
  };

  const handleLogout = () => {
    localStorage.removeItem(storageKey);
    setAuthorized(false);
  };

  if (authorized) {
    return (
      <div>
        <div className="admin-toolbar">
          <span className="admin-badge">Admin ativo</span>
          <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
            Sair
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="card shadow-lg auth-card">
        <div className="card-body">
          <h3 className="card-title">Acesso administrativo</h3>
          <p className="text-muted small">
            Digite a senha definida em <code>VITE_ADMIN_PASSWORD</code>.
          </p>
          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <input
              type="password"
              className="form-control"
              placeholder="Senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
            {error && <div className="alert alert-danger mb-0">{error}</div>}
            <button className="btn btn-primary" type="submit">
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
