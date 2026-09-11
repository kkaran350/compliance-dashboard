import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Server,
  FileText,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  Clock,
  HardDrive,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import api from '../api.js';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliances' },
  { to: '/inventory', icon: Server, label: 'Inventory' },
  { to: '/forms', icon: FileText, label: 'Forms' },
];

const QUICK_STAT_TONES = {
  danger: 'bg-dangerSoft text-danger',
  warning: 'bg-warningSoft text-warning',
  accent: 'bg-accentSoft text-accent',
};

function QuickStat({ icon: Icon, label, value, tone, to }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-surfaceAlt transition-colors group"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${QUICK_STAT_TONES[tone]}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-faint truncate">{label}</p>
      </div>
      <span className="text-sm font-bold text-ink">{value ?? '—'}</span>
    </Link>
  );
}

export default function Sidebar({ user, logout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/compliance/summary/stats'), api.get('/inventory/summary/stats')]).then(
      ([c, i]) => setStats({ compliance: c.data, inventory: i.data })
    );
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-line flex-col hidden md:flex">
      <div className="px-6 py-6 border-b border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-ink tracking-tight">Compliance Hub</h1>
          </div>
          <NotificationBell />
        </div>
        <p className="text-xs text-faint mt-2 tracking-wide">
          MCX Compliance &amp; Asset Inventory
        </p>
      </div>

      <nav className="px-3 py-4 space-y-1 border-b border-line">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-faint px-2.5 mb-2">
          Quick Overview
        </p>
        <div className="space-y-1">
          <QuickStat
            icon={AlertTriangle}
            label="Overdue"
            value={stats?.compliance?.overdue}
            tone="danger"
            to="/compliance?status=Overdue"
          />
          <QuickStat
            icon={Clock}
            label="Due in 7 Days"
            value={stats?.compliance?.dueSoon}
            tone="warning"
            to="/compliance"
          />
          <QuickStat
            icon={HardDrive}
            label="Total Assets"
            value={stats?.inventory?.total}
            tone="accent"
            to="/inventory"
          />
        </div>
      </div>

      <div className="px-4 py-4 border-t border-line space-y-3">
        <button onClick={toggleTheme} className="btn-secondary w-full justify-center">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">{user?.name}</p>
            <p className="text-xs text-faint">
              @{user?.username} · <span className="text-primary">{user?.role}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-danger hover:bg-dangerSoft transition-colors"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}