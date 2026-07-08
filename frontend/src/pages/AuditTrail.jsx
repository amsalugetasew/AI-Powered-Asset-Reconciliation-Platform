import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiFileText, FiUser, FiClock, FiChevronDown, FiChevronRight, FiFilter } from 'react-icons/fi'

const AuditTrail = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState(null)
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    fetchAuditLogs()
  }, [limit])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/audit-logs?limit=${limit}`)
      setLogs(response.data.logs)
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (logId) => {
    setExpandedLog(expandedLog === logId ? null : logId)
  }

  const getOperationColor = (operationType) => {
    const colors = {
      CREATE_USER: 'text-green-700 bg-green-100',
      UPDATE_ROLE: 'text-blue-700 bg-blue-100',
      DELETE_USER: 'text-red-700 bg-red-100',
      APPROVE_EXCEPTION: 'text-purple-700 bg-purple-100',
      FINALIZE_RECONCILIATION: 'text-indigo-700 bg-indigo-100',
      UPDATE_CONFIG: 'text-orange-700 bg-orange-100'
    }
    return colors[operationType] || 'text-gray-700 bg-gray-100'
  }

  const getOperationIcon = (operationType) => {
    return <FiFileText className="h-4 w-4" />
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.operation_type === filter)

  const uniqueOperations = [...new Set(logs.map(log => log.operation_type))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Audit Trail</h2>
          <p className="text-gray-600 mt-1">Track all privileged operations and system changes</p>
        </div>
        <button
          onClick={fetchAuditLogs}
          className="bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] px-4 py-2 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#8E288D]">
          <div className="text-gray-600 text-sm font-medium">Total Logs</div>
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-gray-600 text-sm font-medium">User Created</div>
          <div className="text-2xl font-bold text-gray-900">
            {logs.filter(l => l.operation_type === 'CREATE_USER').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-gray-600 text-sm font-medium">Role Updates</div>
          <div className="text-2xl font-bold text-gray-900">
            {logs.filter(l => l.operation_type === 'UPDATE_ROLE').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-gray-600 text-sm font-medium">Approvals</div>
          <div className="text-2xl font-bold text-gray-900">
            {logs.filter(l => l.operation_type === 'APPROVE_EXCEPTION').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FiFilter className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
          >
            <option value="all">All Operations</option>
            {uniqueOperations.map(op => (
              <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
            >
              <option value="50">50 logs</option>
              <option value="100">100 logs</option>
              <option value="200">200 logs</option>
              <option value="500">500 logs</option>
            </select>
          </div>
          <div className="text-sm text-gray-600 ml-auto">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FiFileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No audit logs found</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="hover:bg-gray-50 transition-colors">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Operation Badge */}
                      <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getOperationColor(log.operation_type)}`}>
                        {getOperationIcon(log.operation_type)}
                        {log.operation_type.replace(/_/g, ' ')}
                      </div>

                      {/* Log Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FiUser className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {log.username}
                          </span>
                          <span className="text-sm text-gray-500">
                            performed {log.operation_type.toLowerCase().replace(/_/g, ' ')}
                          </span>
                          {log.resource_type && (
                            <>
                              <span className="text-sm text-gray-500">on</span>
                              <span className="text-sm font-medium text-gray-700">
                                {log.resource_type} #{log.resource_id}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                          {log.ip_address && (
                            <div>IP: {log.ip_address}</div>
                          )}
                        </div>
                      </div>

                      {/* Expand Icon */}
                      <div className="text-gray-400">
                        {expandedLog === log.id ? (
                          <FiChevronDown className="h-5 w-5" />
                        ) : (
                          <FiChevronRight className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLog === log.id && log.details && (
                    <div className="mt-4 ml-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Operation Details:</h4>
                      <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <FiFileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">About Audit Trail</h3>
            <p className="text-sm text-blue-700">
              All privileged operations are automatically logged including user management, 
              role changes, approvals, and finalizations. Each log includes the user who 
              performed the action, timestamp, IP address, and detailed context.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuditTrail
