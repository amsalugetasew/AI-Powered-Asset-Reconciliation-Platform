import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { logActivity } from '../services/activityService'
import {
  FiActivity, FiAlertTriangle, FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiDownload, FiFilter, FiSearch, FiSettings, FiUpload, FiUser,
} from 'react-icons/fi'

const OP_META = {
  USER_LOGIN: { label: 'User Login', module: 'Authentication', icon: FiUser },
  USER_LOGOUT: { label: 'User Logout', module: 'Authentication', icon: FiUser },
  USER_REGISTER: { label: 'User Register', module: 'User Management', icon: FiUser },
  LOGIN_FAILED: { label: 'Failed Authentication', module: 'Authentication', icon: FiAlertTriangle },
  CREATE_USER: { label: 'Create User', module: 'User Management', icon: FiUser },
  UPDATE_ROLE: { label: 'Update Settings', module: 'User Management', icon: FiSettings },
  DELETE_USER: { label: 'Delete User', module: 'User Management', icon: FiAlertTriangle },
  UPLOAD_FILES: { label: 'Data Upload', module: 'Reconciliation', icon: FiUpload },
  PROCESS_RECONCILIATION: { label: 'Auto-Reconcile', module: 'Engine', icon: FiActivity },
  DELETE_RECONCILIATION: { label: 'Delete Reconciliation', module: 'Reconciliation', icon: FiAlertTriangle },
  DOWNLOAD_REPORT: { label: 'Export Report', module: 'Reports', icon: FiDownload },
  DOWNLOAD_ENRICHED_REPORT: { label: 'Export Report', module: 'Reports', icon: FiDownload },
  APPROVE_RECORD: { label: 'Approve Assets', module: 'Approval', icon: FiActivity },
  APPROVE_RECORD_GROUP: { label: 'Bulk Approval', module: 'Approval', icon: FiActivity },
  APPROVE_EXCEPTION: { label: 'Approve Exception', module: 'Approval', icon: FiActivity },
  FINALIZE_RECONCILIATION: { label: 'Finalize Reconciliation', module: 'Reconciliation', icon: FiActivity },
}

const getMeta = operation => OP_META[operation] || {
  label: operation?.replace(/_/g, ' ') || 'System Event',
  module: 'System',
  icon: FiActivity,
}

const getStatus = operation => operation === 'LOGIN_FAILED' ? 'Failed' : operation === 'PROCESS_RECONCILIATION' ? 'Running' : 'Success'

const statusClasses = {
  Success: 'text-[#10B981]',
  Running: 'text-blue-600',
  Failed: 'text-red-600',
}



const LOGS_PER_PAGE = 5
const DATE_RANGES = [1, 2, 5, 7, 14, 20, 30, 60, 90]

const getPaginationItems = (totalPages, currentPage) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)

  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
  if (currentPage >= totalPages - 2) return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]

  return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
}

const AuditTrail = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)
  const [dateRange, setDateRange] = useState(7)
  const [page, setPage] = useState(1)

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/audit-logs?limit=${limit}`)
      setLogs(response.data.logs || [])
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    logActivity('/audit-trail', 'PAGE_VISIT_AUDIT_TRAIL')
    fetchAuditLogs()
  }, [limit])

  const uniqueOperations = useMemo(() => [...new Set(logs.map(log => log.operation_type))].sort(), [logs])
  const filteredLogs = useMemo(() => {
    const query = search.toLowerCase()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRange)
    return logs.filter(log => {
      const searchable = [log.full_name, log.username, log.operation_type, log.resource_type, log.resource_id, log.ip_address].join(' ').toLowerCase()
      return new Date(log.timestamp) >= startDate &&
        (filter === 'all' || log.operation_type === filter) &&
        (!query || searchable.includes(query))
    })
  }, [dateRange, filter, logs, search])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginatedLogs = filteredLogs.slice((safePage - 1) * LOGS_PER_PAGE, safePage * LOGS_PER_PAGE)
  const paginationItems = getPaginationItems(totalPages, safePage)

  useEffect(() => {
    setPage(1)
  }, [dateRange, filter, search])

  const exportLogs = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Details', 'IP Address', 'Status']
    const rows = filteredLogs.map(log => {
      const meta = getMeta(log.operation_type)
      return [new Date(log.timestamp).toLocaleString(), log.full_name ? `${log.full_name} (${log.username || `User #${log.user_id}`})` : (log.username || `User #${log.user_id}`), meta.label, meta.module, Object.values(log.details || {}).join('; '), log.ip_address || 'Unknown', getStatus(log.operation_type)]
    })
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'audit-trail.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const totalEvents = logs.length
  const userActions = logs.filter(log => !['PROCESS_RECONCILIATION'].includes(log.operation_type)).length
  const systemEvents = logs.filter(log => log.operation_type === 'PROCESS_RECONCILIATION').length
  const flaggedItems = logs.filter(log => getStatus(log.operation_type) === 'Failed').length
  const todayEvents = logs.filter(log => {
    const timestamp = new Date(log.timestamp)
    const today = new Date()
    return timestamp.toDateString() === today.toDateString()
  }).length

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#8E288D]" /></div>

  return (
    <div className="min-w-0 space-y-5 bg-[#f7f9fc] pb-10">
      <p className="text-lg text-slate-500">Track all system activities and user actions across the platform</p>

      <div className="grid w-full grid-cols-1 gap-4 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Events',
            value: totalEvents.toLocaleString(),
            note: `${todayEvents.toLocaleString()} events today`,
            icon: <FiActivity />,
            color: '#8E288D'
          },
          {
            label: 'User Actions',
            value: `${userActions.toLocaleString()} Logged`,
            note: `${new Set(logs.map(log => log.user_id)).size} unique users`,
            icon: <FiUser />,
            color: '#CFB53B'
          },
          {
            label: 'System Events',
            value: `${systemEvents.toLocaleString()} Automated`,
            note: 'No failure alerts',
            icon: <FiSettings />,
            color: '#10B981'
          },
          {
            label: 'Flagged Items',
            value: `${flaggedItems.toLocaleString()} critical`,
            note: flaggedItems ? 'Requires security review' : 'No security alerts',
            icon: <FiAlertTriangle />,
            color: '#DC2626'
          },
        ].map(card => (
          <div
            key={card.label}
            className="w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >

            {/* KPI Label + Icon */}
            <div
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold uppercase"
              style={{
                color: card.color,
                backgroundColor: `${card.color}10`,
              }}
            >
              <span className="text-sm">
                {card.icon}
              </span>

              {card.label}
            </div>

            {/* KPI Value */}
            <div
              className="mt-4 text-3xl font-extrabold"
              style={{ color: card.color }}
            >
              {card.value}
            </div>

            {/* KPI Note */}
            <div
              className="mt-4 text-right text-xs font-bold"
              style={{ color: card.color }}
            >
              {card.note}
            </div>

          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 lg:grid-cols-5">

        {/* Search */}
        <div className="relative min-w-0 lg:col-span-2">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by keyword, user, IP ..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#8E288D] focus:ring-1 focus:ring-[#8E288D]"
          />
        </div>

        {/* Date Range */}
        <label className="relative flex items-center gap-2">
          <FiCalendar className="absolute left-3 z-10 text-slate-500" />

          <select
            value={dateRange}
            onChange={event => setDateRange(Number(event.target.value))}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#8E288D] focus:ring-1 focus:ring-[#8E288D]"
          >
            <option value={1}>Last 1 Day</option>

            {DATE_RANGES.slice(1).map(days => (
              <option key={days} value={days}>
                Last {days} Days
              </option>
            ))}
          </select>

          <FiChevronDown className="pointer-events-none absolute right-3 text-slate-500" />
        </label>

        {/* Event Type */}
        <label className="relative flex items-center gap-2">
          <FiFilter className="absolute left-3 z-10 text-slate-500" />

          <select
            value={filter}
            onChange={event => setFilter(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#8E288D] focus:ring-1 focus:ring-[#8E288D]"
          >
            <option value="all">All Event Types</option>

            {uniqueOperations.map(operation => (
              <option key={operation} value={operation}>
                {getMeta(operation).label}
              </option>
            ))}
          </select>

          <FiChevronDown className="pointer-events-none absolute right-3 text-slate-500" />
        </label>

        {/* Export */}
        <button
          type="button"
          onClick={exportLogs}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#972b91] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#7d2278]"
        >
          <FiDownload />
          Export Logs
        </button>

      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filteredLogs.length === 0 ?
          <div className="p-12 text-center text-slate-500">
            <FiActivity className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium">No audit logs found</p>
            <p className="mt-1 text-sm">Try adjusting your filters or search</p>
          </div> :
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-center">
              <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-[#8E288D] text-center">
                <tr>
                  {['Timestamp', 'User', 'Action', 'Module', 'Details', 'IP Address', 'Status'].map(header => 
                  <th key={header} className="border-b border-slate-200 px-4 py-3 font-bold">{header}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map(log => { const meta = getMeta(log.operation_type); 
                const Icon = meta.icon; const status = getStatus(log.operation_type);
                const expanded = expandedLog === log.id; 
                return <React.Fragment key={log.id}>
                <tr onClick={() => setExpandedLog(expanded ? null : log.id)} className="cursor-pointer transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-700">
                    <div>{log.full_name || 'Name unavailable'}</div>
                    <div className="text-xs font-normal text-slate-400">
                      User Name: <span className='text-[#8E288D] text-sm'>{log.username || `User #${log.user_id}`}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#8E288D]" />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {meta.module}
                  </td>
                  <td className="max-w-[360px] truncate px-4 py-3 text-sm text-slate-600">
                    {Object.values(log.details || {}).join('; ') || `${meta.label} recorded`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {log.ip_address || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>
                      {status}
                    </span>
                  </td>
                </tr>
                {expanded && 
                <tr className="bg-slate-50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      {Object.entries(log.details || {}).map(([key, value]) => 
                      <div key={key}>
                        <span className="text-slate-400">{key.replace(/_/g, ' ')}: 
                        </span>
                        <span className="font-semibold">
                          {String(value)}
                        </span>
                      </div>)}
                    </div>
                  </td>
                </tr>}</React.Fragment> })}
              </tbody>
            </table>
          </div>}
        {filteredLogs.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3"><span className="text-xs text-gray-500">Showing {(safePage - 1) * LOGS_PER_PAGE + 1}–{Math.min(safePage * LOGS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} logs</span><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Logs <select value={limit} onChange={event => setLimit(Number(event.target.value))} className="appearance-none rounded-lg border border-[#972b91] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-[#7d2278] focus:border-[#8E288D] focus:ring-1 focus:ring-[#8E288D]"><option value="50">50 logs</option><option value="100">100 logs</option><option value="200">200 logs</option><option value="500">500 logs</option><option value="1000">1 000 logs</option></select></label><div className="flex items-center gap-1"><button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={safePage === 1} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><FiChevronLeft className="h-3.5 w-3.5" /></button>{paginationItems.map((item, index) => item === 'ellipsis-left' || item === 'ellipsis-right' ? <span key={`${item}-${index}`} className="flex h-7 w-5 items-center justify-center text-xs text-gray-400">...</span> : <button key={item} onClick={() => setPage(item)} aria-current={item === safePage ? 'page' : undefined} className={`h-7 w-7 rounded-lg border text-xs font-semibold transition ${item === safePage ? 'border-[#8E288D] bg-[#8E288D] text-white' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>{item}</button>)}<button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><FiChevronRight className="h-3.5 w-3.5" /></button></div></div></div>}
      </div>
    </div>
  )
}

export default AuditTrail
