import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import AIAnalysisModal from '../components/AIAnalysisModal'
import AIContextMenu from '../components/AIContextMenu'
import {
  FiArrowLeft, FiDatabase, FiCheckCircle, FiXCircle, FiAlertTriangle, FiClock, FiTarget, FiCpu, FiCopy, FiRepeat,
  FiAlertCircle, FiLoader, FiPercent, FiLayers, FiMapPin, FiBarChart2
} from 'react-icons/fi'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => n == null ? '—' : Number(n).toLocaleString()
const pct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`

const APPROVAL_COLORS = {
  reconciled: '#8E288D',
  unreconciled: '#ef4444',
  surplus_assets: '#f97316',
  exist_in_erp_not_physical: '#8b5cf6',
  pending: '#4E79A7',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  sub,
  textColor = "text-white",
  shadow = "shadow-lg",
  borderColor = "",
  icon: Icon,
  gradient,
}) => (
  <div
    className={`rounded-xl p-5 ${gradient} ${textColor} ${shadow} ${borderColor}
    transform hover:scale-105 transition-all duration-300`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      </div>

      {Icon && (
        <div className="bg-white/20 p-2 rounded-lg">
          <Icon className="h-6 w-6" />
        </div>
      )}
    </div>
  </div>
);

// ── Horizontal bar ────────────────────────────────────────────────────────────
const HBar = ({ name, rate, reconciled, total, color }) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium text-gray-700 truncate max-w-[55%]" title={name}>{name}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {rate}%
        <span className="text-xs text-gray-400 font-normal ml-1">({fmt(reconciled)}/{fmt(total)})</span>
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className="h-3 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }} />
    </div>
  </div>
)

// ── Custom tooltip (simple, kept for non-stacked charts) ─────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ── useSegmentTooltip — hover state for custom CSS horizontal bars ────────────
const useSegmentTooltip = () => {
  const [tip, setTip] = React.useState(null)
  const show = (e, data) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTip({ x: rect.left + rect.width / 2, y: rect.top - 8, ...data })
  }
  const hide = () => setTip(null)
  const Tooltip = tip ? (
    <div className="fixed z-50 pointer-events-none"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%,-100%)' }}>
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
        <p className="font-bold border-b border-gray-600 pb-1 mb-1">{tip.label}</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: tip.color }} />
          <span>{tip.name}</span>
        </div>
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-gray-300">Count</span>
          <span className="font-semibold">{tip.value.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Share</span>
          <span className="font-semibold">{tip.pct}%</span>
        </div>
      </div>
      <div className="flex justify-center"><div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" /></div>
    </div>
  ) : null
  return { show, hide, Tooltip }
}

// ── HorizontalStackedBar — 100% stacked bar with live tooltip ─────────────────
const HorizontalStackedBar = ({ row, statuses, colors, labels, rowLabel }) => {
  const { show, hide, Tooltip } = useSegmentTooltip()
  const rowTotal = statuses.reduce((s, k) => s + (row[k] || 0), 0)
  if (rowTotal === 0) return null
  return (
    <div className="mb-4">
      {Tooltip}
      <div className="flex w-full rounded-md overflow-hidden h-9 shadow-sm">
        {statuses.map(s => {
          const val = row[s] || 0
          if (val === 0) return null
          const wp = ((val / rowTotal) * 100).toFixed(2)
          const showLabel = parseFloat(wp) > 8
          return (
            <div key={s}
              style={{ width: `${wp}%`, backgroundColor: colors[s] }}
              className="flex items-center justify-center overflow-hidden cursor-default transition-opacity hover:opacity-90"
              onMouseEnter={e => show(e, { label: rowLabel, name: labels[s] || s, value: val, pct: wp, color: colors[s] })}
              onMouseLeave={hide}
            >
              {showLabel && (
                <span className="text-white text-xs font-semibold truncate px-1 select-none">
                  {labels[s] || s}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-0.5 pl-1 truncate" title={row.full_name || rowLabel}>
        {rowLabel} <span className="text-gray-400">({rowTotal.toLocaleString()})</span>
      </p>
    </div>
  )
}

// ── Rich custom tooltip for stacked/aging charts ──────────────────────────────
const AgingTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2 border-b pb-1">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-gray-600">{p.name}</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-gray-800">{p.value.toLocaleString()}</span>
            <span className="text-gray-400 ml-1">({total > 0 ? ((p.value / total) * 100).toFixed(1) : 0}%)</span>
          </div>
        </div>
      ))}
      <div className="border-t mt-1 pt-1 flex justify-between font-semibold text-gray-700">
        <span>Total</span><span>{total.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
const ReconciliationReport = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [agingData, setAgingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [barSize, setBarSize] = useState(40)
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAIContextMenu, setShowAIContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [aiModalConfig, setAiModalConfig] = useState({
    chartData: null,
    chartType: 'chart',
    title: 'AI Analysis',
    targetLabel: '',
    analysisContext: {}
  })
  const [aiModalAction, setAiModalAction] = useState('modal')
  const [aiModalAnalysisType, setAiModalAnalysisType] = useState('summary')
  const [aiModalOutputFormat, setAiModalOutputFormat] = useState('combined')

  const openAIModal = ({ chartData, chartType, title, targetLabel, analysisContext, action = 'modal', analysisType = 'summary', outputFormat = 'combined' }) => {
    setAiModalConfig({ chartData, chartType, title, targetLabel, analysisContext })
    setAiModalAction(action)
    setAiModalAnalysisType(analysisType)
    setAiModalOutputFormat(outputFormat)
    setShowAIModal(true)
  }

  const openAIContextMenu = (event, config) => {
    event.preventDefault()
    setAiModalConfig(config)
    setMenuPosition({ x: event.clientX, y: event.clientY })
    setShowAIContextMenu(true)
  }

  const handleAIContextSelect = ({ action = 'modal', analysisType = 'summary', outputFormat = 'combined' }) => {
    setAiModalAction(action)
    setAiModalAnalysisType(analysisType)
    setAiModalOutputFormat(outputFormat)
    setShowAIModal(true)
    setShowAIContextMenu(false)
  }

  useEffect(() => {
    logActivity(`/report/${id}`, `PAGE_VISIT_REPORT_${id}`)
    Promise.all([
      axios.get(`/api/reconciliation/analytics/single/${id}`),
      axios.get(`/api/reconciliation/analytics/aging/${id}`),
    ])
      .then(([r1, r2]) => { setData(r1.data); setAgingData(r2.data) })
      .catch(() => { toast.error('Failed to load report'); navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
    </div>
  )
  if (!data) return null

  const { kpis, donut, category_breakdown, department_breakdown,
    district_breakdown, dept_rec_chart, reconciliation, total_records_in_db } = data

  const recon = reconciliation
  const completedAt = recon.completed_at ? new Date(recon.completed_at).toLocaleString() : '—'
  const createdAt = new Date(recon.created_at).toLocaleString()

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'category', label: 'By Category' },
    { key: 'department', label: 'By Division' },
    { key: 'district', label: 'By Branch' },
    { key: 'dept_rec', label: 'Dept. Reconcile' },
    { key: 'aging', label: 'Aging Analysis' },
  ]

  // ── Shared status palette for ALL breakdown tabs ──────────────────────────
  const STATUS_COLORS = {
    reconciled:                  '#CFB53B',
    unreconciled:                '#000000',
    surplus_assets:              '#8E288D',
    exist_in_erp_not_physical:   '#e64595ff',
    duplicated:                  '#9C755F',
    unique:                      '#14b8a6',
    pending:                     '#4E79A7',
  }
  const STATUS_LABELS = {
    reconciled:                  'Reconciled',
    unreconciled:                'Unmatched',
    surplus_assets:              'Surplus Assets',
    exist_in_erp_not_physical:   'Shortage Asset',
    duplicated:                  'Duplicated',
    unique:                      'Unique',
    pending:                     'Pending',
  }
  const ALL_STATUS_KEYS = Object.keys(STATUS_COLORS)

  // stacked bar data for category — lowercase keys match backend now
  const stackedCatData = category_breakdown.map(c => ({
    name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
    fullName: c.name,
    reconciled:                 c.reconciled   || 0,
    unreconciled:               c.unreconciled || 0,
    surplus_assets:             c.surplus_assets || 0,
    exist_in_erp_not_physical:  c.exist_in_erp_not_physical || 0,
    duplicated:                 c.duplicated   || 0,
    unique:                     c.unique       || 0,
    pending:                    c.pending      || 0,
  }))

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      {/* Back */}
      <div className="mb-4">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <FiArrowLeft className="mr-2" /> Back
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
        <div className='flex'>
          <h1 className="text-2xl font-bold text-gray-900">
            Reconciliation <span className="text-[#8E288D]">#{id}</span>
          </h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
            {/* <span>📁 {recon.customer_file}</span>
            <span>📁 {recon.internal_file}</span> */}
            <span>🕒 Created: {createdAt}</span>
            {recon.completed_at && <span>✅ Completed: {completedAt}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/results/${id}`)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700
             rounded-lg hover:from-gray-400 hover:to-gray-300">
            View Records
          </button>
          <button onClick={() => navigate(`/approval/${id}`)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700
             rounded-lg hover:from-gray-400 hover:to-gray-300">
            Approval
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="ERP Assets" value={fmt(kpis.total_erp_assets)} icon={FiDatabase}
          gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Physical Count" value={fmt(kpis.physical_count)} icon={FiLayers}
          gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />


        <KpiCard label="Exact Match" value={fmt(kpis.exact_matched)} icon={FiTarget}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          textColor="text-black-500" />
        <KpiCard label="AI Match" value={fmt(kpis.ai_matched)} icon={FiCpu}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          textColor="text-black-500" />
        <KpiCard label="Near Match" value={fmt(kpis.near_match)} icon={FiCopy}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          textColor="text-black-500" />
        <KpiCard label="Reconciled(Appro.)" value={fmt(kpis.reconciled)} icon={FiCheckCircle}
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          borderColor="border-l-4 border-l-gray-100"
          gradient="bg-gradient-to-br from-white-500 to-white-600" textColor="text-black-500" />
      </div>

      {/* secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Recon. Rate" value={pct(kpis.reconciliation_rate)} icon={FiPercent}
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"
          gradient="bg-gradient-to-br from-white-500 to-white-600" textColor="text-black-500" />

        <KpiCard label="Pending" value={fmt(kpis.pending)} icon={FiClock}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          textColor="text-black-500" />
        <KpiCard label="Unmatched" value={fmt(kpis.unreconciled)} icon={FiXCircle}
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"
          gradient="bg-gradient-to-br from-white-500 to-white-600" textColor='text-pink-700' />
        <KpiCard label="Shortage Assets" value={fmt(kpis.exist_erp_not_physical)} icon={FiAlertTriangle}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-[#F87171]" />
        <KpiCard label="Surplus Assets" value={fmt(kpis.surplus_assets)} icon={FiAlertCircle}
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"
          gradient="bg-gradient-to-br from-white-500 to-white-600" textColor='text-orange-600' />
        <KpiCard label="Duplicates" value={fmt(kpis.customer_duplicates)} icon={FiRepeat}
          gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
          textColor="text-pink-500" />
        {/* {[
          { label: 'Shortage Assets',   value: kpis.exist_erp_not_physical,                              border: 'border-purple-400', text: 'text-purple-600' },
          { label: 'Pending Approval',   value: kpis.pending,                                              border: 'border-gray-400',   text: 'text-gray-600'   },
          { label: 'Exact Match',        value: kpis.exact_matched,                                        border: 'border-teal-400',   text: 'text-teal-600'   },
          { label: 'AI Match',           value: kpis.ai_matched,                                           border: 'border-[#8E288D]',  text: 'text-[#8E288D]'  },
          { label: 'Near Match',         value: kpis.near_match,                                           border: 'border-blue-400',   text: 'text-blue-600'   },
          { label: 'Total Duplicates',   value: (kpis.customer_duplicates||0)+(kpis.internal_duplicates||0), border: 'border-pink-400', text: 'text-pink-600'   },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-lg shadow p-3 border-l-4 ${k.border}`}>
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{fmt(k.value)}</p>
          </div>
        ))} */}
      </div>

      {/* Pending notice */}
      {kpis.pending > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <FiAlertCircle className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{fmt(kpis.pending)}</strong> records are still <strong>pending approval</strong>.
            The charts below reflect current approved data. Approve remaining records to see full results.
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); logActivity(`/report/${id}`, `TAB_SWITCH_${t.key.toUpperCase()}`) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key
              ? 'bg-[#8E288D] text-white shadow'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#8E288D]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Approval Status Donut */}
          <div className="bg-white rounded-xl shadow p-6 text-purple-600 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'report_approval_status_donut',
                data: donut,
                reconciliationId: parseInt(id)
              },
              chartType: 'donut',
              title: 'AI Analysis - Approval Status Breakdown',
              targetLabel: 'Approval Status Breakdown',
              analysisContext: { page: 'Report', section: 'Approval Status Breakdown' }
            })}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-base font-semibold text-gray-800">Approval Status Breakdown</h3>
              <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
            </div>
            {donut.length > 0 ? (() => {
              const donutTotal = donut.reduce((s, d) => s + d.value, 0) || 1
              return (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Total: {donutTotal.toLocaleString()} records
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={donut} cx="50%" cy="50%"
                        innerRadius={65} outerRadius={110}
                        paddingAngle={3} dataKey="value"
                        label={({ value, percent }) =>
                          percent > 0.04
                            ? `${name.split(' ')[0]}: ${((value / donutTotal) * 100).toFixed(1)}%`
                            : ''
                        }
                        labelLine={false}>
                        {donut.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0]
                        const sharePct = ((p.value / donutTotal) * 100).toFixed(1)
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
                            <p className="font-bold border-b border-gray-600 pb-1 mb-1">{p.name}</p>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-300">Count</span>
                              <span className="font-semibold">{p.value.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-300">Share</span>
                              <span className="font-semibold">{sharePct}%</span>
                            </div>
                          </div>
                        )
                      }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )
            })() : (
              <p className="text-gray-400 text-center py-12">No approval data yet</p>
            )}
          </div>

          {/* Match type progress */}
          <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'report_match_type_breakdown',
                data: {
                  exact_matched: kpis.exact_matched,
                  ai_matched: kpis.ai_matched,
                  near_match: kpis.near_match,
                  customer_unmatched: kpis.customer_unmatched,
                  customer_duplicates: kpis.customer_duplicates,
                  internal_duplicates: kpis.internal_duplicates,
                  total_records: kpis.physical_count
                },
                reconciliationId: parseInt(id)
              },
              chartType: 'bar',
              title: 'AI Analysis - Match Type Breakdown',
              targetLabel: 'Match Type Breakdown',
              analysisContext: { page: 'Report', section: 'Match Type Breakdown' }
            })}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-semibold text-gray-800">Match Type Breakdown</h3>
              <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Exact Match', value: kpis.exact_matched, color: '#8E288D' },
                { label: 'AI Match', value: kpis.ai_matched, color: '#7A1E79' },
                { label: 'Near Match', value: kpis.near_match, color: '#CFB53B' },
                { label: 'Unmatched', value: kpis.customer_unmatched, color: '#ef4444' },
                { label: 'Physical Duplicates', value: kpis.customer_duplicates || 0, color: '#ec4899' },
                { label: 'ERP Duplicates', value: kpis.internal_duplicates || 0, color: '#f97316' },
              ].map(item => {
                const total = kpis.physical_count || 1
                const r = ((item.value / total) * 100).toFixed(1)
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>
                        {fmt(item.value)} ({r}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${r}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total records in DB including Duplicats</span>
                <span className="text-xl font-bold text-[#8E288D]">{fmt(total_records_in_db)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[gray-600]">Reconciliation Rate</span>
                <span className="text-lg font-bold text-[#8E288D]">{pct(kpis.reconciliation_rate)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── By Category ──────────────────────────────────────────────────── */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: {
              source: 'report_category_breakdown',
              data: category_breakdown,
              reconciliationId: parseInt(id)
            },
            chartType: 'stacked_bar',
            title: 'AI Analysis - Reconciliation by Asset Category',
            targetLabel: 'Reconciliation by Asset Category',
            analysisContext: { page: 'Report', section: 'Category Breakdown' }
          })}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <FiLayers className="text-[#8E288D]" /> Reconciliation by Asset Category
            </h3>
            <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
          </div>
          {category_breakdown.length ? (
            <>
              <div className="mb-2">
                {(() => {
                  const activeKeys = ALL_STATUS_KEYS.filter(k => stackedCatData.some(r => (r[k]||0) > 0))
                  return (
                    <>
                      {stackedCatData.map(row => (
                        <HorizontalStackedBar key={row.name} row={row} statuses={activeKeys}
                          colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.fullName || row.name} />
                      ))}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                        {activeKeys.map(s => (
                          <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                            {STATUS_LABELS[s]}
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            </>
          ) : <p className="text-gray-400 text-center py-12">No category data — approve records first</p>}
        </div>
      )}

      {/* ── By Division/Department ────────────────────────────────────────── */}
      {activeTab === 'department' && (
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: {
              source: 'report_division_department_breakdown',
              data: department_breakdown,
              reconciliationId: parseInt(id)
            },
            chartType: 'stacked_bar',
            title: 'AI Analysis - Reconciliation by Division / Department',
            targetLabel: 'Reconciliation by Division / Department',
            analysisContext: { page: 'Report', section: 'Division / Department Breakdown' }
          })}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <FiBarChart2 className="text-[#8E288D]" /> Reconciliation by Division / Department
            </h3>
            <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
          </div>
          {department_breakdown.length ? (
            <>
              {(() => {
                const activeKeys = ALL_STATUS_KEYS.filter(k => department_breakdown.some(r => (r[k]||0) > 0))
                return (
                  <>
                    {department_breakdown.map(row => (
                      <HorizontalStackedBar key={row.name} row={row} statuses={activeKeys}
                        colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.name} />
                    ))}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                      {activeKeys.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                          {STATUS_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </>
          ) : <p className="text-gray-400 text-center py-12">No department data — approve records first</p>}
        </div>
      )}

      {/* ── By District/Branch ───────────────────────────────────────────── */}
      {activeTab === 'district' && (
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: {
              source: 'report_branch_district_breakdown',
              data: district_breakdown,
              reconciliationId: parseInt(id)
            },
            chartType: 'stacked_bar',
            title: 'AI Analysis - Reconciliation by Branch / District',
            targetLabel: 'Reconciliation by Branch / District',
            analysisContext: { page: 'Report', section: 'Branch / District Breakdown' }
          })}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <FiMapPin className="text-[#8E288D]" /> Reconciliation by Branch / District
            </h3>
            <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
          </div>
          <div>
            {district_breakdown.length ? (
              <>
                {(() => {
                  const activeKeys = ALL_STATUS_KEYS.filter(k => district_breakdown.some(r => (r[k]||0) > 0))
                  return (
                    <>
                      {district_breakdown.map(row => (
                        <HorizontalStackedBar key={row.name} row={row} statuses={activeKeys}
                          colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.name} />
                      ))}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                        {activeKeys.map(s => (
                          <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                            {STATUS_LABELS[s]}
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </>
            ) : <p className="text-gray-400 text-center py-12">No district/branch data — approve records first</p>}
          </div>
        </div>
      )}

      {/* ── Dept. Reconcile ───────────────────────────────────────────────── */}
      {activeTab === 'dept_rec' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'report_department_reconcile_summary',
                data: dept_rec_chart,
                reconciliationId: parseInt(id)
              },
              chartType: 'donut',
              title: 'AI Analysis - Department Reconciliation Summary',
              targetLabel: 'Department Reconciliation Summary',
              analysisContext: { page: 'Report', section: 'Department Reconciliation Summary' }
            })}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-semibold text-gray-800">Department Reconciliation Summary</h3>
              <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
            </div>
            {dept_rec_chart.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dept_rec_chart} cx="50%" cy="50%"
                    innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.03 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}>
                    {dept_rec_chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-12">No data</p>}
          </div>

          <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'report_department_match_detail',
                data: dept_rec_chart,
                reconciliationId: parseInt(id)
              },
              chartType: 'bar',
              title: 'AI Analysis - Department Match Detail',
              targetLabel: 'Department Match Detail',
              analysisContext: { page: 'Report', section: 'Department Match Detail' }
            })}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-semibold text-gray-800">Department Match Detail</h3>
              <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
            </div>
            <div className="space-y-3">
              {dept_rec_chart.map(item => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>
                      {fmt(item.value)}
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        ({total_records_in_db > 0
                          ? ((item.value / total_records_in_db) * 100).toFixed(1)
                          : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-700"
                      style={{
                        width: total_records_in_db > 0
                          ? `${(item.value / total_records_in_db) * 100}%` : '0%',
                        backgroundColor: item.color
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Aging Analysis ───────────────────────────────────────────────── */}
      {activeTab === 'aging' && (() => {
        if (!agingData) return (
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400">
            <FiLoader className="animate-spin mx-auto h-8 w-8 mb-2" />
            <p>Loading aging data…</p>
          </div>
        )

        // Use shared STATUS_COLORS / STATUS_LABELS / ALL_STATUS_KEYS from component scope
        const { aging_chart = [], department_chart = [], district_chart = [], current_year } = agingData

        const agingActiveStatuses = ALL_STATUS_KEYS.filter(s =>
          aging_chart.some(row => (row[s] || 0) > 0)
        )
        const deptActiveStatuses = ALL_STATUS_KEYS.filter(s =>
          department_chart.some(row => (row[s] || 0) > 0)
        )
        const distActiveStatuses = ALL_STATUS_KEYS.filter(s =>
          district_chart.some(row => (row[s] || 0) > 0)
        )

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-2 gap-4">
              {/* Aging Bar Chart */}
              <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                  chartData: {
                    source: 'report_aging_analysis',
                    data: aging_chart,
                    reconciliationId: parseInt(id)
                  },
                  chartType: 'bar',
                  title: 'AI Analysis - Asset Aging',
                  targetLabel: 'Asset Aging',
                  analysisContext: { page: 'Report', section: 'Aging Analysis' }
                })}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    📅 Asset Aging — ERP Records (vs {current_year})
                  </h3>
                  <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  Based on the year field in ERP data. Stacked by approval status.
                </p>
                {aging_chart.length ? (
                  <>
                    <div className="mt-2">
                      {aging_chart.map(row => (
                        <HorizontalStackedBar
                          key={row.bucket}
                          row={row}
                          statuses={agingActiveStatuses}
                          colors={STATUS_COLORS}
                          labels={STATUS_LABELS}
                          rowLabel={row.bucket}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-100">
                      {agingActiveStatuses.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                          {STATUS_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-gray-400 text-center py-8">No aging data — year field may be missing in ERP records</p>}
              </div>

              {/* Department stacked bar */}
              <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                  chartData: {
                    source: 'report_aging_department_breakdown',
                    data: department_chart,
                    reconciliationId: parseInt(id)
                  },
                  chartType: 'stacked_bar',
                  title: 'AI Analysis - Aging Department Breakdown',
                  targetLabel: 'Aging Department Breakdown',
                  analysisContext: { page: 'Report', section: 'Aging Department Breakdown' }
                })}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    🏢 By Department — Approval Status
                  </h3>
                  <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
                </div>
                {department_chart.length ? (
                  <>
                    <div className="mt-1">
                      {department_chart.map(row => (
                        <HorizontalStackedBar
                          key={row.name}
                          row={row}
                          statuses={deptActiveStatuses}
                          colors={STATUS_COLORS}
                          labels={STATUS_LABELS}
                          rowLabel={row.name}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                      {deptActiveStatuses.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                          {STATUS_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-gray-400 text-center py-8">No department data</p>}
              </div>

              {/* District/Branch stacked bar */}
              <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                  chartData: {
                    source: 'report_aging_branch_breakdown',
                    data: district_chart,
                    reconciliationId: parseInt(id)
                  },
                  chartType: 'stacked_bar',
                  title: 'AI Analysis - Aging Branch / District Breakdown',
                  targetLabel: 'Aging Branch / District Breakdown',
                  analysisContext: { page: 'Report', section: 'Aging Branch / District Breakdown' }
                })}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    📍 By Branch / District — Approval Status
                  </h3>
                  <span className="text-xs text-gray-500 italic">Right-click for AI insights</span>
                </div>
                {district_chart.length ? (
                  <>
                    <div className="mt-1">
                      {district_chart.map(row => (
                        <HorizontalStackedBar
                          key={row.name}
                          row={row}
                          statuses={distActiveStatuses}
                          colors={STATUS_COLORS}
                          labels={STATUS_LABELS}
                          rowLabel={row.name}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                      {distActiveStatuses.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                          {STATUS_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-gray-400 text-center py-8">No branch/district data</p>}
              </div>
            </div>
          </div>
        )
      })()}
      <AIAnalysisModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        reconciliationId={parseInt(id)}
        chartData={aiModalConfig.chartData}
        chartType={aiModalConfig.chartType}
        title={aiModalConfig.title}
        targetLabel={aiModalConfig.targetLabel}
        analysisContext={aiModalConfig.analysisContext}
        action={aiModalAction}
        analysisType={aiModalAnalysisType}
        outputFormat={aiModalOutputFormat}
      />
      <AIContextMenu
        isOpen={showAIContextMenu}
        x={menuPosition.x}
        y={menuPosition.y}
        onClose={() => setShowAIContextMenu(false)}
        onSelect={handleAIContextSelect}
      />
    </div>
  )
}

export default ReconciliationReport
