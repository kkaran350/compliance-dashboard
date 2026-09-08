import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api.js';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/compliance', { params: { status: 'Overdue' } })
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surfaceAlt transition-colors"
        title="Overdue reminders"
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-11 w-80 bg-surface border border-line rounded-2xl z-50 overflow-hidden"
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Overdue Compliances</h4>
              <button onClick={() => setOpen(false)} className="text-faint hover:text-ink transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-faint px-4 py-4">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-faint px-4 py-4">Nothing overdue. You're all caught up.</p>
              ) : (
                items.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-3 border-b border-line/70 last:border-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-danger mt-0.5">Due {item.due_date}</p>
                  </div>
                ))
              )}
            </div>
            {items.length > 0 && (
              <Link
                to="/compliance?status=Overdue"
                onClick={() => setOpen(false)}
                className="block text-center text-sm text-primary font-medium py-3 border-t border-line hover:bg-surfaceAlt transition-colors"
              >
                View all {items.length} overdue →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}