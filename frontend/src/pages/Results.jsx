import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiDownload, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiXCircle, FiDatabase, FiUsers, FiChevronLeft, FiChevronRight, FiCheck } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { logActivity } from '../services/activityService'
import { useAuth } from '../context/AuthContext'

// ── Paired column definitions (mirrored from ApprovalPage) ────────────────────
const RESULT_COLUMN_PAIRS = [
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

const APPROVAL_BADGE_CLS = {
  pending:                    'bg-gray-100 text-gray-700 border-gray-300',
  reconciled:                'bg-green-100 text-green-800 border-green-300',
  unreconciled:              'bg-red-100 text-red-800 border-red-300',
  surplus_assets:            'bg-orange-100 text-orange-800 border-orange-300',
  exist_in_erp_not_physical: 'bg-purple-100 text-purple-800 border-purple-300',
  duplicated:                'bg-pink-100 text-pink-800 border-pink-300',
  unique:                    'bg-teal-100 text-teal-800 border-teal-300',
}

const APPROVAL_LABEL = {
  pending:                    'Pending',
  reconciled:                'Reconciled',
  unreconciled:              'Unreconciled',
  surplus_assets:            'Surplus Assets',
  exist_in_erp_not_physical: 'Exist in ERP not Physical',
  duplicated:                'Duplicated',
  unique:                    'Unique',
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
    { name: 'Rule Matched', value: stats.rule_matched, color: '#008080' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Unmatched', value: stats.customer_unmatched, color: '#ef4444' }
  ]

  // Customer records breakdown
  const customerReconciled = stats.rule_matched + stats.ai_matched
  const customerData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#008080' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Not Reconciled', value: stats.customer_unmatched, color: '#ef4444' }
  ]

  // Internal records breakdown (assuming similar distribution)
  const internalReconciled = stats.rule_matched + stats.ai_matched
  const internalData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#008080' },
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
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <FiArrowLeft className="mr-2" />
          Back to Dashboard
        </button>
      </div>

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className='flex'>
          <h1 className="text-3xl font-semibold  text-gray-900">
            Reconciliation Results #{id}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Completed on {new Date(reconciliation.completed_at).toLocaleString()}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => navigate(`/report/${id}`)}
            className="inline-flex items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#008080] hover:bg-[#006666]"
          >
            📊 Dashboard Report
          </button>
          <button
            onClick={() => navigate(`/approval/${id}`)}
            className="inline-flex items-center px-4 py-3 border 
            border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8E288D]
            hover:bg-[#7A1E79]"
          >
            <FiCheck className="mr-2" />
            {hasRole('manager') ? 'Review & Approve' : 'View Approval Status'}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-4 py-3 border 
            border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#CFB53B]
            hover:bg-[#CFB53C]"
          >
            <FiDownload className="mr-2" />
            Download
          </button>
        </div>
      </div>

      {/* Processed Records Table */}
      <div className="mt-8 bg-white shadow rounded-xl overflow-hidden">
        {/* Header + category tabs */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processed Records</h2>
            <span className="text-sm text-gray-500">Total: {totalRecords} records</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all',            label: 'All',                           cls: 'bg-gray-100 text-gray-700',       active: 'bg-gray-700 text-white'      },
              { key: 'Exact Match',   label: `Exact Match (${stats.rule_matched})`,  cls: 'bg-green-100 text-green-700',  active: 'bg-green-600 text-white'     },
              { key: 'AI Match',      label: `AI Match (${stats.ai_matched})`,       cls: 'bg-purple-100 text-purple-700',active: 'bg-purple-600 text-white'    },
              { key: 'Manual Review', label: `Manual Review (${stats.manual_review})`,cls:'bg-yellow-100 text-yellow-700',active: 'bg-yellow-500 text-white'    },
              { key: 'Unmatched',     label: `Unmatched (${stats.customer_unmatched})`,cls:'bg-red-100 text-red-700',   active: 'bg-red-600 text-white'       },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => handleCategoryChange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === tab.key ? tab.active : tab.cls + ' hover:opacity-80'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paired-column table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xl border-collapse">
            <thead>
              {/* Row 1 — group headers */}
              <tr className="bg-gray-100 border-b border-gray-500">
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-500 sticky left-0 bg-gray-100 z-10">
                  Category
                </th>
                {RESULT_COLUMN_PAIRS.map(p => (
                  <th key={p.label} colSpan={2}
                    onClick={p.expandable ? () => toggleCol(p.label) : undefined}
                    className={`px-3 py-1.5 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-500 whitespace-nowrap
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
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-500">Match</th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-500">Conf.</th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-amber-700 uppercase whitespace-nowrap border-r border-gray-500 bg-amber-50">Dept. Reconcile</th>
                <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap border-r border-gray-500">Approval</th>
              </tr>
              {/* Row 2 — Customer / Finance */}
              <tr className="bg-gray-50 border-b-2 border-gray-400">
                {RESULT_COLUMN_PAIRS.map(p => (
                  <React.Fragment key={p.label}>
                    <th className="px-3 py-1 text-center text-xs font-medium text-purple-700 bg-purple-50 border-r border-gray-400 whitespace-nowrap">Physical</th>
                    <th className="px-3 py-1 text-center text-xs font-medium text-teal-700 bg-teal-50 border-r border-gray-400 whitespace-nowrap">ERP</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recordsLoading ? (
                <tr>
                  <td colSpan={3 + RESULT_COLUMN_PAIRS.length * 2} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8E288D] mx-auto mb-3" />
                    <p className="text-gray-500">Loading records…</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={3 + RESULT_COLUMN_PAIRS.length * 2} className="px-4 py-12 text-center text-gray-400">
                    <FiDatabase className="mx-auto h-10 w-10 mb-2" />
                    <p>No records found</p>
                  </td>
                </tr>
              ) : records.map((rec, idx) => (
                <tr key={rec.id} className={`hover:bg-yellow-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  {/* Category */}
                  <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-gray-400">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      rec.category === 'Exact Match'        ? 'bg-green-100 text-green-800' :
                      rec.category === 'AI Match'           ? 'bg-purple-100 text-purple-800' :
                      rec.category === 'Manual Review'      ? 'bg-yellow-100 text-yellow-800' :
                      rec.category === 'Customer Unmatched' ? 'bg-red-100 text-red-700' :
                      rec.category === 'Finance Unmatched'  ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{rec.category}</span>
                  </td>
                  {/* Paired columns */}
                  {RESULT_COLUMN_PAIRS.map(p => {
                    const isExpanded = expandedCols[p.label]
                    const cellCls = isExpanded
                      ? 'px-3 py-2 text-xs text-gray-800 border-r border-gray-300 min-w-[200px] max-w-[400px] whitespace-normal break-words'
                      : 'px-3 py-2 text-xs text-gray-800 border-r border-gray-300 max-w-[140px] whitespace-nowrap overflow-hidden'
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
                  {/* Match */}
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-300">{rec.match_method}</td>
                  {/* Confidence */}
                  <td className="px-3 py-2 text-xs font-medium text-gray-800 whitespace-nowrap border-r border-gray-300">{rec.confidence}</td>
                  {/* Dept Reconcile */}
                  <td className="px-3 py-2 whitespace-nowrap border-r border-gray-400 bg-amber-50/40">
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
                  {/* Approval status badge */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${APPROVAL_BADGE_CLS[rec.approval_status] || APPROVAL_BADGE_CLS.pending}`}>
                      {APPROVAL_LABEL[rec.approval_status] || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-300 bg-white">
            <p className="text-sm text-gray-600">
              Showing {((currentPage-1)*recordsPerPage)+1}–{Math.min(currentPage*recordsPerPage, totalRecords)} of {totalRecords}
            </p>
            <div className="flex gap-1.5 items-center">
              <button onClick={() => handlePageChange(currentPage-1)} disabled={currentPage===1}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <FiChevronLeft className="h-4 w-4" />
              </button>
              {[...Array(totalPages)].map((_, i) => {
                const pn = i + 1
                if (pn===1 || pn===totalPages || (pn>=currentPage-1 && pn<=currentPage+1)) {
                  return (
                    <button key={pn} onClick={() => handlePageChange(pn)}
                      className={`px-3 py-1 rounded border text-sm font-medium ${
                        currentPage===pn ? 'bg-[#8E288D] text-white border-[#8E288D]'
                                         : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                      {pn}
                    </button>
                  )
                } else if (pn===currentPage-2 || pn===currentPage+2) {
                  return <span key={pn} className="px-1 text-gray-400">…</span>
                }
                return null
              })}
              <button onClick={() => handlePageChange(currentPage+1)} disabled={currentPage===totalPages}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Divider */}
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Detailed Breakdown</h2>
        <div className="h-1 w-32 bg-gradient-to-r from-[#8E288D] to-[#008080] rounded"></div>
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
        <div className="h-1 w-32 bg-gradient-to-r from-[#8E288D] to-[#008080] rounded"></div>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg p-6">
        {/* <h3 className="text-xl text-center font-semibold text-gray-900 mb-6">Overall Match Distribution</h3> */}
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
              outerRadius={110}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: '15px', fontWeight: '500' }} />
            <Legend wrapperStyle={{ fontSize: '15px', fontWeight: '500' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      

      {/* Detailed Statistics Table */}
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        {/* <h3 className="text-xl font-semibold text-gray-900 mb-6">Detailed Statistics</h3> */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
              <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b-2 border-purple-200"><div className='flex'><FiUsers className="h-6 w-6 text-purple-600 mr-2" />Customer Data</div></h4>
            <dl className="space-y-3">
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <dt className="text-sm font-medium text-gray-600">Total Records</dt>
                <dd className="text-sm font-bold text-gray-900">{stats.total_customer_records}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-300 rounded">
                <dt className="text-sm font-medium text-gray-600">Reconciled (Total)</dt>
                <dd className="text-sm font-bold text-green-600">{customerReconciled}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-200 rounded">
                <dt className="text-sm font-medium text-gray-600 pl-4">→ By Rule</dt>
                <dd className="text-sm font-bold text-green-600">{stats.rule_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-200 rounded">
                <dt className="text-sm font-medium text-gray-600 pl-4">→ By AI</dt>
                <dd className="text-sm font-bold text-[#8E288D]">{stats.ai_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-purple-200 rounded">
                <dt className="text-sm font-medium text-gray-600">Manual Review</dt>
                <dd className="text-sm font-bold text-yellow-600">{stats.manual_review}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-200 rounded">
                <dt className="text-sm font-medium text-gray-600">Not Reconciled</dt>
                <dd className="text-sm font-bold text-red-600">{stats.customer_unmatched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-pink-300 rounded">
                <dt className="text-sm font-medium text-gray-600">Duplicates</dt>
                <dd className="text-sm font-bold text-purple-600">{stats.customer_duplicates !== undefined ? stats.customer_duplicates : 0}</dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b-2 border-teal-200"><div className='flex'><FiDatabase className="h-6 w-6 text-teal-600 mr-2" />Finance Data</div></h4>
            <dl className="space-y-3">
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <dt className="text-sm font-medium text-gray-600">Total Records</dt>
                <dd className="text-sm font-bold text-gray-900">{stats.total_internal_records}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-300 rounded">
                <dt className="text-sm font-medium text-gray-600">Reconciled (Total)</dt>
                <dd className="text-sm font-bold text-green-600">{internalReconciled}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-200 rounded">
                <dt className="text-sm font-medium text-gray-600 pl-4">→ By Rule</dt>
                <dd className="text-sm font-bold text-green-600">{stats.rule_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-200 rounded">
                <dt className="text-sm font-medium text-gray-600 pl-4">→ By AI</dt>
                <dd className="text-sm font-bold text-[#8E288D]">{stats.ai_matched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-purple-200 rounded">
                <dt className="text-sm font-medium text-gray-600">Manual Review</dt>
                <dd className="text-sm font-bold text-yellow-600">{stats.manual_review}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-200 rounded">
                <dt className="text-sm font-medium text-gray-600">Not Reconciled</dt>
                <dd className="text-sm font-bold text-red-600">{stats.internal_unmatched}</dd>
              </div>
              <div className="flex justify-between items-center p-2 bg-pink-300 rounded">
                <dt className="text-sm font-medium text-gray-600">Duplicates</dt>
                <dd className="text-sm font-bold text-purple-600">{stats.internal_duplicates !== undefined ? stats.internal_duplicates : 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results
