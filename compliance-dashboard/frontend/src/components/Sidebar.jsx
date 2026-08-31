import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Server, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliances' },
  { to: '/inventory', icon: Server, label: 'Inventory' },
];

export default function Sidebar({ user, logout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-line flex-col hidden md:flex">
      <div className="px-6 py-6 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-ink tracking-tight">Compliance Hub</h1>
        </div>
        <p className="text-xs text-faint mt-2 tracking-wide">
          MCX Compliance &amp; Asset Inventory
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
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