import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Sun, Moon } from 'lucide-react';
import api from '../api.js';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      onLogin(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 btn-secondary !px-3 !py-2"
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4 shadow-sm">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Compliance Hub</h1>
          <p className="text-sm text-muted mt-1">MCX Compliance &amp; Asset Inventory Dashboard</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          {error && (
            <div className="bg-dangerSoft text-danger text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-faint text-center mt-4">
          First time setup? Run <code className="text-muted">npm run seed</code> in the backend
          to create the admin account (see README).
        </p>
      </div>
    </div>
  );
}