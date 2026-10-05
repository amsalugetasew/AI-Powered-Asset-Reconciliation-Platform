import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import AIAnalysisModal from '../components/AIAnalysisModal'
import AIContextMenu from '../components/AIContextMenu'
import {
  FiArrowLeft, FiCheckCircle, FiXCircle, FiClock,
  FiChevronLeft, FiChevronRight, FiAlertCircle, FiFilter, FiChevronDown
} from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { clearCachedGets } from '../services/cachedGet'

// ── Status definitions ────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'pending', label: 'Pending', color: '#CFCFCF' },
  { value: 'reconciled', label: 'Reconciled', color: '#95298E' },
  { value: 'unreconciled', label: 'Unreconciled', color: '#FF7373' },
  { value: 'surplus_assets', label: 'Surplus Assets', color: '#558AFF' },
  { value: 'exist_in_erp_not_physical', label: 'Shortage Assets', color: '#F6DB6F' },
  { value: 'duplicated', label: 'Duplicated', color: '#FF8342' },
  { value: 'unique', label: 'Unique', color: '#95298E' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

const statusBadgeCls = {
  pending: 'bg-[#CFCFCF10] text-[#CFCFCF]',
  reconciled: 'bg-[#95298E10] text-[#95298E]',
  unreconciled: 'bg-[#FF737310] text-[#FF7373]',
  surplus_assets: 'bg-[#558AFF10] text-[#558AFF]',
  exist_in_erp_not_physical: 'bg-[#F6DB6F10] text-[#F6DB6F]',
  duplicated: 'bg-[#FF834210] text-[#FF8342]',
  unique: 'bg-[#95298E10] text-[#95298E]',
}

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'Exact Match', label: 'Exact Match' },
  { key: 'AI Match', label: 'AI Match' },
  { key: 'Manual Review', label: 'Manual Review' },
  { key: 'Unmatched', label: 'Unmatched' },
  { key: 'Duplicate', label: 'Duplicate' },
]

const getPaginationItems = (totalPages, currentPage) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
  if (currentPage >= totalPages - 2) return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
}

// Bulk action options per category type
const BULK_OPTIONS_MATCHED = [
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'unreconciled', label: 'Unreconciled' },
]
const BULK_OPTIONS_UNMATCHED = [
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'unreconciled', label: 'Unreconciled' },
]
const BULK_OPTIONS_PHYSICAL_UNMATCHED = [
  { value: 'surplus_assets', label: 'Surplus Assets' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'unreconciled', label: 'Unreconciled' },
]
const BULK_OPTIONS_ERP_UNMATCHED = [
  { value: 'exist_in_erp_not_physical', label: 'Shortage Assets' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'unreconciled', label: 'Unreconciled' },
]
const BULK_OPTIONS_DUPLICATE = [
  { value: 'duplicated', label: 'Duplicated' },
  { value: 'unique', label: 'Unique' },
]

// ── Paired column definitions ─────────────────────────────────────────────────
const COLUMN_PAIRS = [
  { label: 'Old Tag', cKey: 'customer_old_tag', iKey: 'internal_old_tag', expandable: false },
  { label: 'New Tag', cKey: 'customer_new_tag', iKey: 'internal_new_tag', expandable: false },
  { label: 'Year', cKey: 'customer_year', iKey: 'internal_year', expandable: false },
  { label: 'Category', cKey: 'customer_category', iKey: 'internal_category', expandable: true },
  { label: 'Description', cKey: 'customer_description', iKey: 'internal_description', expandable: true },
  { label: 'Department', cKey: 'customer_department', iKey: 'internal_department', expandable: true },
  { label: 'District', cKey: 'customer_district', iKey: 'internal_district', expandable: true },
  { label: 'Book Value', cKey: 'customer_book_value', iKey: 'internal_book_value', expandable: false },
  { label: 'Asset No.', cKey: 'customer_asset_no', iKey: 'internal_asset_no', expandable: false },
  { label: 'Serial No.', cKey: 'customer_serial', iKey: 'internal_serial', expandable: false },
]

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  const cls = statusBadgeCls[status] || statusBadgeCls.pending
  const Icon = status === 'reconciled' ? FiCheckCircle
    : status === 'pending' ? FiClock
      : FiXCircle
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />{s.label}
    </span>
  )
}

const getAllowedStatusValues = category => {
  if (category === 'Physical Unmatched') {
    return new Set(['pending', 'surplus_assets', 'reconciled', 'unreconciled'])
  }
  if (category === 'ERP Unmatched') {
    return new Set(['pending', 'exist_in_erp_not_physical', 'reconciled', 'unreconciled'])
  }
  if (category === 'Duplicate') {
    return new Set(['pending', 'duplicated', 'unique'])
  }
  return new Set(['pending', 'reconciled', 'unreconciled'])
}

const effectiveStatus = (preferredStatus, fallbackStatus) => {
  const pendingStatuses = new Set(['pending', 'checking'])
  if (pendingStatuses.has(preferredStatus) && fallbackStatus && !pendingStatuses.has(fallbackStatus)) {
    return fallbackStatus
  }
  return preferredStatus || fallbackStatus || 'pending'
}

// ── Per-record status dropdown ────────────────────────────────────────────────
const StatusDropdown = ({ recordId, category, current, onSelect, loading }) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const currentStatus = STATUS_MAP[current] || STATUS_MAP.pending
  const cls = statusBadgeCls[current] || statusBadgeCls.pending
  const allowedStatuses = getAllowedStatusValues(category)

  // Close on outside click without blocking the underlying click target
  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  if (loading) return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8E288D]" />

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer hover:opacity-80 ${cls}`}
      >
        {currentStatus.label}
        <FiChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[220px]">
          {STATUSES.map(s => (
            <button
              key={s.value}
              disabled={!allowedStatuses.has(s.value) || s.value === current}
              onClick={() => { setOpen(false); onSelect(recordId, s.value) }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                !allowedStatuses.has(s.value) || s.value === current
                  ? 'cursor-not-allowed text-gray-300'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[s.value].split(' ')[0]} ${!allowedStatuses.has(s.value) || s.value === current ? 'opacity-40' : ''}`} />
              {s.label}
              {s.value === current && ' (current)'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bulk action dropdown ──────────────────────────────────────────────────────
const BulkDropdown = ({ category, onSelect, loading, approvalSummary, records = [], selectedRecords = [], stage = 'check', className = '', actionLabel = 'Bulk Approve' }) => {
  const [open, setOpen] = useState(false)
  const [subCat, setSubCat] = useState(null) // for Unmatched sub-category step
  const selectionMode = selectedRecords.length > 0
  const isDuplicate = category === 'Duplicate'
  const isUnmatched = category === 'Unmatched'

  const UNMATCHED_SUBCATS = [
    { value: 'Physical Unmatched', label: 'Pysical Unmatched' },
    { value: 'ERP Unmatched', label: 'ERP Unmatched' },
  ]

  const optionsForSubCat = subCat === 'Physical Unmatched'
    ? BULK_OPTIONS_PHYSICAL_UNMATCHED
    : subCat === 'ERP Unmatched'
      ? BULK_OPTIONS_ERP_UNMATCHED
      : BULK_OPTIONS_UNMATCHED
  const getAllowedBulkValues = targetCategory => {
    if (targetCategory === 'Physical Unmatched') return new Set(['surplus_assets', 'reconciled', 'unreconciled'])
    if (targetCategory === 'ERP Unmatched') return new Set(['exist_in_erp_not_physical', 'reconciled', 'unreconciled'])
    if (targetCategory === 'Duplicate') return new Set(['duplicated', 'unique'])
    return new Set(['reconciled', 'unreconciled'])
  }
  const selectedAllowedValues = selectionMode
    ? STATUSES.filter(status => selectedRecords.every(record => getAllowedBulkValues(record.category).has(status.value)))
    : []
  const optionsForCat = selectionMode ? selectedAllowedValues
    : isDuplicate ? BULK_OPTIONS_DUPLICATE
      : isUnmatched ? optionsForSubCat
        : BULK_OPTIONS_MATCHED

  const getStatusValue = (record) => {
    if (stage === 'approve') {
      return effectiveStatus(record?.approver_status, record?.approval_status)
    }
    return effectiveStatus(record?.checker_status, record?.check_status)
  }

  const getTargetSummary = targetCategory => {
    if (selectionMode) {
      return selectedRecords.reduce((result, record) => {
        const value = getStatusValue(record)
        result.total += 1
        if (value === 'pending' || value === 'checking' || !value) result.pending += 1
        else result[value] = (result[value] || 0) + 1
        return result
      }, { total: 0, pending: 0 })
    }

    const stageCounts = approvalSummary[targetCategory]?.stage_counts?.[stage]
    if (stageCounts && Object.keys(stageCounts).length) {
      return {
        ...stageCounts,
        total: Object.values(stageCounts).reduce((sum, count) => sum + Number(count || 0), 0),
        pending: Number(stageCounts.pending || 0) + Number(stageCounts.checking || 0),
      }
    }

    if (targetCategory === 'Unmatched') {
      const keys = ['Physical Unmatched', 'ERP Unmatched']
      const summary = { total: 0, pending: 0, reconciled: 0, unreconciled: 0, surplus_assets: 0, exist_in_erp_not_physical: 0, duplicated: 0, unique: 0 }
      keys.forEach(key => {
        const categoryRecords = Array.isArray(records) ? records.filter(record => record.category === key) : []
        categoryRecords.forEach(record => {
          const value = getStatusValue(record)
          summary.total += 1
          if (value === 'pending' || value === 'checking' || !value) summary.pending += 1
          else if (value in summary) summary[value] = (summary[value] || 0) + 1
        })
      })
      return summary
    }

    const categoryRecords = Array.isArray(records) ? records.filter(record => record.category === targetCategory) : []
    return categoryRecords.reduce((result, record) => {
      const value = getStatusValue(record)
      result.total = (result.total || 0) + 1
      if (value === 'pending' || value === 'checking' || !value) {
        result.pending = (result.pending || 0) + 1
      } else {
        result[value] = (result[value] || 0) + 1
      }
      return result
    }, { total: 0, pending: 0, reconciled: 0, unreconciled: 0, surplus_assets: 0, exist_in_erp_not_physical: 0, duplicated: 0, unique: 0 })
  }

  const isOptionDisabled = (targetCategory, option) => {
    const targetSummary = getTargetSummary(targetCategory)
    const allowed = selectionMode
      ? new Set(selectedAllowedValues.map(status => status.value))
      : getAllowedBulkValues(targetCategory)
    if (!allowed.has(option.value)) return true
    if (!targetSummary.total) return true

    const selectedCount = Number(targetSummary[option.value] || 0)
    const pendingCount = Number(targetSummary.pending || 0)

    const expectedValueForCategory = targetCategory === 'Physical Unmatched'
      ? 'surplus_assets'
      : targetCategory === 'ERP Unmatched'
        ? 'exist_in_erp_not_physical'
        : null

    if (expectedValueForCategory && option.value === expectedValueForCategory) {
      return pendingCount === 0
    }

    if (pendingCount > 0) return false
    return selectedCount >= targetSummary.total
  }

  const isBulkLoading = loading && Object.keys(loading).some(k => {
    if (!loading[k]) return false
    if (selectionMode) return k.startsWith('Selected')
    if (category === 'Unmatched') return k.startsWith('Unmatched') || k.startsWith('Physical Unmatched') || k.startsWith('ERP Unmatched')
    return k.startsWith(category)
  })
  const categorySummary = selectionMode
    ? { total: selectedRecords.length }
    : category === 'Unmatched'
    ? getTargetSummary('Unmatched')
    : approvalSummary[category] || {}
  const noRecords = !categorySummary.total

  const handleClose = () => { setOpen(false); setSubCat(null) }

  const handleSelect = (targetCat, decision) => {
    handleClose()
    onSelect(targetCat, decision)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSubCat(null) }}
        disabled={!!isBulkLoading || noRecords}
        className={`inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-white bg-[#8E288D] hover:bg-[#7A1E79] disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
      >
        {isBulkLoading ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : null}
        {actionLabel} <FiChevronDown className="w-3 h-3" />
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
                  <button type="button" key={sc.value}
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
                  <button type="button" onClick={() => setSubCat(null)}
                    className="text-[#8E288D] hover:underline flex items-center gap-1">
                    <FiChevronDown className="w-3 h-3 rotate-90" /> Back
                  </button>
                  <span className="truncate">{UNMATCHED_SUBCATS.find(s => s.value === subCat)?.label}</span>
                </div>
                {optionsForCat.map(opt => (
                  <button type="button" key={opt.value}
                    disabled={isOptionDisabled(subCat, opt)}
                    onClick={() => handleSelect(subCat, opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${isOptionDisabled(subCat, opt)
                      ? 'cursor-not-allowed text-gray-300'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[opt.value]?.split(' ')[0] || 'bg-gray-300'} ${isOptionDisabled(subCat, opt) ? 'opacity-40' : ''}`} />
                    {opt.label}
                  </button>
                ))}
              </>
            )}

            {/* Non-unmatched categories: direct status pick */}
            {!isUnmatched && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  {selectionMode ? 'Mark selected as…' : 'Mark all as…'}
                </div>
                {selectionMode && optionsForCat.length === 0 ? (
                  <p className="max-w-60 px-3 py-2 text-xs text-gray-500">
                    Select rows from compatible categories to apply one status to all.
                  </p>
                ) : optionsForCat.map(opt => (
                  <button type="button" key={opt.value}
                    disabled={isOptionDisabled(category, opt)}
                    onClick={() => handleSelect(category, opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${isOptionDisabled(category, opt)
                      ? 'cursor-not-allowed text-gray-300'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeCls[opt.value]?.split(' ')[0] || 'bg-gray-300'} ${isOptionDisabled(category, opt) ? 'opacity-40' : ''}`} />
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
  const { hasRole, user } = useAuth()
  const [reconciliation, setReconciliation] = useState(null)

  const [records, setRecords] = useState([])
  const [allCategoryRecords, setAllCategoryRecords] = useState([])
  const [selectedRecordMap, setSelectedRecordMap] = useState(() => new Map())
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [expandedCols, setExpandedCols] = useState({}) // { [colLabel]: true }
  const [tableCollapsed, setTableCollapsed] = useState(false)

  const isPrivilegedReviewer = hasRole('manager') || hasRole('admin')
  const canCheck = user?.role === 'officer' && reconciliation && Number(user.id) !== Number(reconciliation.user_id) && (
    Number(reconciliation.assigned_to) === Number(user.id) ||
    reconciliation.assignment_scope === 'all_officers'
  )
  const canApprove = isPrivilegedReviewer
  const canReview = isPrivilegedReviewer || canCheck

  const getCategoryValues = (categoryKey) => {
    if (!categoryKey || categoryKey === 'all') return new Set(['Exact Match', 'AI Match', 'Manual Review', 'Physical Unmatched', 'ERP Unmatched', 'Duplicate'])
    if (categoryKey === 'Unmatched') return new Set(['Physical Unmatched', 'ERP Unmatched'])
    return new Set([categoryKey])
  }

  const getRecordsForCategory = (categoryKey) => {
    const sourceRecords = allCategoryRecords.length > 0 ? allCategoryRecords : records
    if (!categoryKey || categoryKey === 'all') return sourceRecords
    const allowed = getCategoryValues(categoryKey)
    return sourceRecords.filter(item => allowed.has(item.category))
  }

  const categoryRecords = getRecordsForCategory(selectedCategory)
  const selectedRecords = Array.from(selectedRecordMap.values())
  const visibleRowsSelected = records.length > 0 && records.every(record => selectedRecordMap.has(record.id))
  const isRecordChecked = (record) => {
    const value = effectiveStatus(record?.checker_status, record?.check_status)
    return value !== 'pending' && value !== 'checking' && value !== '' && value !== null
  }

  const getSummary = (cat) => {
    const empty = {
      total: 0, pending: 0, reconciled: 0, unreconciled: 0,
      surplus_assets: 0, exist_in_erp_not_physical: 0,
      duplicated: 0, unique: 0
    }
    if (cat === 'all') {
      const SKIP_KEYS = new Set(['Physical Unmatched', 'ERP Unmatched', 'Duplicate'])
      return Object.entries(summary)
        .filter(([k]) => !SKIP_KEYS.has(k))
        .reduce((a, [, s]) => {
          Object.keys(empty).forEach(k => { a[k] = (a[k] || 0) + (s[k] || 0) })
          return a
        }, { ...empty })
    }
    if (cat === 'Unmatched') {
      return ['Physical Unmatched', 'ERP Unmatched'].reduce((a, k) => {
        const s = summary[k] || {}
        Object.keys(empty).forEach(f => { a[f] = (a[f] || 0) + (s[f] || 0) })
        return a
      }, { ...empty })
    }
    return { ...empty, ...(summary[cat] || {}) }
  }

  const getStageSummary = (categoryKey, stage) => {
    const categoryKeys = categoryKey === 'all'
      ? Object.keys(summary).filter(key => !['Physical Unmatched', 'ERP Unmatched', 'Unmatched', 'Duplicate'].includes(key))
          .concat(['Physical Unmatched', 'ERP Unmatched'])
      : categoryKey === 'Unmatched'
        ? ['Physical Unmatched', 'ERP Unmatched']
        : [categoryKey]
    const counts = {}
    categoryKeys.forEach(key => {
      const stageCounts = summary[key]?.stage_counts?.[stage] || {}
      Object.entries(stageCounts).forEach(([status, count]) => {
        counts[status] = (counts[status] || 0) + Number(count || 0)
      })
    })
    let total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    const stageRecords = getRecordsForCategory(categoryKey).filter(record => (
      categoryKey !== 'all' || record.category !== 'Duplicate'
    ))
    if (total === 0 || (stageRecords.length > 0 && stageRecords.length === total)) {
      Object.keys(counts).forEach(status => { counts[status] = 0 })
      stageRecords.forEach(record => {
        const preferredStatus = stage === 'check'
          ? record.checker_status
          : record.approver_status
        const fallbackStatus = stage === 'check'
          ? record.check_status
          : record.approval_status
        const preferredIsPending = !preferredStatus || ['pending', 'checking'].includes(preferredStatus)
        const fallbackIsDone = fallbackStatus && !['pending', 'checking'].includes(fallbackStatus)
        const status = preferredIsPending && fallbackIsDone
          ? fallbackStatus
          : preferredStatus || fallbackStatus || 'pending'
        counts[status] = (counts[status] || 0) + 1
      })
      total = stageRecords.length
    }
    const pending = Number(counts.pending || 0) + Number(counts.checking || 0)
    return { total, pending, checked: Math.max(total - pending, 0) }
  }

  const isCategoryFullyChecked = (categoryKey) => {
    if (!categoryKey || categoryKey === 'all') return false
    const checkCounts = summary[categoryKey]?.stage_counts?.check
    if (checkCounts && Object.keys(checkCounts).length) {
      const total = Object.values(checkCounts).reduce((sum, count) => sum + Number(count || 0), 0)
      const pending = Number(checkCounts.pending || 0) + Number(checkCounts.checking || 0)
      return total > 0 && pending === 0
    }
    const catRecords = getRecordsForCategory(categoryKey)
    return catRecords.length > 0 && catRecords.every(isRecordChecked)
  }

  const allCategoryChecked = isCategoryFullyChecked(selectedCategory)
  const bulkActionLabel = canReview && allCategoryChecked && isPrivilegedReviewer ? 'Bulk Approve' : 'Bulk Check'
  const showBulkAction = canReview && selectedCategory !== 'all' && getRecordsForCategory(selectedCategory).length > 0
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({}) // { [recordId]: true }
  const [bulkLoading, setBulkLoading] = useState({}) // { [category-decision]: true }
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAIContextMenu, setShowAIContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [aiModalConfig, setAiModalConfig] = useState({
    chartData: null,
    chartType: 'table',
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

  const approvalTableRef = useRef(null)
  const approvalDragState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })
  const PER_PAGE = 10

  const handleApprovalTableMouseDown = event => {
    if (event.button !== 0 || !approvalTableRef.current || event.target.closest('button, a, input, select, th')) return
    approvalDragState.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: approvalTableRef.current.scrollLeft,
      scrollTop: approvalTableRef.current.scrollTop,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.classList.add('cursor-grabbing')
  }

  const handleApprovalTableMouseMove = event => {
    if (!approvalDragState.current.active || !approvalTableRef.current) return
    event.preventDefault()
    approvalTableRef.current.scrollLeft = approvalDragState.current.scrollLeft - (event.clientX - approvalDragState.current.startX)
    approvalTableRef.current.scrollTop = approvalDragState.current.scrollTop - (event.clientY - approvalDragState.current.startY)
  }

  const stopApprovalTableDragging = event => {
    approvalDragState.current.active = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    event.currentTarget.classList.remove('cursor-grabbing')
  }

  const toggleCol = (label) =>
    setExpandedCols(prev => ({ ...prev, [label]: !prev[label] }))

  // ── fetch header ───────────────────────────────────────────────────────────
  useEffect(() => {
    logActivity(`/approval/${id}`, `PAGE_VISIT_APPROVAL_${id}`)
    axios.get(`/api/reconciliation/${id}`)
      .then(r => setReconciliation(r.data.reconciliation))
      .catch((error) => {
        if (error.response?.status === 403) {
          toast.error('This record is not assigned to you for review.')
          navigate('/')
          return
        }
        toast.error('Failed to load reconciliation')
        navigate('/')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  // ── fetch summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const r = await axios.get(`/api/reconciliation/records/approval-summary/${id}`)
      setSummary(r.data.summary || {})
    } catch { }
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

      const fullParams = {
        page: 1,
        per_page: 10000,
        category: selectedCategory === 'all' ? 'all' : selectedCategory,
        ...(statusFilter !== 'all' && { approval_status: statusFilter }),
      }
      const fullResponse = await axios.get(`/api/reconciliation/records/${id}`, { params: fullParams })
      setAllCategoryRecords(fullResponse.data.records || [])
    } catch { toast.error('Failed to load records') }
    finally { setRecordsLoading(false) }
  }, [id, page, selectedCategory, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── per-record decision ────────────────────────────────────────────────────
  const handleRecordDecision = async (recordId, decision) => {
    try {
      setActionLoading(p => ({ ...p, [recordId]: true }))
      const record = records.find(item => item.id === recordId)
      const isPrivilegedReviewer = hasRole('manager') || hasRole('admin')
      const recordChecked = isRecordChecked(record)
      if (isPrivilegedReviewer && !recordChecked) {
        toast.error('This record must be checked before approval can be completed.')
        return
      }
      const decisionStage = isPrivilegedReviewer && recordChecked ? 'approve' : 'check'

      await axios.post('/api/reconciliation/records/approve-record', {
        record_id: recordId,
        approval_decision: decision,
        decision_stage: decisionStage,
      })
      clearCachedGets()
      setSelectedRecordMap(current => {
        const next = new Map(current)
        next.delete(recordId)
        return next
      })
      logActivity(`/approval/${id}`, `APPROVE_RECORD_${recordId}_AS_${decision.toUpperCase()}_${decisionStage.toUpperCase()}`)
      toast.success(`Marked as "${STATUS_MAP[decision]?.label || decision}" (${decisionStage})`)
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
      const isPrivilegedReviewer = hasRole('manager') || hasRole('admin')
      const usingSelection = selectedRecords.length > 0
      const allRecordsForCategory = usingSelection ? selectedRecords : getRecordsForCategory(category)
      // For selection mode: check local records (exact set is known).
      // For category-wide mode: prefer server-side stage_counts (accurate for 66K+ records),
      // fall back to local records only when summary is unavailable.
      let allChecked
      if (usingSelection) {
        allChecked = allRecordsForCategory.length > 0 && allRecordsForCategory.every(isRecordChecked)
      } else {
        const checkCounts = summary[category]?.stage_counts?.check
        if (checkCounts && Object.keys(checkCounts).length) {
          const total = Object.values(checkCounts).reduce((s, c) => s + Number(c || 0), 0)
          const pending = Number(checkCounts.pending || 0) + Number(checkCounts.checking || 0)
          allChecked = total > 0 && pending === 0
        } else {
          allChecked = allRecordsForCategory.length > 0 && allRecordsForCategory.every(isRecordChecked)
        }
      }
      if (isPrivilegedReviewer && !allChecked) {
        toast.error('All records in this category must be checked before bulk approval can be done.')
        return
      }
      const decisionStage = isPrivilegedReviewer && allChecked ? 'approve' : 'check'

      await axios.post('/api/reconciliation/records/approve-group', {
        reconciliation_id: parseInt(id),
        category,
        approval_decision: decision,
        decision_stage: decisionStage,
        ...(usingSelection ? { record_ids: allRecordsForCategory.map(record => record.id) } : {}),
      })
      clearCachedGets()
      logActivity(`/approval/${id}`, `BULK_${decisionStage.toUpperCase()}_${category.toUpperCase()}_AS_${decision.toUpperCase()}`)
      toast.success(usingSelection
        ? `${allRecordsForCategory.length} selected records → "${STATUS_MAP[decision]?.label || decision}" (${decisionStage})`
        : `All "${category}" → "${STATUS_MAP[decision]?.label || decision}" (${decisionStage})`)
      if (usingSelection) setSelectedRecordMap(new Map())
      await fetchRecords()
      await fetchSummary()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bulk action failed')
    } finally {
      setBulkLoading(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  // Customer / Finance unmatched split for display
  const customerUnmatched = summary['Physical Unmatched'] || {}
  const financeUnmatched = summary['ERP Unmatched'] || {}

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
    const active = {
      all: 'bg-[#8E288D] text-white', 'Exact Match': 'bg-[#8E288D] text-white',
      'AI Match': 'bg-[#8E288D] text-white', 'Manual Review': 'bg-[#8E288D] text-white',
      'Unmatched': 'bg-[#8E288D] text-white', 'Duplicate': 'bg-[#8E288D] text-white'
    }
    const inactive = {
      all: 'bg-purple-100 text-gray-700 hover:bg-gray-200',
      'Exact Match': 'bg-purple-50 text-[#8E288D] hover:text-[#8E288D] hover:bg-purple-100',
      'AI Match': 'bg-purple-50 text-[#8E288D] hover:bg-purple-100',
      'Manual Review': 'bg-purple-50 text-[#8E288D] hover:bg-purple-100',
      'Unmatched': 'bg-purple-50 text-[#8E288D] hover:bg-purple-100',
      'Duplicate': 'bg-purple-50 text-[#8E288D] hover:bg-purple-100'
    }
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
  const isCheckerView = canCheck && !canApprove
  const checkerProgress = getStageSummary('all', 'check')
  const progressTotal = isCheckerView ? checkerProgress.total : overall.total
  const progressPending = isCheckerView ? checkerProgress.pending : overall.pending
  const progressDone = isCheckerView ? checkerProgress.checked : nonPendingCount(overall)
  const progressPct = progressTotal > 0 ? ((progressDone / progressTotal) * 100).toFixed(0) : 0
  const matchedCheckerProgress = ['Exact Match', 'AI Match', 'Manual Review'].reduce((checked, category) => {
    const progress = getStageSummary(category, 'check')
    return checked + progress.checked
  }, 0)
  const physicalCheckerProgress = matchedCheckerProgress + getStageSummary('Physical Unmatched', 'check').checked
  const erpCheckerProgress = matchedCheckerProgress + getStageSummary('ERP Unmatched', 'check').checked

  return (
    <div className="min-w-0 bg-[#f7f9fc] px-4 pb-12 sm:px-6 lg:px-8">
      {/* Back */}
      <div className="mb-0">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <FiArrowLeft className="mr-2" /> Back
        </button>
      </div>

      {/* Title + progress */}
      <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            {canReview ? (user?.role === 'officer' ? 'Assigned Review' : 'Approval Review') : 'Approval Status'} — Reconciliation #{id}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {canReview
              ? (user?.role === 'officer'
                ? 'You are allowed to check this delegated reconciliation update.'
                : 'Managers and admins can approve only after the checker stage has been completed.')
              : 'View approval status for this reconciliation'}
          </p>
        </div>
        <div className="min-w-[300px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Checker progress and approver progress use their own workflow stage. */}
          <p className="text-xs text-gray-500 mb-1 font-medium">
            {isCheckerView ? 'Checking Progress (excluding Duplicates)' : 'Approval Progress (excluding Duplicates)'}
          </p>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700">{progressPct}% {isCheckerView ? 'checked' : 'reviewed'}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            {progressDone} of {progressTotal} records {isCheckerView ? 'checked' : 'reviewed'}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
            {isCheckerView ? (
              <>
                <span className="text-[#CFB53B] font-medium">⏳ {progressPending} pending</span>
                <span className="text-[#8E288D] font-medium">✓ {checkerProgress.checked} checked</span>
              </>
            ) : (
              <>
                <span className="text-[#CFB53B] font-medium">⏳ {overall.pending} pending</span>
                <span className="text-[#95298E] font-medium">✓ {overall.reconciled} reconciled</span>
                <span className="text-[#FF7373] font-medium">✗ {overall.unreconciled} unreconciled</span>
                <span className="text-[#558AFF] font-medium">◈ {overall.surplus_assets} surplus</span>
              </>
            )}
          </div>
          {/* Per-side reconciliation rates based on APPROVAL decisions */}
          {reconciliation && (() => {
            const stats = reconciliation.statistics
            const custTotal = stats.total_customer_records || 1
            const finTotal = stats.total_internal_records || 1
            const custUnmatch = stats.customer_unmatched || 0
            const finUnmatch = stats.internal_unmatched || 0
            const physicalUniqueTotal = Math.max(custTotal - Number(stats.customer_duplicates || 0), 0)
            const erpUniqueTotal = Math.max(finTotal - Number(stats.internal_duplicates || 0), 0)
            // Reconciliation rate = approved-reconciled / total (from approval decisions)
            const custRecRate = isCheckerView
              ? (physicalUniqueTotal > 0 ? (physicalCheckerProgress / physicalUniqueTotal) * 100 : 0).toFixed(1)
              : ((overall.reconciled / custTotal) * 100).toFixed(1)
            const finRecRate = isCheckerView
              ? (erpUniqueTotal > 0 ? (erpCheckerProgress / erpUniqueTotal) * 100 : 0).toFixed(1)
              : ((overall.reconciled / finTotal) * 100).toFixed(1)
            return (
              <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-purple-50 dark:bg-gray-800 rounded p-2">
                  <p className="text-gray-700 font-bold text-center">Physical</p>
                  <p className="text-xl font-bold text-gray-700 text-center">{custRecRate}%</p>
                  <p className="text-gray-600 font-bold text-center">{isCheckerView ? 'Checked' : 'Reconciled'}</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-medium">{custTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Unmatched</span>
                      <span className="font-bold text-gray-700">{custUnmatch.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Duplicates</span>
                      <span className="font-bold text-gray-700">{(stats.customer_duplicates || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-teal-50 dark:bg-gray-800 rounded p-2">
                  <p className="text-gray-700 font-bold text-center">ERP</p>
                  <p className="text-xl font-bold text-gray-700 text-center">{finRecRate}%</p>
                  <p className="text-gray-600 font-bold text-center">{isCheckerView ? 'Checked' : 'Reconciled'}</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-medium">{finTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Unmatched</span>
                      <span className="font-bold text-gray-700">{finUnmatch.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Duplicates</span>
                      <span className="font-bold text-gray-700">{(stats.internal_duplicates || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Filter + bulk row (outside table card) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <FiFilter className="text-gray-400 flex-shrink-0" />
          {['all', ...STATUSES.map(s => s.value)].map(sf => (
            <button key={sf}
              onClick={() => { setStatusFilter(sf); setPage(1); setSelectedRecordMap(new Map()) }}
              className={`flex h-10 w-36 items-center justify-center px-4 text-sm font-medium transition-colors ${statusFilter === sf
                  ? 'text-[#8E288D] shadow border-b-2 border-[#8E288D]'
                  : 'text-gray-600'
                }`}>
              {sf === 'all' ? 'All' : (STATUS_MAP[sf]?.label || sf)}
            </button>
          ))}
        </div>

        {/* Selected rows take precedence; category-wide bulk remains available with no selection. */}
        {canReview && (selectedRecords.length > 0 || showBulkAction) && (
          <BulkDropdown
            category={selectedRecords.length > 0 ? 'Selected' : selectedCategory}
            onSelect={handleBulkDecision}
            loading={bulkLoading}
            approvalSummary={summary}
            records={getRecordsForCategory(selectedCategory)}
            selectedRecords={selectedRecords}
            stage={isPrivilegedReviewer && (selectedRecords.length > 0
              ? selectedRecords.every(isRecordChecked)
              : allCategoryChecked) ? 'approve' : 'check'}
            className="h-10 w-44"
            actionLabel={selectedRecords.length > 0
              ? `${isPrivilegedReviewer && selectedRecords.every(isRecordChecked) ? 'Bulk Approve' : 'Bulk Check'} Selected (${selectedRecords.length})`
              : bulkActionLabel}
          />
        )}
        {selectedRecords.length > 0 && (
          <button type="button" onClick={() => setSelectedRecordMap(new Map())}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800">
            Clear selection
          </button>
        )}
      </div>

      {/* Reconciliation Records Table */}
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm cursor-context-menu" title="Right-click for AI insights"
        onContextMenu={e => openAIContextMenu(e, {
          chartData: {
            source: 'approval_records_table',
            reconciliationId: parseInt(id),
            category: selectedCategory,
            statusFilter,
            recordPreview: records.slice(0, 10)
          },
          chartType: 'table',
          title: 'AI Analysis - Approval Records',
          targetLabel: 'Approval Records Table',
          analysisContext: { page: 'Approval', section: 'Approval Records Table' }
        })}>
        {/* Dark navy header bar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-800">Reconciliation Records - {totalRecords} records</h2>
            <p className="mt-0.5 text-xs text-slate-400">Review and update approval status for reconciled asset records</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{totalRecords} records</span>
            <button
              onClick={() => setTableCollapsed(c => !c)}
              className="text-[#8E288D] opacity-70 hover:opacity-100 font-bold text-lg leading-none px-1"
              title={tableCollapsed ? 'Expand' : 'Collapse'}>
              {tableCollapsed ? '+' : '−'}
            </button>
          </div>
        </div>

        {/* Category tab pills */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3">
          {CATEGORIES.map(cat => {
            const s = getSummary(cat.key)
            const stageSummary = isCheckerView ? getStageSummary(cat.key, 'check') : null
            const pendingCount = isCheckerView ? stageSummary.pending : s.pending
            const doneCount = isCheckerView ? stageSummary.checked : nonPendingCount(s)
            const isActive = selectedCategory === cat.key
            const activeCls = {
              all:            'bg-[#8E288D] text-white border-[#8E288D]',
              'Exact Match':  'bg-[#8E288D] text-white border-[#8E288D]',
              'AI Match':     'bg-[#8E288D] text-white border-[#8E288D]',
              'Manual Review':'bg-[#8E288D] text-white border-[#8E288D]',
              'Unmatched':    'bg-[#8E288D] text-white border-[#8E288D]',
              'Duplicate':    'bg-[#8E288D] text-white border-[#8E288D]',
            }
            const inactiveCls = {
              all:            'bg-white text-gray-600 border-gray-300 hover:opacity-80',
              'Exact Match':  'bg-white text-gray-600 border-gray-300 hover:opacity-80',
              'AI Match':     'bg-white text-gray-600 border-gray-300 hover:opacity-80',
              'Manual Review':'bg-white text-gray-600 border-gray-300 hover:opacity-80',
              'Unmatched':    'bg-white text-gray-600 border-gray-300 hover:opacity-80',
              'Duplicate':    'bg-white text-gray-600 border-gray-300 hover:opacity-80',
            }
            return (
              <button key={cat.key}
                onClick={() => { setSelectedCategory(cat.key); setPage(1); setSelectedRecordMap(new Map()) }}
                className={`rounded-lg h-10 w-48 border px-4 py-1.5 text-xs font-semibold transition-colors ${isActive ? activeCls[cat.key] : inactiveCls[cat.key]}`}>
                {cat.label}
                {cat.key !== 'all' && (
                  <span className="ml-1 opacity-80">
                    ({pendingCount}p · {doneCount}{isCheckerView ? 'c' : 'd'})
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Table — collapsible */}
        {!tableCollapsed && (
        <>
        <div
          ref={approvalTableRef}
          className="h-[420px] cursor-grab select-none overflow-auto overscroll-contain"
          onPointerDown={handleApprovalTableMouseDown}
          onPointerMove={handleApprovalTableMouseMove}
          onPointerUp={stopApprovalTableDragging}
          onPointerCancel={stopApprovalTableDragging}
        >
          <table className="reconciliation-table min-w-[2100px] text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              {/* Row 1 — dark navy group headers */}
              <tr style={{ background: "#e7e7e7"}}>
                <th rowSpan={2} className="sticky left-0 z-30 w-10 bg-[#cfcdcd] px-1 py-3 text-center"
                  style={{ width: '40px', minWidth: '40px', maxWidth: '40px', left: 0, zIndex: 31 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible records"
                    checked={visibleRowsSelected}
                    disabled={!canReview || records.length === 0 || recordsLoading}
                    onChange={event => setSelectedRecordMap(current => {
                      const next = new Map(current)
                      records.forEach(record => {
                        if (event.target.checked) next.set(record.id, record)
                        else next.delete(record.id)
                      })
                      return next
                    })}
                  />
                </th>
                <th rowSpan={2} className="sticky left-10 z-20 bg-[#cfcdcd] px-4 py-3 text-left text-xs font-bold text-white uppercase whitespace-nowrap"
                  style={{color:'#1a3a5c', background: "#cfcdcd", letterSpacing: '0.07em', 
                  borderRight: '1px solid rgba(255,255,255,0.2)', left: '40px', zIndex: 30 }}>
                  Category
                </th>
                {COLUMN_PAIRS.map(p => (
                  <th key={p.label} colSpan={2}
                    onClick={p.expandable ? () => toggleCol(p.label) : undefined}
                    className={`px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase whitespace-nowrap ${p.expandable ? 'cursor-pointer select-none' : ''}`}
                    style={{
                      letterSpacing: '0.07em',
                      borderRight: '1px solid rgba(255,255,255,0.15)',
                    }}
                    title={p.expandable ? (expandedCols[p.label] ? 'Collapse' : 'Expand') : undefined}>
                    {p.label}
                    {p.expandable && (
                      <span className="ml-1 text-white/50 text-xs">
                        {expandedCols[p.label] ? ' ⇤' : ' ⇥'}
                      </span>
                    )}
                  </th>
                ))}
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Match
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Conf.
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Dept. Reconcile
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Maker
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Checker
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                  Checker Status
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                  style={{ letterSpacing: '0.07em', borderRight: canApprove ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                  Approver Status
                </th>
                {canApprove && (
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-[#1a3a5c] uppercase whitespace-nowrap"
                    style={{ letterSpacing: '0.07em' }}>
                    Approver
                  </th>
                )}
              </tr>
              {/* Row 2 — Physical (purple tint) / ERP (teal tint) sub-headers */}
              <tr style={{ borderBottom: '1px solid #a19a9a', borderTop: '0.15px solid #cfcdcd' }}>
                {COLUMN_PAIRS.map(p => (
                  <React.Fragment key={p.label}>
                    <th className="px-3 py-1.5 bg-white text-center text-xs font-semibold whitespace-nowrap"
                      style={{ color: '#1a3a5c', background: '#cfcdcd', borderRight: '0.15px solid #cfcdcd' }}
                      >
                      Physical
                    </th>
                    <th className="px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap"
                      style={{ color: '#1a3a5c', background: '#cfcdcd', borderRight: '1px solid #e8ecf0' }}>
                      ERP
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {recordsLoading ? (
                <tr>
                  <td colSpan={4 + COLUMN_PAIRS.length * 2 + (canApprove ? 1 : 0)}
                    className="px-4 py-12 text-center" style={{ color: '#94a3b8' }}>
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8E288D] mb-3" />
                      <p className="text-sm">Loading records…</p>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={4 + COLUMN_PAIRS.length * 2 + (canApprove ? 1 : 0)}
                    className="px-4 py-10 text-center" style={{ color: '#94a3b8' }}>
                    <FiAlertCircle className="mx-auto h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No records found for this filter</p>
                  </td>
                </tr>
              ) : records.map((rec, idx) => (
                <tr key={rec.id}
                  // style={{ background: idx % 2 === 0 ? '#ffffff' : '#f4f7fa', borderBottom: '1px solid #e8ecf0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eef4ff'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f4f7fa'}>

                  <td className="sticky left-0 z-20 bg-white px-1 py-2.5 text-center"
                    style={{ width: '40px', minWidth: '40px', maxWidth: '40px', left: 0 }}>
                    <input
                      type="checkbox"
                      aria-label={`Select record ${rec.id}`}
                      checked={selectedRecordMap.has(rec.id)}
                      disabled={!canReview}
                      onClick={event => event.stopPropagation()}
                      onChange={event => setSelectedRecordMap(current => {
                        const next = new Map(current)
                        if (event.target.checked) next.set(rec.id, rec)
                        else next.delete(rec.id)
                        return next
                      })}
                    />
                  </td>

                  {/* Category */}
                  <td className="px-4 py-2.5 whitespace-nowrap sticky left-10 z-10"
                    style={{ background: 'inherit', borderRight: '1px solid #e2e8f0', left: '40px' }}>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      // style={{
                      //   color: rec.category === 'Exact Match' ? '#1a3a5c' :
                      //          rec.category === 'AI Match' ? '#1a3a5c' :
                      //          rec.category === 'Manual Review' ? '#1a3a5c' :
                      //          rec.category === 'Physical Unmatched' ? '#1a3a5c' :
                      //          rec.category === 'ERP Unmatched' ? '#1a3a5c' :
                      //          rec.category === 'Duplicate' ? '#1a3a5c' : '#1a3a5c',
                      //   background: rec.category === 'Exact Match' ? '#f1f1f1' :
                      //               rec.category === 'AI Match' ? '#f1f1f1' :
                      //               rec.category === 'Manual Review' ? '#f1f1f1' :
                      //               rec.category === 'Physical Unmatched' ? '#f1f1f1' :
                      //               rec.category === 'ERP Unmatched' ? '#f1f1f1' :
                      //               rec.category === 'Duplicate' ? '#f1f1f1' : '#f1f1f1',
                      // }}
                      >
                      {rec.category}
                    </span>
                  </td>

                  {/* Paired columns — NO inner column lines, only group separator */}
                  {COLUMN_PAIRS.map((p) => {
                    const isExpanded = expandedCols[p.label]
                    const w = isExpanded ? 'min-w-[200px] max-w-[400px] whitespace-normal break-words' : 'max-w-[140px] whitespace-nowrap overflow-hidden'
                    return (
                      <React.Fragment key={p.label}>
                        <td className={`px-4 py-2.5 text-xs ${w}`}
                          // style={{ color: '#334155', background: 'rgba(124,58,237,0.02)' }}
                          >
                          {isExpanded ? <span>{rec[p.cKey]}</span> : <div className="truncate" title={rec[p.cKey]}>{rec[p.cKey]}</div>}
                        </td>
                        <td className={`px-4 py-2.5 text-xs ${w}`}
                          // style={{ color: '#334155', background: 'rgba(15,118,110,0.02)', borderRight: '1px solid #e2e8f0' }}
                          >
                          {isExpanded ? <span>{rec[p.iKey]}</span> : <div className="truncate" title={rec[p.iKey]}>{rec[p.iKey]}</div>}
                        </td>
                      </React.Fragment>
                    )
                  })}

                  {/* Match */}
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium"
                    // style={{ color: '#64748b', borderLeft: '1px solid #e2e8f0' }}
                    >
                    {rec.match_method}
                  </td>

                  {/* Confidence */}
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap font-bold"
                    // style={{ color: '#8E288D' }}
                    >
                    {rec.confidence}
                  </td>

                  {/* Dept Reconcile — full cell color */}
                  <td className="px-3 py-2.5 whitespace-nowrap text-center"
                    style={{
                      background:
                        rec.dept_reconcile === 'Same'                     ? '#ecfdf5' :
                        rec.dept_reconcile === 'Same Dept, Diff District' ? '#dbeafe' :
                        rec.dept_reconcile === 'Diff Dept, Same District' ? '#ffedd5' :
                        rec.dept_reconcile === 'Different'                ? '#fee2e2' : '#f8fafc',
                      color:
                        rec.dept_reconcile === 'Same'                     ? '#95298E' :
                        rec.dept_reconcile === 'Same Dept, Diff District' ? '#1e40af' :
                        rec.dept_reconcile === 'Diff Dept, Same District' ? '#92400e' :
                        rec.dept_reconcile === 'Different'                ? '#991b1b' : '#64748b',
                    }}
                    >
                    <span className="text-xs font-bold">{rec.dept_reconcile || 'N/A'}</span>
                  </td>

                  {/* Maker */}
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium" style={{ color: '#64748b' }}>
                    {rec.maker_username || rec.maker_user_id || '—'}
                  </td>

                  {/* Checker */}
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium" style={{ color: '#64748b' }}>
                    {rec.checker_username || rec.checked_by_username || rec.checked_by || '—'}
                  </td>

                  {/* Checker Status */}
                  <td className="whitespace-nowrap text-center" style={{ background: '#f8fafc' }}>
                    {canCheck && Number(rec.maker_user_id) !== Number(user?.id) ? (
                      <div className="px-3 py-2.5">
                        <StatusDropdown
                          recordId={rec.id}
                          category={rec.category}
                          current={effectiveStatus(rec.checker_status, rec.check_status)}
                          onSelect={handleRecordDecision}
                          loading={!!actionLoading[rec.id]}
                        />
                      </div>
                    ) : (
                      <div className="px-4 py-2.5">
                        <span className="text-xs font-bold" style={{ color: '#475569' }}>
                          {STATUS_MAP[effectiveStatus(rec.checker_status, rec.check_status)]?.label || 'Pending'}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Approver Status — full cell color */}
                  <td className="whitespace-nowrap text-center"
                    style={{
                      background: {
                        reconciled:               '#ecfdf5',
                        unreconciled:             '#fee2e2',
                        surplus_assets:           '#ffedd5',
                        exist_in_erp_not_physical:'#fce7f3',
                        duplicated:               '#f1f5f9',
                        unique:                   '#ccfbf1',
                        pending:                  '#fef3c7',
                      }[rec.approver_status || rec.approval_status || 'pending'] || '#f8fafc',
                    }}>
                    {canApprove && isRecordChecked(rec) && Number(rec.maker_user_id) !== Number(user?.id) ? (
                      <div className="px-3 py-2.5">
                        <StatusDropdown
                          recordId={rec.id}
                          category={rec.category}
                          current={rec.approver_status || rec.approval_status || 'pending'}
                          onSelect={handleRecordDecision}
                          loading={!!actionLoading[rec.id]}
                        />
                      </div>
                    ) : (
                      <div className="px-4 py-2.5">
                        <span className="text-xs font-bold" style={{
                          color: {
                            reconciled: '#95298E', unreconciled: '#FF7373',
                            surplus_assets: '#558AFF', exist_in_erp_not_physical: '#F6DB6F',
                            duplicated: '#FF8342', unique: '#95298E', pending: '#CFCFCF',
                          }[rec.approver_status || rec.approval_status || 'pending'] || '#CFCFCF'
                        }}>
                          {!isRecordChecked(rec) && canApprove
                            ? 'Awaiting check'
                            : (STATUS_MAP[rec.approver_status || rec.approval_status || 'pending']?.label || 'Pending')}
                        </span>
                      </div>
                    )}
                    {rec.approved_at && (
                      <div className="text-xs px-2 pb-1" style={{ color: '#94a3b8' }}>
                        {new Date(rec.approved_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>

                  {/* Approver */}
                  {canApprove && (
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium"
                      style={{ color: '#64748b' }}>
                      {rec.approver_username || rec.approved_by_username || rec.approved_by || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer — pagination only */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3">
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-gray-500">
                Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, totalRecords)} of {totalRecords}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  aria-label="Previous page"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                  <FiChevronLeft className="h-3.5 w-3.5" />
                </button>
                {getPaginationItems(totalPages, page).map((item, index) => item === 'ellipsis-left' || item === 'ellipsis-right'
                  ? <span key={`${item}-${index}`} className="flex h-7 w-5 items-center justify-center text-xs text-gray-400">...</span>
                  : <button key={item} onClick={() => setPage(item)} aria-current={item === page ? 'page' : undefined}
                    className={`h-7 w-7 rounded-lg border text-xs font-semibold transition ${item === page ? 'border-[#8E288D] bg-[#8E288D] text-white' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                    {item}
                  </button>)}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  aria-label="Next page"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                  <FiChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">{totalRecords} records</span>
          )}
        </div>
        </>
        )}
      </div>

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

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
  {
    CATEGORIES.filter(c => c.key !== 'all').map(cat => {
      const s = getSummary(cat.key)
      const done = cat.key === 'Duplicate'
        ? (s.duplicated || 0) + (s.unique || 0)
        : nonPendingCount(s)
      const p = s.total > 0 ? ((done / s.total) * 100).toFixed(0) : 0
      const barColor = cat.key === 'Duplicate' ? '#ec4899' : '#8E288D'
      const border = {
        'Exact Match': 'border-gray-250',
        'AI Match': 'border-gray-250',
        'Manual Review': 'border-gray-250',
        'Unmatched': 'border-gray-250',
        'Duplicate': 'border-gray-250',
      }
      return (
        <div key={cat.key} className={`bg-white dark:bg-gray-900 rounded-lg shadow p-4 border-t-4 ${border[cat.key]}`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{cat.label}</h3>
          <div className="text-2xl font-bold text-gray-800 mb-1">{s.total}</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div className="h-1.5 rounded-full" style={{ width: `${p}%`, backgroundColor: barColor }} />
          </div>
          <div className="space-y-0.5 text-xs">
            {cat.key === 'Duplicate' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">{s.pending} pending</span>
                  <span className="text-pink-600">{s.duplicated || 0} duplicated</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E288D]">{s.unique || 0} unique</span>
                </div>
              </>
            ) : cat.key === 'Unmatched' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">{s.pending} pending</span>
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
                  <span className="text-[#CFCFCF]">{s.pending} pending</span>
                  <span className="text-[#95298E]">{s.reconciled} reconciled</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FF7373]">{s.unreconciled} unreconciled</span>
                  <span className="text-[#558AFF]">{s.surplus_assets} surplus</span>
                </div>
              </>
            )}
          </div>
        </div>
      )
    })
  }
      </div>
    </div>
  )
}

export default ApprovalPage
