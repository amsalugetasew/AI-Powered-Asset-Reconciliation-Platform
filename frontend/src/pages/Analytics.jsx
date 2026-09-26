import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import { cachedGet } from '../services/cachedGet'
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
  reconciled:             '#8E288D',
  unreconciled:           '#BE123C',
  surplus_assets:         '#BE123C',
  exist_erp_not_physical: '#BE123C',
  duplicated:             '#000000',
  unique:                 '#8E288D',
  pending:                '#6B7280',
  matched:                '#8E288D',
  ai_matched:             '#8E288D',
  manual:                 '#CFB53B',
}

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString()
const pct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`
const duration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}

const KpiCard = ({
  label,
  value,
  icon: Icon,
  color = '#8E288D',
  textColor = 'text-gray-900',
}) => {
  return (
    <div className="w-full h-[140px] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">

      {/* KPI Label + Icon */}
      <div
        className="relative flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider"
        style={{
          color: color,
          backgroundColor: `${color}10`,
        }}
      >
        {/* Centered Title */}
        <span className="text-center">
          {label}
        </span>

        {/* Right Corner Icon */}
        {Icon && (
          <span className="absolute right-2 text-base">
            <Icon />
          </span>
        )}
      </div>

      {/* KPI Value */}
      <p
        className={`mt-4 text-center text-2xl font-extrabold tracking-tight ${textColor}`}
      >
        {value}
      </p>

    </div>
  );
};
// const PairedKpiCard = ({ title, icon: Icon, left, right, showRate = true }) => (
//   <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
//     <div className="mb-3 flex items-center justify-between">
//       <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{title}</p>
//       {Icon && <Icon className="h-5 w-5 text-gray-400" />}
//     </div>
//     <div className="grid grid-cols-2 divide-x divide-gray-100">
//       {[left, right].map((item, index) => (
//         <div key={item.label} className={index === 0 ? 'pr-3' : 'pl-3'}>
//           <p className="truncate text-xs text-gray-500" title={item.label}>{item.label}</p>
//           <p className={`mt-1 text-2xl font-extrabold ${item.color}`}>{fmt(item.value)}</p>
//           {showRate && <>
//             <p className="mt-1 text-xs font-semibold text-gray-400">{pct(item.rate)}</p>
//             <p className="text-[10px] text-gray-400">of {fmt(item.total)}</p>
//           </>}
//           {item.detail && <p className="mt-1 truncate text-[10px] text-gray-400" title={item.detail}>{item.detail}</p>}
//         </div>
//       ))}
//     </div>
//   </div>
// )

// ── Status colours used across breakdown tabs ─────────────────────────────────
const STATUS_COLORS = {
  reconciled:                '#8E288D',
  unreconciled:              '#BE123C',
  pending:                   '#6B7280',
  surplus_assets:            '#BE123C',
  exist_in_erp_not_physical: '#BE123C',
  duplicated:                '#000000',
  unique:                    '#8E288D',
}
const STATUS_LABELS_BASE = {
  reconciled:                'Reconciled',
  unreconciled:              'Unreconciled',
  pending:                   'Pending',
  surplus_assets:            'Surplus',
  exist_in_erp_not_physical: 'Shortage',
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

// ── HorizontalStackedBar — stacked bar with live tooltip ──────────────────────
// grandTotal: if provided, bar width is % of grandTotal (cross-row comparison)
//             if omitted, bar width is 100% of row total (within-row breakdown)
const HorizontalStackedBar = ({ row, statuses, colors, labels, rowLabel, grandTotal }) => {
  const { show, hide, Tooltip } = useSegmentTooltip()
  const rowTotal = statuses.reduce((s, k) => s + (row[k] || 0), 0)
  if (rowTotal === 0) return null
  // widthBase: the denominator used for the overall bar width
  const widthBase = grandTotal || rowTotal
  // barWidth: how wide the whole bar is relative to the container
  const barWidthPct = grandTotal ? ((rowTotal / grandTotal) * 100).toFixed(2) : 100
  return (
    <div className="mb-4">
      {Tooltip}
      <div className="flex w-full rounded-md overflow-hidden h-9 shadow-sm"
        style={{ width: `${barWidthPct}%`, minWidth: '4px' }}>
        {statuses.map(s => {
          const val = row[s] || 0
          if (val === 0) return null
          // Each segment is % of its own rowTotal (so segments always fill the bar)
          const wp = ((val / rowTotal) * 100).toFixed(2)
          // Tooltip shows % of grandTotal if available, else % of rowTotal
          const pctDisplay = grandTotal
            ? ((val / grandTotal) * 100).toFixed(1)
            : wp
          const showLabel = parseFloat(wp) > 8
          return (
            <div key={s}
              style={{ width: `${wp}%`, backgroundColor: colors[s] }}
              className="flex items-center justify-center overflow-hidden cursor-default transition-opacity hover:opacity-90"
              onMouseEnter={e => show(e, { label: rowLabel, name: labels[s] || s, value: val, pct: pctDisplay, color: colors[s] })}
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
        {rowLabel}
        <span className="text-gray-400 ml-1">({rowTotal.toLocaleString()}{grandTotal ? ` · ${((rowTotal/grandTotal)*100).toFixed(1)}% of all` : ''})</span>
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
  const [reportSide, setReportSide] = useState('erp')
  const [activeTab, setActiveTab] = useState('category')
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
    return undefined
  }

  const openAIContextMenu = (event, config) => {
    return undefined
  }

  const handleAIContextSelect = ({ action = 'modal', analysisType = 'summary', outputFormat = 'combined' }) => {
    setAiModalAction(action)
    setAiModalAnalysisType(analysisType)
    setAiModalOutputFormat(outputFormat)
    setShowAIModal(true)
    setShowAIContextMenu(false)
  }

  useEffect(() => {
    logActivity('/analytics', 'PAGE_VISIT_ANALYTICS')
    Promise.all([
      cachedGet('/api/reconciliation/analytics?period=latest'),
      cachedGet(`/api/reconciliation/analytics/aging?side=${reportSide}&period=latest`),
    ])
      .then(([r1, r2]) => {
        setData(r1.data)
        setAgingData(r2.data)
      })
      .catch(() => toast.error('Failed to fetch analytics'))
      .finally(() => setLoading(false))
  }, [reportSide])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
    </div>
  )

  const totalRecordSet = Number((data?.total_customer_records || 0) + (data?.total_internal_records || 0))

  if (!data || totalRecordSet === 0) return (
    <div className="px-4 py-16 text-center">
      <FiBarChart2 className="mx-auto h-14 w-14 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-700">No analytics data yet</h3>
      <p className="text-sm text-gray-400 mt-1">Complete and approve reconciliations to see insight records here.</p>
    </div>
  )

  const kpi = data.approval_kpis || {}

  const totalERP = Number(kpi.total_erp_assets || 0)
  const totalPhysical = Number(kpi.physical_count || 0)
  const totalRecords = Number((data.total_customer_records || 0) + (data.total_internal_records || 0))
  const erp = kpi.side_counts?.erp || {}
  const physical = kpi.side_counts?.physical || {}
  const resolvedCount = Number(erp.resolved || 0)
  const pendingCount = Number(erp.pending || 0)
  const unmatchedCount = Number(erp.unmatched || 0)
  const selectedSide = reportSide === 'erp' ? erp : physical
  const STATUS_LABELS = {
    ...STATUS_LABELS_BASE,
    surplus_assets: 'Surplus',
    exist_in_erp_not_physical: 'Shortage',
  }
  const lastReconciliation = data.last_reconciliation
  const timestampProcessingSeconds = lastReconciliation?.completed_at && lastReconciliation?.created_at
    ? Math.max((new Date(lastReconciliation.completed_at) - new Date(lastReconciliation.created_at)) / 1000, 0)
    : 0
  const processingSeconds = Number(data.last_reconciliation_processing_seconds || data.processing_time_seconds || 0) || timestampProcessingSeconds
  const selectedTotal = reportSide === 'erp' ? totalERP : totalPhysical
  const selectedResolved = Number(selectedSide.resolved || 0)
  const selectedPending = Number(selectedSide.approval_pending ?? selectedSide.pending ?? 0)
  const selectedUnmatched = Number(selectedSide.unmatched || 0)
  const selectedSurplus = Number(selectedSide.surplus || 0)
  const shortageCount = Number(erp.shortage || 0)
  const selectedShortage = Number(selectedSide.shortage || 0)
  const selectedDuplicate = Number(selectedSide.duplicate || 0)
  const rate = (value, total) => total > 0 ? (value / total) * 100 : 0

  // ── Donut data ────────────────────────────────────────────────────────────
  const donutData = [
    { name: 'Matched (Reconciled)', value: selectedResolved, color: COLORS.reconciled },
    { name: reportSide === 'erp' ? 'Shortage' : 'Surplus',
      value: reportSide === 'erp' ? selectedShortage : selectedSurplus,
      color: reportSide === 'erp' ? COLORS.exist_erp_not_physical : COLORS.surplus_assets },
    { name: 'Pending', value: selectedPending, color: COLORS.pending },
    { name: 'Unmatched', value: selectedUnmatched, color: '#BE123C' },
    { name: 'Duplicate', value: selectedDuplicate, color: COLORS.duplicated },
  ].filter(d => d.value > 0)

  const erpExactMatch = Number(data.total_rule_matched || 0)
  const erpNearMatch = Number(data.total_manual_review || 0)
  const erpAiMatch = Number(data.total_ai_matched || 0)
  const erpShortage = Number(kpi.side_counts?.erp?.shortage ?? (kpi.exist_erp_not_physical ?? 0))
  const erpDuplicate = Number(kpi.side_counts?.erp?.duplicate ?? (kpi.duplicated ?? 0))
  const erpUnmatch = Number(
    kpi.side_counts?.erp?.unmatched ?? (kpi.unmatched_erp ?? Math.max(totalERP - erpExactMatch - erpNearMatch - erpAiMatch - erpShortage - erpDuplicate, 0))
  )

  const matchBreakdown = [
    { label: 'Exact Match', value: erpExactMatch, color: COLORS.reconciled },
    { label: 'Near Match', value: erpNearMatch, color: '#f59e0b' },
    { label: 'AI Match', value: erpAiMatch, color: COLORS.ai_matched },
    { label: 'Unmatch', value: reportSide === 'erp' ? erpUnmatch : Number(physical.unmatched || 0), color: '#BE123C' },
    { label: reportSide === 'erp' ? 'Shortage' : 'Surplus',
      value: reportSide === 'erp' ? erpShortage : Number(physical.surplus || 0),
      color: reportSide === 'erp' ? COLORS.exist_erp_not_physical : COLORS.surplus_assets },
    { label: 'Duplicate', value: reportSide === 'erp' ? erpDuplicate : Number(physical.duplicate || 0), color: COLORS.duplicated },
  ].filter(item => item.value > 0)

  const sideBreakdowns = reportSide === 'erp' ? {
    category: data.category_breakdown || [],
    departmentBranch: data.department_breakdown || [],
    divisionDistrict: data.district_breakdown || [],
    location: data.location_reconciliation_chart || [],
  } : {
    category: data.category_breakdown_physical || [],
    departmentBranch: data.department_breakdown_physical || [],
    divisionDistrict: data.district_breakdown_physical || [],
    location: data.location_reconciliation_chart || [],
  }
  const visibleStatusKeys = Object.keys(STATUS_COLORS).filter(key =>
    reportSide === 'erp' ? key !== 'surplus_assets' : key !== 'exist_in_erp_not_physical'
  )

  const tabs = [
    { key: 'category', label: 'Category' },
    { key: 'departmentBranch', label: 'Department / Branch' },
    { key: 'divisionDistrict', label: 'Division / District' },
    { key: 'aging', label: 'Aging' },
    { key: 'location', label: 'Location' },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Analytics Dashboard</h1>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#8E288D] text-white">
            📊 {totalRecords.toLocaleString()} records combined
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {data.scope === 'all' ? '🌐 System-wide — all reconciliations' : '👤 Your reconciliations only'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
            🗄️ {totalRecords.toLocaleString()} total records
          </span>
        </div>
      </div>

      <div className="mb-8 grid w-full grid-cols-1 gap-4 p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-4">

        <KpiCard
          label="ERP Records"
          value={fmt(totalERP)}
          icon={FiDatabase}
          color="#8E288D"
        />

        <KpiCard
          label="Physical Records"
          value={fmt(totalPhysical)}
          icon={FiLayers}
          color="#CFB53B"
        />

        <KpiCard
          label="Match Rate (ERP)"
          value={pct(kpi.erp_match_rate ?? data.average_match_rate)}
          icon={FiPercent}
          color="#059669"
        />

        <KpiCard
          label="Processing Time"
          value={duration(processingSeconds)}
          icon={FiClock}
          color="#2563EB"
        />

      </div>

      <div className="mb-2 flex gap-2 border-b border-gray-200">
        {['erp', 'physical'].map(side => (
          <button key={side} onClick={() => setReportSide(side)}
            className={`border-b-2 px-5 py-1 text-sm font-semibold capitalize ${
              reportSide === side ? 'border-[#8E288D] text-[#8E288D]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {side === 'erp' ? 'ERP' : 'Physical'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map(t => (
                <button key={t.key} onClick={() => { setActiveTab(t.key); logActivity('/analytics', `TAB_SWITCH_${t.key.toUpperCase()}`) }}
                  className={`flex h-10 w-44 items-center justify-center px-4 text-sm font-medium transition-colors ${activeTab === t.key
                        ? 'text-[#8E288D] shadow border-b-2 border-[#8E288D]'
                        : 'text-gray-600'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeTab === 'category' && (
              <div className="bg-white rounded-xl cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                    chartData: {
                      source: 'analytics_category_breakdown',
                      categoryBreakdown: sideBreakdowns.category
                    },
                    chartType: 'stacked_bar',
                    title: 'AI Analysis - Category Breakdown',
                    targetLabel: 'Category Breakdown',
                    analysisContext: { page: 'Analytics', section: 'Category Breakdown' }
                  })}>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <FiLayers className="text-[#8E288D]" /> Asset Reconciliation by Category
                </h3>
                <p className="text-xs text-gray-400 mb-5">
                  Aggregated across {totalRecords.toLocaleString()} records ·{' '}
                  {((kpi.reconciled||0)+(kpi.unreconciled||0)+(kpi.surplus_assets||0)+(kpi.exist_erp_not_physical||0)+(kpi.duplicated||0)+(kpi.unique||0)+(kpi.pending||0)).toLocaleString()} total records in view
                </p>
                {sideBreakdowns.category.length ? (
                  (() => {
                    const activeKeys = visibleStatusKeys.filter(k =>
                      sideBreakdowns.category.some(r => (r[k] || 0) > 0)
                    )
                    return (
                      <>
                        {sideBreakdowns.category.map(row => (
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

            {activeTab === 'departmentBranch' && (
              <div className="bg-white rounded-xl cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                    chartData: {
                      source: 'analytics_department_branch_breakdown',
                      departmentBreakdown: sideBreakdowns.departmentBranch
                    },
                    chartType: 'stacked_bar',
                    title: 'AI Analysis - Department / Branch Performance',
                    targetLabel: 'Department / Branch Performance',
                    analysisContext: { page: 'Analytics', section: 'Department / Branch Performance' }
                  })}>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <FiMapPin className="text-[#8E288D]" /> Department / Branch Performance
                </h3>
                <p className="text-xs text-gray-400 mb-5">
                  Aggregated across {totalRecords.toLocaleString()} records
                </p>
                {sideBreakdowns.departmentBranch.length ? (
                  (() => {
                    const activeKeys = visibleStatusKeys.filter(k =>
                      sideBreakdowns.departmentBranch.some(r => (r[k] || 0) > 0)
                    )
                    return (
                      <>
                        {sideBreakdowns.departmentBranch.map(row => (
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
                ) : <p className="text-gray-400 text-center py-8">No department/branch data — approve records first</p>}
              </div>
            )}

            {activeTab === 'divisionDistrict' && (
              <div className="bg-white rounded-xl cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                    chartData: {
                      source: 'analytics_division_district_breakdown',
                      districtBreakdown: sideBreakdowns.divisionDistrict
                    },
                    chartType: 'stacked_bar',
                    title: 'AI Analysis - Division / District Performance',
                    targetLabel: 'Division / District Performance',
                    analysisContext: { page: 'Analytics', section: 'Division / District Performance' }
                  })}>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <FiBarChart2 className="text-[#8E288D]" /> Division / District Performance
                </h3>
                <p className="text-xs text-gray-400 mb-5">
                  Aggregated across {totalRecords.toLocaleString()} records
                </p>
                {sideBreakdowns.divisionDistrict.length ? (
                  (() => {
                    const activeKeys = visibleStatusKeys.filter(k =>
                      sideBreakdowns.divisionDistrict.some(r => (r[k] || 0) > 0)
                    )
                    return (
                      <>
                        {sideBreakdowns.divisionDistrict.map(row => (
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
                ) : <p className="text-gray-400 text-center py-8">No division/district data — approve records first</p>}
              </div>
            )}

            {activeTab === 'location' && (
              <div className="bg-white rounded-xl cursor-context-menu" title="Right-click for AI insights"
                onContextMenu={e => openAIContextMenu(e, {
                  chartData: {
                    source: 'analytics_location_reconciliation',
                    data: sideBreakdowns.location
                  },
                  chartType: 'bar',
                  title: 'AI Analysis - Location Reconciliation',
                  targetLabel: 'Location Reconciliation',
                  analysisContext: { page: 'Analytics', section: 'Location Reconciliation' }
                })}>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <FiMapPin className="text-[#8E288D]" /> Location Reconciliation
                </h3>
                <p className="text-xs text-gray-400 mb-5">Department/branch and division/district matching across all records</p>
                {sideBreakdowns.location.length ? (
                  (() => {
                    const locationStatuses = visibleStatusKeys.filter(status =>
                      sideBreakdowns.location.some(row => Number(row[status] || 0) > 0)
                    )
                    return (
                      <div>
                        {sideBreakdowns.location.map(row => (
                          <HorizontalStackedBar key={row.name} row={row} statuses={locationStatuses}
                            colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.name} />
                        ))}
                        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
                          {locationStatuses.map(status => (
                            <span key={status} className="flex items-center gap-1.5">
                              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[status] }} />
                              {STATUS_LABELS[status]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()
                ) : <p className="text-gray-400 text-center py-8">No location data available</p>}
              </div>
            )}

            {activeTab === 'aging' && (() => {
              if (!agingData) return (
                <div className="bg-white rounded-xl text-center text-gray-400">
                  <FiLoader className="animate-spin mx-auto h-8 w-8 mb-2" />
                  <p>Loading aging data…</p>
                </div>
              )

              const AGING_COLORS = {
                reconciled: '#8E288D',
                unreconciled: '#000000',
                pending: '#6B7280',
                duplicated: '#000000',
                unique: '#008080',
                ...(reportSide === 'erp'
                  ? { exist_in_erp_not_physical: '#BE123C' }
                  : { surplus_assets: '#BE123C' }),
              }
              const AGING_LABELS = {
                reconciled: 'Reconciled', unreconciled: 'Unmatched',
                pending: 'Pending',
                duplicated: 'Duplicated', unique: 'Unique',
                ...(reportSide === 'erp'
                  ? { exist_in_erp_not_physical: 'Shortage' }
                  : { surplus_assets: 'Surplus' }),
              }
              const AGING_STATUS_KEYS = Object.keys(AGING_COLORS)

              const stackedBuckets = agingData.stacked_buckets || []
              const buckets = agingData.buckets || []
              const agingTotal = buckets.reduce((s, d) => s + d.count, 0) || 1
              const currentYear = agingData.current_year || new Date().getFullYear()

              const agingActiveKeys = AGING_STATUS_KEYS.filter(k =>
                stackedBuckets.some(row => (row[k] || 0) > 0)
              )

              return (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl cursor-context-menu" title="Right-click for AI insights"
                    onContextMenu={e => openAIContextMenu(e, {
                        chartData: {
                          source: 'analytics_aging_analysis',
                          agingBuckets: stackedBuckets.length ? stackedBuckets : buckets
                        },
                        chartType: 'bar',
                        title: 'AI Analysis - Aging Analysis',
                        targetLabel: 'Aging Analysis',
                        analysisContext: { page: 'Analytics', section: 'Aging Analysis' }
                      })}>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                      📅 Asset Aging — {reportSide === 'erp' ? 'ERP' : 'Physical'} Records (vs {currentYear})
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Based on year field in Finance data · {agingTotal.toLocaleString()} total records
                    </p>
                    {stackedBuckets.length ? (
                      <div className="w-full">
                        <div className="space-y-1">
                          {stackedBuckets.map(row => (
                            <HorizontalStackedBar
                              key={row.bucket}
                              row={row}
                              statuses={agingActiveKeys}
                              colors={AGING_COLORS}
                              labels={AGING_LABELS}
                              rowLabel={row.bucket}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-100">
                          {agingActiveKeys.map(s => (
                            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: AGING_COLORS[s] }} />
                              {AGING_LABELS[s]}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : buckets.length ? (
                      <div className="space-y-3">
                        {buckets.map((d, i) => {
                          const sharePct = ((d.count / agingTotal) * 100).toFixed(1)
                          const color = ['#8E288D','#000','#CFB53B','#f97316','#ef4444','#b91c1c','#9ca3af'][Math.min(i, 6)]
                          return (
                            <div key={d.bucket} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-16 flex-shrink-0">{d.bucket}</span>
                              <div className="flex-1 bg-gray-100 rounded-md h-8 overflow-hidden">
                                <div className="h-full flex items-center rounded-md transition-all duration-700"
                                  style={{ width: `${sharePct}%`, backgroundColor: color }}>
                                  <span className="text-white text-xs font-semibold px-2 select-none">{d.count.toLocaleString()}</span>
                                </div>
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-12 text-right">{sharePct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : <p className="text-gray-400 text-center py-8">No aging data — year field may be missing in ERP records</p>}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" title="Right-click for AI insights"
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
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Overview</h3>
          {(() => {
            const donutTotal = donutData.reduce((s, d) => s + d.value, 0) || 1
            const chartTotal = donutTotal
            return (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Total: {chartTotal.toLocaleString()} records
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%"
                      innerRadius={62} outerRadius={96}
                      paddingAngle={3} dataKey="value"
                      labelLine={true}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]
                      const sharePct = ((p.value / chartTotal) * 100).toFixed(1)
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
                            <span className="font-semibold">{chartTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-6 border-t border-gray-100 pt-5">
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">Match Type Breakdown</h4>
                  <div className="space-y-3">
                    {matchBreakdown.map(item => {
                      const pctValue = chartTotal > 0 ? ((item.value / chartTotal) * 100).toFixed(1) : 0
                      return (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                            <span className="font-medium">{item.label}</span>
                            <span className="font-bold" style={{ color: item.color }}>{item.value.toLocaleString()} ({pctValue}%)</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${pctValue}%`, backgroundColor: item.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

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
