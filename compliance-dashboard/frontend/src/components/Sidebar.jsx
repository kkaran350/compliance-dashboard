import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const linkBase =
  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition';
const linkActive = 'bg-brand-600 text-white';
const linkInactive = 'text-slate-600 hover:bg-slate-100';

export default function Sidebar({ user, logout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
      <div className="px-6 py-5 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">Compliance Hub</h1>
        <p className="text-xs text-slate-500 mt-0.5">MCX Compliance & Asset Inventory</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/compliance"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Compliances
        </NavLink>
        <NavLink
          to="/inventory"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Inventory
        </NavLink>
      </nav>

      <div className="px-4 py-4 border-t border-slate-200">
        <p className="text-sm font-medium text-slate-800">{user?.name}</p>
        <p className="text-xs text-slate-500 mb-3">@{user?.username} · {user?.role}</p>
        <button onClick={handleLogout} className="btn-secondary w-full">
          Log out
        </button>
      </div>
    </aside>
  );
}
