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

// Helper for safe localStorage access
const getStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`localStorage access denied for ${key}:`, e);
    return null;
  }
};

function PrivateRoute({ children }) {
  const token = getStored('token');
  const user = getStored('user');
  return (token && user) ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const token = getStored('token');
  const user = getStored('user');
  return (token && user) ? <Navigate to="/chat" replace /> : children;
}

function AdminLoginRoute({ children }) {
  const token = getStored('token');
  const userStr = getStored('user');
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/chat" replace />;
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  return children;
}

function AdminRoute({ children }) {
  const token = getStored('token');
  const userStr = getStored('user');
  if (!token || !userStr) return <Navigate to="/admin-login" replace />;
  try {
    const user = JSON.parse(userStr);
    return user.role === 'admin' ? children : <Navigate to="/chat" replace />;
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/admin-login" replace />;
  }
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
