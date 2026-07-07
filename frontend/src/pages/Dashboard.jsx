import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import { useAuth } from '../context/AuthContext'
import { 
  FiUpload, 
  FiDownload, 
  FiClock, 
  FiCheckCircle, 
  FiXCircle, 
  FiLoader,
  FiFileText,
  FiFilter,
  FiSearch,
  FiCheck,
  FiCopy
} from 'react-icons/fi'

const Dashboard = () => {
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    pending: 0
  })
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  useEffect(() => {
    fetchReconciliations()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [reconciliations])

  const fetchReconciliations = async () => {
    try {
      const response = await axios.get('/api/reconciliation/list')
      setReconciliations(response.data.reconciliations)
    } catch (error) {
      toast.error('Failed to fetch reconciliations')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const completed = reconciliations.filter(r => r.status === 'completed')
    setStats({
      total:        reconciliations.length,
      completed:    completed.length,
      processing:   reconciliations.filter(r => r.status === 'processing').length,
      pending:      reconciliations.filter(r => r.status === 'pending').length,
      nearMatch:    completed.reduce((s, r) => s + (r.statistics?.manual_review || 0), 0),
      duplicates:   completed.reduce((s, r) => s + (r.statistics?.customer_duplicates || 0) + (r.statistics?.internal_duplicates || 0), 0),
    })
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="text-[#8E288D]" />
      case 'failed':
        return <FiXCircle className="text-pink-500" />
      case 'processing':
        return <FiLoader className="text-[#F59E0B] animate-spin" />
      default:
        return <FiClock className="text-yellow-500" />
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      completed: 'bg-purple-100 text-[#8E288D] border-purple-200',
      failed: 'bg-pink-100 text-pink-800 border-pink-200',
      processing: 'bg-yellow-100 text-[[#F59E0B] border-[#f59e0b]',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const handleDownload = async (id) => {
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
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }

  const filteredReconciliations = reconciliations.filter(recon => {
    const matchesSearch = recon.customer_file.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recon.internal_file.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || recon.status === filterStatus
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-white-500 to-white-600 rounded-xl 
          shadow-xl hover:shadow-2xl shadow-[0_4px_15px_rgba(142,40,141,0.4)] 
          hover:shadow-[0_8px_25px_rgba(142,40,141,0.6)] 
           p-5 text-[#8E288D] transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#8E288D] text-xs font-medium">Total Jobs</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiFileText className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white-500 to-white-600 rounded-xl 
          shadow-xl hover:shadow-2xl shadow-[0_4px_15px_rgba(0,128,128,0.4)] 
          hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] p-5 
        text-[#008080] transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#008080] text-xs font-medium">Completed</p>
              <p className="text-3xl font-bold mt-1">{stats.completed}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiCheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white-500 to-white-600 rounded-xl shadow-xl 
        hover:shadow-2xl shadow-[0_4px_15px_rgba(245,158,11,0.4)] 
          hover:shadow-[0_8px_25px_rgba(245,158,11,0.6)]
        p-5 text-[#F59E0B] transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F59E0B] text-xs font-medium">Processing</p>
              <p className="text-3xl font-bold mt-1">{stats.processing}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiLoader className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white-500 to-white-600 rounded-xl shadow-xl 
        hover:shadow-2xl shadow-[0_4px_15px_rgba(107,114,128,0.4)] 
          hover:shadow-[0_8px_25px_rgba(107,114,128,0.6)] 
        p-5 text-[#6B7280] transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#6B7280] text-xs font-medium">Pending</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiClock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white-500 to-white-600 
        rounded-xl shadow-xl 
        hover:shadow-2xl shadow-[0_4px_15px_rgba(207,181,59,0.4)] 
          hover:shadow-[0_8px_25px_rgba(207,181,59,0.6)] 
        p-5 text-[#CFB53B] transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#CFB53B] text-xs font-medium">Near Match</p>
              <p className="text-3xl font-bold mt-1">{(stats.nearMatch || 0).toLocaleString()}</p>
              <p className="text-xs text-[#CFB53B] mt-0.5">Fuzzy / review</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiSearch className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white-500 to-white-600 
        rounded-xl shadow-xl 
        hover:shadow-2xl shadow-[0_4px_15px_rgba(236,72,153,0.4)] 
          hover:shadow-[0_8px_25px_rgba(236,72,153,0.6)]  
        p-5 text-pink-500 transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-500 text-xs font-medium">Duplicates</p>
              <p className="text-3xl font-bold mt-1">{(stats.duplicates || 0).toLocaleString()}</p>
              <p className="text-xs text-pink-500 mt-0.5">Phys. + ERP</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiCopy className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Reconciliation Jobs</h2>
            <p className="text-gray-600 mt-1">Manage and track your asset reconciliations</p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center 
            px-6 py-3 bg-gradient-to-r from-[#8E288D] to-[#7A1E79]  
            text-white rounded-lg hover:from-[#008080] hover:to-[#008070]
            transition-all shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <FiUpload className="mr-2 h-5 w-5" />
            New Reconciliation
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8E288D] h-5 w-5" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reconciliations List */}
      {filteredReconciliations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FiUpload className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No reconciliations found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter' 
              : 'Get started by uploading your first files'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <div className="mt-6">
              <Link
                to="/upload"
                className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
              >
                <FiUpload className="mr-2" />
                Upload Files
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredReconciliations.map((recon) => (
            <div
              key={recon.id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-gray-800">#{recon.id}</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(recon.status)}`}>
                        {getStatusIcon(recon.status)}
                        <span className="ml-1 capitalize">{recon.status}</span>
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <FiFileText className="mr-2 h-4 w-4" />
                        <span className="font-medium">Physical:</span>
                        <span className="ml-2">{recon.customer_file}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <FiFileText className="mr-2 h-4 w-4" />
                        <span className="font-medium">ERP:</span>
                        <span className="ml-2">{recon.internal_file}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <FiClock className="mr-2 h-4 w-4" />
                        {new Date(recon.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {recon.status === 'completed' && (
                    <div className="ml-6 flex flex-col space-y-2">
                      <button
                        onClick={() => {
                          logActivity(window.location.pathname, `VIEW_RESULTS_ID_${recon.id}`)
                          navigate(`/results/${recon.id}`)
                        }}
                        className="px-4 py-2 bg-[#8E288D] text-white rounded-lg hover:bg-[#7A1E79] transition-colors text-sm font-medium"
                      >
                        View Results
                      </button>
                      <button
                        onClick={() => navigate(`/report/${recon.id}`)}
                        className="px-4 py-2 bg-[#000000] text-white rounded-lg hover:bg-[#001111] transition-colors text-sm font-medium flex items-center justify-center"
                      >
                        📊 Dashboard
                      </button>
                      <button
                        onClick={() => {
                          logActivity(window.location.pathname, `VIEW_APPROVAL_ID_${recon.id}`)
                          navigate(`/approval/${recon.id}`)
                        }}
                        className="px-4 py-2 bg-[#CFB53B] text-white rounded-lg hover:bg-[#CFB53B] transition-colors
                         text-sm font-medium flex items-center justify-center"
                      >
                        <FiCheck className="mr-2 h-4 w-4" />
                        {hasRole('manager') ? 'Review & Approve' : 'Approval Status'}
                      </button>
                      <button
                        onClick={() => handleDownload(recon.id)}
                        className="px-4 py-2 bg-[#000040] text-white rounded-lg hover:bg-black transition-colors text-sm font-medium flex items-center justify-center"
                      >
                        <FiDownload className="mr-2 h-4 w-4" />
                        Download
                      </button>
                    </div>
                  )}
                </div>

                {recon.status === 'completed' && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#8E288D]">{recon.statistics.rule_matched}</p>
                        <p className="text-xs text-gray-600 mt-1">Exact Match</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#8E288D]">{recon.statistics.ai_matched}</p>
                        <p className="text-xs text-gray-600 mt-1">AI Match</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#CFB53B]">{recon.statistics.manual_review}</p>
                        <p className="text-xs text-gray-600 mt-1">Near Match</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-pink-600">{recon.statistics.customer_unmatched}</p>
                        <p className="text-xs text-gray-600 mt-1">Unmatched</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-orange-500">{recon.statistics.customer_duplicates || 0}</p>
                        <p className="text-xs text-gray-600 mt-1">Physical Duplicate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-orange-700">{recon.statistics.internal_duplicates || 0}</p>
                        <p className="text-xs text-gray-600 mt-1">ERP Duplicate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#8E288D]">
                          {((recon.statistics.rule_matched + recon.statistics.ai_matched) / recon.statistics.total_customer_records * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Match Rate</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
