import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, Download, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';

const CATEGORIES = [
  'MCX Circular',
  'Margin Reporting',
  'Client KYC',
  'Risk Management',
  'Audit',
  'SEBI Reporting',
  'Membership Renewal',
  'Other',
];
const FREQUENCIES = ['One-time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annual'];
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];

const emptyForm = {
  title: '',
  exchange: '',
  category: CATEGORIES[0],
  reference_no: '',
  description: '',
  frequency: 'One-time',
  due_date: '',
  status: 'Pending',
  notes: '',
};

function StatusBadge({ status }) {
  const cls =
    status === 'Overdue' ? 'badge-overdue' : status === 'Completed' ? 'badge-completed' : status === 'In Progress' ? 'badge-progress' : 'badge-pending';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function Compliance() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    category: '',
    q: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;
    if (filters.q) params.q = filters.q;
    const res = await api.get('/compliance', { params });
    setItems(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFile(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      exchange: item.exchange || '',
      category: item.category || CATEGORIES[0],
      reference_no: item.reference_no || '',
      description: item.description || '',
      frequency: item.frequency || 'One-time',
      due_date: item.due_date || '',
      status: item.status || 'Pending',
      notes: item.notes || '',
    });
    setFile(null);
    setError('');
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      if (file) fd.append('file', file);

      if (editing) {
        await api.put(`/compliance/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/compliance', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save compliance.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this compliance record? This cannot be undone.')) return;
    await api.delete(`/compliance/${id}`);
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
      const res = await api.post('/compliance/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const markComplete = async (item) => {
    const fd = new FormData();
    fd.append('status', 'Completed');
    fd.append('completed_date', new Date().toISOString().slice(0, 10));
    fd.append('title', item.title);
    fd.append('exchange', item.exchange || '');
    fd.append('category', item.category || '');
    fd.append('reference_no', item.reference_no || '');
    fd.append('description', item.description || '');
    fd.append('frequency', item.frequency || 'One-time');
    fd.append('due_date', item.due_date || '');
    fd.append('notes', item.notes || '');
    await api.put(`/compliance/${item.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    load();
  };

  const download = (item) => {
    api
      .get(`/compliance/${item.id}/file`, { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = item.file_name || 'compliance-file';
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert('No file attached or file could not be downloaded.'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">
            Compliances <span className="text-base font-normal text-faint">({items.length})</span>
          </h2>
          <p className="text-sm text-muted mt-1">Track MCX and regulatory compliance items</p>
        </div>
        <div className="flex gap-3">
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} />
            {importing ? 'Importing…' : 'Bulk Upload Tracker'}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            Add / Upload
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`card ${importResult.error ? '!border-danger/40' : '!border-success/40'}`}>
          {importResult.error ? (
            <p className="text-sm text-danger">{importResult.error}</p>
          ) : (
            <div className="text-sm text-success">
              <p>
                Imported {importResult.imported} compliance item(s)
                {importResult.skippedCount > 0 && ` (${importResult.skippedCount} skipped — missing a title)`}.
              </p>
              {importResult.sheets?.length > 0 && (
                <p className="text-xs text-faint mt-1">
                  {importResult.sheets.map((s) => `${s.sheet}: ${s.imported}${s.note ? ` (${s.note})` : ''}`).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="w-40">
          <label className="label">Status</label>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="label">Category</label>
          <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Search title, reference no, description…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-faint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-faint">No compliances found. Add your first one above.</p>
        ) : (
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Exchange</th>
                <th>Category</th>
                <th>Reference No.</th>
                <th>Frequency</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="align-top">
                  <td className="text-faint">{idx + 1}</td>
                  <td className="font-medium text-ink">{item.title}</td>
                  <td>{item.exchange || '—'}</td>
                  <td>{item.category || '—'}</td>
                  <td>{item.reference_no || '—'}</td>
                  <td>{item.frequency}</td>
                  <td>{item.due_date || '—'}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.file_name ? (
                      <button onClick={() => download(item)} className="text-primary hover:text-primaryStrong text-xs inline-flex items-center gap-1" title={item.file_name}>
                        <Download size={12} /> File
                      </button>
                    ) : (
                      <span className="text-faint text-xs">None</span>
                    )}
                  </td>
                  <td className="space-x-3 whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => openEdit(item)}>
                      <Pencil size={13} />
                    </button>
                    {item.status !== 'Completed' && (
                      <button className="text-xs text-success hover:text-success/80 inline-flex items-center" onClick={() => markComplete(item)} title="Mark done">
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button className="text-xs text-danger hover:text-danger/80 inline-flex items-center" onClick={() => remove(item.id)} title="Delete">
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
        <Modal title={editing ? 'Edit Compliance' : 'Add / Upload Compliance'} onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-dangerSoft text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div>
              <label className="label">Title *</label>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. MCX Monthly Client Margin Reporting"
              />
            </div>

            <div>
              <label className="label">Exchange</label>
              <input className="input" value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })} placeholder="e.g. MCX, BSE, NSE" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Reference No.</label>
                <input className="input" value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} placeholder="MCX/circular/2026/..." />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Frequency</label>
                <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
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

            <div>
              <label className="label">Attach File (PDF or Excel) {editing?.file_name && '— leave blank to keep existing file'}</label>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primarySoft file:text-primary file:text-xs file:font-medium"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {editing?.file_name && !file && <p className="text-xs text-faint mt-1">Current file: {editing.file_name}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Compliance'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}