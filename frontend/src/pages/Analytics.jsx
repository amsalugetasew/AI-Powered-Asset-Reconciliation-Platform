import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import AIAnalysisModal from '../components/AIAnalysisModal'
import AIContextMenu from '../components/AIContextMenu'
import {
  FiDatabase, FiCheckCircle, FiXCircle, FiAlertCircle,FiAlertTriangle,FiClock,
  FiTrendingUp, FiBarChart2, FiLoader, FiPercent, FiLayers, FiMapPin,FiCopy
} from 'react-icons/fi'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, XAxis, YAxis
} from 'recharts'

// ── colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  reconciled:             '#CFB53B',
  unreconciled:           '#ef4444',
  surplus_assets:         '#8E288D',
  exist_erp_not_physical: '#ee649dff',
  duplicated:             '#1a1a1a',
  unique:                 '#008080',
  pending:                '#4E79A7',
  matched:                '#CFB53B',
  ai_matched:             '#8E288D',
  manual:                 '#CFB53B',
}

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString()
const pct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`

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

// ── Status colours used across breakdown tabs ─────────────────────────────────
const STATUS_COLORS = {
  reconciled:                '#CFB53B',
  unreconciled:              '#f132a8ff',
  pending:                   '#4E79A7',
  surplus_assets:            '#8E288D',
  exist_in_erp_not_physical: '#f14a90ff',
  duplicated:                '#1a1a1a',
  unique:                    '#008080',
}
const STATUS_LABELS = {
  reconciled:                'Reconciled',
  unreconciled:              'Unreconciled',
  pending:                   'Pending',
  surplus_assets:            'Surplus Assets',
  exist_in_erp_not_physical: 'ERP not Physical',
  duplicated:                'Duplicated',
  unique:                    'Unique',
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

// ── Rich tooltip for donut / stacked charts ───────────────────────────────────
const AgingTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2 border-b pb-1">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
              style={{ backgroundColor: p.fill || p.color }} />
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

// ── Main Component ────────────────────────────────────────────────────────────
const Analytics = () => {
  const [data, setData]           = useState(null)
  const [agingData, setAgingData] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiModalConfig, setAiModalConfig] = useState({
    chartData: null,
    chartType: 'pie',
    title: 'AI Analysis',
    targetLabel: '',
    analysisContext: {}
  })
  const [aiModalAction, setAiModalAction] = useState('modal')
  const [aiModalAnalysisType, setAiModalAnalysisType] = useState('summary')
  const [aiModalOutputFormat, setAiModalOutputFormat] = useState('combined')
  const [showAIContextMenu, setShowAIContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })

  const openAIModal = ({ chartData, chartType, title, targetLabel, analysisContext }) => {
    setAiModalConfig({ chartData, chartType, title, targetLabel, analysisContext })
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
    Promise.all([
      axios.get('/api/reconciliation/analytics'),
      axios.get('/api/reconciliation/analytics/aging'),
    ])
      .then(([r1, r2]) => {
        setData(r1.data)
        setAgingData(r2.data)
      })
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
    { name: 'Loss Assets',          value: kpi.exist_erp_not_physical || 0, color: COLORS.exist_erp_not_physical },
    { name: 'Duplicated',           value: kpi.duplicated || 0,             color: COLORS.duplicated },
    { name: 'Unique',               value: kpi.unique || 0,                 color: COLORS.unique },
    { name: 'Pending',              value: kpi.pending || 0,                color: COLORS.pending },
  ].filter(d => d.value > 0)

  const tabs = [
    { key: 'overview',  label: 'Overview'   },
    { key: 'category',  label: 'Category'   },
    { key: 'branch',    label: 'Branch'     },
    { key: 'division',  label: 'Division'   },
    { key: 'aging',     label: 'Aging'      },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      <div className="mb-6 flex">
        <h1 className="text-3xl font-semibold text-gray-900 mr-3">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-3">
          {data.scope === 'all' ? 'System-wide · all requested reconciliations' : 'Your reconciliations only'}
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Total ERP Assets"      value={fmt(kpi.total_erp_assets)}   icon={FiDatabase}    
         gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Physical Count"        value={fmt(kpi.physical_count)}     icon={FiLayers}     
         gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
        <KpiCard label="Reconciled"            value={fmt(kpi.reconciled)}         icon={FiCheckCircle} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Reconciliation Rate"   value={pct(kpi.reconciliation_rate)} icon={FiPercent}    
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Unmatched"          value={fmt(kpi.unreconciled)}       icon={FiXCircle}     
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Surplus Assets"        value={fmt(kpi.surplus_assets)}     icon={FiAlertCircle} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
        <KpiCard label="Shortage/Loss Asset"        value={fmt(kpi.exist_erp_not_physical)}     icon={FiAlertTriangle} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
          <KpiCard label="Pending Approval"        value={fmt(kpi.pending)}     icon={FiClock} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
          <KpiCard label="Duplicates"        value={fmt(kpi.duplicated)}     icon={FiCopy} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
          <KpiCard label="Avg. Match Rate"        value={fmt(data.average_match_rate)}     icon={FiPercent} 
        gradient="bg-gradient-to-br from-white-500 to-white-600"
          borderColor="border-l-4 border-l-gray-100"
          shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500"/>
      </div>

      {/* secondary KPIs */}
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-400">
          <p className="text-xs text-gray-500">Shortage/Loss Asset</p>
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
      </div> */}

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
          <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
                chartData: {
                  source: 'analytics_overall_status_donut',
                  donutData,
                  total: donutData.reduce((s, d) => s + d.value, 0)
                },
                chartType: 'donut',
                title: 'AI Analysis - Overall Reconciliation Status',
                targetLabel: 'Overall Reconciliation Status',
                analysisContext: { page: 'Analytics', section: 'Overview' }
              })}>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Overall Reconciliation Status</h3>
            {(() => {
              const donutTotal = donutData.reduce((s, d) => s + d.value, 0) || 1
              return (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Total: {donutTotal.toLocaleString()} records
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%"
                        innerRadius={70} outerRadius={120}
                        paddingAngle={3} dataKey="value"
                        // label={({ name, value, percent }) =>
                        //   percent > 0.04
                        //     ? `${name.split(' ')[0]}: ${((value / donutTotal) * 100).toFixed(1)}%`
                        //     : ''
                        // }
                        labelLine={true}>
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
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
                            <div className="flex justify-between gap-4 border-t border-gray-600 mt-1 pt-1">
                              <span className="text-gray-300">Total</span>
                              <span className="font-semibold">{donutTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        )
                      }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )
            })()}
          </div>

          {/* Match type breakdown */}
          <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
            onContextMenu={e => openAIContextMenu(e, {
                chartData: {
                  source: 'analytics_match_type_breakdown',
                  matchBreakdown: data.approval_kpis
                },
                chartType: 'bar',
                title: 'AI Analysis - Match Type Breakdown',
                targetLabel: 'Match Type Breakdown',
                analysisContext: { page: 'Analytics', section: 'Overview' }
              })}>
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
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'analytics_category_breakdown',
                categoryBreakdown: data.category_breakdown
              },
              chartType: 'stacked_bar',
              title: 'AI Analysis - Category Breakdown',
              targetLabel: 'Category Breakdown',
              analysisContext: { page: 'Analytics', section: 'Category Breakdown' }
            })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiLayers className="text-[#8E288D]" /> Asset Reconciliation by Category
          </h3>
          {data.category_breakdown?.length ? (
            (() => {
              const activeKeys = Object.keys(STATUS_COLORS).filter(k =>
                data.category_breakdown.some(r => (r[k] || 0) > 0)
              )
              return (
                <>
                  {data.category_breakdown.map(row => (
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
            })()
          ) : <p className="text-gray-400 text-center py-8">No category data — approve records first</p>}
        </div>
      )}

      {/* ── Branch/District Tab ───────────────────────────────────────────── */}
      {activeTab === 'branch' && (
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'analytics_branch_breakdown',
                districtBreakdown: data.district_breakdown
              },
              chartType: 'stacked_bar',
              title: 'AI Analysis - Branch/District Performance',
              targetLabel: 'Branch / District Performance',
              analysisContext: { page: 'Analytics', section: 'Branch / District Performance' }
            })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiMapPin className="text-[#8E288D]" /> Branch / District Performance
          </h3>
          {data.district_breakdown?.length ? (
            (() => {
              const activeKeys = Object.keys(STATUS_COLORS).filter(k =>
                data.district_breakdown.some(r => (r[k] || 0) > 0)
              )
              return (
                <>
                  {data.district_breakdown.map(row => (
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
            })()
          ) : <p className="text-gray-400 text-center py-8">No district/branch data — approve records first</p>}
        </div>
      )}

      {/* ── Division/Department Tab ───────────────────────────────────────── */}
      {activeTab === 'division' && (
        <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'analytics_division_breakdown',
                departmentBreakdown: data.department_breakdown
              },
              chartType: 'stacked_bar',
              title: 'AI Analysis - Division / Department Performance',
              targetLabel: 'Division / Department Performance',
              analysisContext: { page: 'Analytics', section: 'Division / Department Performance' }
            })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FiBarChart2 className="text-[#8E288D]" /> Division / Department Performance
          </h3>
          {data.department_breakdown?.length ? (
            (() => {
              const activeKeys = Object.keys(STATUS_COLORS).filter(k =>
                data.department_breakdown.some(r => (r[k] || 0) > 0)
              )
              return (
                <>
                  {data.department_breakdown.map(row => (
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
            })()
          ) : <p className="text-gray-400 text-center py-8">No department data — approve records first</p>}
        </div>
      )}

      {/* ── Aging Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'aging' && (() => {
        if (!agingData) return (
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400">
            <FiLoader className="animate-spin mx-auto h-8 w-8 mb-2" />
            <p>Loading aging data…</p>
          </div>
        )

        const AGING_COLORS = {
          reconciled:               '#10b981',
          unreconciled:             '#ef4444',
          pending:                  '#CFB53B',
          surplus_assets:           '#8E288D',
          exist_in_erp_not_physical:'#7A1E79',
          duplicated:               '#1a1a1a',
          unique:                   '#008080',
        }
        const AGING_LABELS = {
          reconciled: 'Reconciled', unreconciled: 'Unreconciled',
          pending: 'Pending', surplus_assets: 'Surplus Assets',
          exist_in_erp_not_physical: 'ERP not Physical',
          duplicated: 'Duplicated', unique: 'Unique',
        }

        const buckets = agingData.buckets || []
        const agingTotal = buckets.reduce((s, d) => s + d.count, 0) || 1
        const currentYear = agingData.current_year || new Date().getFullYear()

        // Simple single-value bars (no stacking — global aging has no status breakdown)
        const AGE_BAR_COLORS = ['#8E288D','#000','#CFB53B','#f97316','#ef4444','#b91c1c','#9ca3af']

        return (
          <div className="space-y-6">
            {/* Age bucket bars */}
            <div className="bg-white rounded-xl shadow p-6 cursor-context-menu" title="Right-click for AI insights"
              onContextMenu={e => openAIContextMenu(e, {
                  chartData: {
                    source: 'analytics_aging_analysis',
                    agingBuckets: buckets
                  },
                  chartType: 'bar',
                  title: 'AI Analysis - Aging Analysis',
                  targetLabel: 'Aging Analysis',
                  analysisContext: { page: 'Analytics', section: 'Aging Analysis' }
                })}>
              <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                📅 Asset Aging — ERP Records (vs {currentYear})
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Based on year field in Finance data · {agingTotal.toLocaleString()} total records
              </p>
              {buckets.length ? (
                <>
                  <div className="space-y-3">
                    {buckets.map((d, i) => {
                      const sharePct = ((d.count / agingTotal) * 100).toFixed(1)
                      const color = AGE_BAR_COLORS[Math.min(i, AGE_BAR_COLORS.length - 1)]
                      return (
                        <div key={d.bucket}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16 flex-shrink-0">{d.bucket}</span>
                            <div className="flex-1 bg-gray-100 rounded-md h-8 overflow-hidden">
                              <div className="h-full flex items-center justify-start rounded-md transition-all duration-700"
                                style={{ width: `${sharePct}%`, backgroundColor: color }}
                                title={`${d.bucket}: ${d.count.toLocaleString()} (${sharePct}%)`}>
                                <span className="text-white text-xs font-semibold px-2 select-none">
                                  {d.count.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-12 text-right">{sharePct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                    {buckets.map((d, i) => {
                      const color = AGE_BAR_COLORS[Math.min(i, AGE_BAR_COLORS.length - 1)]
                      const sharePct = ((d.count / agingTotal) * 100).toFixed(1)
                      return (
                        <div key={d.bucket} className="flex items-center gap-1 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                          {d.bucket}: <strong className="ml-0.5">{d.count.toLocaleString()}</strong>
                          <span className="text-gray-400 ml-0.5">({sharePct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p className="text-gray-400 text-center py-8">No aging data — year field may be missing in Finance records</p>}
            </div>

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
              💡 This shows system-wide aging across all reconciliations. For per-reconciliation aging with approval status breakdown (department &amp; branch), open the <strong>📊 Dashboard Report</strong> for a specific reconciliation.
            </div>
          </div>
        )
      })()}
      <AIAnalysisModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        reconciliationId={null}
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

export default Analytics
