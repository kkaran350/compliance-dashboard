import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload, Pencil, Trash2 } from 'lucide-react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';

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
      const res = await api.post('/inventory/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
          <h2 className="text-2xl font-bold text-ink">
            Inventory <span className="text-base font-normal text-faint">({items.length})</span>
          </h2>
          <p className="text-sm text-muted mt-1">Servers, desktops and other IT assets</p>
        </div>
        <div className="flex gap-3">
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} />
            {importing ? 'Importing…' : 'Bulk Upload'}
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
            <Plus size={16} />
            Add Asset
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`card ${importResult.error ? '!border-danger/40' : '!border-success/40'}`}>
          {importResult.error ? (
            <p className="text-sm text-danger">{importResult.error}</p>
          ) : (
            <p className="text-sm text-success">
              Imported {importResult.imported} of {importResult.totalRows} rows
              {importResult.skippedCount > 0 && ` (${importResult.skippedCount} skipped — missing Asset ID/Computer Name)`}.
            </p>
          )}
        </div>
      )}

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <label className="label">Department</label>
          <select className="input" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label">Location</label>
          <select className="input" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label">Asset Type</label>
          <select className="input" value={filters.asset_type} onChange={(e) => setFilters({ ...filters, asset_type: e.target.value })}>
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
          <p className="text-sm text-faint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-faint">No assets yet. Use "Bulk Upload" to import your Excel sheet, or add one manually.</p>
        ) : (
          <table className="data-table min-w-[1100px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset ID</th>
                <th>Type</th>
                <th>Processor</th>
                <th>RAM</th>
                <th>Storage</th>
                <th>OS</th>
                <th>IP Address</th>
                <th>Computer Name</th>
                <th>User</th>
                <th>Department</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="text-faint">{idx + 1}</td>
                  <td className="font-medium text-ink">{item.asset_id}</td>
                  <td>{item.asset_type}</td>
                  <td className="max-w-[220px] truncate" title={item.processor}>
                    {item.processor}
                  </td>
                  <td>{item.ram}</td>
                  <td>{item.storage}</td>
                  <td>{item.os}</td>
                  <td>{item.ip_address}</td>
                  <td>{item.computer_name}</td>
                  <td>{item.user_name}</td>
                  <td>{item.department}</td>
                  <td>{item.location}</td>
                  <td>
                    <span className="badge bg-surfaceAlt text-muted">{item.status}</span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => openEdit(item)}>
                      <Pencil size={13} />
                    </button>
                    <button className="text-xs text-danger hover:text-danger/80 inline-flex items-center" onClick={() => remove(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Asset' : 'Add Asset'} onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-dangerSoft text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

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
        </Modal>
      )}
    </div>
  );
}