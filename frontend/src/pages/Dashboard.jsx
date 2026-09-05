import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import { useAuth } from '../context/AuthContext'
import AIAnalysisModal from '../components/AIAnalysisModal'
import AIContextMenu from '../components/AIContextMenu'
import {
  FiUpload, FiDownload, FiClock, FiCheckCircle, FiXCircle, FiLoader,
  FiFileText, FiFilter, FiSearch, FiCheck, FiCopy, FiTarget,
  FiTrash2, FiChevronLeft, FiChevronRight, FiUser, FiBarChart2, FiEye,
  FiRefreshCw, FiAlertTriangle, FiPlus
} from 'react-icons/fi'

// ── Palette for charts ─────────────────────────────────────────────────────────
// Bucket order: < 1yr, 1-3yr, 3-5yr, 5-10yr, 10-20yr, >20yr, Unknown
const AGING_BUCKET_CONFIG = [
  { key: '< 1 yr',    label: '< 1 yr',    color: '#22c55e' },  // green  – fresh
  { key: '1 – 3 yr',  label: '1 – 3 yr',  color: '#8E288D' },  // blue
  { key: '3 – 5 yr',  label: '3 – 5 yr',  color: '#f59e0b' },  // brand purple
  { key: '5 – 10 yr', label: '5 – 10 yr', color: '#CFB53B' },  // amber
  { key: '10 – 20 yr',label: '10 – 20 yr',color: '#f08eee' },  // red – aging
  { key: '> 20 yr',   label: '> 20 yr',   color: '#bbb38d' },  // gray – very old
  { key: 'Unknown',   label: 'Unknown',   color: '#000000' },  // light gray
]

// ── Category Distribution Bar Component ─────────────────────────────────────
// Each bar = Reconciled (approved: reconciled+surplus+shortage+duplicate) vs Unresolved (unreconciled+pending)
// Purple bar = Reconciled, gray track = Unresolved
const CategoryDistributionChart = ({ categoryData, monthLabel }) => {
  const [hovered, setHovered] = React.useState(null)

  const hasData = categoryData && categoryData.length > 0

  const items = hasData
    ? categoryData.slice(0, 10).map(cat => {
        const resolved = (cat.reconciled || 0)
          + (cat.surplus_assets || 0)
          + (cat.exist_in_erp_not_physical || 0)
          + (cat.duplicated || 0)
          + (cat.unique || 0)
        const unresolved = (cat.unreconciled || 0) + (cat.pending || 0)
        const total      = resolved + unresolved
        const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0
        return {
          name:         cat.name || 'Unknown',
          resolved,
          unresolved,
          total,
          resolvedPct,
        }
      })
    : [
        { name: 'Furniture & Fitting',  resolved: 190, unresolved: 10,  total: 200, resolvedPct: 95 },
        { name: 'Hardware',             resolved: 144, unresolved: 56,  total: 200, resolvedPct: 72 },
        { name: 'Office Equipment',     resolved: 104, unresolved: 96,  total: 200, resolvedPct: 52 },
        { name: 'ATM & POS',            resolved: 60,  unresolved: 140, total: 200, resolvedPct: 30 },
        { name: 'Motor Vehicle',        resolved: 46,  unresolved: 154, total: 200, resolvedPct: 23 },
        { name: 'Premises',             resolved: 38,  unresolved: 162, total: 200, resolvedPct: 19 },
        { name: 'Hardware Expense',     resolved: 30,  unresolved: 170, total: 200, resolvedPct: 15 },
        { name: 'Equipment Expense',    resolved: 20,  unresolved: 180, total: 200, resolvedPct: 10 },
      ]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 h-full flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
            Category Distribution
            {monthLabel && <span className="text-xs font-normal text-[#8E288D] ml-1.5">({monthLabel})</span>}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Reconciled vs Unresolved per asset category
          </p>
        </div>
        {!hasData && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
            Sample data
          </span>
        )}
      </div>

      {/* Bars */}
      <div className="flex items-end justify-between gap-2 flex-1 pb-7 relative">
        {items.map((item) => {
          const isHov = hovered === item.name
          return (
            <div
              key={item.name}
              className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Percentage label above bar */}
              <span
                className="text-[11px] font-bold mb-1.5 transition-all duration-150"
                style={{ color: '#8E288D', opacity: isHov ? 1 : 0.8 }}
              >
                {item.resolvedPct}%
              </span>

              {/* Bar column */}
              <div
                className="w-full max-w-[40px] rounded-t-md overflow-hidden flex flex-col-reverse"
                style={{
                  height: '100%',
                  backgroundColor: '#f3f0f4',  // unresolved track (light purple-gray)
                }}
              >
                {/* Reconciled (purple) — fills from bottom */}
                <div
                  className="w-full rounded-t-md transition-all duration-700 ease-out"
                  style={{
                    height: `${Math.max(2, item.resolvedPct)}%`,
                    backgroundColor: '#8E288D',
                    opacity: isHov ? 1 : 0.85,
                    boxShadow: isHov ? '0 -2px 8px rgba(142,40,141,0.4)' : 'none',
                  }}
                />
              </div>

              {/* Tooltip on hover */}
              {isHov && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
                  <p className="font-bold mb-1">{item.name}</p>
                  <p><span className="inline-block w-2 h-2 rounded-full bg-[#8E288D] mr-1" />Reconciled: <span className="font-semibold">{item.resolved.toLocaleString()}</span> ({item.resolvedPct}%)</p>
                  <p><span className="inline-block w-2 h-2 rounded-full bg-[#f3f0f4] border border-gray-400 mr-1" />Unresolved: <span className="font-semibold">{item.unresolved.toLocaleString()}</span> ({100 - item.resolvedPct}%)</p>
                  <p className="text-gray-400 mt-0.5">Total: {item.total.toLocaleString()}</p>
                </div>
              )}

              {/* X-axis label */}
              <div className="absolute top-full mt-2 left-1/2 w-20 origin-top-left -rotate-45">
                <p className="text-[9.5px] font-medium text-gray-500 dark:text-gray-400 leading-tight whitespace-nowrap truncate">
                  {item.name}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#8E288D' }} />
          <span className="text-xs font-semibold" style={{ color: '#8E288D' }}>Reconciled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-[#f3f0f4] border border-gray-300" />
          <span className="text-xs font-semibold text-gray-400">Unresolved</span>
        </div>
      </div>

    </div>
  )
}

// ── Asset Aging Ring/Donut Chart (Current Month ERP Data Only) ────────────────
const DonutAgingChart = ({ agingData, agingYear, monthLabel, totalERPCount }) => {
  const [hovered, setHovered] = React.useState(null)
  const [tooltip, setTooltip]  = React.useState({ visible: false, x: 0, y: 0, item: null })

  // Enforce bucket order — only include buckets that have data or exist in config
  const orderedData = AGING_BUCKET_CONFIG
    .map(cfg => {
      const found = (agingData || []).find(d => d.bucket === cfg.key)
      return { ...cfg, count: found ? (found.count || 0) : 0 }
    })
    .filter(d => d.count > 0)  // hide zero buckets

  const hasData = orderedData.length > 0

  // Fall back placeholder when no data
  const displayData = hasData ? orderedData : [
    { key: 'No data', label: 'No data yet', color: '#e5e7eb', count: 1 }
  ]

  const totalAssets = hasData
    ? orderedData.reduce((s, d) => s + d.count, 0)
    : (totalERPCount || 0)

  // SVG donut parameters
  const size        = 200
  const sw          = 28           // stroke width
  const radius      = (size - sw) / 2
  const cx          = size / 2
  const cy          = size / 2
  const circ        = 2 * Math.PI * radius
  const gapAngle    = hasData ? 0.03 : 0  // small gap between segments (radians)
  const gapArc      = hasData ? (gapAngle * radius) : 0

  // Build segments
  let offsetAcc = 0
  const segments = displayData.map(item => {
    const pct       = totalAssets > 0 ? item.count / totalAssets : 1
    const arcLen    = Math.max(0, pct * circ - gapArc)
    const dash      = `${arcLen} ${circ}`
    const offset    = -offsetAcc
    offsetAcc      += pct * circ
    return { ...item, pct, dash, offset }
  })

  const handleMouseMove = (e, item) => {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      item,
    })
    setHovered(item.key)
  }
  const handleMouseLeave = () => {
    setTooltip(t => ({ ...t, visible: false }))
    setHovered(null)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 h-full flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-100 uppercase">
            Asset Aging Analysis
          </h2>
          <p className="text-[10px] text-gray-400 mt-0.5">ERP assets by acquisition age</p>
        </div>
        <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
          {monthLabel || `FY ${agingYear || new Date().getFullYear()}`}
        </span>
      </div>

      {/* Donut + center */}
      <div className="flex items-center justify-center relative select-none">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 overflow-visible"
        >
          {/* Track */}
          <circle cx={cx} cy={cy} r={radius}
            fill="transparent"
            stroke="#f3f4f6"
            strokeWidth={sw}
          />

          {/* Segments */}
          {segments.map(seg => (
            <circle
              key={seg.key}
              cx={cx} cy={cy} r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={hovered === seg.key ? sw + 5 : sw}
              strokeDasharray={seg.dash}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
              className="transition-all duration-200 cursor-pointer"
              style={{ opacity: hovered && hovered !== seg.key ? 0.45 : 1 }}
              onMouseMove={e => handleMouseMove(e, seg)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-xl font-black text-gray-800 dark:text-white leading-tight">
                {(segments.find(s => s.key === hovered)?.count || 0).toLocaleString()}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 leading-tight mt-0.5">
                {hovered}
              </span>
              <span className="text-[11px] font-bold text-gray-500 mt-0.5">
                {((segments.find(s => s.key === hovered)?.pct || 0) * 100).toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">
                {totalAssets.toLocaleString()}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                Total ERP Assets
              </span>
            </>
          )}
        </div>

        {/* SVG tooltip */}
        {tooltip.visible && tooltip.item && (
          <div
            className="absolute z-20 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap"
            style={{
              left: tooltip.x + 12,
              top:  tooltip.y - 36,
              transform: tooltip.x > size * 0.65 ? 'translateX(-110%)' : 'none',
            }}
          >
            <p className="font-bold">{tooltip.item.label}</p>
            <p className="mt-0.5">
              <span className="text-white font-semibold">{tooltip.item.count.toLocaleString()}</span>
              <span className="text-gray-400 ml-1">assets</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="font-semibold" style={{ color: tooltip.item.color }}>
                {(tooltip.item.pct * 100).toFixed(1)}%
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Legend — single row, titles only */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {displayData.map(item => {
          const isHov = hovered === item.key
          return (
            <div
              key={item.key}
              className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${isHov ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }} />
              <span className="text-[11px] font-semibold whitespace-nowrap"
                style={{ color: item.color }}>
                {item.label}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}

// ── Main Dashboard Component ──────────────────────────────────────────────────
const Dashboard = () => {
  const [reconciliations, setReconciliations] = useState([])
  const [analyticsData, setAnalyticsData] = useState(null)
  const [agingData, setAgingData] = useState([])
  const [agingYear, setAgingYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // AI Insights State
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAIContextMenu, setShowAIContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [aiModalConfig, setAiModalConfig] = useState({
    chartData: null, chartType: 'pie', title: 'AI Analysis', targetLabel: '', analysisContext: {}
  })
  const [aiModalAction, setAiModalAction] = useState('modal')
  const [aiModalAnalysisType, setAiModalAnalysisType] = useState('summary')
  const [aiModalOutputFormat, setAiModalOutputFormat] = useState('combined')

  const ITEMS_PER_PAGE = 5
  const navigate = useNavigate()
  const { user, userRole, hasRole } = useAuth()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [reconRes, agingRes, analyticsRes] = await Promise.allSettled([
        axios.get('/api/reconciliation/list'),
        axios.get('/api/reconciliation/analytics/aging'),
        axios.get('/api/reconciliation/analytics')
      ])

      if (reconRes.status === 'fulfilled') {
        setReconciliations(reconRes.value.data.reconciliations || [])
      }
      if (agingRes.status === 'fulfilled') {
        setAgingData(agingRes.value.data.buckets || [])
        setAgingYear(agingRes.value.data.current_year || new Date().getFullYear())
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalyticsData(analyticsRes.value.data || null)
      }
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  // ── Scope reconciliations strictly based on user's access privileges ──
  // admin/manager: see all records from all users (server already returns all)
  // officer: strictly filter to only their own — fallback to false so no accidental leakage
  const scopedReconciliations = reconciliations.filter(r => {
    if (userRole === 'admin' || userRole === 'manager') return true
    // Officer scope: match by user_id first (most reliable)
    if (user?.id && r.user_id != null) {
      return Number(r.user_id) === Number(user.id)
    }
    // Secondary: match by username if user.id not yet hydrated
    if (user?.username && r.requester_username) {
      return r.requester_username.toLowerCase() === user.username.toLowerCase()
    }
    // Default false — never show unverifiable records to an officer
    return false
  })

  // ── Calculate dynamic KPIs strictly for CURRENT MONTH uploaded records & user's scope ──
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Filter reconciliations belonging to the current month in user's access scope
  const currentMonthReconciliations = scopedReconciliations.filter(r => {
    if (!r.created_at) return false
    const d = new Date(r.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  // If no records in current calendar month, scope to latest upload month in user's dataset or current month
  const activeMonthReconciliations = currentMonthReconciliations.length > 0
    ? currentMonthReconciliations
    : scopedReconciliations.filter(r => {
        if (!scopedReconciliations.length) return false
        const latestTimestamp = Math.max(...scopedReconciliations.map(x => new Date(x.created_at).getTime()))
        const latestDate = new Date(latestTimestamp)
        const d = new Date(r.created_at)
        return d.getMonth() === latestDate.getMonth() && d.getFullYear() === latestDate.getFullYear()
      })

  const activeMonthDate = activeMonthReconciliations.length > 0 && activeMonthReconciliations[0]?.created_at
    ? new Date(activeMonthReconciliations[0].created_at)
    : now

  const activeMonthLabel = activeMonthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })

  // Total uploaded records in current month for user's scope
  const totalPhysicalRecords = activeMonthReconciliations.reduce(
    (s, r) => s + (r.statistics?.total_customer_records || r.total_customer_records || 0), 0
  )
  const totalERPRecords = activeMonthReconciliations.reduce(
    (s, r) => s + (r.statistics?.total_internal_records || r.total_internal_records || 0), 0
  )

  // Pull approval_kpis from analyticsData (server-computed, role-scoped)
  // Falls back to 0 while data loads
  const kpi = analyticsData?.approval_kpis || {}

  // 1. Reconciled = all approved statuses: reconciled + surplus_assets + shortage + duplicated + unique
  const reconciledCount = (kpi.reconciled || 0)
    + (kpi.surplus_assets || 0)
    + (kpi.exist_erp_not_physical || 0)
    + (kpi.duplicated || 0)
    + (kpi.unique || 0)

  // Use server ERP/physical totals when available, fall back to job-level aggregates
  const erpTotal      = kpi.total_erp_assets   || totalERPRecords
  const physicalTotal = kpi.physical_count      || totalPhysicalRecords

  // 2. Unresolved = unreconciled + pending
  const unresolvedCount = (kpi.unreconciled || 0) + (kpi.pending || 0)

  // 3. Surplus = physical records not in ERP (from approval_kpis)
  const surplusCount = kpi.surplus_assets || activeMonthReconciliations.reduce(
    (s, r) => s + (r.statistics?.customer_unmatched || 0), 0
  )

  // 4. Reconciliation Rate = reconciled / total ERP assets
  const matchRate = erpTotal > 0
    ? ((reconciledCount / erpTotal) * 100).toFixed(1)
    : '0.0'

  const reconciledRate = matchRate

  const unresolvedRate = erpTotal > 0
    ? ((unresolvedCount / erpTotal) * 100).toFixed(1)
    : '0.0'

  // Surplus Rate: surplus / total physical records
  const surplusRate = physicalTotal > 0
    ? ((surplusCount / physicalTotal) * 100).toFixed(1)
    : '0.0'

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

  const handleDownload = async (id) => {
    try {
      logActivity(window.location.pathname, `DOWNLOAD_REPORT_ID_${id}`)
      const response = await axios.get(`/api/reconciliation/download-enriched/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reconciliation_enriched_${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await axios.delete(`/api/reconciliation/${id}`)
      logActivity('/', `DELETE_RECONCILIATION_ID_${id}`)
      toast.success('Reconciliation deleted successfully')
      setDeleteConfirmId(null)

      const updated = reconciliations.filter(r => r.id !== id)
      setReconciliations(updated)
      const filtered = updated.filter(recon => {
        const matchesSearch = (recon.customer_file || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (recon.internal_file || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter = filterStatus === 'all' || recon.status === filterStatus
        return matchesSearch && matchesFilter
      })
      const newTotalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
      if (currentPage > newTotalPages) setCurrentPage(Math.max(1, newTotalPages))
    } catch (error) {
      toast.error('Failed to delete reconciliation')
    } finally {
      setDeleting(false)
    }
  }

  // Filter and pagination for table scoped to user's access privilege
  const filteredReconciliations = scopedReconciliations.filter(recon => {
    const matchesSearch = (recon.customer_file || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (recon.internal_file || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || recon.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filteredReconciliations.length / ITEMS_PER_PAGE))
  const paginatedReconciliations = filteredReconciliations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">
            Completed
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <FiLoader className="animate-spin mr-1 h-3 w-3" /> Processing
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800">
            Failed Validation
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
            Needs Review
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <FiLoader className="animate-spin h-10 w-10 text-[#701460]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Scope indicator bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-600 dark:text-gray-300">Data Scope:</span>
          {(userRole === 'admin' || userRole === 'manager') ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-purple-50 text-[#701460] dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <FiUser className="h-3 w-3" />
              All Officers
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <FiUser className="h-3 w-3" />
              My Uploads Only
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Showing: <span className="font-semibold text-gray-600 dark:text-gray-300">{activeMonthLabel}</span>
          &nbsp;·&nbsp; ERP: <span className="font-semibold text-gray-700 dark:text-gray-200">{erpTotal.toLocaleString()}</span>
          &nbsp;·&nbsp; Physical: <span className="font-semibold text-gray-700 dark:text-gray-200">{physicalTotal.toLocaleString()}</span>
          &nbsp;·&nbsp; Jobs: <span className="font-semibold text-gray-700 dark:text-gray-200">{activeMonthReconciliations.length}</span>
        </span>
      </div>

      {/* ── Top 4 KPI Metric Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Reconciled */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <FiCheck className="h-3 w-3 mr-0.5" />
              Reconciled ({activeMonthLabel})
            </span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-3 tracking-tight">
            {reconciledCount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-xs">
            <span className="text-gray-400 truncate">
              {reconciledCount.toLocaleString()} / {erpTotal.toLocaleString()} ERP Records
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-[11px] ml-1 flex-shrink-0">
              {reconciledRate}%
            </span>
          </div>
        </div>

        {/* Card 2: Unresolved (Unreconciled) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <FiAlertTriangle className="h-3 w-3 mr-0.5" />
              Unresolved ({activeMonthLabel})
            </span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-3 tracking-tight">
            {unresolvedCount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-xs">
            <span className="text-gray-400 truncate">
              {unresolvedCount.toLocaleString()} / {erpTotal.toLocaleString()} ERP Records
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/50 text-[11px] ml-1 flex-shrink-0">
              {unresolvedRate}%
            </span>
          </div>
        </div>

        {/* Card 3: Surplus Assets (Physical not in ERP) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Assets found in Physical/Customer records but not in ERP">
              <FiPlus className="h-3 w-3 mr-0.5" />
              Surplus Assets ({activeMonthLabel})
            </span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-3 tracking-tight">
            {surplusCount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-xs">
            <span className="text-gray-400 truncate" title="Physical records not found in ERP">
              {surplusCount.toLocaleString()} / {physicalTotal.toLocaleString()} Physical Records
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/50 text-[11px] ml-1 flex-shrink-0">
              {surplusRate}%
            </span>
          </div>
        </div>

        {/* Card 4: Match Rate (Total Matches / Total ERP Records) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-[#701460] dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <FiTarget className="h-3 w-3 mr-0.5" />
              Match Rate ({activeMonthLabel})
            </span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-3 tracking-tight">
            {matchRate}%
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-xs">
            <span className="text-gray-400 truncate">
              {reconciledCount.toLocaleString()} Matches of {erpTotal.toLocaleString()} ERP Records
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-[11px] ml-1 flex-shrink-0">
              ERP Match Rate
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle Visualizations: Category Split & Asset Aging ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 cursor-context-menu"
          title="Right-click for AI category insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: { source: 'category_distribution', categories: analyticsData?.category_breakdown },
            chartType: 'bar',
            title: 'AI Analysis - Category Distribution',
            targetLabel: 'Category Distribution Chart',
            analysisContext: { page: 'Dashboard', section: 'Category Distribution' }
          })}
        >
          <CategoryDistributionChart
            categoryData={analyticsData?.category_breakdown}
            monthLabel={activeMonthLabel}
          />
        </div>

        <div
          className="cursor-context-menu"
          title="Right-click for AI aging insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: { source: 'asset_aging', agingData, year: agingYear },
            chartType: 'pie',
            title: 'AI Analysis - Asset Aging',
            targetLabel: 'Asset Aging Ring Chart',
            analysisContext: { page: 'Dashboard', section: 'Aging Analysis' }
          })}
        >
          <DonutAgingChart
            agingData={agingData}
            agingYear={agingYear}
            monthLabel={activeMonthLabel}
            totalERPCount={erpTotal}
          />
        </div>
      </div>

      {/* ── Bottom Section: Recent Reconciliation Reports Table ───────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        {/* Table Header & Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Recent Reconciliation Reports
              </h2>
              <Link
                to="/analytics"
                className="text-xs font-semibold text-[#701460] dark:text-purple-400 hover:underline"
              >
                See All Reports
              </Link>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Recent automated and manual branch reconciliation executions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#701460]/40 w-44"
              />
            </div>

            {/* Filter dropdown */}
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }}
                className="pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#701460]/40 appearance-none cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* New Reconciliation Button */}
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-[#701460] hover:bg-[#5c104e] rounded-lg shadow-sm transition-all transform hover:scale-[1.02]"
            >
              <FiPlus className="mr-1.5 h-3.5 w-3.5" />
              New Reconciliation
            </Link>
          </div>
        </div>

        {/* Table Content */}
        {filteredReconciliations.length === 0 ? (
          <div className="py-12 text-center">
            <FiFileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No reconciliations found</h3>
            <p className="text-xs text-gray-400 mt-1">
              {searchTerm || filterStatus !== 'all' ? 'Try adjusting search or status filter' : 'Upload files to start reconciliation'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[12px] font-bold uppercase tracking-wider text-[#8E288D] dark:text-gray-200 text-center">
                  <th className="py-3 px-3">Requested By</th>
                  <th className="py-3 px-3">RECONCILIATION DATE</th>
                  <th className="py-3 px-3">RECORDS ANALYZED</th>
                  <th className="py-3 px-3">CURRENT STATUS</th>
                  <th className="py-3 px-3">MATCH RATE FOR APROVAL</th>
                  <th className="py-3 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs">
                {paginatedReconciliations.map((recon) => {
                  const totalRecords = recon.statistics?.total_customer_records || recon.total_customer_records || 0
                  const ruleMatched = recon.statistics?.rule_matched || 0
                  const aiMatched = recon.statistics?.ai_matched || 0
                  const matchRateVal = totalRecords > 0
                    ? Math.round(((ruleMatched + aiMatched) / totalRecords) * 100)
                    : 0

                  const jobTitle = recon.customer_file
                    ? recon.customer_file.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
                    : `Reconciliation #${recon.id}`

                  return (
                    <tr key={recon.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors text-center">
                      {/* Name & Type */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/60 text-[#701460] dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                            <FiRefreshCw className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[12px] text-gray-700 dark:text-gray-500">
                              <span className='font-bold'>Requester:</span> <span className='text-[#8E288D]'> {user?.full_name || user?.username || 'User'} : {user?.email || user?.username || 'User'}</span>
                            </p>
                            <p className="text-gray-800 dark:text-gray-100 capitalize">
                              <span className='font-bold'>File:</span>
                              {jobTitle}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Execution Date */}
                      <td className="py-3.5 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {new Date(recon.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        })} • {new Date(recon.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Records Analyzed */}
                      <td className="py-3.5 px-3 font-semibold text-gray-700 dark:text-gray-200">
                        {totalRecords.toLocaleString()} assets
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {getStatusBadge(recon.status)}
                      </td>

                      {/* Match Rate */}
                      <td className="py-3.5 px-3 font-bold text-gray-800 dark:text-gray-100">
                        {matchRateVal}%
                      </td>

                      {/* Action Buttons: View, Dashboard, Review & Approve, Download, Delete */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* 1. View Results Button */}
                          <button
                            onClick={() => {
                              logActivity(window.location.pathname, `VIEW_RESULTS_ID_${recon.id}`)
                              navigate(`/results/${recon.id}`)
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#701460] hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                            title="View Results"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>

                          {/* 2. Dashboard Button */}
                          <button
                            onClick={() => {
                              logActivity('/', `VIEW_REPORT_DASHBOARD_ID_${recon.id}`)
                              navigate(`/report/${recon.id}`)
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#701460] hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                            title="View Visual Dashboard"
                          >
                            <FiBarChart2 className="h-4 w-4" />
                          </button>

                          {/* 3. Review & Approve Button (Role-Aware) */}
                          <button
                            onClick={() => {
                              logActivity(window.location.pathname, `VIEW_APPROVAL_ID_${recon.id}`)
                              navigate(`/approval/${recon.id}`)
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                            title={hasRole('manager') ? "Review & Approve Exceptions" : "View Approval Status"}
                          >
                            <FiCheckCircle className="h-4 w-4" />
                          </button>

                          {/* 4. Download Report Button */}
                          {recon.status === 'completed' && (
                            <button
                              onClick={() => handleDownload(recon.id)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                              title="Download Enriched Excel Report"
                            >
                              <FiDownload className="h-4 w-4" />
                            </button>
                          )}

                          {/* 5. Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmId(recon.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete Reconciliation Job"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Showing <strong className="font-semibold text-gray-700 dark:text-gray-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong>–
              <strong className="font-semibold text-gray-700 dark:text-gray-200">{Math.min(currentPage * ITEMS_PER_PAGE, filteredReconciliations.length)}</strong> of{' '}
              <strong className="font-semibold text-gray-700 dark:text-gray-200">{filteredReconciliations.length}</strong> reconciliations
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    currentPage === i + 1
                      ? 'bg-[#701460] text-white'
                      : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <FiTrash2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Reconciliation</h3>
                <p className="text-xs text-gray-400">Job #{deleteConfirmId}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete this reconciliation job and all its analyzed asset records? This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
              >
                {deleting ? <FiLoader className="animate-spin h-3.5 w-3.5" /> : <FiTrash2 className="h-3.5 w-3.5" />}
                <span>{deleting ? 'Deleting...' : 'Delete Job'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Analysis Modals & Context Menus ─────────────────────────────── */}
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

export default Dashboard
