import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiDatabase, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiTrendingUp, FiBarChart2, FiLoader, FiPercent, FiLayers, FiMapPin
} from 'react-icons/fi'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts'

// ── colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  reconciled:               '#10b981',
  unreconciled:             '#ef4444',
  surplus_assets:           '#f97316',
  exist_erp_not_physical:   '#8b5cf6',
  pending:                  '#9ca3af',
  matched:                  '#008080',
  ai_matched:               '#8E288D',
  manual:                   '#f59e0b',
}

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString()
const pct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, gradient, textColor = 'text-white' }) => (
  <div className={`rounded-xl shadow-lg p-5 ${gradient} text-white transform hover:scale-105 transition-transform`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${textColor}`}>{value}</p>
        {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      </div>
      {Icon && (
        <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
          <Icon className="h-7 w-7" />
        </div>
      )}
    </div>
  </div>
)

// ── Horizontal bar row ────────────────────────────────────────────────────────
const HBar = ({ name, rate, reconciled, total, color }) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium text-gray-700 truncate max-w-[55%]" title={name}>{name}</span>
      <span className="text-sm font-bold" style={{ color }}>{rate}%
        <span className="text-xs text-gray-400 font-normal ml-1">({fmt(reconciled)}/{fmt(total)})</span>
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className="h-3 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }} />
    </div>
  </div>
)

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          {p.name === 'Rate' ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const Analytics = () => {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview') // overview | category | branch | division | monthly

  useEffect(() => {
    axios.get('/api/reconciliation/analytics')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to fetch analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
    </div>
  )

  if (!data || data.total_reconciliations === 0) return (
    <div className="px-4 py-16 text-center">
      <FiBarChart2 className="mx-auto h-14 w-14 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-700">No analytics data yet</h3>
      <p className="text-sm text-gray-400 mt-1">Complete and approve reconciliations to see insights here.</p>
    </div>
  )

  const kpi = data.approval_kpis || {}

  // ── Donut data ────────────────────────────────────────────────────────────
  const donutData = [
    { name: 'Reconciled',           value: kpi.reconciled || 0,             color: COLORS.reconciled },
    { name: 'Unreconciled',         value: kpi.unreconciled || 0,           color: COLORS.unreconciled },
    { name: 'Surplus Assets',       value: kpi.surplus_assets || 0,         color: COLORS.surplus_assets },
    { name: 'ERP not Physical',     value: kpi.exist_erp_not_physical || 0, color: COLORS.exist_erp_not_physical },
    { name: 'Duplicated',           value: kpi.duplicated || 0,             color: '#ec4899' },
    { name: 'Unique',               value: kpi.unique || 0,                 color: '#14b8a6' },
    { name: 'Pending',              value: kpi.pending || 0,                color: COLORS.pending },
  ].filter(d => d.value > 0)

  const tabs = [
    { key: 'overview',  label: 'Overview'   },
    { key: 'category',  label: 'Category'   },
    { key: 'branch',    label: 'Branch'     },
    { key: 'division',  label: 'Division'   },
    { key: 'monthly',   label: 'Monthly'    },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.scope === 'all' ? 'System-wide · all reconciliations' : 'Your reconciliations only'}
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Total ERP Assets"      value={fmt(kpi.total_erp_assets)}   icon={FiDatabase}    gradient="bg-gradient-to-br from-[#8E288D] to-[#7A1E79]" />
        <KpiCard label="Physical Count"        value={fmt(kpi.physical_count)}     icon={FiLayers}      gradient="bg-gradient-to-br from-blue-600 to-blue-700" />
        <KpiCard label="Reconciled"            value={fmt(kpi.reconciled)}         icon={FiCheckCircle} gradient="bg-gradient-to-br from-green-500 to-green-600" />
        <KpiCard label="Reconciliation Rate"   value={pct(kpi.reconciliation_rate)} icon={FiPercent}    gradient="bg-gradient-to-br from-teal-500 to-teal-600" />
        <KpiCard label="Unreconciled"          value={fmt(kpi.unreconciled)}       icon={FiXCircle}     gradient="bg-gradient-to-br from-red-500 to-red-600" />
        <KpiCard label="Surplus Assets"        value={fmt(kpi.surplus_assets)}     icon={FiAlertCircle} gradient="bg-gradient-to-br from-orange-500 to-orange-600" />
      </div>

      {/* secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-400">
          <p className="text-xs text-gray-500">Exist in ERP not Physical</p>
          <p className="text-2xl font-bold text-purple-600">{fmt(kpi.exist_erp_not_physical)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <p className="text-xs text-gray-500">Pending Approval</p>
          <p className="text-2xl font-bold text-gray-600">{fmt(kpi.pending)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#008080]">
          <p className="text-xs text-gray-500">Avg. Match Rate</p>
          <p className="text-2xl font-bold text-teal-600">{pct(data.average_match_rate)}</p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-[#8E288D] text-white shadow'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#8E288D]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut chart */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Reconciliation Status</h3>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%"
                  innerRadius={70} outerRadius={120}
                  paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={true}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => v.toLocaleString()} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Match type breakdown */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Match Type Breakdown</h3>
            <div className="space-y-4 mt-6">
              {[
                { label: 'Exact Matches',    value: data.total_rule_matched, color: COLORS.matched },
                { label: 'AI-Assisted',      value: data.total_ai_matched,   color: COLORS.ai_matched },
                { label: 'Near Match',       value: data.total_manual_review,color: '#3b82f6' },
              ].map(item => {
                const total = data.total_customer_records || 1
                const rate  = ((item.value / total) * 100).toFixed(1)
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>
                        {fmt(item.value)} ({rate}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${rate}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Reconciliations</p>
                <p className="text-xl font-bold text-green-600">{data.total_reconciliations}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Records Processed</p>
                <p className="text-xl font-bold text-teal-600">{fmt(data.total_customer_records)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiLayers className="text-[#8E288D]" /> Asset Reconciliation by Category
          </h3>
          {data.category_breakdown?.length ? (
            <>
              <div className="mb-6">
                {data.category_breakdown.map(c => (
                  <HBar key={c.name} name={c.name} rate={c.rate}
                    reconciled={c.reconciled} total={c.total} color={COLORS.matched} />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.category_breakdown} layout="vertical"
                  margin={{ left: 120, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={115} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Rate']} />
                  <Bar dataKey="rate" name="Rate" fill={COLORS.matched} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-8">No category data — approve records first</p>}
        </div>
      )}

      {/* ── Branch/District Tab ───────────────────────────────────────────── */}
      {activeTab === 'branch' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiMapPin className="text-[#8E288D]" /> Branch / District Performance
          </h3>
          {data.district_breakdown?.length ? (
            <>
              <div className="mb-6">
                {data.district_breakdown.map(d => (
                  <HBar key={d.name} name={d.name} rate={d.rate}
                    reconciled={d.reconciled} total={d.total} color="#3b82f6" />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.district_breakdown} layout="vertical"
                  margin={{ left: 130, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={125} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Rate']} />
                  <Bar dataKey="rate" name="Rate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-8">No district/branch data — approve records first</p>}
        </div>
      )}

      {/* ── Division/Department Tab ───────────────────────────────────────── */}
      {activeTab === 'division' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiBarChart2 className="text-[#8E288D]" /> Division / Department Performance
          </h3>
          {data.department_breakdown?.length ? (
            <>
              <div className="mb-6">
                {data.department_breakdown.map(d => (
                  <HBar key={d.name} name={d.name} rate={d.rate}
                    reconciled={d.reconciled} total={d.total} color={COLORS.ai_matched} />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.department_breakdown}
                  margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35}
                    textAnchor="end" interval={0} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Rate']} />
                  <Bar dataKey="rate" name="Rate" fill={COLORS.ai_matched} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-8">No department data — approve records first</p>}
        </div>
      )}

      {/* ── Monthly Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiTrendingUp className="text-[#8E288D]" /> Monthly Reconciliation Progress
          </h3>
          {data.monthly_trend?.length ? (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={data.monthly_trend}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]}
                  unit="%" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Line yAxisId="left"  type="monotone" dataKey="total"
                  name="Total Records" stroke="#9ca3af" strokeWidth={2} dot={true} />
                <Line yAxisId="left"  type="monotone" dataKey="matched"
                  name="Matched" stroke={COLORS.matched} strokeWidth={2} dot={true} />
                <Line yAxisId="right" type="monotone" dataKey="rate"
                  name="Rate (%)" stroke={COLORS.ai_matched} strokeWidth={2}
                  strokeDasharray="5 5" dot={true} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-8">No monthly data available yet</p>}
        </div>
      )}
    </div>
  )
}

export default Analytics
