import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HardDrive,
  Server,
  Monitor,
  MapPin,
} from 'lucide-react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const PALETTE = {
  light: {
    chart: ['#6366F1', '#F97316', '#10B981', '#F43F5E', '#38BDF8', '#A78BFA'],
    tooltip: { background: '#FFFFFF', border: '1px solid #E6E8F5', color: '#1E202E', borderRadius: 10, fontSize: 13 },
    grid: '#EEF0FA',
    axis: '#9BA0B5',
  },
  dark: {
    chart: ['#818CF8', '#FB923C', '#34D399', '#FB7185', '#38BDF8', '#A78BFA'],
    tooltip: { background: '#171825', border: '1px solid #292B3A', color: '#E8E9F5', borderRadius: 10, fontSize: 13 },
    grid: '#22242F',
    axis: '#696D85',
  },
};

function truncate(label, max = 20) {
  if (!label) return '';
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function StatCard({ label, value, icon: Icon, tint, onClick }) {
  const tints = {
    primary: 'bg-primarySoft text-primary',
    danger: 'bg-dangerSoft text-danger',
    warning: 'bg-warningSoft text-warning',
    success: 'bg-successSoft text-success',
    accent: 'bg-accentSoft text-accent',
    info: 'bg-infoSoft text-info',
  };
  return (
    <button onClick={onClick} className="card card-interactive text-left w-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-faint font-semibold">{label}</p>
          <p className="text-3xl font-bold mt-2 text-ink">{value}</p>
        </div>
        <div className={`icon-badge ${tints[tint]}`}>
          <Icon size={18} />
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const { theme } = useTheme();
  const colors = PALETTE[theme];

  const [complianceStats, setComplianceStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [modal, setModal] = useState(null); // { title, kind, rows }
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    api.get('/compliance/summary/stats').then((r) => setComplianceStats(r.data));
    api.get('/inventory/summary/stats').then((r) => setInventoryStats(r.data));
    api.get('/compliance').then((r) => {
      const upcomingItems = r.data.filter((c) => c.status !== 'Completed' && c.due_date).slice(0, 6);
      setUpcoming(upcomingItems);
    });
  }, []);

  const toChartData = (obj = {}) => Object.entries(obj).map(([name, value]) => ({ name, value }));
  const categoryData = complianceStats ? toChartData(complianceStats.byCategory) : [];
  const departmentData = inventoryStats ? toChartData(inventoryStats.byDepartment) : [];

  const openDetail = async (kind) => {
    setModalLoading(true);
    let title = '';
    let type = 'compliance';
    let rows = [];

    try {
      if (kind === 'totalCompliance') {
        title = 'All Compliances';
        rows = (await api.get('/compliance')).data;
      } else if (kind === 'overdue') {
        title = 'Overdue Compliances';
        rows = (await api.get('/compliance', { params: { status: 'Overdue' } })).data;
      } else if (kind === 'dueSoon') {
        title = 'Due in the Next 7 Days';
        const all = (await api.get('/compliance')).data;
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        rows = all.filter((c) => c.status !== 'Completed' && c.due_date >= today && c.due_date <= in7);
      } else if (kind === 'completed') {
        title = 'Completed Compliances';
        rows = (await api.get('/compliance', { params: { status: 'Completed' } })).data;
      } else if (kind === 'totalAssets') {
        title = 'All Assets';
        type = 'inventory';
        rows = (await api.get('/inventory')).data;
      } else if (kind === 'servers') {
        title = 'Servers';
        type = 'inventory';
        rows = (await api.get('/inventory', { params: { asset_type: 'SERVER' } })).data;
      } else if (kind === 'desktops') {
        title = 'Desktops';
        type = 'inventory';
        rows = (await api.get('/inventory', { params: { asset_type: 'DESKTOP' } })).data;
      } else if (kind === 'locations') {
        title = 'Assets by Location';
        type = 'locationSummary';
        rows = (await api.get('/inventory')).data;
      }
    } finally {
      setModal({ title, type, rows });
      setModalLoading(false);
    }
  };

  const totalAssets = inventoryStats?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink">Dashboard</h2>
        <p className="text-sm text-muted mt-1">Overview of MCX compliances and IT asset inventory</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Compliances"
          value={complianceStats?.total ?? '—'}
          icon={ClipboardList}
          tint="primary"
          onClick={() => openDetail('totalCompliance')}
        />
        <StatCard
          label="Overdue"
          value={complianceStats?.overdue ?? '—'}
          icon={AlertTriangle}
          tint="danger"
          onClick={() => openDetail('overdue')}
        />
        <StatCard
          label="Due in 7 Days"
          value={complianceStats?.dueSoon ?? '—'}
          icon={Clock}
          tint="warning"
          onClick={() => openDetail('dueSoon')}
        />
        <StatCard
          label="Completed"
          value={complianceStats?.completed ?? '—'}
          icon={CheckCircle2}
          tint="success"
          onClick={() => openDetail('completed')}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={totalAssets}
          icon={HardDrive}
          tint="accent"
          onClick={() => openDetail('totalAssets')}
        />
        <StatCard
          label="Servers"
          value={inventoryStats?.byType?.SERVER ?? 0}
          icon={Server}
          tint="info"
          onClick={() => openDetail('servers')}
        />
        <StatCard
          label="Desktops"
          value={inventoryStats?.byType?.DESKTOP ?? 0}
          icon={Monitor}
          tint="primary"
          onClick={() => openDetail('desktops')}
        />
        <StatCard
          label="Locations"
          value={inventoryStats ? Object.keys(inventoryStats.byLocation || {}).length : '—'}
          icon={MapPin}
          tint="accent"
          onClick={() => openDetail('locations')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-ink mb-1">Compliance by Category</h3>
          <p className="text-xs text-faint mb-4">Number of tracked items per category</p>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(260, categoryData.length * 32)}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={colors.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 11, fill: colors.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => truncate(v, 20)}
                />
                <Tooltip
                  contentStyle={colors.tooltip}
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  formatter={(value) => [value, 'Items']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="value" fill={colors.chart[0]} radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-faint">No compliance data yet. Add one to get started.</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-ink mb-1">Inventory by Department</h3>
          <p className="text-xs text-faint mb-4">Share of assets assigned per department</p>
          {departmentData.length > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                  >
                    {departmentData.map((_, i) => (
                      <Cell key={i} fill={colors.chart[i % colors.chart.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={colors.tooltip} formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-ink">{totalAssets}</span>
                <span className="text-xs text-faint uppercase tracking-wide">Assets</span>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                {departmentData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: colors.chart[i % colors.chart.length] }}
                    />
                    {d.name} · {d.value}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-faint">No inventory data yet. Upload your asset sheet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Upcoming / Pending Compliances</h3>
          <Link to="/compliance" className="text-sm text-primary font-medium hover:text-primaryStrong">
            View all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-faint">Nothing pending. You're all caught up.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-ink">{c.title}</td>
                  <td>{c.category || '—'}</td>
                  <td>{c.due_date || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        c.status === 'Overdue' ? 'badge-overdue' : c.status === 'In Progress' ? 'badge-progress' : 'badge-pending'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)} wide>
          {modalLoading ? (
            <p className="text-sm text-faint">Loading…</p>
          ) : modal.rows.length === 0 ? (
            <p className="text-sm text-faint">No records found.</p>
          ) : modal.type === 'compliance' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {modal.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.title}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.due_date || '—'}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === 'Overdue' ? 'badge-overdue' : r.status === 'Completed' ? 'badge-completed' : r.status === 'In Progress' ? 'badge-progress' : 'badge-pending'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : modal.type === 'inventory' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {modal.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.asset_id}</td>
                    <td>{r.asset_type}</td>
                    <td>{r.department || '—'}</td>
                    <td>{r.location || '—'}</td>
                    <td>
                      <span className="badge bg-surfaceAlt text-muted">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Assets</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  modal.rows.reduce((acc, r) => {
                    const key = r.location || 'Unspecified';
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([loc, count]) => (
                  <tr key={loc}>
                    <td className="font-medium text-ink">{loc}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}