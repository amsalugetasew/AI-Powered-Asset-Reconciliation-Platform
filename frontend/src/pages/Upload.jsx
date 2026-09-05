import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiUploadCloud, FiFile, FiX, FiCheckCircle,
  FiRefreshCw, FiClock, FiEye, FiDatabase,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { logActivity } from '../services/activityService'

const REQUIRED_COLUMNS = {
  'old tag number': 'Old Tag Number',
  'old tag no.': 'Old Tag Number',
  'old_tag': 'Old Tag Number',
  'old tag no': 'Old Tag Number',
  'new tag number': 'New Tag Number',
  'new tag no.': 'New Tag Number',
  'new_tag': 'New Tag Number',
  'new tag no': 'New Tag Number',
  'description': 'Asset Description',
  'asset description': 'Asset Description',
  'asset_description': 'Asset Description',
  'desc': 'Asset Description',
  'department': 'Department/Branch',
  'department/branch': 'Department/Branch',
  'branch': 'Department/Branch',
  'unit': 'Department/Branch',
  'department/unit': 'Department/Branch',
  'district': 'Division/Districts',
  'division/districts': 'Division/Districts',
  'division/district': 'Division/Districts',
  'division': 'Division/Districts',
  'districts': 'Division/Districts',
}

const normalizeHeader = column => String(column).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const getMappedColumn = column => {
  const normalized = normalizeHeader(column)
  if (REQUIRED_COLUMNS[normalized]) return REQUIRED_COLUMNS[normalized]
  const words = new Set(normalized.split(' '))
  if (words.has('old') && words.has('tag')) return 'Old Tag Number'
  if (words.has('new') && words.has('tag')) return 'New Tag Number'
  if (['description', 'desc', 'details'].some(word => words.has(word))) return 'Asset Description'
  if (['department', 'branch', 'unit'].some(word => words.has(word))) return 'Department/Branch'
  if (['district', 'districts', 'division'].some(word => words.has(word))) return 'Division/Districts'
  return null
}

const getMissingColumns = (columns) => {
  const mapped = new Set(columns.map(getMappedColumn).filter(Boolean))
  return ['Old Tag Number', 'New Tag Number', 'Asset Description', 'Department/Branch', 'Division/Districts']
    .filter(column => !mapped.has(column))
}

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const map = {
    completed:      { label: 'Completed',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    processing:     { label: 'In Progress',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending:        { label: 'Pending Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    failed:         { label: 'Failed',         cls: 'bg-red-50 text-red-600 border-red-200' },
  }
  const s = map[status?.toLowerCase()] || { label: status || '—', cls: 'bg-gray-50 text-gray-500 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
const DropZone = ({ id, file, preview, onFileChange, onRemove, label, sublabel, hint, accent }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      const fakeEvent = { target: { files: [dropped] } }
      onFileChange(fakeEvent)
    }
  }

  const accentBorder = accent === 'purple' ? 'border-[#8E288D]/40' : 'border-emerald-400/50'
  const accentBg     = accent === 'purple' ? 'bg-purple-50/60'      : 'bg-emerald-50/60'
  const iconBg       = accent === 'purple' ? 'bg-[#8E288D]/10'      : 'bg-emerald-100'
  const iconColor    = accent === 'purple' ? 'text-[#8E288D]'        : 'text-emerald-600'
  const btnColor     = accent === 'purple'
    ? 'bg-[#8E288D] hover:bg-[#7A1E79] text-white'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white'

  return (
    <div className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${accentBg}`}>
      {/* Card header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <FiDatabase className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">{label}</p>
            <p className="text-xs text-gray-400">{sublabel}</p>
          </div>
        </div>
      </div>

      {/* Drop area */}
      <div className="px-5 pb-5">
        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center py-8 px-4 text-center
              ${dragging
                ? `${accentBorder} bg-white shadow-inner scale-[0.99]`
                : `border-gray-200 hover:${accentBorder} hover:bg-white`
              }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${iconBg}`}>
              <FiUploadCloud className={`h-6 w-6 ${iconColor}`} />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              Drag &amp; drop {label.toLowerCase()} file here
            </p>
            <p className="text-xs text-gray-400 mt-1">Supported formats: CSV, XLSX, XLS</p>
            <button
              type="button"
              className={`mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${btnColor}`}
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
            >
              <FiFile className="h-3.5 w-3.5" />
              Browse Files
            </button>
            <input ref={inputRef} id={id} type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <FiCheckCircle className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                {preview && (
                  <p className="text-xs text-gray-400">{preview.totalRecords.toLocaleString()} records · {preview.fileSize}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={onRemove}
              className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors">
              <FiX className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Expected columns hint */}
        <p className="text-[10px] text-gray-400 mt-2 text-center leading-relaxed">{hint}</p>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
const Upload = () => {
  const [customerFile,    setCustomerFile]    = useState(null)
  const [internalFile,    setInternalFile]    = useState(null)
  const [customerPreview, setCustomerPreview] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [customerValidationError, setCustomerValidationError] = useState(null)
  const [internalValidationError, setInternalValidationError] = useState(null)
  const [uploading,       setUploading]       = useState(false)
  const [processing,      setProcessing]      = useState(false)
  const [uploadComplete,  setUploadComplete]  = useState(false)
  const [reconciliationId, setReconciliationId] = useState(null)
  const [history,         setHistory]         = useState([])
  const navigate = useNavigate()

  // Fetch recent upload history on mount
  useEffect(() => {
    axios.get('/api/reconciliation/list')
      .then(res => setHistory((res.data.reconciliations || []).slice(0, 10)))
      .catch(() => {})
  }, [uploadComplete])

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0]
    if (!file) return
    const fileExtension = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension)) {
      toast.error('Please upload an Excel or CSV file (.xlsx, .xls, or .csv)')
      return
    }
    if (type === 'customer') {
      setCustomerFile(file)
      logActivity(window.location.pathname, 'UPLOAD_CUSTOMER_FILE')
      await previewFile(file, 'customer')
    } else {
      setInternalFile(file)
      logActivity(window.location.pathname, 'UPLOAD_FINANCE_FILE')
      await previewFile(file, 'internal')
    }
  }

  const previewFile = async (file, type) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      const headers = rows[0] || []
      const missingColumns = getMissingColumns(headers)
      if (missingColumns.length > 0) {
        const label = type === 'customer' ? 'Physical Inventory Count' : 'ERP Asset Register'
        const errorMessage = `${label} file is missing required column(s): ${missingColumns.join(', ')}`
        toast.error(errorMessage)
        if (type === 'customer') {
          setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(errorMessage)
        } else {
          setInternalFile(null); setInternalPreview(null); setInternalValidationError(errorMessage)
        }
        return
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      const preview = {
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(2) + ' KB',
        totalRecords: jsonData.length,
        columns: jsonData.length > 0 ? Object.keys(jsonData[0]).length : 0,
        sampleData: jsonData.slice(0, 3),
      }
      if (type === 'customer') setCustomerPreview(preview)
      else setInternalPreview(preview)
      if (type === 'customer') setCustomerValidationError(null)
      else setInternalValidationError(null)
      toast.success(`File loaded: ${jsonData.length} records found`)
    } catch {
      const errorMessage = "Failed to read file. Please ensure it's a valid Excel or CSV file."
      toast.error(errorMessage)
      if (type === 'customer') {
        setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(errorMessage)
      } else {
        setInternalFile(null); setInternalPreview(null); setInternalValidationError(errorMessage)
      }
    }
  }

  const removeFile = (type) => {
    if (type === 'customer') {
      setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(null)
    } else {
      setInternalFile(null); setInternalPreview(null); setInternalValidationError(null)
    }
  }

  const clearAll = () => {
    setCustomerFile(null); setInternalFile(null)
    setCustomerPreview(null); setInternalPreview(null)
    setCustomerValidationError(null); setInternalValidationError(null)
    setUploadComplete(false); setReconciliationId(null)
    toast.info('All data cleared')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customerFile || !internalFile) { toast.error('Please upload both files'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('customer_file', customerFile)
      formData.append('internal_file', internalFile)
      const uploadResponse = await axios.post('/api/reconciliation/upload', formData)
      const recId = uploadResponse.data.reconciliation_id
      setReconciliationId(recId)
      setUploadComplete(true)
      toast.success('Files uploaded successfully!')
      logActivity(window.location.pathname, `START_RECONCILIATION_ID_${recId}`)
      setUploading(false)
      setProcessing(true)
      await axios.post(`/api/reconciliation/process/${recId}`)
      toast.success('Reconciliation completed!')
      navigate(`/results/${recId}`)
    } catch (error) {
      const validationErrors = error.response?.data?.validation_errors
      const message = validationErrors?.length
        ? validationErrors.join(' | ')
        : error.response?.data?.error || 'Upload failed'
      toast.error(message)
      if (validationErrors?.length) {
        const internalError = validationErrors.find(message => message.startsWith('ERP Asset Register'))
        const customerError = validationErrors.find(message => message.startsWith('Physical Inventory Count'))
        if (internalError) setInternalValidationError(internalError)
        if (customerError) setCustomerValidationError(customerError)
      }
      setUploading(false); setProcessing(false); setUploadComplete(false)
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const shortName = (path) => {
    if (!path) return '—'
    const parts = path.split(/[/\\]/)
    return parts[parts.length - 1]
  }

  const jobId = (r) => `AR-${String(r.id).padStart(4, '0')}`

  return (
    <div className="space-y-6 pb-10">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <span className="font-semibold text-[#8E288D]">Upload &amp; Reconcile</span>
          <span>›</span>
          <span>Reconcile your Assets</span>
        </div>
        <p className="text-sm text-gray-500">
          Import asset registry files, validate data structure, and trigger AI-powered reconciliation across branches.
        </p>
      </div>

      {/* ── Upload cards ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ERP */}
          <DropZone
            id="internal-file"
            file={internalFile}
            preview={internalPreview}
            onFileChange={e => handleFileChange(e, 'internal')}
            onRemove={() => removeFile('internal')}
            label="ERP Asset Register"
            sublabel="Upload the fixed asset register exported from the core banking system"
            hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts"
            accent="purple"
          />
          {/* Physical */}
          <DropZone
            id="customer-file"
            file={customerFile}
            preview={customerPreview}
            onFileChange={e => handleFileChange(e, 'customer')}
            onRemove={() => removeFile('customer')}
            label="Physical Inventory Count"
            sublabel="Upload the physical asset count conducted"
            hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts"
            accent="green"
          />
        </div>

        {/* Action row */}
        <div className="mt-5 flex items-center justify-between gap-4">
          {(customerFile || internalFile) && (
            <button type="button" onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <FiRefreshCw className="h-4 w-4" />
              Clear All
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {/* File readiness indicator */}
            {(customerFile || internalFile) && (
              <div className="flex items-center gap-3 text-xs">
                <span className={`flex items-center gap-1 ${internalFile ? 'text-[#8E288D]' : 'text-gray-300'}`}>
                  <FiCheckCircle className="h-3.5 w-3.5" /> ERP
                </span>
                <span className={`flex items-center gap-1 ${customerFile ? 'text-emerald-600' : 'text-gray-300'}`}>
                  <FiCheckCircle className="h-3.5 w-3.5" /> Physical
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={!customerFile || !internalFile || uploading || processing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white
                bg-[#8E288D] hover:bg-[#7A1E79] disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors shadow-sm"
            >
              {uploading ? (
                <><FiRefreshCw className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : processing ? (
                <><FiRefreshCw className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><FiUploadCloud className="h-4 w-4" /> Start Reconciliation</>
              )}
            </button>
          </div>
        </div>

        {processing && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Processing reconciliation… This may take a few minutes.
          </p>
        )}
      </form>

      {/* ── File preview (when both files loaded, before submit) ────────── */}
      {(customerPreview || internalPreview || customerValidationError || internalValidationError) && !uploadComplete && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'ERP File',      preview: internalPreview,  error: internalValidationError,  color: 'text-[#8E288D]',  bg: 'bg-purple-50' },
            { label: 'Physical File', preview: customerPreview, error: customerValidationError, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, preview, error, color, bg }) => (preview || error) && (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <FiCheckCircle className={`h-4 w-4 ${error ? 'text-red-500' : color}`} />
                <span className="text-sm font-bold text-gray-800">{label}</span>
                {preview && !error && (
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${color}`}>
                    {preview.totalRecords.toLocaleString()} records
                  </span>
                )}
              </div>
              {error ? (
                <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs font-medium leading-relaxed text-red-600">
                  {error}
                </p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {[
                    ['File', preview.fileName],
                    ['Size', preview.fileSize],
                    ['Columns', preview.columns],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium text-gray-800 truncate max-w-[180px]">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Upload History ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <FiClock className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-800">Recent Upload History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Job ID', 'Date & Time', 'ERP File', 'Physical Count File', 'Records', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    No upload history yet. Upload files above to get started.
                  </td>
                </tr>
              ) : history.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-bold text-[#8E288D] whitespace-nowrap">
                    {jobId(r)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 max-w-[180px] truncate" title={shortName(r.internal_file)}>
                    {shortName(r.internal_file)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 max-w-[180px] truncate" title={shortName(r.customer_file)}>
                    {shortName(r.customer_file)}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-gray-800 whitespace-nowrap">
                    {((r.statistics?.total_internal_records || r.total_internal_records || 0) +
                      (r.statistics?.total_customer_records || r.total_customer_records || 0)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => navigate(`/results/${r.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E288D] hover:text-[#7A1E79] transition-colors"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default Upload
