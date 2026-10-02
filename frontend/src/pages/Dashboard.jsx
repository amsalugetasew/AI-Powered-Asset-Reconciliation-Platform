import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import { cachedGet, clearCachedGets } from '../services/cachedGet'
import { useAuth } from '../context/AuthContext'
import AIAnalysisModal from '../components/AIAnalysisModal'
import AIContextMenu from '../components/AIContextMenu'
import {
  FiUpload, FiDownload, FiClock, FiCheckCircle, FiXCircle, FiLoader,
  FiFileText, FiFilter, FiSearch, FiCheck, FiCopy, FiTarget,
  FiTrash2, FiChevronLeft, FiChevronRight, FiUser, FiBarChart2, FiEye,FiArrowLeft,
  FiRefreshCw, FiMinusCircle, FiPlus, FiLayers, FiMapPin,FiPackage, FiHelpCircle,
  FiMoreVertical
} from 'react-icons/fi'

// ── Palette for charts ─────────────────────────────────────────────────────────
const AGING_BUCKET_CONFIG = [
  { key: '< 1 yr',    label: '< 1 yr',    color: '#7a2175' },  // green  – fresh
  { key: '1 – 3 yr',  label: '1 – 3 yr',  color: '#95298E' },  // blue
  { key: '3 – 5 yr',  label: '3 – 5 yr',  color: '#a34d9c' },  // brand purple
  { key: '5 – 10 yr', label: '5 – 10 yr', color: '#c387be' },  // amber
  { key: '10 – 20 yr',label: '10 – 20 yr',color: '#dcb9d8' },  // red – aging
  { key: '> 20 yr',   label: '> 20 yr',   color: '#f0d7ed' },  // gray – very old
  { key: 'Unknown',   label: 'Unknown',   color: '#8c8c8c' },  // light gray
]

// ── Category Distribution Bar Component ─────────────────────────────────────
// Horizontal stacked rows match the reporting page breakdown layout.
const CategoryDistributionChart = ({ categoryData, monthLabel, totalCount }) => {
  const hasData = (categoryData && categoryData.length > 0) || Number(totalCount || 0) > 0

  const allItems = (categoryData || []).map(cat => {
        const resolved   = (cat.reconciled || 0)
          + (cat.surplus_assets || 0)
          + (cat.exist_in_erp_not_physical || 0)
          + (cat.unique || 0)
        const duplicated = cat.duplicated || 0
        const unmatched  = cat.unreconciled || 0
        const pending    = cat.pending || 0
        const total      = resolved + duplicated + unmatched + pending
        return {
          name: cat.name || 'Unknown',
          resolved,
          duplicated,
          unmatched,
          pending,
          total,
        }
      })
  const items = allItems.slice(0, 10)
  const remainingItems = allItems.slice(10)
  if (remainingItems.length) {
    items.push(remainingItems.reduce((other, item) => ({
      name: 'Other categories',
      resolved: other.resolved + item.resolved,
      duplicated: other.duplicated + item.duplicated,
      unmatched: other.unmatched + item.unmatched,
      pending: other.pending + item.pending,
      total: other.total + item.total,
    }), { name: 'Other categories', resolved: 0, duplicated: 0, unmatched: 0, pending: 0, total: 0 }))
  }
  const categoryTotal = allItems.reduce((sum, item) => sum + item.total, 0)
  const unclassifiedTotal = Math.max(Number(totalCount || 0) - categoryTotal, 0)
  if (unclassifiedTotal) {
    items.push({ name: 'Unclassified', resolved: 0, unmatched: 0, pending: unclassifiedTotal, total: unclassifiedTotal, unclassified: true })
  }

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
            Reconciled, Unmatched, and Pending per asset category
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-semibold text-gray-500">
          Total: {Number(totalCount || 0).toLocaleString()}
        </span>
      </div>

      {/* Horizontal stacked rows */}
      <div className="space-y-4">
        {hasData ? items.map(item => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-gray-700 dark:text-gray-200" title={item.name}>{item.name}</span>
              <span className="flex-shrink-0 text-gray-400">{item.total.toLocaleString()}</span>
            </div>
            <div className="flex h-9 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800" title={`${item.name}: ${item.total.toLocaleString()} records`}>
              {[
                ...(item.unclassified
                  ? [{ key: 'unclassified', value: item.total, color: '#9CA3AF', label: 'No detail data' }]
                  : [
                      { key: 'resolved',   value: item.resolved,   color: '#8E288D', label: 'Reconciled' },
                      { key: 'duplicated', value: item.duplicated, color: '#8c8c8c', label: 'Duplicate' },
                      { key: 'unmatched',  value: item.unmatched,  color: '#BE123C', label: 'Unmatched' },
                      { key: 'pending',    value: item.pending,    color: '#D97706', label: 'Pending' },
                    ]),
              ].map(segment => segment.value > 0 && (
                <div key={segment.key} className="flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                  style={{ width: `${(segment.value / item.total) * 100}%`, backgroundColor: segment.color }}
                  title={`${segment.label}: ${segment.value.toLocaleString()}`}>
                  {segment.value / item.total > 0.12 && <span className={`truncate px-1 text-[10px] font-semibold ${segment.key === 'pending' ? 'text-white' : 'text-white'}`}>{segment.label}</span>}
                </div>
              ))}
            </div>
          </div>
        )) : (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No category data yet</p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#8E288D' }} />
          <span className="text-xs font-semibold" style={{ color: '#8E288D' }}>Reconciled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#8c8c8c' }} />
          <span className="text-xs font-semibold" style={{ color: '#8c8c8c' }}>Duplicate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-red-500" />
          <span className="text-xs font-semibold text-red-500">Unmatched</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#D97706' }} />
          <span className="text-xs font-semibold" style={{ color: '#D97706' }}>Pending</span>
        </div>
      </div>

    </div>
  )
}

const BREAKDOWN_COLORS = {
  reconciled: '#8E288D',
  unreconciled: '#BE123C',
  pending: '#D97706',
  surplus_assets: '#B45309',
  exist_in_erp_not_physical: '#F33838',
  duplicated: '#8c8c8c',
  unique: '#8E288D',
}

const LOCATION_COLORS = {
  same_dept_diff_district: '#CFB53B',
  different: '#BE123C',
  same_dept: '#8E288D',
  na: '#6B7280',
}
const LOCATION_LABELS = {
  same_dept_diff_district: 'Same Dept, Diff District',
  different: 'Different',
  same_dept: 'Same Dept',
  na: 'N/A',
}

const BREAKDOWN_LABELS = {
  reconciled: 'Reconciled',
  unreconciled: 'Unmatched',
  pending: 'Pending',
  surplus_assets: 'Surplus',
  exist_in_erp_not_physical: 'Shortage',
  duplicated: 'Duplicate',
  unique: 'Unique',
}

const ReportingBreakdownChart = ({ title, subtitle, data, side, dimension, icon: Icon }) => {
  const excludedStatus = side === 'erp' ? 'surplus_assets' : 'exist_in_erp_not_physical'
  const statuses = Object.keys(BREAKDOWN_COLORS)
    .filter(status => status !== excludedStatus)
    .filter(status => data?.some(row => Number(row[status] || 0) > 0))

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-5 flex items-start gap-2">
        {Icon && <Icon className="mt-0.5 h-5 w-5 text-[#8E288D]" />}
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>
      </div>

      {data?.length ? (
        <>
          <div className="space-y-4">
            {data.map(row => {
              const total = statuses.reduce((sum, status) => sum + Number(row[status] || 0), 0)
              if (!total) return null
              return (
                <div key={row.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-gray-700 dark:text-gray-200" title={row.name}>{row.name}</span>
                    <span className="flex-shrink-0 text-gray-400">{total.toLocaleString()}</span>
                  </div>
                  <div className="flex h-8 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                    {statuses.map(status => {
                      const value = Number(row[status] || 0)
                      if (!value) return null
                      return (
                        <div
                          key={status}
                          className="flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                          style={{ width: `${(value / total) * 100}%`, backgroundColor: BREAKDOWN_COLORS[status] }}
                          title={`${BREAKDOWN_LABELS[status]}: ${value.toLocaleString()}`}
                        >
                          {value / total > 0.12 && <span className="truncate px-1 text-[10px] font-semibold text-white">{BREAKDOWN_LABELS[status]}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            {statuses.map(status => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: BREAKDOWN_COLORS[status] }} />
                {BREAKDOWN_LABELS[status]}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-gray-400">No {dimension} data available</p>
      )}
    </div>
  )
}

const LocationReconciliationChart = ({ data, side }) => {
  const excludedStatus = side === 'erp' ? 'surplus_assets' : 'exist_in_erp_not_physical'
  const statuses = Object.keys(BREAKDOWN_COLORS)
    .filter(status => status !== excludedStatus)
    .filter(status => data?.some(row => Number(row[status] || 0) > 0))
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-5 flex items-start gap-2">
        <FiMapPin className="mt-0.5 h-5 w-5 text-[#8E288D]" />
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Location Reconciliation</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Department/branch and division/district matching
          </p>
        </div>
      </div>

      {data?.length ? (
        <div className="space-y-4">
          {data.map(item => {
            const total = statuses.reduce((sum, status) => sum + Number(item[status] || 0), 0)
            return (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-gray-700 dark:text-gray-200" title={item.name}>{item.name}</span>
                  <span className="flex-shrink-0 text-gray-400">{total.toLocaleString()}</span>
                </div>
                <div className="flex h-8 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                  {statuses.map(status => {
                    const value = Number(item[status] || 0)
                    if (!value) return null
                    return <div key={status} className="flex items-center justify-center overflow-hidden"
                      style={{ width: `${(value / total) * 100}%`, backgroundColor: BREAKDOWN_COLORS[status] }}
                      title={`${BREAKDOWN_LABELS[status]}: ${value.toLocaleString()}`}>
                      {value / total > 0.12 && <span className="truncate px-1 text-[10px] font-semibold text-white">{BREAKDOWN_LABELS[status]}</span>}
                    </div>
                  })}
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
            {statuses.map(status => <span key={status} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: BREAKDOWN_COLORS[status] }} />
              {BREAKDOWN_LABELS[status]}
            </span>)}
          </div>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-gray-400">No Location data available</p>
      )}
    </div>
  )
}

// ── Asset Aging Ring/Donut Chart (Current Month ERP Data Only) ────────────────
const DonutAgingChart = ({ agingData, agingYear, monthLabel, totalERPCount, side = 'erp' }) => {
  const [hovered, setHovered] = React.useState(null)
  const [tooltip, setTooltip]  = React.useState({ visible: false, x: 0, y: 0, item: null })

  // Enforce bucket order — only include buckets that have data or exist in config
  const orderedData = AGING_BUCKET_CONFIG
    .map(cfg => {
      const found = (agingData || []).find(d => d.bucket === cfg.key)
      return { ...cfg, count: found ? (found.count || 0) : 0 }
    })
    .filter(d => d.count > 0)  // hide zero buckets

  const bucketTotal = orderedData.reduce((sum, item) => sum + item.count, 0)
  const totalAssets = Number(totalERPCount) || bucketTotal
  const unclassifiedCount = Math.max(totalAssets - bucketTotal, 0)
  const chartData = unclassifiedCount
    ? [...orderedData, { key: 'Unclassified', label: 'Unclassified', color: '#9CA3AF', count: unclassifiedCount }]
    : orderedData
  const hasData = chartData.length > 0

  // Fall back placeholder when no data
  const displayData = hasData ? chartData : [
    { key: 'No data', label: 'No data yet', color: '#e5e7eb', count: 1 }
  ]

  // SVG donut parameters
  const size        = 240
  const sw          = 20           // stroke width
  const radius      = (size - sw) / 2
  const cx          = size / 2
  const cy          = size / 2
  const circ        = 2 * Math.PI * radius
  const gapAngle    = hasData ? 0.27 : 0  // leave visible spacing between rounded segment ends
  const gapArc      = hasData ? (gapAngle * radius) : 0
  const availableArc = circ - gapArc * displayData.length

  // Build segments
  let offsetAcc = 0
  const segments = displayData.map(item => {
    const pct       = totalAssets > 0 ? item.count / totalAssets : 1
    const arcLen    = Math.max(0, pct * availableArc)
    const dash      = `${arcLen} ${circ}`
    const offset    = -offsetAcc
    offsetAcc      += arcLen + gapArc
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
    <div className="w-full max-w-[616px] min-h-[462px] bg-white dark:bg-gray-900 rounded-[8px] border border-[#E2E8F0] dark:border-gray-800 p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-100 uppercase">
            Asset Aging Analysis
          </h2>
          {/* <p className="text-[10px] text-gray-400 mt-0.5">ERP assets by acquisition age</p>
          <p className="mb-0 text-xs text-gray-400">
                {reportSide === 'erp' ? 'ERP' : 'Physical'} assets by acquisition age
              </p> */}
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
              strokeLinecap="round"
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
              <span className="text-[10px] font-medium uppercase text-gray-500 mt-1">
                Total Assets
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-gray-100 dark:border-gray-800 pt-3 gap-x-2 gap-y-3">
        {displayData.map(item => {
          const isHov = hovered === item.key
          return (
            <div
              key={item.key}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 cursor-pointer rounded-md px-1 py-1 transition-colors ${isHov ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }} />
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {item.count.toLocaleString()}
                </span>
              </span>
              <span className="text-[10px] font-medium uppercase text-gray-500 text-center leading-tight">
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
  const [dashboardSide, setDashboardSide] = useState('erp')
  const [dashboardChartTab, setDashboardChartTab] = useState('category')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [trashedReconciliations, setTrashedReconciliations] = useState([])
  const [recovering, setRecovering] = useState(false)
  const [assignmentModal, setAssignmentModal] = useState(null)
  const [assignableUsers, setAssignableUsers] = useState([])
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState({ left: 0, top: 0 })

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

  const ITEMS_PER_PAGE = 3
  const navigate = useNavigate()
  const { user, userRole, hasRole } = useAuth()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    fetchAgingData()
  }, [dashboardSide])

  useEffect(() => {
    if (showTrash && hasRole('admin')) fetchTrash()
    if (userRole === 'officer' || userRole === 'manager' || userRole === 'admin') {
      fetchAssignableUsers()
    }
    setCurrentPage(1)
  }, [showTrash, userRole])

  useEffect(() => {
    if (openActionMenuId === null) return undefined
    const closeMenu = event => {
      if (!event.target.closest('[data-dashboard-action-menu]')) setOpenActionMenuId(null)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpenActionMenuId(null)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openActionMenuId])

  const fetchTrash = async () => {
    try {
      const response = await cachedGet('/api/reconciliation/trash')
      setTrashedReconciliations(response.data.reconciliations || [])
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load trash')
    }
  }

  const fetchAssignableUsers = async () => {
    try {
      const response = await axios.get('/api/reconciliation/assignable-users')
      setAssignableUsers(response.data.users || [])
    } catch (error) {
      console.error('Failed to load assignable users:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const [reconRes, analyticsRes] = await Promise.allSettled([
        cachedGet('/api/reconciliation/list'),
        cachedGet('/api/reconciliation/analytics?period=current_month')
      ])

      if (reconRes.status === 'fulfilled') {
        setReconciliations(reconRes.value.data.reconciliations || [])
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

  const fetchAgingData = async () => {
    try {
      const response = await cachedGet(`/api/reconciliation/analytics/aging?side=${dashboardSide}&period=current_month`)
      setAgingData(response.data?.buckets || [])
      setAgingYear(response.data?.current_year || new Date().getFullYear())
    } catch {
      toast.error('Failed to load asset aging data')
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

  // Dashboard-only 32-day window: recent jobs can span the previous month as long as
  // they are no older than 32 days, while stale jobs are excluded from KPI/chart/table display.
  const dashboardDateCutoff = new Date()
  dashboardDateCutoff.setDate(dashboardDateCutoff.getDate() - 32)

  const dashboardWindowReconciliations = scopedReconciliations.filter(reconciliation => {
    const referenceDates = [
      reconciliation.completed_at,
      reconciliation.created_at,
      reconciliation.updated_at,
      reconciliation.uploaded_at,
    ].filter(Boolean)

    if (!referenceDates.length) {
      return true
    }

    const latestDate = new Date(Math.max(...referenceDates.map(date => new Date(date).getTime())))
    return !Number.isNaN(latestDate.getTime()) && latestDate >= dashboardDateCutoff
  })

  const currentMonthReconciliations = dashboardWindowReconciliations

  const activeMonthReconciliations = currentMonthReconciliations

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
  const totalRecordCount = totalERPRecords + totalPhysicalRecords

  // Pull approval_kpis from analyticsData (server-computed, role-scoped)
  // Falls back to 0 while data loads
  const kpi = analyticsData?.approval_kpis || {}
  const erpSide = kpi.side_counts?.erp || {}
  const physicalSide = kpi.side_counts?.physical || {}

  // 1. Reconciled = all approved statuses: reconciled + surplus_assets + shortage + duplicated + unique
  const reconciledCount = Number(erpSide.resolved || kpi.resolved_erp || 0)

  // Use server ERP/physical totals when available, fall back to job-level aggregates
  const erpTotal      = kpi.total_erp_assets   || totalERPRecords
  const physicalTotal = kpi.physical_count      || totalPhysicalRecords

  // 2. Unresolved ERP records are the ERP remainder after resolved records.
  const unmatchedERPCount = Number(erpSide.unmatched || kpi.unmatched_erp || 0)
  const unmatchedRate = erpTotal > 0
    ? ((unmatchedERPCount / erpTotal) * 100).toFixed(1)
    : '0.0'

  // 3. Surplus = physical records not in ERP (from approval_kpis)
  const surplusCount = Number(physicalSide.surplus || kpi.surplus_assets || activeMonthReconciliations.reduce(
    (s, r) => s + (r.statistics?.customer_unmatched || 0), 0
  ))

  // 4. Reconciliation Rate = reconciled / total ERP assets
  const matchRate = erpTotal > 0
    ? ((reconciledCount / erpTotal) * 100).toFixed(1)
    : '0.0'

  const reconciledRate = matchRate

  // 4. Shortage = ERP records not found in physical count
  const shortageCount = Number(erpSide.shortage || kpi.exist_erp_not_physical || activeMonthReconciliations.reduce(
    (s, r) => s + (r.statistics?.internal_unmatched || 0), 0
  ))

  // Surplus Rate: surplus / total physical records
  const surplusRate = physicalTotal > 0
    ? ((surplusCount / physicalTotal) * 100).toFixed(1)
    : '0.0'

  const shortageRate = erpTotal > 0
    ? ((shortageCount / erpTotal) * 100).toFixed(1)
    : '0.0'

  const selectedBreakdowns = dashboardSide === 'erp'
    ? {
        category: analyticsData?.category_breakdown || [],
        departmentBranch: analyticsData?.department_breakdown || [],
        divisionDistrict: analyticsData?.district_breakdown || [],
        location: analyticsData?.location_reconciliation_chart || [],
      }
    : {
        category: analyticsData?.category_breakdown_physical || [],
        departmentBranch: analyticsData?.department_breakdown_physical || [],
        divisionDistrict: analyticsData?.district_breakdown_physical || [],
        location: analyticsData?.location_reconciliation_chart || [],
      }

  const selectedSideLabel = dashboardSide === 'erp' ? 'ERP' : 'Physical'

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
      clearCachedGets()
      logActivity('/', `DELETE_RECONCILIATION_ID_${id}`)
      toast.success('Reconciliation moved to trash')
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

  const handleRecover = async (id) => {
    setRecovering(true)
    try {
      await axios.post(`/api/reconciliation/${id}/recover`)
      clearCachedGets()
      toast.success('Reconciliation recovered successfully')
      setTrashedReconciliations(items => items.filter(item => item.id !== id))
      fetchDashboardData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to recover reconciliation')
    } finally {
      setRecovering(false)
    }
  }

  const handleAssignReconciliation = async () => {
    if (!assignmentModal) return
    setAssignmentSubmitting(true)
    try {
      const payload = {
        assignment_scope: assignmentModal.assignment_scope,
        assignment_note: assignmentModal.assignment_note,
        ...(assignmentModal.assignment_scope === 'specific_user' ? { assignee_id: assignmentModal.assignee_id } : {})
      }
      const response = await axios.post(`/api/reconciliation/${assignmentModal.id}/assign`, payload)
      const assignment = response.data.assignment
      const assignee = assignment.assignment_scope === 'specific_user'
        ? assignableUsers.find(option => Number(option.id) === Number(assignment.assigned_to))
        : null
      setReconciliations(current => current.map(reconciliation => (
        reconciliation.id === assignmentModal.id
          ? {
              ...reconciliation,
              assignment_scope: assignment.assignment_scope,
              assigned_to: assignment.assigned_to,
              assigned_to_username: assignment.assigned_to_username || assignee?.username || null,
              assigned_by: assignment.assigned_by,
              assignment_note: assignment.assignment_note,
              assigned_at: assignment.assigned_at,
            }
          : reconciliation
      )))
      toast.success('Review assignment updated successfully')
      clearCachedGets()
      setAssignmentModal(null)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update assignment')
    } finally {
      setAssignmentSubmitting(false)
    }
  }

  // Filter and pagination for table scoped to user's access privilege
  const filteredReconciliations = dashboardWindowReconciliations.filter(recon => {
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
  const visibleReconciliations = showTrash ? trashedReconciliations : filteredReconciliations
  const visibleTotalPages = Math.max(1, Math.ceil(visibleReconciliations.length / ITEMS_PER_PAGE))
  const visiblePageItems = visibleReconciliations.slice(
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
    <div className="space-y-2">
      {/* ── Scope indicator bar ──────────────────────────────────────────────── */}
      {/* <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl px-2 py-1.5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-600 dark:text-gray-300">Data Scope:</span>
          {(userRole === 'admin' || userRole === 'manager') ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 font-bold text-[#701460] dark:bg-purple-950/50 dark:text-purple-300">
              <FiUser className="h-3 w-3" />
              All Officers(Users) Records
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
              <FiUser className="h-3 w-3" />
              My Records Only
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Showing: <span className="font-semibold text-gray-600 dark:text-gray-300">{activeMonthLabel}</span>
          &nbsp;·&nbsp; ERP: <span className="font-semibold text-gray-700 dark:text-gray-200">{erpTotal.toLocaleString()}</span>
          &nbsp;·&nbsp; Physical: <span className="font-semibold text-gray-700 dark:text-gray-200">{physicalTotal.toLocaleString()}</span>
          &nbsp;·&nbsp; Records: <span className="font-semibold text-gray-700 dark:text-gray-200">{totalRecordCount.toLocaleString()}</span>
        </span>
      </div> */}

      {/* ── Top 4 KPI Metric Cards ─────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">

        {/* Card 1: Reconciled */}
        <div
          className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#E1C3DF] p-0 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-purple-950/40 dark:bg-gray-900"
        >
          {/* KPI Label + Icon */}
          <div
            className="relative flex h-[32px] items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 bg-[#E1C3DF] dark:bg-purple-900/60"
          >
            {/* Icon */}
            <span
              className="absolute left-3 flex h-5 w-5 items-center justify-center rounded-[6px] text-[16px] text-[#8E288D] dark:text-purple-300"
            >
              <FiCheckCircle />
            </span>

            {/* Label */}
            <span
              className="ml-8 mt-1 text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-purple-200"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
              }}
            >
              Reconciled ({activeMonthLabel})
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p
                className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-gray-100"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 800,
                }}
              >
                {reconciledCount.toLocaleString()}
              </p>

              <p
                className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}
              >
                Records
              </p>
            </div>

            {/* Description + Percentage */}
            <div className="flex h-[17px] w-full flex-row items-center justify-between gap-3">
              <p
                className="truncate text-[13px] leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}
              >
                {reconciledCount.toLocaleString()} / {erpTotal.toLocaleString()} ERP Records
              </p>

              <span
                className="inline-flex h-[24px] w-[77px] shrink-0 flex-row items-center justify-center rounded-[8px] px-2 text-[14px] font-extrabold text-[#8E288D] bg-[#E1C3DF] dark:text-purple-200 dark:bg-purple-900/60"
              >
                {reconciledRate}%
              </span>
            </div>
          </div>
        </div>


        {/* Card 2: Unmatched ERP Records */}
        <div
          className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#FCE4EA] p-0 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-rose-950/40 dark:bg-gray-900"
        >
          {/* KPI Label + Icon */}
          <div
            className="relative flex h-[32px] items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 bg-[#FCE4EA] dark:bg-rose-900/60"
          >
            {/* Icon */}
            <span
              className="absolute left-3 flex h-5 w-5 items-center justify-center rounded-[6px] text-[16px] text-[#BE123C] dark:text-rose-300"
            >
              <FiHelpCircle />
            </span>

            {/* Label */}
            <span
              className="ml-8 mt-1 text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-rose-200"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
              }}
            >
              Unmatched ({activeMonthLabel})
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p
                className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-gray-100"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 800,
                }}
              >
                {unmatchedERPCount.toLocaleString()}
              </p>

              <p
                className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}
              >
                Records
              </p>
            </div>

            {/* Description + Percentage */}
            <div className="flex h-[17px] w-full flex-row items-center justify-between gap-3">
              <p
                className="truncate text-[13px] leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}
              >
                {unmatchedERPCount.toLocaleString()} / {erpTotal.toLocaleString()} ERP Records
              </p>

              <span
                className="inline-flex h-[24px] w-[77px] shrink-0 flex-row items-center justify-center rounded-[8px] px-2 text-[14px] font-extrabold text-[#BE123C] bg-[#FCE4EA] dark:text-rose-200 dark:bg-rose-900/60"
              >
                {unmatchedRate}%
              </span>
            </div>
          </div>
        </div>

         {/* Card 3: Shortage Assets */}
        <div
          className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#FEE2E2] p-0 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-red-950/40 dark:bg-gray-900"
        >
          {/* KPI Label + Icon */}
          <div
            className="relative flex h-[32px] items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 bg-[#FEE2E2] dark:bg-red-900/60"
            title="ERP records not found in the physical count">
            {/* Icon */}
            <span
              className="absolute left-3 flex h-5 w-5 items-center justify-center rounded-[6px] text-[16px] text-[#F33838] dark:text-red-300"
            >
              <FiMinusCircle />
            </span>

            {/* Label */}
            <span
              className="ml-8 mt-1 text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-red-200"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
              }}
            >
              Shortage Assets ({activeMonthLabel})
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p
                className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-gray-100"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 800,
                }}
              >
                {shortageCount.toLocaleString()}
              </p>

              <p
                className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}
              >
                Records
              </p>
            </div>

            {/* Description + Percentage */}
            <div className="flex h-[17px] w-full flex-row items-center justify-between gap-3">
              <p
                className="truncate text-[13px] leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}
                title="ERP records not found in physical count"
              >
                {shortageCount.toLocaleString()} / {erpTotal.toLocaleString()} ERP Records
              </p>

              <span
                className="inline-flex h-[24px] w-[77px] shrink-0 flex-row items-center justify-center rounded-[8px] px-2 text-[14px] font-extrabold text-[#F33838] bg-[#FEE2E2] dark:text-red-200 dark:bg-red-900/60"
              >
                {shortageRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Surplus Assets */}
        <div
          className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#FEF3C7] p-0 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-amber-950/40 dark:bg-gray-900"
        >
          {/* KPI Label + Icon */}
          <div
            className="relative flex h-[32px] items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 bg-[#FEF3C7] dark:bg-amber-900/60"
            title="Assets found in Physical/Customer records but not in ERP"
          >
            {/* Icon */}
            <span
              className="absolute left-3 flex h-5 w-5 items-center justify-center rounded-[6px] text-[16px] text-[#B45309] dark:text-amber-300"
            >
              <FiPackage />
            </span>

            {/* Label */}
            <span
              className="ml-8 mt-1 text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-amber-200"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
              }}
            >
              Surplus Assets ({activeMonthLabel})
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p
                className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-gray-100"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 800,
                }}
              >
                {surplusCount.toLocaleString()}
              </p>

              <p
                className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}
              >
                Records
              </p>
            </div>

            {/* Description + Percentage */}
            <div className="flex h-[17px] w-full flex-row items-center justify-between gap-3">
              <p
                className="truncate text-[13px] leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}
                title="Physical/Customer records not found in ERP"
              >
                {surplusCount.toLocaleString()} / {physicalTotal.toLocaleString()} Physical Records
              </p>

              <span
                className="inline-flex h-[24px] w-[77px] shrink-0 flex-row items-center justify-center rounded-[8px] px-2 text-[14px] font-extrabold text-[#B45309] bg-[#FEF3C7] dark:text-amber-200 dark:bg-amber-900/60"
              >
                {surplusRate}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Side tabs and chart cards ────────────────────────────────────── */}
      <div className="mb-4 flex gap-2">
        {['erp', 'physical'].map(side => (
          <button type="button" key={side} onClick={event => { event.preventDefault(); setDashboardSide(side) }}
            className={`border-b-2 px-5 py-3 text-sm font-semibold ${
              dashboardSide === side
                ? 'border-[#8E288D] text-[#8E288D] dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}>
            {side === 'erp' ? 'ERP' : 'Physical'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex h-[462px] min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <div className="border-b border-gray-100 p-4 dark:border-gray-800">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'category', label: 'Category' },
                { key: 'departmentBranch', label: 'Department / Branch' },
                { key: 'divisionDistrict', label: 'Division / District' },
                { key: 'location', label: 'Location' },
              ].map(tab => (
                <button type="button" key={tab.key} onClick={event => { event.preventDefault(); setDashboardChartTab(tab.key) }}
                  className={`flex h-10 w-44 items-center justify-center px-4 text-sm font-medium transition-colors ${dashboardChartTab === tab.key
                      ? 'text-[#8E288D] shadow border-b-2 border-[#8E288D] dark:text-purple-400 dark:border-purple-400'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {dashboardChartTab === 'category' && (
              <CategoryDistributionChart
                categoryData={selectedBreakdowns.category}
                monthLabel={`${selectedSideLabel} · ${activeMonthLabel}`}
                totalCount={dashboardSide === 'erp' ? erpTotal : physicalTotal}
              />
            )}
            {dashboardChartTab === 'departmentBranch' && (
              <ReportingBreakdownChart
                title={`${selectedSideLabel} Department / Branch Performance`}
                subtitle="Reconciled, unmatched, pending, and side-specific variance"
                data={selectedBreakdowns.departmentBranch}
                side={dashboardSide}
                dimension="Department / Branch"
                icon={FiMapPin}
              />
            )}
            {dashboardChartTab === 'divisionDistrict' && (
              <ReportingBreakdownChart
                title={`${selectedSideLabel} Division / District Performance`}
                subtitle="Reconciled, unmatched, pending, and side-specific variance"
                data={selectedBreakdowns.divisionDistrict}
                side={dashboardSide}
                dimension="Division / District"
                icon={FiLayers}
              />
            )}
            {dashboardChartTab === 'location' && (
              <LocationReconciliationChart data={selectedBreakdowns.location} side={dashboardSide} />
            )}
          </div>
        </div>

        <div className="h-[462px] min-h-0 overflow-y-auto cursor-context-menu" title="Right-click for AI aging insights"
          onContextMenu={e => openAIContextMenu(e, {
            chartData: { source: 'asset_aging', agingData, year: agingYear, side: dashboardSide },
            chartType: 'pie',
            title: `AI Analysis - ${selectedSideLabel} Asset Aging`,
            targetLabel: `${selectedSideLabel} Asset Aging Ring Chart`,
            analysisContext: { page: 'Dashboard', section: 'Aging Analysis', side: dashboardSide }
          })}>
          <DonutAgingChart
            agingData={agingData}
            agingYear={agingYear}
            monthLabel={`${selectedSideLabel} · ${activeMonthLabel}`}
            totalERPCount={dashboardSide === 'erp' ? erpTotal : physicalTotal}
            side={dashboardSide}
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
                Reconciliation Reports
              </h2>
              {/* <Link
                to="/analytics"
                className="text-xs font-semibold text-[#701460] dark:text-purple-400 hover:underline"
              >
                See All Reports
              </Link> */}
            </div>
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
              className="inline-flex h-8 w-fit items-center gap-2 rounded-lg bg-[#701460] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-[#5c104e]"
            >
              <FiPlus className="h-3.5 w-3.5" />
              New Upload
            </Link>

            {hasRole('admin') && (
              <button
                type="button"
                onClick={() => setShowTrash(value => !value)}
                className={`inline-flex h-8 w-[120px] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${showTrash
                  ? 'border-[#701460] bg-[#701460] text-white'
                  : 'border-gray-200 text-gray-600 hover:border-[#701460] hover:text-[#701460] dark:border-gray-700 dark:text-gray-300'
                  }`}
              >
                {showTrash ? (
                  <>
                    <FiArrowLeft className="h-3.5 w-3.5" />
                    Main
                  </>
                ) : (
                  <>
                    <FiTrash2 className="h-3.5 w-3.5" />
                    Trash
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {visibleReconciliations.length === 0 ? (
          <div className="py-12 text-center">
            <FiFileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {showTrash ? 'Trash is empty' : 'No reconciliations found'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {showTrash ? 'Deleted reports can be recovered by an administrator' : searchTerm || filterStatus !== 'all' ? 'Try adjusting search or status filter' : 'Upload files to start reconciliation'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="reconciliation-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[12px] font-bold uppercase tracking-wider text-[#64748B] dark:text-gray-200 text-center">
                  <th className="py-3 px-3">Uploaded File</th>
                  <th className="py-3 px-3">Maker</th>
                  <th className="py-3 px-3">Checker</th>
                  {/* <th className="py-3 px-3">Approver</th> */}
                  <th className="py-3 px-3">RECONCILIATION DATE</th>
                  <th className="py-3 px-3">RECORDS ANALYZED</th>
                  <th className="py-3 px-3">CURRENT STATUS</th>
                  <th className="py-3 px-3">MATCH RATE FOR APROVAL</th>
                  <th className="py-3 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs">
                {visiblePageItems.map((recon) => {
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
                          <div>
                            <p className="text-gray-800 dark:text-gray-100 capitalize">
                              <span className='font-bold'>File:</span>
                              {jobTitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="text-[12px] text-gray-700 dark:text-gray-500">
                              {/* <span className='font-bold'>Requester:</span>  */}
                              <span className='text-[#8E288D]'> {recon.requester_username || `User #${recon.user_id || 'Unknown'}`} : {recon.requester_email || 'Email unavailable'}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="text-[12px] text-gray-700 dark:text-gray-500">
                              <span className="font-bold">Assigned to:</span>{' '}
                              <span className="text-[#8E288D]">
                                {recon.assignment_scope === 'specific_user'
                                  ? recon.assigned_to_username || `User #${recon.assigned_to}`
                                  : 'All officers'}
                              </span>
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

                      {/* Action Menu: compact three-dot dropdown preserving the same handlers */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="relative inline-block" data-dashboard-action-menu>
                          <button
                            type="button"
                            onClick={event => {
                              if (openActionMenuId === recon.id) {
                                setOpenActionMenuId(null)
                                return
                              }
                              const rect = event.currentTarget.getBoundingClientRect()
                              const menuWidth = 176
                              const menuItemCount = showTrash
                                ? 1
                                : 4 + (recon.status === 'completed' ? 1 : 0) + (hasRole('admin') ? 1 : 0)
                              const menuHeight = menuItemCount * 36 + 10
                              const openAbove = window.innerHeight - rect.bottom - 4 < menuHeight
                              setActionMenuPosition({
                                left: Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth)),
                                top: openAbove ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
                              })
                              setOpenActionMenuId(recon.id)
                            }}
                            aria-label={`Actions for ${jobTitle}`}
                            aria-expanded={openActionMenuId === recon.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8E288D] dark:text-purple-400 transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/40 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
                          >
                            <FiMoreVertical className="h-5 w-5" />
                          </button>

                          {openActionMenuId === recon.id && createPortal(
                            <div
                              data-dashboard-action-menu
                              className="fixed z-[100] w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-left shadow-xl"
                              style={{
                                left: actionMenuPosition.left,
                                top: actionMenuPosition.top,
                              }}
                            >
                              {!showTrash && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      logActivity(window.location.pathname, `VIEW_RESULTS_ID_${recon.id}`)
                                      navigate(`/results/${recon.id}`)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-purple-50 dark:hover:bg-gray-700"
                                  >
                                    <FiEye className="h-4 w-4 text-[#8E288D] dark:text-purple-400" />
                                    View Results
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      logActivity('/', `VIEW_REPORT_DASHBOARD_ID_${recon.id}`)
                                      navigate(`/report/${recon.id}`)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  >
                                    <FiBarChart2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    View Dashboard
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      logActivity(window.location.pathname, `VIEW_APPROVAL_ID_${recon.id}`)
                                      navigate(`/approval/${recon.id}`)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  >
                                    <FiCheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    {hasRole('manager') ? 'Review & Approve' : 'View Approval'}
                                  </button>

                                  {recon.status === 'completed' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null)
                                        handleDownload(recon.id)
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    >
                                      <FiDownload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      Download Report
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      setAssignmentModal({
                                        id: recon.id,
                                        assignment_scope: 'all_officers',
                                        assignee_id: '',
                                        assignment_note: recon.assignment_note || '',
                                      })
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  >
                                    <FiUser className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    Assign Reviewer
                                  </button>
                                </>
                              )}

                              {showTrash ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null)
                                    handleRecover(recon.id)
                                  }}
                                  disabled={recovering}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <FiRefreshCw className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${recovering ? 'animate-spin' : ''}`} />
                                  Recover Job
                                </button>
                              ) : hasRole('admin') ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null)
                                    setDeleteConfirmId(recon.id)
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <FiTrash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                                  Move to Trash
                                </button>
                              ) : null}
                            </div>,
                            document.body
                          )}
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
        {visibleTotalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Showing <strong className="font-semibold text-gray-700 dark:text-gray-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong>–
              <strong className="font-semibold text-gray-700 dark:text-gray-200">{Math.min(currentPage * ITEMS_PER_PAGE, visibleReconciliations.length)}</strong> of{' '}
              <strong className="font-semibold text-gray-700 dark:text-gray-200">{visibleReconciliations.length}</strong> {showTrash ? 'deleted reports' : 'reconciliations'}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              {[...Array(visibleTotalPages)].map((_, i) => (
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
                onClick={() => setCurrentPage(p => Math.min(visibleTotalPages, p + 1))}
                disabled={currentPage === visibleTotalPages}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Assignment Modal ─────────────────────────────────────────────── */}
      {assignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 rounded-xl">
                <FiUser className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Assign Review</h3>
                <p className="text-xs text-gray-400">Reconciliation #{assignmentModal.id}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Assignment type</label>
                <select
                  value={assignmentModal.assignment_scope}
                  onChange={e => setAssignmentModal({ ...assignmentModal, assignment_scope: e.target.value, assignee_id: e.target.value === 'all_officers' ? '' : assignmentModal.assignee_id || assignableUsers[0]?.id || '' })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                >
                  <option value="all_officers">All officers</option>
                  <option value="specific_user">Specific officer</option>
                </select>
              </div>

              {assignmentModal.assignment_scope === 'specific_user' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Assign to</label>
                  <select
                    value={assignmentModal.assignee_id || ''}
                    onChange={e => setAssignmentModal({ ...assignmentModal, assignee_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                  >
                    <option value="">Select an officer</option>
                    {assignableUsers
                      .filter(option => option.role === 'officer' && Number(option.id) !== Number(user?.id))
                      .map(option => (
                        <option key={option.id} value={option.id}>{option.full_name || option.username} ({option.username})</option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Note</label>
                <textarea
                  rows={3}
                  value={assignmentModal.assignment_note || ''}
                  onChange={e => setAssignmentModal({ ...assignmentModal, assignment_note: e.target.value })}
                  placeholder="Add review note or check instruction"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setAssignmentModal(null)}
                disabled={assignmentSubmitting}
                className="w-32 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignReconciliation}
                disabled={assignmentSubmitting || (assignmentModal.assignment_scope === 'specific_user' && !assignmentModal.assignee_id)}
                className="w-32 h-10 rounded-lg bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7D207C] transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
              >
                {assignmentSubmitting ? <FiLoader className="animate-spin h-3.5 w-3.5" /> : 'Save assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 bg-red-100 dark:bg-red-950/60 rounded-xl">
                <FiTrash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Reconciliation</h3>
                <p className="text-xs text-gray-400">Job #{deleteConfirmId}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to move this reconciliation job to trash? Its analyzed asset records will be kept and the job can be recovered by an administrator.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="w-32 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="w-32 h-10 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 transition-colors flex items-center justify-center space-x-1.5"
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
