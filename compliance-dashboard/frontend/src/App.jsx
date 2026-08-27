import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Compliance from './pages/Compliance.jsx';
import Inventory from './pages/Inventory.jsx';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';

function useAuth() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return { user, login, logout };
}

function Protected({ user, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Shell({ user, logout, children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} logout={logout} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav user={user} logout={logout} />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();
  const navigate = typeof window !== 'undefined' ? null : null; // placeholder (navigate used inside Login)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login onLogin={login} />}
        />
        <Route
          path="/"
          element={
            <Protected user={user}>
              <Shell user={user} logout={logout}>
                <Dashboard />
              </Shell>
            </Protected>
          }
        />
        <Route
          path="/compliance"
          element={
            <Protected user={user}>
              <Shell user={user} logout={logout}>
                <Compliance />
              </Shell>
            </Protected>
          }
        />
        <Route
          path="/inventory"
          element={
            <Protected user={user}>
              <Shell user={user} logout={logout}>
                <Inventory />
              </Shell>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
