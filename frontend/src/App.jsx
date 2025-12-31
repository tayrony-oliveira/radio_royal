import { NavLink, Route, Routes } from "react-router-dom";
import PublicRadio from "./PublicRadio.jsx";
import HeaderPlayer from "./HeaderPlayer.jsx";
import NewsDetail from "./NewsDetail.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import AdminGate from "./AdminGate.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-grid py-2">
          <div className="header-brand">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 240 56" role="img" aria-hidden="true">
                <rect x="0" y="8" width="40" height="40" rx="12" />
                <path className="logo-stroke" d="M9 22c3-7 19-7 22 0" />
                <rect className="logo-stroke" x="6.5" y="22" width="5" height="8" rx="2.5" />
                <rect className="logo-stroke" x="28.5" y="22" width="5" height="8" rx="2.5" />
                <text x="20" y="35" textAnchor="middle" className="logo-monogram">
                  R
                </text>
                <text x="56" y="34" className="logo-title">
                  Radio Royal
                </text>
                <text x="56" y="48" className="logo-subtitle">
                  ESTUDIO WEB AO VIVO
                </text>
              </svg>
            </div>
          </div>
          <div className="header-air-slot">
            <HeaderPlayer />
          </div>
          <nav className="nav nav-pills header-nav">
            <NavLink className="nav-link" to="/">
              Publico
            </NavLink>
            <NavLink className="nav-link" to="/admin">
              Admin
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<PublicRadio />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminDashboard />
              </AdminGate>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
