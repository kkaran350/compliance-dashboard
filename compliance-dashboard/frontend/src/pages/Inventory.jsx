import React, { useEffect, useRef, useState } from 'react';
import api from '../api.js';

const ASSET_TYPES = ['SERVER', 'DESKTOP', 'LAPTOP', 'NETWORK', 'OTHER'];
const STATUSES = ['IN USE', 'IDLE', 'UNDER REPAIR', 'DECOMMISSIONED'];

const emptyForm = {
  asset_id: '',
  asset_type: 'DESKTOP',
  processor: '',
  ram: '',
  storage: '',
  os: '',
  ip_address: '',
  computer_name: '',
  user_name: '',
  department: '',
  location: '',
  status: 'IN USE',
  notes: '',
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ department: '', location: '', asset_type: '', q: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    const res = await api.get('/inventory', { params });
    setItems(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const departments = [...new Set(items.map((i) => i.department).filter(Boolean))];
  const locations = [...new Set(items.map((i) => i.location).filter(Boolean))];

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...emptyForm, ...item });
    setError('');
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/inventory/${editing.id}`, form);
      } else {
        await api.post('/inventory', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save asset.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this asset record?')) return;
    await api.delete(`/inventory/${id}`);
    load();
  };

  const handleImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/inventory/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Inventory</h2>
          <p className="text-sm text-slate-500">Servers, desktops and other IT assets</p>
        </div>
        <div className="flex gap-3">
          <label className="btn-secondary cursor-pointer">
            {importing ? 'Importing…' : 'Bulk Upload (Excel/CSV)'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
          <button className="btn-primary" onClick={openAdd}>
            + Add Asset
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`card ${importResult.error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}
        >
          {importResult.error ? (
            <p className="text-sm text-red-700">{importResult.error}</p>
          ) : (
            <p className="text-sm text-emerald-700">
              Imported {importResult.imported} of {importResult.totalRows} rows
              {importResult.skippedCount > 0 && ` (${importResult.skippedCount} skipped — missing Asset ID/Computer Name)`}.
            </p>
          )}
        </div>
      )}

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <label className="label">Department</label>
          <select
            className="input"
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label">Location</label>
          <select
            className="input"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          >
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label">Asset Type</label>
          <select
            className="input"
            value={filters.asset_type}
            onChange={(e) => setFilters({ ...filters, asset_type: e.target.value })}
          >
            <option value="">All</option>
            {ASSET_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Asset ID, computer name, user, IP…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">
            No assets yet. Use "Bulk Upload" to import your Excel sheet, or add one manually.
          </p>
        ) : (
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3">Asset ID</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Processor</th>
                <th className="pb-2 pr-3">RAM</th>
                <th className="pb-2 pr-3">Storage</th>
                <th className="pb-2 pr-3">OS</th>
                <th className="pb-2 pr-3">IP Address</th>
                <th className="pb-2 pr-3">Computer Name</th>
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Department</th>
                <th className="pb-2 pr-3">Location</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-700">{item.asset_id}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.asset_type}</td>
                  <td className="py-2 pr-3 text-slate-500 max-w-[220px] truncate" title={item.processor}>
                    {item.processor}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{item.ram}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.storage}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.os}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.ip_address}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.computer_name}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.user_name}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.department}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.location}</td>
                  <td className="py-2 pr-3">
                    <span className="badge bg-slate-100 text-slate-700">{item.status}</span>
                  </td>
                  <td className="py-2 pr-3 space-x-2 whitespace-nowrap">
                    <button className="text-xs text-slate-600 hover:underline" onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => remove(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{editing ? 'Edit Asset' : 'Add Asset'}</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowForm(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Asset ID</label>
                  <input className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} />
                </div>
                <div>
                  <label className="label">Asset Type</label>
                  <select className="input" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                    {ASSET_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Processor</label>
                <input className="input" value={form.processor} onChange={(e) => setForm({ ...form, processor: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">RAM</label>
                  <input className="input" value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} placeholder="e.g. 16GB" />
                </div>
                <div>
                  <label className="label">Storage</label>
                  <input className="input" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} placeholder="e.g. 512GB" />
                </div>
              </div>

              <div>
                <label className="label">Operating System</label>
                <input className="input" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">IP Address</label>
                  <input className="input" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
                </div>
                <div>
                  <label className="label">Computer Name</label>
                  <input className="input" value={form.computer_name} onChange={(e) => setForm({ ...form, computer_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">User Name</label>
                  <input className="input" value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Department</label>
                  <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Location</label>
                  <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
