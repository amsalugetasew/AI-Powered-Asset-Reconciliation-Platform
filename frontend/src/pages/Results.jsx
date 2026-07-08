import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiDownload, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiGrid, FiBarChart2, FiXCircle, FiDatabase, FiUsers, FiChevronLeft, FiChevronRight, FiCheck } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { logActivity } from '../services/activityService'
import { useAuth } from '../context/AuthContext'

// ── Paired column definitions (mirrored from ApprovalPage) ────────────────────
const RESULT_COLUMN_PAIRS = [
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

const APPROVAL_BADGE_CLS = {
  pending: 'bg-gray-10 text-gray-700 border-gray-30',
  reconciled: 'bg-purple-10 text-[#8E288D] border-purple-30',
  unreconciled: 'bg-red-10 text-red-800 border-red-30',
  surplus_assets: 'bg-orange-10 text-orange-800 border-orange-30',
  exist_in_erp_not_physical: 'bg-purple-100 text-purple-800 border-purple-30',
  duplicated: 'bg-pink-10 text-pink-800 border-pink-30',
  unique: 'bg-teal-10 text-teal-800 border-teal-30',
}

const APPROVAL_LABEL = {
  pending: 'Pending',
  reconciled: 'Reconciled',
  unreconciled: 'Unreconciled',
  surplus_assets: 'Surplus Assets',
  exist_in_erp_not_physical: 'Shortage Assets',
  duplicated: 'Duplicated',
  unique: 'Unique',
}

const Results = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reconciliation, setReconciliation] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [recordsStored, setRecordsStored] = useState(false)
  const [expandedCols, setExpandedCols] = useState({})
  const [tableCollapsed, setTableCollapsed] = useState(false)

  const toggleCol = (label) =>
    setExpandedCols(prev => ({ ...prev, [label]: !prev[label] }))

  useEffect(() => {
    fetchReconciliation()
  }, [id])

  useEffect(() => {
    if (reconciliation) {
      fetchRecords()
    }
  }, [currentPage, selectedCategory, reconciliation])

  const fetchReconciliation = async () => {
    try {
      const response = await axios.get(`/api/reconciliation/${id}`)
      setReconciliation(response.data.reconciliation)

      // Check if records exist in database
      try {
        const recordsResponse = await axios.get(`/api/reconciliation/records/${id}`, {
          params: { page: 1, per_page: 1 }
        })
        if (recordsResponse.data.pagination.total_records > 0) {
          setRecordsStored(true)
        } else {
          setRecordsStored(false)
        }
      } catch (error) {
        // Records not in database, will use file-based approach
        setRecordsStored(false)
      }
    } catch (error) {
      toast.error('Failed to fetch reconciliation details')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecords = async () => {
    try {
      setRecordsLoading(true)
      const response = await axios.get(`/api/reconciliation/records/${id}`, {
        params: {
          page: currentPage,
          per_page: recordsPerPage,
          category: selectedCategory === 'all' ? 'all' : selectedCategory
        }
      })
      setRecords(response.data.records)
      setTotalRecords(response.data.pagination.total_records)
      setTotalPages(response.data.pagination.total_pages)
      if (response.data.pagination.total_records > 0) setRecordsStored(true)
    } catch (error) {
      toast.error('Failed to fetch records')
      setRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      logActivity(window.location.pathname, `DOWNLOAD_REPORT_ID_${id}`)
      const response = await axios.get(`/api/reconciliation/download-enriched/${id}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reconciliation_enriched_${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Enriched report downloaded successfully')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!reconciliation) {
    return null
  }

  const stats = reconciliation.statistics
  const totalMatched = stats.rule_matched + stats.ai_matched
  const totalCustomerRecords = stats.total_customer_records
  const customerDuplicates = stats.customer_duplicates || 0
  const uniqueRecords = totalCustomerRecords - customerDuplicates
  const matchRate = uniqueRecords > 0 ? ((totalMatched / uniqueRecords) * 100).toFixed(2) : 0

  // Overall distribution chart
  const chartData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#101010' },
    { name: 'Unmatched', value: stats.customer_unmatched, color: 'hsla(0, 98%, 67%, 1.00)' }
  ]

  // Customer records breakdown
  const customerReconciled = stats.rule_matched + stats.ai_matched
  const customerData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Not Reconciled', value: stats.customer_unmatched, color: '#ef4444' }
  ]

  // Internal records breakdown (assuming similar distribution)
  const internalReconciled = stats.rule_matched + stats.ai_matched
  const internalData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Not Reconciled', value: stats.internal_unmatched, color: '#ef4444' }
  ]

  // Comparison bar chart data
  const comparisonData = [
    {
      category: 'Total Records',
      Customer: stats.total_customer_records,
      Internal: stats.total_internal_records
    },
    {
      category: 'Reconciled',
      Customer: customerReconciled,
      Internal: internalReconciled
    },
    {
      category: 'Not Reconciled',
      Customer: stats.customer_unmatched,
      Internal: stats.internal_unmatched
    }
  ]

  return (
    <div className="px-0 lg:px-0 lg:px-6">
      <div className="mb-4">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-700"
        >
          <FiArrowLeft className="mr-0" />
          Back to Dashboard
        </button>
      </div>

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className='flex'>
          <h1 className="text-3xl font-semibold  text-gray-900 mr-4">
            Reconciliation Results #{id}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Completed on {new Date(reconciliation.completed_at).toLocaleString()}
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex space-x-3">
          <button
            onClick={() => navigate(`/report/${id}`)}
            className="inline-flex items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium 
            text-white bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D]"
          >
            <FiBarChart2 className="w-5 h-5 mr-2" />
            Dashboard Report
          </button>
          <button
            onClick={() => navigate(`/approval/${id}`)}
            className="inline-flex items-center px-4 py-3 border 
            border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#8E288D] to-[#000000] text-white rounded-lg hover:from-[#000000] hover:to-[#8E288D]"
          >
            <FiCheck className="mr-2" />
            {hasRole('manager') ? 'Review & Approve' : 'View Approval Status'}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-4 py-3 border 
            border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#CFB53B] to-[#8E288D] text-white rounded-lg hover:from-[#8E288D] hover:to-[#CFB53B]"
          >
            <FiDownload className="mr-2" />
            Download
          </button>
        </div>
      </div>

      {/* Processed Records Table */}
      <div className="mt-8 shadow rounded-xl overflow-hidden" style={{ background: '#fff' }}>
        {/* Table header bar — dark blue like reference */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: "linear-gradient(90deg, #CFB53B 0%, #8E288D 100%)" }}>
          <h2 className="text-base font-semibold text-white tracking-wide">Processed Records</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-200">{totalRecords} records</span>
            <button
              onClick={() => setTableCollapsed(c => !c)}
              className="text-white opacity-70 hover:opacity-100 font-bold text-lg leading-none px-1"
              title={tableCollapsed ? 'Expand' : 'Collapse'}>
              {tableCollapsed ? '+' : '−'}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap gap-2" style={{ background: '#f8fafc'}}>
          {[
            { key: 'all',           label: 'All',                                          cls: 'bg-white text-gray-600 border-gray-300',       active: 'bg-[#1a3a5c] text-white border-[#1a3a5c]' },
            { key: 'Exact Match',   label: `Tag Match (${stats.rule_matched})`,           cls: 'bg-white text-[#1a3a5c] border-[#1a3a5c]',     active: 'bg-[#1a3a5c] text-white border-[#1a3a5c]'  },
            { key: 'AI Match',      label: `AI Match (${stats.ai_matched})`,                cls: 'bg-white text-purple-700 border-purple-300',   active: 'bg-[#7A1E79] text-white border-[#7A1E79]'  },
            { key: 'Manual Review', label: `Near Match (${stats.manual_review})`,           cls: 'bg-white text-[#1a3a5c] border-[#1a3a5c]',       active: 'bg-[#1a3a5c] text-white border-[#1a3a5c]'    },
            { key: 'Unmatched',     label: `Unmatched (${stats.customer_unmatched})`,       cls: 'bg-white text-red-600 border-red-300',         active: 'bg-red-600 text-white border-red-600'      },
            { key: 'Duplicate',     label: `Duplicates (${(stats.customer_duplicates||0)+(stats.internal_duplicates||0)})`, cls: 'bg-white text-pink-600 border-pink-300', active: 'bg-pink-600 text-white border-pink-600' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => handleCategoryChange(tab.key)}
              className={`px-3 py-1 rounded border text-xs font-semibold transition-colors ${
                selectedCategory === tab.key ? tab.active : tab.cls + ' hover:opacity-80'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table — collapsible */}
        {!tableCollapsed && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  {/* Row 1 — dark blue group headers like reference */}
                  <tr style={{ background: "linear-gradient(90deg, #CFB53B 0%, #8E288D 100%)" }}>
                    <th rowSpan={2}
                      className="px-4 py-3 text-left text-xs font-bold text-white uppercase whitespace-nowrap sticky left-0 z-10"
                      style={{ background: "linear-gradient(90deg, #CFB53B 0%, #8E288D 100%)", letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                      Category
                    </th>
                    {RESULT_COLUMN_PAIRS.map(p => (
                      <th key={p.label} colSpan={2}
                        onClick={p.expandable ? () => toggleCol(p.label) : undefined}
                        className={`px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap ${p.expandable ? 'cursor-pointer select-none' : ''}`}
                        style={{
                          background: expandedCols[p.label] ? '#E0E0E0' : '#E0E0E0',
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
                    <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap"
                      style={{ background: '#E0E0E0', letterSpacing: '0.07em', borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Match ⇅
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap"
                      style={{ background: '#E0E0E0', letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Conf. ⇅
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap"
                      style={{ background: '#E0E0E0', letterSpacing: '0.07em', borderRight: '1px solid #B0B0B0' }}>
                      Dept. Reconcile ⇅
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap"
                      style={{ background: '#E0E0E0', letterSpacing: '0.07em' }}>
                      Approval ⇅
                    </th>
                  </tr>
                  {/* Row 2 — Physical / ERP sub-headers */}
                  <tr style={{ background: '#E0E0E0', borderBottom: '1px solid #a19a9aff',borderTop: '0.15px solid #cfcdcdff' }}>
                    {RESULT_COLUMN_PAIRS.map(p => (
                      <React.Fragment key={p.label}>
                        <th className="px-3 py-1.5 text-center text-xs font-semibold text-gray-600/90 whitespace-nowrap"
                          style={{ background: '#E0E0E0', borderRight: '0.15px solid #cfcdcdff' }}>
                          Physical
                        </th>
                        <th className="px-3 py-1.5 text-center text-xs font-semibold text-gray-600/90 whitespace-nowrap"
                          style={{ background: '#E0E0E0', borderRight: '0.51px solid #cfcdcdff' }}>
                          ERP
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {recordsLoading ? (
                    <tr>
                      <td colSpan={3 + RESULT_COLUMN_PAIRS.length * 2} className="px-4 py-12 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a3a5c] mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Loading records…</p>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={3 + RESULT_COLUMN_PAIRS.length * 2} className="px-4 py-12 text-center text-gray-400">
                        <FiDatabase className="mx-auto h-10 w-10 mb-2 opacity-30" />
                        <p className="text-sm">No records found</p>
                      </td>
                    </tr>
                  ) : records.map((rec, idx) => (
                    <tr key={rec.id}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f4f7fa', borderBottom: '1px solid #e8ecf0' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eef4ff'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f4f7fa'}>

                      {/* Category */}
                      <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 z-10"
                        style={{ background: 'inherit', borderRight: '1px solid #e2e8f0' }}>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: rec.category === 'Exact Match' ? '#1a3a5c' :
                                   rec.category === 'AI Match' ? '#1a3a5c' :
                                   rec.category === 'Manual Review' ? '#1a3a5c' :
                                   rec.category === 'Customer Unmatched' ? '#1a3a5c' :
                                   rec.category === 'Finance Unmatched' ? '#1a3a5c' :
                                   rec.category === 'Duplicate' ? '#1a3a5c' : '#1a3a5c',
                            background: rec.category === 'Exact Match' ? '#fff' :
                                        rec.category === 'AI Match' ? '#fff' :
                                        rec.category === 'Manual Review' ? '#fff' :
                                        rec.category === 'Customer Unmatched' ? '#fff' :
                                        rec.category === 'Finance Unmatched' ? '#fff' :
                                        rec.category === 'Duplicate' ? '#fce7f3' : '#f1f5f9',
                          }}>
                          {rec.category}
                        </span>
                      </td>

                      {/* Paired columns */}
                      {RESULT_COLUMN_PAIRS.map(p => {
                        const isExpanded = expandedCols[p.label]
                        const w = isExpanded
                          ? 'min-w-[200px] max-w-[400px] whitespace-normal break-words'
                          : 'max-w-[140px] whitespace-nowrap overflow-hidden'
                        return (
                          <React.Fragment key={p.label}>
                            <td className={`px-4 py-2.5 text-xs ${w}`}
                              style={{ color: '#334155', background: 'rgba(124,58,237,0.015)' }}>
                              {isExpanded ? <span>{rec[p.cKey]}</span> : <div className="truncate" title={rec[p.cKey]}>{rec[p.cKey]}</div>}
                            </td>
                            <td className={`px-4 py-2.5 text-xs ${w}`}
                              style={{ color: '#334155', background: 'rgba(15,118,110,0.015)', borderRight: '1px solid #e8ecf0' }}>
                              {isExpanded ? <span>{rec[p.iKey]}</span> : <div className="truncate" title={rec[p.iKey]}>{rec[p.iKey]}</div>}
                            </td>
                          </React.Fragment>
                        )
                      })}

                      {/* Match */}
                      <td className="px-4 py-2.5 text-xs font-medium whitespace-nowrap"
                        style={{ color: '#64748b', borderLeft: '1px solid #e2e8f0' }}>
                        {rec.match_method}
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: '#8E288D' }}>
                        {rec.confidence}
                      </td>

                      {/* Dept Reconcile — pastel full-cell */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center"
                        style={{
                          background: rec.dept_reconcile === 'Same'                     ? '#f1f1f1' :
                                      rec.dept_reconcile === 'Same Dept, Diff District' ? '#dbeafe' :
                                      rec.dept_reconcile === 'Diff Dept, Same District' ? '#ffedd5' :
                                      rec.dept_reconcile === 'Different'                ? '#f2f2f2' : '#f8fafc',
                          color:      rec.dept_reconcile === 'Same'                     ? '#1a3a5c' :
                                      rec.dept_reconcile === 'Same Dept, Diff District' ? '#1e40af' :
                                      rec.dept_reconcile === 'Diff Dept, Same District' ? '#92400e' :
                                      rec.dept_reconcile === 'Different'                ? '#991b1b' : '#94a3b8',
                        }}>
                        <span className="text-xs font-bold">{rec.dept_reconcile || 'N/A'}</span>
                      </td>

                      {/* Approval — pastel full-cell */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center"
                        style={{
                          background: {
                            reconciled:               '#f1f1f1',
                            unreconciled:             '#fee2e2',
                            surplus_assets:           '#ede9fe',
                            exist_in_erp_not_physical:'#fce7f3',
                            duplicated:               '#f1f5f9',
                            unique:                   '#ccfbf1',
                            pending:                  '#e7e3cfff',
                          }[rec.approval_status] || '#f8fafc',
                        }}>
                        <span className="text-xs font-bold"
                          style={{
                            color: {
                              reconciled: '#1a3a5c', unreconciled: '#991b1b',
                              surplus_assets: '#3c4349ff', exist_in_erp_not_physical: '#9c5b75ff',
                              duplicated: '#334155', unique: '#134e4a', pending: '#000',
                            }[rec.approval_status] || '#64748b'
                          }}>
                          {APPROVAL_LABEL[rec.approval_status] || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer — pagination + download */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
              {totalPages > 1 ? (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500">
                    Showing {((currentPage-1)*recordsPerPage)+1}–{Math.min(currentPage*recordsPerPage, totalRecords)} of {totalRecords}
                  </p>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => handlePageChange(currentPage-1)} disabled={currentPage===1}
                      className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                      <FiChevronLeft className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const pn = i+1
                      if (pn===1||pn===totalPages||(pn>=currentPage-1&&pn<=currentPage+1)) {
                        return (
                          <button key={pn} onClick={() => handlePageChange(pn)}
                            className={`px-2.5 py-1 rounded border text-xs font-medium ${
                              currentPage===pn ? 'border-[#1a3a5c] text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                            style={{ background: currentPage===pn ? '#1a3a5c' : undefined }}>
                            {pn}
                          </button>
                        )
                      } else if (pn===currentPage-2||pn===currentPage+2) {
                        return <span key={pn} className="text-gray-400 text-xs">…</span>
                      }
                      return null
                    })}
                    <button onClick={() => handlePageChange(currentPage+1)} disabled={currentPage===totalPages}
                      className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                      <FiChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-400">{totalRecords} records</span>
              )}
              {/* Download CSV */}
              <button
                onClick={handleDownload}
                className="text-xs font-semibold hover:underline flex items-center gap-1"
                style={{ color: '#1a3a5c' }}>
                <FiDownload className="h-3.5 w-3.5" />
                Download Data (CSV/Excel)
              </button>
            </div>
          </>
        )}
      </div>

      {/* Section Divider */}
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Detailed Breakdown</h2>
        <div className="h-1 w-32 bg-gradient-to-r from-[#8E288D] to-[#CFB53C] rounded"></div>
      </div>

      {/* KPI Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiCheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Matched</dt>
                  <dd className="text-lg font-semibold text-gray-900">{totalMatched}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm text-gray-500">Match Rate: {matchRate}%</div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiCheckCircle className="h-6 w-6 text-[#008080]" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Exact Matched</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.rule_matched}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiAlertCircle className="h-6 w-6 text-[#8E288D]" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">AI Matched</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.ai_matched}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiXCircle className="h-6 w-6 text-pink-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Unmatched</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.customer_unmatched}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Bar Chart */}
      {/* <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Customer vs Internal Records Comparison</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" style={{ fontSize: '14px', fontWeight: '500' }} />
            <YAxis style={{ fontSize: '14px' }} />
            <Tooltip 
              contentStyle={{ fontSize: '14px', fontWeight: '500' }}
              labelStyle={{ fontSize: '15px', fontWeight: '600' }}
            />
            <Legend wrapperStyle={{ fontSize: '14px', fontWeight: '500' }} />
            <Bar dataKey="Customer" fill="#8E288D" radius={[8, 8, 0, 0]} />
            <Bar dataKey="Internal" fill="#008080" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div> */}

      {/* Detailed Breakdown Charts */}
      {/* <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
      {/* Customer Records Breakdown */}
      {/* <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiUsers className="h-6 w-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Customer Records Breakdown</h3>
          </div>
          <div className="mb-4 p-4 bg-purple-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Customer Records:</span>
              <span className="text-2xl font-bold text-purple-600">{stats.total_customer_records}</span>
            </div>
          </div> */}
      {/* <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={customerData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {customerData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: '14px', fontWeight: '500' }} />
            </PieChart>
          </ResponsiveContainer> */}
      {/* <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-sm font-medium text-gray-700">✓ Rule Matched</span>
              <span className="text-sm font-bold text-green-700">{stats.rule_matched} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-sm font-medium text-gray-700">✓ AI Matched</span>
              <span className="text-sm font-bold text-[#8E288D]">{stats.ai_matched} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
              <span className="text-sm font-medium text-gray-700">⚠ Manual Review</span>
              <span className="text-sm font-bold text-yellow-700">{stats.manual_review} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
              <span className="text-sm font-medium text-gray-700">✗ Not Reconciled</span>
              <span className="text-sm font-bold text-red-700">{stats.customer_unmatched} records</span>
            </div>
          </div>
        </div> */}

      {/* Internal Records Breakdown */}
      {/* <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiDatabase className="h-6 w-6 text-teal-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Finance Records Breakdown</h3>
          </div>
          <div className="mb-4 p-4 bg-teal-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Finance Records:</span>
              <span className="text-2xl font-bold text-teal-600">{stats.total_internal_records}</span>
            </div>
          </div> */}
      {/* <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={internalData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {internalData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: '14px', fontWeight: '500' }} />
            </PieChart>
          </ResponsiveContainer> */}
      {/* <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-sm font-medium text-gray-700">✓ Rule Matched</span>
              <span className="text-sm font-bold text-green-700">{stats.rule_matched} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-sm font-medium text-gray-700">✓ AI Matched</span>
              <span className="text-sm font-bold text-[#8E288D]">{stats.ai_matched} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
              <span className="text-sm font-medium text-gray-700">⚠ Manual Review</span>
              <span className="text-sm font-bold text-yellow-700">{stats.manual_review} records</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
              <span className="text-sm font-medium text-gray-700">✗ Not Reconciled</span>
              <span className="text-sm font-bold text-red-700">{stats.internal_unmatched} records</span>
            </div>
          </div>
        </div>
      </div> */}

      {/* Overall Statistics Summary */}
      <div className="mt-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Statistics Summary</h2>
        <div className="h-1 w-32 bg-gradient-to-r from-[#8E288D] to-[#CFB53C] rounded"></div>
      </div>

      {/* Detailed Statistics Table */}
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        {/* <h3 className="text-xl font-semibold text-gray-900 mb-6">Detailed Statistics</h3> */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="mt-0 bg-white shadow rounded-lg p-0">
            <h3 className="text-md font-semibold text-center text-gray-900 border-gray-500 mb-0 pb-2 border-b-2">Asset Matching Distribution</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  // label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '12px', fontWeight: '500' }} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b-2 border-[#8E288D]">
              <div className='flex'><FiUsers className="h-6 w-6 text-[#8E288D] mr-2" />Physical Data</div></h4>
            <dl className="space-y-3">
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <dt className="text-sm font-medium text-gray-600">Total Records</dt>
                <dd className="text-lg font-bold text-[#8E288D]">{stats.total_customer_records}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#8E288D] rounded">
                <dt className="text-sm font-medium text-white">Total Matched (Before Aproval)</dt>
                <dd className="text-sm font-bold text-white">{customerReconciled}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#CFB53C] rounded">
                <dt className="text-sm font-medium text-white">Rule Matched</dt>
                <dd className="text-sm font-bold text-white">{stats.rule_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-700 rounded">
                <dt className="text-sm font-medium text-white">AI Matched</dt>
                <dd className="text-sm font-bold text-white">{stats.ai_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-600 rounded">
                <dt className="text-sm font-medium text-white">Match by Similarity (Require Manual Review)</dt>
                <dd className="text-sm font-bold text-white">{stats.manual_review}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-400 rounded">
                <dt className="text-sm font-medium text-white">Unmatched</dt>
                <dd className="text-sm font-bold text-white">{stats.customer_unmatched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-pink-400 rounded">
                <dt className="text-sm font-medium text-white">Duplicates</dt>
                <dd className="text-sm font-bold text-white">{stats.customer_duplicates !== undefined ? stats.customer_duplicates : 0}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b-2 border-[#CFB53B]"><div className='flex'><FiDatabase className="h-6 w-6 text-[#CFB53B] mr-2" />ERP Data</div></h4>
            <dl className="space-y-3">
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <dt className="text-sm font-medium text-gray-600">Total Records</dt>
                <dd className="text-lg font-bold text-[#CFB53C]">{stats.total_internal_records}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#CFB53C] rounded">
                <dt className="text-sm font-medium text-white">Total Matched (Before Aproval)</dt>
                <dd className="text-sm font-bold text-white">{internalReconciled + stats.manual_review}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#8E288D]  rounded">
                <dt className="text-sm font-medium text-white">Rule Match</dt>
                <dd className="text-sm font-bold text-white">{stats.rule_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-500 rounded">
                <dt className="text-sm font-medium text-white">AI Match</dt>
                <dd className="text-sm font-bold text-white">{stats.ai_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-700 rounded">
                <dt className="text-sm font-medium text-white">Match by Similarity (Require Manual Review)</dt>
                <dd className="text-sm font-bold text-white">{stats.manual_review}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-pink-400 rounded">
                <dt className="text-sm font-medium text-white">Unmatched</dt>
                <dd className="text-sm font-bold text-white">{stats.internal_unmatched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-400 rounded">
                <dt className="text-sm font-medium text-white">Duplicates</dt>
                <dd className="text-sm font-bold text-white">{stats.internal_duplicates !== undefined ? stats.internal_duplicates : 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results
