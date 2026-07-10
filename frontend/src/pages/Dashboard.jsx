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
  FiFileText, FiFilter, FiSearch, FiCheck, FiCopy, FiTarget
} from 'react-icons/fi'

// ── Age bucket colours (green → red as assets age) ────────────────────────────
const AGE_COLORS = ['#CFB53B', '#8E288D', '#4E79A7', '#f97316', '#000', '#CFB53B', '#8E288D']

// ── useSegmentTooltip — hover state for aging bars ────────────────────────────
const useSegmentTooltip = () => {
  const [tip, setTip] = React.useState(null)
  const show = (e, data) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTip({ x: rect.left + rect.width / 2, y: rect.top - 8, ...data })
  }
  const hide = () => setTip(null)
  const TooltipEl = tip ? (
    <div className="fixed z-50 pointer-events-none"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%,-100%)' }}>
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
        <p className="font-bold border-b border-gray-600 pb-1 mb-1">{tip.label}</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: tip.color }} />
          <span>Assets</span>
        </div>
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-gray-300">Count</span>
          <span className="font-semibold">{tip.count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Share</span>
          <span className="font-semibold">{tip.pct}%</span>
        </div>
      </div>
      <div className="flex justify-center"><div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" /></div>
    </div>
  ) : null
  return { show, hide, TooltipEl }
}

// ── AgingChart — horizontal bars for asset aging ─────────────────────────────
const AgingChart = ({ agingData, agingYear }) => {
  const { show, hide, TooltipEl } = useSegmentTooltip()
  const totalCount = agingData.reduce((s, d) => s + d.count, 0) || 1
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {TooltipEl}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Asset Aging Analysis</h2>
        <p className="text-xs text-gray-500">
          ERP records vs {agingYear} · {totalCount.toLocaleString()} total
        </p>
      </div>
      <div className="space-y-3">
        {agingData.map((d, i) => {
          const sharePct = ((d.count / totalCount) * 100).toFixed(1)
          const color = AGE_COLORS[Math.min(i, AGE_COLORS.length - 1)]
          return (
            <div key={d.bucket}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16 flex-shrink-0">{d.bucket}</span>
                <div className="flex-1 bg-gray-100 rounded-md h-8 overflow-hidden relative">
                  <div
                    className="h-full flex items-center justify-start rounded-md transition-all duration-700 cursor-default"
                    style={{ width: `${sharePct}%`, backgroundColor: color }}
                    onMouseEnter={e => show(e, { label: d.bucket, count: d.count, pct: sharePct, color })}
                    onMouseLeave={hide}
                  >
                    <span className="text-white text-xs font-semibold px-2 select-none">
                      {d.count.toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-600 w-12 text-right">{sharePct}%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
        {agingData.map((d, i) => {
          const color = AGE_COLORS[Math.min(i, AGE_COLORS.length - 1)]
          const sharePct = ((d.count / totalCount) * 100).toFixed(1)
          return (
            <div key={d.bucket} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {d.bucket}: <strong className="ml-0.5">{d.count.toLocaleString()}</strong>
              <span className="text-gray-400 ml-0.5">({sharePct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


const Dashboard = () => {
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [agingData, setAgingData] = useState([])
  const [agingYear, setAgingYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState({
    total: 0, completed: 0, processing: 0, pending: 0, nearMatch: 0, duplicates: 0
  })
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAIContextMenu, setShowAIContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
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
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  useEffect(() => {
    fetchReconciliations()
    fetchAging()
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

  const fetchAging = async () => {
    try {
      const r = await axios.get('/api/reconciliation/analytics/aging')
      setAgingData(r.data.buckets || [])
      setAgingYear(r.data.current_year || new Date().getFullYear())
    } catch {
      // non-fatal — chart just won't show
    }
  }

  const calculateStats = () => {
    const completed = reconciliations.filter(r => r.status === 'completed')
    setStats({
      total: reconciliations.length,
      completed: completed.length,
      processing: reconciliations.filter(r => r.status === 'processing').length,
      pending: reconciliations.filter(r => r.status === 'pending').length,
      unMatch: completed.reduce((s, r) => s + (r.statistics?.customer_unmatched || 0), 0),
      nearMatch: completed.reduce((s, r) => s + (r.statistics?.manual_review || 0), 0),
      exactMatch: completed.reduce((s, r) => s + (r.statistics?.rule_matched || 0), 0),
      aiMatched: completed.reduce((s, r) => s + (r.statistics?.ai_matched || 0), 0),
      duplicates: completed.reduce((s, r) => s + (r.statistics?.customer_duplicates || 0) + (r.statistics?.internal_duplicates || 0), 0),
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

  const openAIModal = ({ chartData, chartType, title, targetLabel, analysisContext, action = 'modal', analysisType = 'summary', outputFormat = 'combined' }) => {
    setAiModalConfig({ chartData, chartType, title, targetLabel, analysisContext })
    setAiModalAction(action)
    setAiModalAnalysisType(analysisType)
    setAiModalOutputFormat(outputFormat)
    setShowAIModal(true)
  }

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
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
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

          {/* <div className="bg-gradient-to-br from-white-500 to-white-600 rounded-xl shadow-xl 
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
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Waiting Approval</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiClock className="h-6 w-6" />
            </div>
          </div>
        </div> */}

          <div className="bg-gradient-to-br from-white-500 to-white-600 
          rounded-xl shadow-xl 
          hover:shadow-2xl shadow-[0_4px_15px_rgba(207,181,59,0.4)] 
          hover:shadow-[0_8px_25px_rgba(207,181,59,0.6)] 
          p-5 text-gray-800 transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 text-xs font-medium">Tag Matched</p>
                <p className="text-3xl font-bold mt-1">{(stats.exactMatch || 0).toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Rule / Matched</p>
              </div>
              <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
                <FiTarget className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* <div className="bg-gradient-to-br from-white-500 to-white-600 
          rounded-xl shadow-xl 
          hover:shadow-2xl shadow-[0_4px_15px_rgba(207,181,59,0.4)] 
          hover:shadow-[0_8px_25px_rgba(207,181,59,0.6)] 
          p-5 text-gray-800 transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-xs font-medium">AI Matched</p>
              <p className="text-3xl font-bold mt-1">{(stats.aiMatched || 0).toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">By Desc. / Dep.</p>
            </div>
            <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
              <FiCpu className="h-6 w-6" />
            </div>
          </div>
        </div> */}

          <div className="bg-gradient-to-br from-white-500 to-white-600 
          rounded-xl shadow-xl 
          hover:shadow-2xl shadow-[0_4px_15px_rgba(207,181,59,0.4)] 
          hover:shadow-[0_8px_25px_rgba(207,181,59,0.6)] 
          p-5 text-gray-800 transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 text-xs font-medium">Near Match</p>
                <p className="text-3xl font-bold mt-1">{(stats.nearMatch + stats.aiMatched || 0).toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">AI+Fuzzy / Require Review</p>
              </div>
              <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
                <FiSearch className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white-500 to-white-600 
          rounded-xl shadow-xl 
          hover:shadow-2xl shadow-[0_4px_15px_rgba(207,181,59,0.4)] 
          hover:shadow-[0_8px_25px_rgba(207,181,59,0.6)] 
          p-5 text-gray-800 transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 text-xs font-medium">Unmatch</p>
                <p className="text-3xl font-bold mt-1">{(stats.unMatch || 0).toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Unmatched Assets</p>
              </div>
              <div className="bg-white bg-opacity-20 p-2.5 rounded-lg">
                <FiXCircle className="h-6 w-6" />
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
        <div
          className="cursor-context-menu"
          title="Right-click for AI insights"
          onContextMenu={e => openAIContextMenu(e, {
              chartData: {
                source: 'dashboard_aging_analysis',
                agingData,
                year: agingYear
              },
              chartType: 'bar',
              title: 'AI Analysis - Dashboard Aging Chart',
              targetLabel: 'Dashboard Aging Chart',
              analysisContext: { page: 'Dashboard', section: 'Aging Analysis' }
            })}
        >
          {/* Aging Analysis Chart */}
          {agingData.length > 0 && (
            <AgingChart agingData={agingData} agingYear={agingYear} />
          )}
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
            px-6 py-3 bg-gradient-to-r from-[#8E288D] to-[#CFB53B]  
            text-white rounded-lg hover:from-[#D4AF37] hover:to-[#7A1E79]
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
                        className="px-4 py-2 bg-gradient-to-r from-[#CFB53B] to-[#8E288D] text-white rounded-lg hover:from-[#8E288D] hover:to-[#CFB53B] transition-colors text-sm font-medium"
                      >
                        View Results
                      </button>
                      <button
                        onClick={() => navigate(`/report/${recon.id}`)}
                        className="px-4 py-2 bg-gradient-to-r from-[#000] to-[#8E288D] text-white rounded-lg hover:from-[#8E288D] hover:to-[#000] transition-colors text-sm font-medium flex items-center justify-center"
                      >
                        📊 Dashboard
                      </button>
                      <button
                        onClick={() => {
                          logActivity(window.location.pathname, `VIEW_APPROVAL_ID_${recon.id}`)
                          navigate(`/approval/${recon.id}`)
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-[#CFB53B] to-[#000000] text-white rounded-lg hover:from-[#000000] hover:to-[#CFB53B] transition-colors
                         text-sm font-medium flex items-center justify-center"
                      >
                        <FiCheck className="mr-2 h-4 w-4" />
                        {hasRole('manager') ? 'Review & Approve' : 'Approval Status'}
                      </button>
                      <button
                        onClick={() => handleDownload(recon.id)}
                        className="px-4 py-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] transition-colors text-sm font-medium flex items-center justify-center"
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
