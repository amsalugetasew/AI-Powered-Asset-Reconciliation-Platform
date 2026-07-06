import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiArrowLeft, FiCheckCircle, FiXCircle, FiClock,
  FiChevronLeft, FiChevronRight, FiAlertCircle, FiFilter, FiChevronDown
} from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

// ── Status definitions ────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'pending',                   label: 'Pending',              color: '#CFB53B'   },
  { value: 'reconciled',               label: 'Reconciled',           color: '#8E288D'  },
  { value: 'unreconciled',             label: 'Unreconciled',         color: 'red'    },
  { value: 'surplus_assets',           label: 'Surplus Assets',       color: 'orange' },
  { value: 'exist_in_erp_not_physical',label: 'Exist in ERP not Physical', color: 'purple' },
  { value: 'duplicated',               label: 'Duplicated',           color: 'pink'   },
  { value: 'unique',                   label: 'Unique',               color: 'teal'   },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

const statusBadgeCls = {
  pending:                   'bg-gray-100 text-gray-700 border-gray-300',
  reconciled:               'bg-green-100 text-[#8E288D] border-green-300',
  unreconciled:             'bg-red-100 text-red-800 border-red-300',
  surplus_assets:           'bg-orange-100 text-orange-800 border-orange-300',
  exist_in_erp_not_physical:'bg-purple-100 text-purple-800 border-purple-300',
  duplicated:               'bg-pink-100 text-pink-800 border-pink-300',
  unique:                   'bg-teal-100 text-teal-800 border-teal-300',
}

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',            label: 'All'           },
  { key: 'Exact Match',   label: 'Exact Match'   },
  { key: 'AI Match',      label: 'AI Match'      },
  { key: 'Manual Review', label: 'Manual Review' },
  { key: 'Unmatched',     label: 'Unmatched'     },
  { key: 'Duplicate',     label: 'Duplicate'     },
]

// Bulk action options per category type
const BULK_OPTIONS_MATCHED = [
  { value: 'reconciled',   label: 'Reconciled'   },
  { value: 'unreconciled', label: 'Unreconciled'  },
]
const BULK_OPTIONS_UNMATCHED = [
  { value: 'surplus_assets',            label: 'Surplus Assets'             },
  { value: 'exist_in_erp_not_physical', label: 'Exist in ERP not Physical'  },
  { value: 'reconciled',                label: 'Reconciled'                 },
  { value: 'unreconciled',              label: 'Unreconciled'               },
]
const BULK_OPTIONS_DUPLICATE = [
  { value: 'duplicated', label: 'Duplicated' },
  { value: 'unique',     label: 'Unique'     },
]

// ── Paired column definitions ─────────────────────────────────────────────────
const COLUMN_PAIRS = [
  { label: 'Old Tag',     cKey: 'customer_old_tag',     iKey: 'internal_old_tag',     expandable: false },
  { label: 'New Tag',     cKey: 'customer_new_tag',     iKey: 'internal_new_tag',     expandable: false },
  { label: 'Year',        cKey: 'customer_year',        iKey: 'internal_year',        expandable: false },
  { label: 'Category',    cKey: 'customer_category',    iKey: 'internal_category',    expandable: true  },
  { label: 'Description', cKey: 'customer_description', iKey: 'internal_description', expandable: true  },
  { label: 'Department',  cKey: 'customer_department',  iKey: 'internal_department',  expandable: true  },
  { label: 'District',    cKey: 'customer_district',    iKey: 'internal_district',    expandable: true  },
  { label: 'Book Value',  cKey: 'customer_book_value',  iKey: 'internal_book_value',  expandable: false },
  { label: 'Asset No.',   cKey: 'customer_asset_no',    iKey: 'internal_asset_no',    expandable: false },
  { label: 'Serial No.',  cKey: 'customer_serial',      iKey: 'internal_serial',      expandable: false },
]

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  const cls = statusBadgeCls[status] || statusBadgeCls.pending
  const Icon = status === 'reconciled' ? FiCheckCircle
             : status === 'pending'    ? FiClock
             : FiXCircle
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />{s.label}
    </span>
  )
}

// ── Per-record status dropdown ────────────────────────────────────────────────
const StatusDropdown = ({ recordId, current, onSelect, loading }) => {
  const [open, setOpen] = useState(false)
  const currentStatus = STATUS_MAP[current] || STATUS_MAP.pending
  const cls = statusBadgeCls[current] || statusBadgeCls.pending

  if (loading) return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8E288D]" />

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer hover:opacity-80 ${cls}`}
      >
        {currentStatus.label}
        <FiChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[220px]">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => { setOpen(false); if (s.value !== current) onSelect(recordId, s.value) }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                  s.value === current ? 'font-semibold text-[#8E288D]' : 'text-gray-700'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[s.value].split(' ')[0]}`} />
                {s.label}
                {s.value === current && ' ✓'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Bulk action dropdown ──────────────────────────────────────────────────────
const BulkDropdown = ({ category, onSelect, loading }) => {
  const [open, setOpen] = useState(false)
  const [subCat, setSubCat] = useState(null) // for Unmatched sub-category step
  const isDuplicate = category === 'Duplicate'
  const isUnmatched = category === 'Unmatched'

  const UNMATCHED_SUBCATS = [
    { value: 'Unmatched',          label: 'All Unmatched'       },
    { value: 'Customer Unmatched', label: 'Customer Unmatched'  },
    { value: 'Finance Unmatched',  label: 'Finance Unmatched'   },
  ]

  const optionsForCat = isDuplicate ? BULK_OPTIONS_DUPLICATE
                      : isUnmatched ? BULK_OPTIONS_UNMATCHED
                      : BULK_OPTIONS_MATCHED

  const loadingKey = loading && Object.keys(loading).find(k => k.startsWith(category) && loading[k])

  const handleClose = () => { setOpen(false); setSubCat(null) }

  const handleSelect = (targetCat, decision) => {
    handleClose()
    onSelect(targetCat, decision)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => { setOpen(o => !o); setSubCat(null) }}
        disabled={!!loadingKey}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white bg-[#8E288D] hover:bg-[#7A1E79] disabled:opacity-50"
      >
        {loadingKey ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : null}
        Bulk Approve <FiChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={handleClose} />
          <div className="absolute right-0 mt-1 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[230px]">

            {/* Unmatched: Step 1 — pick sub-category */}
            {isUnmatched && !subCat && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Apply to…
                </div>
                {UNMATCHED_SUBCATS.map(sc => (
                  <button key={sc.value}
                    onClick={() => setSubCat(sc.value)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center justify-between">
                    {sc.label}
                    <FiChevronDown className="w-3 h-3 -rotate-90 text-gray-400" />
                  </button>
                ))}
              </>
            )}

            {/* Unmatched: Step 2 — pick status for chosen sub-category */}
            {isUnmatched && subCat && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 flex items-center gap-2">
                  <button onClick={() => setSubCat(null)}
                    className="text-[#8E288D] hover:underline flex items-center gap-1">
                    <FiChevronDown className="w-3 h-3 rotate-90" /> Back
                  </button>
                  <span className="truncate">{UNMATCHED_SUBCATS.find(s => s.value === subCat)?.label}</span>
                </div>
                {optionsForCat.map(opt => (
                  <button key={opt.value}
                    onClick={() => handleSelect(subCat, opt.value)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[opt.value]?.split(' ')[0] || 'bg-gray-300'}`} />
                    {opt.label}
                  </button>
                ))}
              </>
            )}

            {/* Non-unmatched categories: direct status pick */}
            {!isUnmatched && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Mark all as…
                </div>
                {optionsForCat.map(opt => (
                  <button key={opt.value}
                    onClick={() => handleSelect(category, opt.value)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[opt.value]?.split(' ')[0] || 'bg-gray-300'}`} />
                    {opt.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const ApprovalPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canApprove = hasRole('manager')

  const [reconciliation, setReconciliation] = useState(null)
  const [records, setRecords]               = useState([])
  const [summary, setSummary]               = useState({})
  const [loading, setLoading]               = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [actionLoading, setActionLoading]   = useState({}) // { [recordId]: true }
  const [bulkLoading, setBulkLoading]       = useState({}) // { [category-decision]: true }

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter]         = useState('all')
  const [page, setPage]                         = useState(1)
  const [totalPages, setTotalPages]             = useState(1)
  const [totalRecords, setTotalRecords]         = useState(0)
  const [expandedCols, setExpandedCols]         = useState({}) // { [colLabel]: true }
  const PER_PAGE = 10

  const toggleCol = (label) =>
    setExpandedCols(prev => ({ ...prev, [label]: !prev[label] }))

  // ── fetch header ───────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`/api/reconciliation/${id}`)
      .then(r => setReconciliation(r.data.reconciliation))
      .catch(() => { toast.error('Failed to load reconciliation'); navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  // ── fetch summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const r = await axios.get(`/api/reconciliation/records/approval-summary/${id}`)
      setSummary(r.data.summary || {})
    } catch {}
  }, [id])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // ── fetch records ──────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      setRecordsLoading(true)
      const params = {
        page, per_page: PER_PAGE,
        category: selectedCategory === 'all' ? 'all' : selectedCategory,
        ...(statusFilter !== 'all' && { approval_status: statusFilter }),
      }
      const r = await axios.get(`/api/reconciliation/records/${id}`, { params })
      setRecords(r.data.records || [])
      setTotalRecords(r.data.pagination.total_records)
      setTotalPages(r.data.pagination.total_pages)
    } catch { toast.error('Failed to load records') }
    finally { setRecordsLoading(false) }
  }, [id, page, selectedCategory, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── per-record decision ────────────────────────────────────────────────────
  const handleRecordDecision = async (recordId, decision) => {
    try {
      setActionLoading(p => ({ ...p, [recordId]: true }))
      await axios.post('/api/reconciliation/records/approve-record', {
        record_id: recordId,
        approval_decision: decision,
      })
      toast.success(`Marked as "${STATUS_MAP[decision]?.label || decision}"`)
      await fetchRecords()
      await fetchSummary()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed')
    } finally {
      setActionLoading(p => { const n = { ...p }; delete n[recordId]; return n })
    }
  }

  // ── bulk decision ──────────────────────────────────────────────────────────
  const handleBulkDecision = async (category, decision) => {
    const key = `${category}-${decision}`
    try {
      setBulkLoading(p => ({ ...p, [key]: true }))
      await axios.post('/api/reconciliation/records/approve-group', {
        reconciliation_id: parseInt(id),
        category,
        approval_decision: decision,
      })
      toast.success(`All "${category}" → "${STATUS_MAP[decision]?.label || decision}"`)
      await fetchRecords()
      await fetchSummary()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bulk action failed')
    } finally {
      setBulkLoading(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  // ── summary helpers ────────────────────────────────────────────────────────
  const getSummary = (cat) => {
    const empty = { total: 0, pending: 0, reconciled: 0, unreconciled: 0,
                    surplus_assets: 0, exist_in_erp_not_physical: 0,
                    duplicated: 0, unique: 0 }
    if (cat === 'all') {
      // Use only canonical keys — skip raw sub-keys that are already grouped
      // 'Unmatched' = Customer Unmatched + Finance Unmatched (already combined by backend)
      // Skip 'Duplicate' — separate workflow
      const SKIP_KEYS = new Set(['Customer Unmatched', 'Finance Unmatched', 'Duplicate'])
      return Object.entries(summary)
        .filter(([k]) => !SKIP_KEYS.has(k))
        .reduce((a, [, s]) => {
          Object.keys(empty).forEach(k => { a[k] = (a[k] || 0) + (s[k] || 0) })
          return a
        }, { ...empty })
    }
    if (cat === 'Unmatched') {
      return ['Customer Unmatched', 'Finance Unmatched'].reduce((a, k) => {
        const s = summary[k] || {}
        Object.keys(empty).forEach(f => { a[f] = (a[f] || 0) + (s[f] || 0) })
        return a
      }, { ...empty })
    }
    return { ...empty, ...(summary[cat] || {}) }
  }

  // Customer / Finance unmatched split for display
  const customerUnmatched = summary['Customer Unmatched'] || {}
  const financeUnmatched  = summary['Finance Unmatched']  || {}

  // For duplicate category separate summary
  const getDuplicateSummary = () => {
    const empty = { total: 0, pending: 0, duplicated: 0, unique: 0 }
    return { ...empty, ...(summary['Duplicate'] || {}) }
  }

  const nonPendingCount = (s) =>
    (s.reconciled || 0) + (s.unreconciled || 0) +
    (s.surplus_assets || 0) + (s.exist_in_erp_not_physical || 0) +
    (s.duplicated || 0) + (s.unique || 0)

  // ── tab styles ─────────────────────────────────────────────────────────────
  const tabCls = (key) => {
    const active   = { all: 'bg-gray-700 text-white', 'Exact Match': 'bg-[#8E288D] text-white',
                       'AI Match': 'bg-[#7A1E79] text-white', 'Manual Review': 'bg-[#CFB53B] text-white',
                       'Unmatched': 'bg-red-600 text-white', 'Duplicate': 'bg-pink-600 text-white' }
    const inactive = { all: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                       'Exact Match': 'bg-green-50 text-[#8E288D] hover:text-[#8E288D] hover:bg-purple-100',
                       'AI Match': 'bg-purple-50 text-[#8E288D] hover:bg-purple-100',
                       'Manual Review': 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                       'Unmatched': 'bg-red-50 text-red-700 hover:bg-red-100',
                       'Duplicate': 'bg-pink-50 text-pink-700 hover:bg-pink-100' }
    return selectedCategory === key
      ? (active[key] || 'bg-gray-700 text-white')
      : (inactive[key] || 'bg-gray-100 text-gray-700 hover:bg-gray-200')
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D]" />
    </div>
  )

  const overall = getSummary('all')
  const overallDone = nonPendingCount(overall)
  const pct = overall.total > 0 ? ((overallDone / overall.total) * 100).toFixed(0) : 0

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      {/* Back */}
      <div className="mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <FiArrowLeft className="mr-2" /> Back
        </button>
      </div>

      {/* Title + progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {canApprove ? 'Approval Review' : 'Approval Status'} — Reconciliation #{id}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {canApprove
              ? 'Click the status badge on each record to change it, or use Bulk Approve for a whole category'
              : 'View approval status for this reconciliation'}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4 min-w-[300px] shadow-sm">
          {/* Overall approval progress — excludes Duplicate category */}
          <p className="text-xs text-gray-500 mb-1 font-medium">
            Approval Progress (excluding Duplicates)
          </p>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-[#8E288D] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700">{pct}% reviewed</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            {overall.total - overall.pending} of {overall.total} records reviewed
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
            <span className="text-yellow-600 font-medium">⏳ {overall.pending} pending</span>
            <span className="text-[#8E288D] font-medium">✓ {overall.reconciled} reconciled</span>
            <span className="text-red-600 font-medium">✗ {overall.unreconciled} unreconciled</span>
            <span className="text-orange-600 font-medium">◈ {overall.surplus_assets} surplus</span>
          </div>
          {/* Per-side reconciliation rates based on APPROVAL decisions */}
          {reconciliation && (() => {
            const stats = reconciliation.statistics
            const custTotal    = stats.total_customer_records || 1
            const finTotal     = stats.total_internal_records || 1
            const custUnmatch  = stats.customer_unmatched || 0
            const finUnmatch   = stats.internal_unmatched || 0
            // Reconciliation rate = approved-reconciled / total (from approval decisions)
            const custRecRate  = ((overall.reconciled / custTotal) * 100).toFixed(1)
            const finRecRate   = ((overall.reconciled / finTotal)  * 100).toFixed(1)
            return (
              <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-purple-50 rounded p-2">
                  <p className="text-gray-500 font-medium text-center">Customer</p>
                  <p className="text-xl font-bold text-purple-700 text-center">{custRecRate}%</p>
                  <p className="text-gray-400 text-center">reconciled</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-medium">{custTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-400">Unmatched</span>
                      <span className="font-medium text-red-500">{custUnmatch.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pink-400">Duplicates</span>
                      <span className="font-medium text-pink-500">{(stats.customer_duplicates||0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-teal-50 rounded p-2">
                  <p className="text-gray-500 font-medium text-center">Finance</p>
                  <p className="text-xl font-bold text-teal-700 text-center">{finRecRate}%</p>
                  <p className="text-gray-400 text-center">reconciled</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-medium">{finTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-400">Unmatched</span>
                      <span className="font-medium text-red-500">{finUnmatch.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pink-400">Duplicates</span>
                      <span className="font-medium text-pink-500">{(stats.internal_duplicates||0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(cat => {
          const s = getSummary(cat.key)
          return (
            <button key={cat.key}
              onClick={() => { setSelectedCategory(cat.key); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tabCls(cat.key)}`}>
              {cat.label}
              {cat.key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-80">
                  ({s.pending} pending · {nonPendingCount(s)} done)
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filter + bulk row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <FiFilter className="text-gray-400 flex-shrink-0" />
          {['all', ...STATUSES.map(s => s.value)].map(sf => (
            <button key={sf}
              onClick={() => { setStatusFilter(sf); setPage(1) }}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                statusFilter === sf
                  ? 'bg-[#8E288D] text-white border-[#8E288D]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#8E288D]'
              }`}>
              {sf === 'all' ? 'All' : (STATUS_MAP[sf]?.label || sf)}
            </button>
          ))}
        </div>

        {/* Bulk action (manager only, non-all category) */}
        {canApprove && selectedCategory !== 'all' && (
          <BulkDropdown
            category={selectedCategory}
            onSelect={handleBulkDecision}
            loading={bulkLoading}
          />
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-2xl border-collapse">
            <thead>
              {/* Row 1 — group headers */}
              <tr className="bg-gray-100 border-b border-gray-300">
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-300 sticky left-0 bg-gray-100 z-10">
                  Category
                </th>
                {COLUMN_PAIRS.map(p => (
                  <th key={p.label} colSpan={2}
                    onClick={p.expandable ? () => toggleCol(p.label) : undefined}
                    className={`px-3 py-1.5 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 whitespace-nowrap
                      ${p.expandable ? 'cursor-pointer select-none hover:bg-yellow-100' : ''}
                      ${expandedCols[p.label] ? 'bg-yellow-50' : ''}`}
                    title={p.expandable ? (expandedCols[p.label] ? 'Click to collapse' : 'Click to expand') : undefined}>
                    {p.label}
                    {p.expandable && (
                      <span className="ml-1 text-gray-400 text-xs">
                        {expandedCols[p.label] ? '⇤' : '⇥'}
                      </span>
                    )}
                  </th>
                ))}
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-300">Match</th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-300">Conf.</th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-300 bg-amber-50 text-amber-700">
                  Dept. Reconcile
                </th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-300">
                  Approval Status
                </th>
                {canApprove && (
                  <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                    Approved By
                  </th>
                )}
              </tr>
              {/* Row 2 — Customer / Finance sub-headers */}
              <tr className="bg-gray-50 border-b-2 border-gray-300">
                {COLUMN_PAIRS.map(p => (
                  <React.Fragment key={p.label}>
                    <th className="px-3 py-1 text-center text-xs font-medium text-purple-700 bg-purple-50 border-r border-gray-200 whitespace-nowrap">
                      Physical
                    </th>
                    <th className="px-3 py-1 text-center text-xs font-medium text-teal-700 bg-teal-50 border-r border-gray-300 whitespace-nowrap">
                      ERP
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {recordsLoading ? (
                <tr>
                  <td colSpan={3 + COLUMN_PAIRS.length * 2 + (canApprove ? 1 : 0)}
                    className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8E288D] mb-3" />
                      <p className="text-gray-500">Loading records…</p>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={3 + COLUMN_PAIRS.length * 2 + (canApprove ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400">
                    <FiAlertCircle className="mx-auto h-10 w-10 mb-2" />
                    <p>No records found for this filter</p>
                  </td>
                </tr>
              ) : records.map((rec, idx) => (
                <tr key={rec.id}
                  className={`hover:bg-yellow-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>

                  {/* Category badge */}
                  <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-gray-200">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      rec.category === 'Exact Match'        ? 'bg-purple-100 text-[#8E288D]'   :
                      rec.category === 'AI Match'           ? 'bg-purple-100 text-[#8E288D]' :
                      rec.category === 'Manual Review'      ? 'bg-yellow-100 text-[#CFB53B]' :
                      rec.category === 'Customer Unmatched' ? 'bg-red-100 text-red-700'       :
                      rec.category === 'Finance Unmatched'  ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {rec.category}
                    </span>
                  </td>

                  {/* Paired data columns */}
                  {COLUMN_PAIRS.map(p => {
                    const isExpanded = expandedCols[p.label]
                    const cellCls = isExpanded
                      ? 'px-3 py-2 text-xs text-gray-800 border-r border-gray-200 min-w-[200px] max-w-[400px] whitespace-normal break-words'
                      : 'px-3 py-2 text-xs text-gray-800 border-r border-gray-100 max-w-[140px] whitespace-nowrap overflow-hidden'
                    return (
                      <React.Fragment key={p.label}>
                        <td className={`${cellCls} bg-purple-50/30`}>
                          {isExpanded
                            ? <span>{rec[p.cKey]}</span>
                            : <div className="truncate" title={rec[p.cKey]}>{rec[p.cKey]}</div>
                          }
                        </td>
                        <td className={`${cellCls} bg-teal-50/30 border-r border-gray-200`}>
                          {isExpanded
                            ? <span>{rec[p.iKey]}</span>
                            : <div className="truncate" title={rec[p.iKey]}>{rec[p.iKey]}</div>
                          }
                        </td>
                      </React.Fragment>
                    )
                  })}

                  {/* Match method */}
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200">{rec.match_method}</td>
                  {/* Confidence */}
                  <td className="px-3 py-2 text-xs font-medium text-gray-800 whitespace-nowrap border-r border-gray-200">{rec.confidence}</td>

                  {/* Dept Reconcile */}
                  <td className="px-3 py-2 whitespace-nowrap border-r border-gray-200 bg-amber-50/40">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      rec.dept_reconcile === 'Same'                     ? 'bg-green-100 text-green-800'   :
                      rec.dept_reconcile === 'Same Dept, Diff District' ? 'bg-blue-100 text-blue-800'     :
                      rec.dept_reconcile === 'Diff Dept, Same District' ? 'bg-orange-100 text-orange-800' :
                      rec.dept_reconcile === 'Different'                ? 'bg-red-100 text-red-700'       :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {rec.dept_reconcile || 'N/A'}
                    </span>
                  </td>

                  {/* Approval status */}
                  <td className="px-3 py-2 whitespace-nowrap border-r border-gray-200">
                    {canApprove ? (
                      <StatusDropdown
                        recordId={rec.id}
                        current={rec.approval_status || 'pending'}
                        onSelect={handleRecordDecision}
                        loading={!!actionLoading[rec.id]}
                      />
                    ) : (
                      <StatusBadge status={rec.approval_status || 'pending'} />
                    )}
                    {rec.approved_at && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(rec.approved_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>

                  {/* Approved by */}
                  {canApprove && (
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {rec.approved_by || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 bg-white">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages} · {totalRecords} records
            </p>
            <div className="flex gap-1.5 items-center">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <FiChevronLeft />
              </button>
              {[...Array(totalPages)].map((_, i) => {
                const pn = i + 1
                if (pn === 1 || pn === totalPages || (pn >= page - 1 && pn <= page + 1)) {
                  return (
                    <button key={pn} onClick={() => setPage(pn)}
                      className={`px-3 py-1 rounded border text-sm font-medium ${
                        page === pn ? 'bg-[#8E288D] text-white border-[#8E288D]'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                      {pn}
                    </button>
                  )
                } else if (pn === page - 2 || pn === page + 2) {
                  return <span key={pn} className="px-1 text-gray-400">…</span>
                }
                return null
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        {CATEGORIES.filter(c => c.key !== 'all').map(cat => {
          const s = getSummary(cat.key)
          const done = cat.key === 'Duplicate'
            ? (s.duplicated || 0) + (s.unique || 0)
            : nonPendingCount(s)
          const p = s.total > 0 ? ((done / s.total) * 100).toFixed(0) : 0
          const barColor = cat.key === 'Duplicate' ? '#ec4899' : '#22c55e'
          const border = {
            'Exact Match':   'border-[#8E288D]',
            'AI Match':      'border-[#7A1E79]',
            'Manual Review': 'border-[#CFB53B]',
            'Unmatched':     'border-red-400',
            'Duplicate':     'border-pink-500',
          }
          return (
            <div key={cat.key} className={`bg-white rounded-lg shadow p-4 border-t-4 ${border[cat.key]}`}>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{cat.label}</h3>
              <div className="text-2xl font-bold text-gray-800 mb-1">{s.total}</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div className="h-1.5 rounded-full" style={{ width: `${p}%`, backgroundColor: barColor }} />
              </div>
              <div className="space-y-0.5 text-xs">
                {cat.key === 'Duplicate' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#CFB53B]">{s.pending} pending</span>
                      <span className="text-pink-600">{s.duplicated || 0} duplicated</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E288D]">{s.unique || 0} unique</span>
                    </div>
                  </>
                ) : cat.key === 'Unmatched' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#CFB53B]">{s.pending} pending</span>
                      <span className="text-[#8E288D]">{s.reconciled} reconciled</span>
                    </div>
                    <div className="flex justify-between text-gray-500 mt-1 border-t border-gray-100 pt-1">
                      <span>Physical: <strong className="text-[#CFB53B]">{customerUnmatched.total || 0}</strong></span>
                      <span>ERP: <strong className="text-[#8E288D]">{financeUnmatched.total || 0}</strong></span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#CFB53B]">{s.pending} pending</span>
                      <span className="text-[#8E288D]">{s.reconciled} reconciled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">{s.unreconciled} unreconciled</span>
                      <span className="text-orange-600">{s.surplus_assets} surplus</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ApprovalPage
