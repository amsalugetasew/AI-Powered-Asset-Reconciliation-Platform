import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import { cachedGet } from '../services/cachedGet'
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
const duration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}

const APPROVAL_COLORS = {
  reconciled: '#8E288D',
  unreconciled: '#BE123C',
  surplus_assets: '#BE123C',
  exist_in_erp_not_physical: '#BE123C',
  pending: '#6B7280',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  color = '#8E288D',
}) => (
  <div className="w-full min-h-[140px] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">

    {/* KPI Label + Icon */}
    <div
      className="relative flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider"
      style={{
        color: color,
        backgroundColor: `${color}10`,
      }}
    >
      {/* Centered Label */}
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
      className="mt-4 text-center text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white"
    >
      {value}
    </p>

    {/* Optional Subtitle */}
    {sub && (
      <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
        {sub}
      </p>
    )}
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
  const [reportSide, setReportSide] = useState('erp')
  const [activeTab, setActiveTab] = useState('report_category')
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
    logActivity(`/report/${id}`, `PAGE_VISIT_REPORT_${id}`)
    Promise.all([
      cachedGet(`/api/reconciliation/analytics/single/${id}?side=${reportSide}`),
      cachedGet(`/api/reconciliation/analytics/aging/${id}?side=${reportSide}`),
    ])
      .then(([r1, r2]) => { setData(r1.data); setAgingData(r2.data) })
      .catch(() => { toast.error('Failed to load report'); navigate('/') })
      .finally(() => setLoading(false))
  }, [id, reportSide])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
    </div>
  )
  if (!data) return null

  const { kpis, donut, category_breakdown, department_breakdown,
    district_breakdown, location_reconciliation_chart, reconciliation, total_records_in_db } = data
  const locationChart = location_reconciliation_chart || []

  const recon = reconciliation
  const erpSide = kpis.side_counts?.erp || {}
  const completedAt = recon.completed_at ? new Date(recon.completed_at).toLocaleString() : '—'
  const createdAt = new Date(recon.created_at).toLocaleString()
  const timestampProcessingSeconds = recon.completed_at && recon.created_at
    ? Math.max((new Date(recon.completed_at) - new Date(recon.created_at)) / 1000, 0)
    : 0
  const processingSeconds = Number(data.processing_time_seconds) > 0
    ? Number(data.processing_time_seconds)
    : timestampProcessingSeconds

  const tabs = [
    { key: 'report_category', label: 'Category' },
    { key: 'report_department', label: 'Department / Branch' },
    { key: 'report_district', label: 'Division / District' },
    { key: 'report_aging', label: 'Aging' },
    { key: 'report_location', label: 'Location' },
  ]

  // ── Shared status palette for ALL breakdown tabs ──────────────────────────
  const STATUS_COLORS = {
    reconciled:                  '#8E288D',
    unreconciled:                '#BE123C',
    duplicated:                  '#000000',
    unique:                      '#14b8a6',
    pending:                     '#6B7280',
    ...(reportSide === 'erp'
      ? { exist_in_erp_not_physical: '#BE123C' }
      : { surplus_assets: '#BE123C' }),
  }
  
  const STATUS_LABELS = {
    reconciled:                  'Reconciled',
    unreconciled:                'Unmatched',
    duplicated:                  'Duplicated',
    unique:                      'Unique',
    pending:                     'Pending',
    ...(reportSide === 'erp'
      ? { exist_in_erp_not_physical: 'Shortage' }
      : { surplus_assets: 'Surplus' }),
  }
  const ALL_STATUS_KEYS = Object.keys(STATUS_COLORS)

  // ── Donut category colors — uses the same palette as horizontal stacked charts ──
const DONUT_CATEGORY_STATUS_MAP = {
  Reconciled: 'reconciled',
  Unreconciled: 'unreconciled',
  Unmatched: 'unreconciled',
  Duplicated: 'duplicated',
  Duplicate: 'duplicated',
  Unique: 'unique',
  Pending: 'pending',
  Shortage: 'exist_in_erp_not_physical',
  Surplus: 'surplus_assets',
}

  // stacked bar data for category — lowercase keys match backend now
  const stackedCatData = category_breakdown.map(c => ({
    name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
    fullName: c.name,
    reconciled:                 c.reconciled   || 0,
    unreconciled:               c.unreconciled || 0,
    ...(reportSide === 'erp'
      ? { exist_in_erp_not_physical: c.exist_in_erp_not_physical || 0 }
      : { surplus_assets: c.surplus_assets || 0 }),
    duplicated:                 c.duplicated   || 0,
    unique:                     c.unique       || 0,
    pending:                    c.pending      || 0,
  }))

  const selectedSide = kpis.side_counts?.[reportSide] || {}
  const matchTypeData = [
    { label: 'Exact Match', value: Number(kpis.exact_matched || 0), color: '#8E288D' },
    { label: 'Near Match', value: Number(kpis.near_match || 0), color: '#CFB53B' },
    { label: 'AI Match', value: Number(kpis.ai_matched || 0), color: '#CFB53B' },
    { label: 'Unmatched', value: Number(selectedSide.unmatched || 0), color: '#BE123C' },
    { label: reportSide === 'erp' ? 'Shortage' : 'Surplus',
      value: Number(reportSide === 'erp' ? selectedSide.shortage : selectedSide.surplus) || 0,
      color: '#BE123C' },
    { label: 'Duplicate', value: Number(selectedSide.duplicate || 0), color: '#000000' },
  ].filter(item => item.value > 0)

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
          <button
            onClick={() => navigate(`/results/${id}`)}
            className="flex h-10 w-44 items-center justify-center rounded-lg hover:border-b-2 hover:border-[#8E288D] px-4 text-sm font-medium text-gray-600 shadow transition-colors hover:text-[#8E288D]">
            View Records
          </button>
          <button onClick={() => navigate(`/approval/${id}`)}
            className="flex h-10 w-44 items-center justify-center rounded-lg hover:border-b-2 hover:border-[#8E288D] px-4 text-sm font-medium text-gray-600 shadow transition-colors hover:text-[#8E288D]">
            Approval
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        <KpiCard
          label="ERP Assets"
          value={fmt(kpis.total_erp_assets)}
          icon={FiDatabase}
          color="#8E288D"
        />

        <KpiCard
          label="Physical Records"
          value={fmt(kpis.physical_count)}
          icon={FiLayers}
          color="#CFB53B"
        />

        <KpiCard
          label="Match Rate (ERP)"
          value={pct(kpis.erp_match_rate)}
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

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {['erp', 'physical'].map(side => (
          <button key={side} onClick={() => setReportSide(side)}
            className={`border-b-2 px-5 py-3 text-sm font-semibold capitalize ${
              reportSide === side ? 'border-[#8E288D] text-[#8E288D]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {side === 'erp' ? 'ERP' : 'Physical'}
          </button>
        ))}
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

      {/* ── Report chart cards: selected breakdown beside aging ───────────── */}
      {(() => {
        const breakdown = activeTab === 'report_location'
          ? locationChart
          : activeTab === 'report_category'
          ? category_breakdown
          : activeTab === 'report_district'
            ? district_breakdown
            : department_breakdown
        const breakdownTitle = activeTab === 'report_location'
          ? 'Location Reconciliation'
          : activeTab === 'report_category'
          ? 'Reconciliation by Asset Category'
          : activeTab === 'report_department'
            ? 'Reconciliation by Department / Branch'
            : 'Reconciliation by Division / District'
        const breakdownSource = activeTab === 'report_location'
          ? 'report_location_reconciliation'
          : activeTab === 'report_category'
          ? 'report_category_breakdown'
          : activeTab === 'report_department'
            ? 'report_department_branch_breakdown'
            : 'report_division_district_breakdown'
        const agingChart = agingData?.aging_chart || []
        const agingStatuses = ALL_STATUS_KEYS.filter(status => agingChart.some(row => (row[status] || 0) > 0))
        const breakdownStatuses = ALL_STATUS_KEYS.filter(status => breakdown.some(row => (row[status] || 0) > 0))

        return (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
              <div className="border-b border-gray-100 p-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => { setActiveTab(t.key); logActivity(`/report/${id}`, `TAB_SWITCH_${t.key.toUpperCase()}`) }}
                      className={`flex h-10 w-44 items-center justify-center px-4 text-sm font-medium transition-colors ${activeTab === t.key
                        ? 'text-[#8E288D] shadow border-b-2 border-[#8E288D]'
                        : 'text-gray-600'
                        }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <FiLayers className="text-[#8E288D]" /> {activeTab === 'report_aging' ? 'Asset Aging' : breakdownTitle}
                </h3>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between text-xs text-gray-400">
                  <span>{reportSide === 'erp' ? 'ERP' : 'Physical'} records for reconciliation #{id}</span>
                  <span>{activeTab === 'report_aging'
                    ? `${agingData?.current_year || new Date().getFullYear()}`
                    : `${breakdown.reduce((sum, row) => sum + Number(row.total || row.value || 0), 0).toLocaleString()} records`}</span>
                </div>
                {activeTab === 'report_aging' ? (
                  agingChart.length ? <>
                    {agingChart.map(row => (
                      <HorizontalStackedBar key={row.bucket} row={row} statuses={agingStatuses}
                        colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.bucket} />
                    ))}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3">
                      {agingStatuses.map(status => (
                        <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[status] }} />
                          {STATUS_LABELS[status]}
                        </div>
                      ))}
                    </div>
                  </> : <p className="py-12 text-center text-gray-400">No aging data available</p>
                ) : activeTab === 'report_location' ? (
                  locationChart.length ? (
                    (() => {
                      const locationStatuses = ALL_STATUS_KEYS.filter(status =>
                        locationChart.some(row => Number(row[status] || 0) > 0)
                      )
                      return (
                        <div>
                          {locationChart.map(row => (
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
                  ) : <p className="py-12 text-center text-gray-400">No location data available</p>
                ) : breakdown.length ? (
                  <>
                    {breakdown.map(row => (
                      <HorizontalStackedBar key={row.name} row={row} statuses={breakdownStatuses}
                        colors={STATUS_COLORS} labels={STATUS_LABELS} rowLabel={row.name} />
                    ))}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3">
                      {breakdownStatuses.map(status => (
                        <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[status] }} />
                          {STATUS_LABELS[status]}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="py-12 text-center text-gray-400">No breakdown data available</p>}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-lg font-semibold text-gray-800">Reconciliation Status</h3>
              <p className="mb-4 text-xs text-gray-400">
                {reportSide === 'erp' ? 'ERP' : 'Physical'} status for reconciliation #{id}
              </p>
              <div className="mb-6">
                {donut.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={donut} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                        {/* {donut.map((entry, index) => <Cell key={index} fill={entry.color} />)} */}
                        {donut.map((entry, index) => {
                          const statusKey = DONUT_CATEGORY_STATUS_MAP[entry.name]

                          return (
                            <Cell
                              key={index}
                              fill={STATUS_COLORS[statusKey] || entry.color}
                            />
                          )
                        })}
                      </Pie>
                      <Tooltip formatter={value => Number(value).toLocaleString()} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-gray-400">No status data available</p>}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-700">Match Type Breakdown</h4>
                <div className="space-y-3">
                  {matchTypeData.map(item => {
                    const total = reportSide === 'erp' ? kpis.total_erp_assets : kpis.physical_count
                    const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                          <span>{item.label}</span>
                          <span className="font-bold" style={{ color: item.color }}>{fmt(item.value)} ({percentage}%)</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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
                { label: 'AI Match', value: kpis.ai_matched, color: '#CFB53B' },
                { label: 'Near Match', value: kpis.near_match, color: '#CFB53B' },
                { label: 'Unmatched', value: kpis.customer_unmatched, color: '#BE123C' },
                { label: 'Physical Duplicates', value: kpis.customer_duplicates || 0, color: '#000000' },
                { label: 'ERP Duplicates', value: kpis.internal_duplicates || 0, color: '#000000' },
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
            title: 'AI Analysis - Reconciliation by Department / Branch',
            targetLabel: 'Reconciliation by Department / Branch',
            analysisContext: { page: 'Report', section: 'Department / Branch Breakdown' }
          })}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <FiBarChart2 className="text-[#8E288D]" /> Reconciliation by Department / Branch
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
            title: 'AI Analysis - Reconciliation by Division / District',
            targetLabel: 'Reconciliation by Division / District',
            analysisContext: { page: 'Report', section: 'Division / District Breakdown' }
          })}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <FiMapPin className="text-[#8E288D]" /> Reconciliation by Division / District
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
                  title: 'AI Analysis - Aging Department / Branch Breakdown',
                  targetLabel: 'Aging Department / Branch Breakdown',
                  analysisContext: { page: 'Report', section: 'Aging Department / Branch Breakdown' }
                })}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    🏢 By Department / Branch — Approval Status
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
                ) : <p className="text-gray-400 text-center py-8">No department/branch data</p>}
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
                  title: 'AI Analysis - Aging Division / District Breakdown',
                  targetLabel: 'Aging Division / District Breakdown',
                  analysisContext: { page: 'Report', section: 'Aging Division / District Breakdown' }
                })}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    📍 By Division / District — Approval Status
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
                ) : <p className="text-gray-400 text-center py-8">No division/district data</p>}
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
