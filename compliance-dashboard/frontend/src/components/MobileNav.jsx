import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function MobileNav({ user, logout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="md:hidden bg-white border-b border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="font-bold text-slate-800">Compliance Hub</h1>
        <button className="btn-secondary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          <NavLink to="/" end className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100" onClick={() => setOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/compliance" className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100" onClick={() => setOpen(false)}>
            Compliances
          </NavLink>
          <NavLink to="/inventory" className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100" onClick={() => setOpen(false)}>
            Inventory
          </NavLink>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out ({user?.username})
          </button>
        </div>
      )}
    </div>
  );
}
