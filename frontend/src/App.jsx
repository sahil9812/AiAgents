import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import UpgradePage from './pages/UpgradePage';
import LandingPage from './pages/LandingPage';
import WebCreatorPage from './pages/WebCreatorPage';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  return localStorage.getItem('token') ? <Navigate to="/chat" replace /> : children;
}

function AdminLoginRoute({ children }) {
  const token = localStorage.getItem('token');
  if (token) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/chat" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/admin-login" replace />;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.role === 'admin' ? children : <Navigate to="/chat" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/admin-login" element={<AdminLoginRoute><AdminLoginPage /></AdminLoginRoute>} />
        <Route path="/reset-password" element={<AuthPage />} />

        <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/creator" element={<PrivateRoute><WebCreatorPage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/upgrade" element={<PrivateRoute><UpgradePage /></PrivateRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
