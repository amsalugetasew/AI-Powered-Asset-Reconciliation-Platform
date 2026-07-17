import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import {
  FiFileText, FiUser, FiClock, FiChevronDown, FiChevronRight,
  FiFilter, FiLogIn, FiLogOut, FiTrash2, FiDownload, FiUpload,
  FiCheckCircle, FiSettings, FiRefreshCw, FiSearch, FiGrid
} from 'react-icons/fi'

// ── Friendly label + colour + icon map ───────────────────────────────────────
const OP_META = {
  USER_LOGIN:               { label: 'Login',                  color: 'text-green-700 bg-green-100',    icon: FiLogIn },
  USER_LOGOUT:              { label: 'Logout',                 color: 'text-gray-700 bg-gray-100',      icon: FiLogOut },
  USER_REGISTER:            { label: 'Register',               color: 'text-blue-700 bg-blue-100',      icon: FiUser },
  LOGIN_FAILED:             { label: 'Login Failed',           color: 'text-red-700 bg-red-100',        icon: FiLogIn },
  CREATE_USER:              { label: 'Create User',            color: 'text-green-700 bg-green-100',    icon: FiUser },
  UPDATE_ROLE:              { label: 'Role Updated',           color: 'text-blue-700 bg-blue-100',      icon: FiSettings },
  DELETE_USER:              { label: 'Delete User',            color: 'text-red-700 bg-red-100',        icon: FiTrash2 },
  UPLOAD_FILES:             { label: 'Files Uploaded',         color: 'text-indigo-700 bg-indigo-100',  icon: FiUpload },
  PROCESS_RECONCILIATION:   { label: 'Reconciliation Run',     color: 'text-[#8E288D] bg-purple-100',  icon: FiRefreshCw },
  DELETE_RECONCILIATION:    { label: 'Reconciliation Deleted', color: 'text-red-700 bg-red-100',        icon: FiTrash2 },
  DOWNLOAD_REPORT:          { label: 'Report Downloaded',      color: 'text-[#CFB53B] bg-yellow-50',   icon: FiDownload },
  DOWNLOAD_ENRICHED_REPORT: { label: 'Enriched Report DL',    color: 'text-yellow-700 bg-yellow-100',  icon: FiDownload },
  APPROVE_RECORD:           { label: 'Record Approved',        color: 'text-purple-700 bg-purple-100',  icon: FiCheckCircle },
  APPROVE_RECORD_GROUP:     { label: 'Bulk Approval',          color: 'text-purple-700 bg-purple-100',  icon: FiGrid },
  APPROVE_EXCEPTION:        { label: 'Exception Approved',     color: 'text-purple-700 bg-purple-100',  icon: FiCheckCircle },
  FINALIZE_RECONCILIATION:  { label: 'Reconciliation Final.',  color: 'text-indigo-700 bg-indigo-100',  icon: FiCheckCircle },
}

const getMeta = (op) => OP_META[op] || { label: op?.replace(/_/g, ' ') || op, color: 'text-gray-700 bg-gray-100', icon: FiFileText }

// ── KPI stat groups ───────────────────────────────────────────────────────────
const KPI_GROUPS = [
  { label: 'Total Logs',     ops: null,             color: 'border-[#8E288D]' },
  { label: 'Logins',         ops: ['USER_LOGIN'],   color: 'border-green-500' },
  { label: 'Role Changes',   ops: ['UPDATE_ROLE'],  color: 'border-blue-500' },
  { label: 'Approvals',      ops: ['APPROVE_RECORD','APPROVE_RECORD_GROUP','APPROVE_EXCEPTION','FINALIZE_RECONCILIATION'], color: 'border-purple-500' },
  { label: 'Deletions',      ops: ['DELETE_USER','DELETE_RECONCILIATION'], color: 'border-red-500' },
  { label: 'Downloads',      ops: ['DOWNLOAD_REPORT','DOWNLOAD_ENRICHED_REPORT'], color: 'border-yellow-500' },
]

const AuditTrail = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    logActivity('/audit-trail', 'PAGE_VISIT_AUDIT_TRAIL')
    fetchAuditLogs()
  }, [limit])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/audit-logs?limit=${limit}`)
      setLogs(response.data.logs)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (logId) => setExpandedLog(expandedLog === logId ? null : logId)

  const uniqueOperations = [...new Set(logs.map(l => l.operation_type))].sort()

  const filteredLogs = logs.filter(log => {
    const matchOp = filter === 'all' || log.operation_type === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (log.username || '').toLowerCase().includes(q) ||
      (log.operation_type || '').toLowerCase().includes(q) ||
      (log.resource_type || '').toLowerCase().includes(q) ||
      String(log.resource_id || '').includes(q) ||
      (log.ip_address || '').includes(q)
    return matchOp && matchSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Audit Trail</h2>
          <p className="text-gray-600 mt-1">Every action across the system — who did what and when</p>
        </div>
        <button
          onClick={fetchAuditLogs}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 hover:from-[#CFB53B] hover:to-[#8E288D] transition-colors text-sm font-medium"
        >
          <FiRefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_GROUPS.map(g => (
          <div key={g.label} className={`bg-white rounded-xl shadow p-4 border-l-4 ${g.color}`}>
            <p className="text-xs text-gray-500 font-medium">{g.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {g.ops === null
                ? logs.length
                : logs.filter(l => g.ops.includes(l.operation_type)).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] relative">
            <FiSearch className="absolute left-3 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search user, operation, IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="h-4 w-4 text-gray-500" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
            >
              <option value="all">All Operations</option>
              {uniqueOperations.map(op => (
                <option key={op} value={op}>{getMeta(op).label}</option>
              ))}
            </select>
          </div>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
          >
            <option value="50">50 logs</option>
            <option value="100">100 logs</option>
            <option value="200">200 logs</option>
            <option value="500">500 logs</option>
            <option value="1000">1 000 logs</option>
          </select>
          <p className="text-sm text-gray-500 ml-auto">
            Showing <span className="font-semibold">{filteredLogs.length}</span> of <span className="font-semibold">{logs.length}</span>
          </p>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FiFileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map(log => {
              const meta = getMeta(log.operation_type)
              const Icon = meta.icon
              const isExpanded = expandedLog === log.id
              return (
                <div key={log.id} className="hover:bg-gray-50 transition-colors">
                  <div className="p-4 cursor-pointer" onClick={() => toggleExpand(log.id)}>
                    <div className="flex items-center gap-3">
                      {/* Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {meta.label}
                      </span>

                      {/* Who + resource */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap text-sm">
                          <FiUser className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-800">{log.username || `User #${log.user_id}`}</span>
                          {log.resource_type && log.resource_id != null && (
                            <span className="text-gray-500">
                              on <span className="font-medium text-gray-700">{log.resource_type} #{log.resource_id}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.ip_address && <span>IP: {log.ip_address}</span>}
                        </div>
                      </div>

                      {/* Expand toggle */}
                      {log.details && (
                        <div className="text-gray-400 flex-shrink-0">
                          {isExpanded ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
                        </div>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && log.details && (
                      <div className="mt-3 ml-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Details</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                          {Object.entries(log.details).map(([k, v]) => (
                            <div key={k} className="flex gap-1 text-xs">
                              <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                              <span className="text-gray-700 font-medium break-all">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <FiFileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Complete System Audit</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Every login, logout, file upload, reconciliation run, approval decision, download, and user-management action is automatically recorded with the user, timestamp, IP address, and full context.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuditTrail
