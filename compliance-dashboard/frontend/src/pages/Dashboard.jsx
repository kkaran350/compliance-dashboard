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
  Legend,
} from 'recharts';
import api from '../api.js';
import { Link } from 'react-router-dom';

const COLORS = ['#3457d5', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

function StatCard({ label, value, tone = 'slate' }) {
  const toneMap = {
    slate: 'text-slate-800',
    red: 'text-red-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    brand: 'text-brand-600',
  };
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${toneMap[tone]}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [complianceStats, setComplianceStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    api.get('/compliance/summary/stats').then((r) => setComplianceStats(r.data));
    api.get('/inventory/summary/stats').then((r) => setInventoryStats(r.data));
    api.get('/compliance', { params: { status: undefined } }).then((r) => {
      const upcomingItems = r.data
        .filter((c) => c.status !== 'Completed' && c.due_date)
        .slice(0, 6);
      setUpcoming(upcomingItems);
    });
  }, []);

  const toChartData = (obj = {}) => Object.entries(obj).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of MCX compliances and IT asset inventory</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Compliances" value={complianceStats?.total ?? '—'} tone="brand" />
        <StatCard label="Overdue" value={complianceStats?.overdue ?? '—'} tone="red" />
        <StatCard label="Due in 7 Days" value={complianceStats?.dueSoon ?? '—'} tone="amber" />
        <StatCard label="Completed" value={complianceStats?.completed ?? '—'} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value={inventoryStats?.total ?? '—'} tone="brand" />
        <StatCard
          label="Servers"
          value={inventoryStats?.byType?.SERVER ?? 0}
          tone="slate"
        />
        <StatCard
          label="Desktops"
          value={inventoryStats?.byType?.DESKTOP ?? 0}
          tone="slate"
        />
        <StatCard
          label="Locations"
          value={inventoryStats ? Object.keys(inventoryStats.byLocation || {}).length : '—'}
          tone="slate"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Compliance by Category</h3>
          {complianceStats && Object.keys(complianceStats.byCategory || {}).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={toChartData(complianceStats.byCategory)}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3457d5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No compliance data yet. Add one to get started.</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Inventory by Department</h3>
          {inventoryStats && Object.keys(inventoryStats.byDepartment || {}).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={toChartData(inventoryStats.byDepartment)}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {toChartData(inventoryStats.byDepartment).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No inventory data yet. Upload your asset sheet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Upcoming / Pending Compliances</h3>
          <Link to="/compliance" className="text-sm text-brand-600 font-medium hover:underline">
            View all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing pending. You're all caught up.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2">Title</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Due Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium text-slate-700">{c.title}</td>
                  <td className="py-2 text-slate-500">{c.category || '—'}</td>
                  <td className="py-2 text-slate-500">{c.due_date || '—'}</td>
                  <td className="py-2">
                    <span
                      className={`badge ${
                        c.status === 'Overdue'
                          ? 'badge-overdue'
                          : c.status === 'In Progress'
                          ? 'badge-progress'
                          : 'badge-pending'
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
    </div>
  );
}
