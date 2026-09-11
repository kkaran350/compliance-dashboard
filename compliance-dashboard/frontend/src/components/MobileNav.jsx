import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Server, FileText, Sun, Moon, LogOut, Menu, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import NotificationBell from './NotificationBell.jsx';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliances' },
  { to: '/inventory', icon: Server, label: 'Inventory' },
  { to: '/forms', icon: FileText, label: 'Forms' },
];

export default function MobileNav({ user, logout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="md:hidden bg-surface border-b border-line">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <ShieldCheck size={14} className="text-white" />
          </div>
          <h1 className="font-bold text-ink">Compliance Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button className="btn-secondary" onClick={() => setOpen((o) => !o)}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <button
            className="nav-link nav-link-inactive w-full"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            className="nav-link w-full text-danger hover:bg-dangerSoft"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={18} />
            Log out ({user?.username})
          </button>
        </div>
      )}
    </div>
  );
}