import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.jsx';
import PublicRadio from './PublicRadio.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRadio />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
