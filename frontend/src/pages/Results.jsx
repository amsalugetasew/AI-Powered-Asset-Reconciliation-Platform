import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiDownload, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiXCircle, FiDatabase, FiUsers, FiChevronLeft, FiChevronRight, FiSearch, FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiCheck } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, 
  Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { logActivity } from '../services/activityService'
import { ManagerOnly } from '../components/RoleGuard'
import { useAuth } from '../context/AuthContext'

const Results = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reconciliation, setReconciliation] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage] = useState(5)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [recordsStored, setRecordsStored] = useState(false)
  
  // Column visibility
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    category: true,
    customer_tag: true,
    internal_tag: true,
    description: true,
    match_method: true,
    confidence: true,
    status: true,
    approval_status: true
  })

  // All available columns
  const allColumns = [
    { key: 'id', label: 'ID' },
    { key: 'category', label: 'Category' },
    { key: 'customer_tag', label: 'Customer Tag' },
    { key: 'internal_tag', label: 'Internal Tag' },
    { key: 'description', label: 'Description' },
    { key: 'match_method', label: 'Match Method' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'status', label: 'Status' },
    { key: 'approval_status', label: 'Approval Status' }
  ]

  useEffect(() => {
    fetchReconciliation()
  }, [id])

  useEffect(() => {
    if (reconciliation && recordsStored) {
      fetchRecords()
    }
  }, [currentPage, selectedCategory, recordsStored])

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
      console.log(`Fetching records: page=${currentPage}, category=${selectedCategory}, stored=${recordsStored}`)
      
      // Use different endpoint based on whether records are stored
      const endpoint = recordsStored 
        ? `/api/reconciliation/records/${id}`
        : `/api/reconciliation/records-from-file/${id}`
      
      const response = await axios.get(endpoint, {
        params: {
          page: currentPage,
          per_page: recordsPerPage,
          category: selectedCategory === 'all' ? 'all' : selectedCategory
        }
      })
      
      console.log('Response:', response.data)
      console.log(`Received ${response.data.records.length} records`)
      console.log(`Total records: ${response.data.pagination.total_records}`)
      
      setRecords(response.data.records)
      setTotalRecords(response.data.pagination.total_records)
      setTotalPages(response.data.pagination.total_pages)
    } catch (error) {
      console.error('Error fetching records:', error)
      if (error.response) {
        console.error('Error response:', error.response.data)
      }
      toast.error('Failed to fetch records')
      setRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      logActivity(window.location.pathname, `DOWNLOAD_REPORT_ID_${id}`)
      const response = await axios.get(`/api/reconciliation/download/${id}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reconciliation_report_${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }

  const handleRecord = async () => {
    try {
      logActivity(window.location.pathname, `RECORD_RESULTS_ID_${id}`)
      toast.info('Recording results to database...')
      const response = await axios.post(`/api/reconciliation/record/${id}`)
      toast.success(response.data.message || 'Results recorded successfully')
      // Mark that records are now stored and trigger fetch
      setRecordsStored(true)
      setCurrentPage(1) // Reset to first page
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record results')
    }
  }

  // Remove the mock data generation function - we now fetch from database
  const currentRecords = records
  const filteredRecordsLength = totalRecords

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setCurrentPage(1) // Reset to first page when category changes
  }

  const toggleColumnVisibility = (column) => {
    setVisibleColumns({
      ...visibleColumns,
      [column]: !visibleColumns[column]
    })
  }

  const toggleAllColumns = (visible) => {
    const newVisibility = {}
    allColumns.forEach(col => {
      newVisibility[col.key] = visible
    })
    setVisibleColumns(newVisibility)
  }

  // Use records directly from API
  const displayRecords = records

  const getCategoryBadgeColor = (category) => {
    switch (category) {
      case 'Exact Match':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'AI Match':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Manual Review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Unmatched':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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
        <div>
          <h1 className="text-3xl font-semibold  text-gray-900">
            Reconciliation Results #{id}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Completed on {new Date(reconciliation.completed_at).toLocaleString()}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          {hasRole('manager') && (
            <button
              onClick={() => navigate(`/approval/${id}`)}
              className="inline-flex items-center px-4 py-3 border 
              border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8E288D]
              hover:bg-[#7A1E79]"
            >
              <FiCheck className="mr-2" />
              {recordsStored ? 'View Approval Status' : 'Approve & Save to DB'}
            </button>
          )}
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-4 py-3 border 
            border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#008080]
            hover:bg-[#7A1E79]"
          >
            <FiDownload className="mr-2" />
            Download Report
          </button>
        </div>
      </div>

      {/* Processed Records Table with Pagination */}
      <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processed Records</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {recordsStored ? (
                  `Total: ${filteredRecordsLength} records`
                ) : (
                  <span className="text-yellow-600 font-medium">
                    Records not yet stored in database
                  </span>
                )}
              </div>
              {/* Column Visibility Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiEye className="mr-2" />
                  Columns
                </button>
                {showColumnMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <div className="p-3">
                      <div className="flex justify-between items-center mb-2 pb-2 border-b">
                        <span className="font-medium text-sm">Show/Hide Columns</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAllColumns(true)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={() => toggleAllColumns(false)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      {allColumns.map(col => (
                        <label key={col.key} className="flex items-center py-1 hover:bg-gray-50 px-2 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key]}
                            onChange={() => toggleColumnVisibility(col.key)}
                            className="mr-2"
                          />
                          <span className="text-sm">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Info message if records not stored */}
          {!recordsStored && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Records are being loaded from the processed file. After approval by a Manager, they will be stored in the database.
              </p>
            </div>
          )}
          
          {/* Category Filter */}
          {recordsStored && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#8E288D] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleCategoryChange('Exact Match')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'Exact Match'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Exact Match ({stats.rule_matched})
              </button>
              <button
                onClick={() => handleCategoryChange('AI Match')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'AI Match'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                AI Match ({stats.ai_matched})
              </button>
              <button
                onClick={() => handleCategoryChange('Manual Review')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'Manual Review'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                Manual Review ({stats.manual_review})
              </button>
              <button
                onClick={() => handleCategoryChange('Unmatched')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'Unmatched'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Unmatched ({stats.customer_unmatched})
              </button>
            </div>
          )}
        </div>

        {/* Records Table - Scroll only the table, not the whole page */}
        <div className="border border-gray-200 rounded-lg" style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {visibleColumns.id && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    ID
                  </th>
                )}
                {visibleColumns.category && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Category
                  </th>
                )}
                {visibleColumns.customer_tag && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Customer Tag
                  </th>
                )}
                {visibleColumns.internal_tag && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Internal Tag
                  </th>
                )}
                {visibleColumns.description && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Description
                  </th>
                )}
                {visibleColumns.match_method && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Match Method
                  </th>
                )}
                {visibleColumns.confidence && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Confidence
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50">
                    Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recordsLoading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D] mb-3"></div>
                      <p className="text-gray-500">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : displayRecords.length > 0 ? (
                displayRecords.map((record, index) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    {visibleColumns.id && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.id}
                      </td>
                    )}
                    {visibleColumns.category && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getCategoryBadgeColor(record.category)}`}>
                          {record.category}
                        </span>
                      </td>
                    )}
                    {visibleColumns.customer_tag && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.customer_tag}
                      </td>
                    )}
                    {visibleColumns.internal_tag && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.internal_tag}
                      </td>
                    )}
                    {visibleColumns.description && (
                      <td className="px-6 py-4 text-sm text-gray-900" style={{ minWidth: '200px', maxWidth: '400px' }}>
                        <div className="truncate" title={record.description}>
                          {record.description}
                        </div>
                      </td>
                    )}
                    {visibleColumns.match_method && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {record.match_method}
                      </td>
                    )}
                    {visibleColumns.confidence && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.confidence}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center ${
                          record.status === 'Matched' ? 'text-green-600' :
                          record.status === 'Review Required' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {record.status === 'Matched' && <FiCheckCircle className="mr-1" />}
                          {record.status === 'Review Required' && <FiAlertCircle className="mr-1" />}
                          {record.status === 'Unmatched' && <FiXCircle className="mr-1" />}
                          {record.status}
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FiDatabase className="h-12 w-12 text-gray-400 mb-3" />
                      {recordsStored ? (
                        <>
                          <p className="text-lg font-medium">No records found</p>
                          <p className="text-sm mt-1">Try selecting a different category</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium">Records not stored yet</p>
                          <p className="text-sm mt-1">Click "Record to DB" button to store records</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {recordsStored && totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * recordsPerPage) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * recordsPerPage, filteredRecordsLength)}
                  </span>{' '}
                  of <span className="font-medium">{filteredRecordsLength}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <FiChevronLeft className="h-5 w-5" />
                  </button>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1
                    // Show first, last, current, and pages around current
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNumber
                              ? 'z-10 bg-[#8E288D] border-[#8E288D] text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    } else if (
                      pageNumber === currentPage - 2 ||
                      pageNumber === currentPage + 2
                    ) {
                      return (
                        <span
                          key={pageNumber}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                        >
                          ...
                        </span>
                      )
                    }
                    return null
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <FiChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
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
