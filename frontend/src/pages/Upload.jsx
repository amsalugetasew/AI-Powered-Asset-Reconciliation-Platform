import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiCheckCircle, FiClock, FiDatabase, FiEye, FiFile, FiFileText,
  FiPlay, FiRefreshCw, FiUploadCloud, FiX,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { logActivity } from '../services/activityService'
import { cachedGet, clearCachedGets } from '../services/cachedGet'

const REQUIRED_COLUMNS = {
  'old tag number': 'Old Tag Number', 'old tag no.': 'Old Tag Number', old_tag: 'Old Tag Number', 'old tag no': 'Old Tag Number',
  'new tag number': 'New Tag Number', 'new tag no.': 'New Tag Number', new_tag: 'New Tag Number', 'new tag no': 'New Tag Number',
  description: 'Asset Description', 'asset description': 'Asset Description', asset_description: 'Asset Description', desc: 'Asset Description',
  department: 'Department/Branch', 'department/branch': 'Department/Branch', branch: 'Department/Branch', unit: 'Department/Branch', 'department/unit': 'Department/Branch',
  district: 'Division/Districts', 'division/districts': 'Division/Districts', 'division/district': 'Division/Districts', division: 'Division/Districts', districts: 'Division/Districts',
}
const REQUIRED_LABELS = ['Old Tag Number', 'New Tag Number', 'Asset Description', 'Department/Branch', 'Division/Districts']
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

const getMissingColumns = columns => {
  const mapped = new Set(columns.map(getMappedColumn).filter(Boolean))
  return REQUIRED_LABELS.filter(column => !mapped.has(column))
}

const StatusPill = ({ status }) => {
  const styles = { completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', processing: 'bg-blue-50 text-blue-700 border-blue-200', pending: 'bg-amber-50 text-[#6B7280] border-amber-200', failed: 'bg-red-50 text-red-600 border-red-200' }
  const normalized = status?.toLowerCase()
  const label = { completed: 'Completed', processing: 'In Progress', pending: 'Pending Review', failed: 'Failed' }[normalized] || status || '—'
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[normalized] || 'border-gray-200 bg-gray-50 text-gray-500'}`}>{label}</span>
}

const DropZone = ({ id, file, preview, onFileChange, onRemove, label, sublabel, hint, accent }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()
  const isPurple = accent === 'purple'
  const iconColor = isPurple ? 'text-[#8E288D]' : 'text-emerald-600'
  const iconBackground = isPurple ? 'bg-[#8E288D]/10' : 'bg-emerald-100'
  const buttonColor = isPurple ? 'bg-[#8E288D] hover:bg-[#7A1E79]' : 'bg-emerald-600 hover:bg-emerald-700'
  const handleDrop = event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) onFileChange({ target: { files: [file] } }) }

  return <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="px-5 pb-3 pt-5"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBackground}`}><FiDatabase className={`h-4 w-4 ${iconColor}`} /></div><div><p className="text-sm font-bold text-gray-800">{label}</p><p className="text-xs text-gray-400">{sublabel}</p></div></div></div><div className="px-5 pb-5">{!file ? <div onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all ${dragging ? 'border-[#8E288D] bg-white shadow-inner' : 'border-gray-200 hover:bg-gray-50'}`}><div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${iconBackground}`}><FiUploadCloud className={`h-6 w-6 ${iconColor}`} /></div><p className="text-sm font-semibold text-gray-700">Drag &amp; drop {label.toLowerCase()} file here</p><p className="mt-1 text-xs text-gray-400">Supported formats: CSV, XLSX, XLS</p><button type="button" className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors ${buttonColor}`} onClick={event => { event.stopPropagation(); inputRef.current?.click() }}><FiFile className="h-3.5 w-3.5" />Browse Files</button><input ref={inputRef} id={id} type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={onFileChange} /></div> : <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconBackground}`}><FiCheckCircle className={`h-4 w-4 ${iconColor}`} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{file.name}</p>{preview && <p className="text-xs text-gray-400">{preview.totalRecords.toLocaleString()} records · {preview.fileSize}</p>}</div></div><button type="button" onClick={onRemove} className="flex-shrink-0 text-gray-400 transition-colors hover:text-red-500"><FiX className="h-4 w-4" /></button></div>}<p className="mt-2 text-center text-[10px] leading-relaxed text-gray-400">{hint}</p></div></div>
}

const UploadedFileCard = ({ file, preview, error, label, accent, onRemove }) => {
  const isPurple = accent === 'purple'
  const accentText = isPurple ? 'text-[#8E288D]' : 'text-emerald-600'
  const accentBorder = isPurple ? 'border-[#ead5eb]' : 'border-[#ccefe4]'
  const accentBackground = isPurple ? 'bg-[#fcf8fd]' : 'bg-[#f7fffc]'
  return <div className={`rounded-xl border ${accentBorder} ${accentBackground} px-4 py-3.5`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white ${accentText} shadow-sm`}><FiFileText className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-700">{file?.name || `${label} file`}</p>{preview && !error && <p className="mt-1 text-xs text-slate-400">{preview.fileSize} · {preview.totalRecords.toLocaleString()} records · Uploaded just now</p>}<span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${error ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{error ? 'Needs attention' : 'Validated'}</span>{error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}</div></div><button type="button" onClick={onRemove} aria-label={`Remove ${label} file`} className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white ${accentText} shadow-sm transition-colors hover:bg-red-50 hover:text-red-500`}><FiX className="h-4 w-4" /></button></div></div>
}

const SummaryCard = ({ label, value, caption, icon, accent, ready }) => {
  const styles = { purple: { background: 'bg-[#fbfaff]', text: 'text-[#8E288D]', badge: 'bg-[#e9d5eb] text-[#8E288D]' }, amber: { background: 'bg-[#fffdf5]', text: 'text-amber-500', badge: 'bg-amber-100 text-amber-600' }, green: { background: 'bg-[#f5fffb]', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-600' } }
  const style = styles[accent]
  return <div className={`relative min-h-[142px] overflow-hidden rounded-2xl border border-slate-100 ${style.background} p-4 shadow-sm`}><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500"><span className={`flex h-5 w-5 items-center justify-center rounded-md bg-white ${style.text} shadow-sm`}>{icon}</span>{label}</div><div className={`mt-4 text-3xl font-extrabold tracking-tight ${style.text}`}>{ready ? <FiCheckCircle className="h-8 w-8" /> : value || '—'}</div><div className="absolute bottom-4 left-4 text-xs text-slate-400">{caption}</div><span className={`absolute bottom-4 right-4 rounded-md px-2 py-1 text-[10px] font-bold ${style.badge}`}>{ready ? 'Ready' : 'Awaiting file'}</span></div>
}

const DataPreviewCard = ({ title, preview, accent }) => {
  const rows = preview?.sampleData || []
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 6) : []
  const color = accent === 'purple' ? 'text-[#8E288D]' : 'text-emerald-600'
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="mb-3 px-1 text-sm font-bold text-slate-700">{title} (First 3 Rows)</h3>{rows.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><div className="overflow-x-auto"><table className="min-w-full table-fixed text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500"><tr>{columns.map(column => <th key={column} className="max-w-[150px] px-3 py-2 font-bold">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{rows.map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-slate-50">{columns.map(column => <td key={column} className={`max-w-[150px] truncate px-3 py-3 font-medium ${color}`} title={String(row[column] ?? '')}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div></div> : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">No preview rows available</div>}</div>
}

const Upload = () => {
  const [customerFile, setCustomerFile] = useState(null)
  const [internalFile, setInternalFile] = useState(null)
  const [customerPreview, setCustomerPreview] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [customerValidationError, setCustomerValidationError] = useState(null)
  const [internalValidationError, setInternalValidationError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [reconciliationId, setReconciliationId] = useState(null)
  const [allHistory, setAllHistory] = useState([])
  const [historyPage, setHistoryPage] = useState(1)
  const navigate = useNavigate()

  const HISTORY_PAGE_SIZE = 5

  useEffect(() => {
    cachedGet('/api/reconciliation/list')
      .then(response => {
        setAllHistory(response.data.reconciliations || [])
        setHistoryPage(1)
      })
      .catch(() => {})
  }, [uploadComplete])

  const historyPageCount = Math.max(1, Math.ceil(allHistory.length / HISTORY_PAGE_SIZE))
  const paginatedHistory = allHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  )
  const history = paginatedHistory

  const previewFile = async (file, type) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      const missingColumns = getMissingColumns(rows[0] || [])
      if (missingColumns.length) {
        const label = type === 'customer' ? 'Physical Inventory Count' : 'ERP Asset Register'
        const errorMessage = `${label} file is missing required column(s): ${missingColumns.join(', ')}`
        toast.error(errorMessage)
        if (type === 'customer') { setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(errorMessage) } else { setInternalFile(null); setInternalPreview(null); setInternalValidationError(errorMessage) }
        return
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      const preview = { fileName: file.name, fileSize: (file.size / 1024).toFixed(2) + ' KB', totalRecords: jsonData.length, columns: jsonData.length ? Object.keys(jsonData[0]).length : 0, sampleData: jsonData.slice(0, 3) }
      if (type === 'customer') { setCustomerPreview(preview); setCustomerValidationError(null) } else { setInternalPreview(preview); setInternalValidationError(null) }
      toast.success(`File loaded: ${jsonData.length} records found`)
    } catch {
      const errorMessage = "Failed to read file. Please ensure it's a valid Excel or CSV file."
      toast.error(errorMessage)
      if (type === 'customer') { setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(errorMessage) } else { setInternalFile(null); setInternalPreview(null); setInternalValidationError(errorMessage) }
    }
  }

  const handleFileChange = async (event, type) => {
    const file = event.target.files[0]
    if (!file) return
    if (!['xlsx', 'xls', 'csv'].includes(file.name.split('.').pop().toLowerCase())) { toast.error('Please upload an Excel or CSV file (.xlsx, .xls, or .csv)'); return }
    if (type === 'customer') { setCustomerFile(file); logActivity(window.location.pathname, 'UPLOAD_CUSTOMER_FILE'); await previewFile(file, type) } else { setInternalFile(file); logActivity(window.location.pathname, 'UPLOAD_FINANCE_FILE'); await previewFile(file, type) }
  }

  const removeFile = type => { if (type === 'customer') { setCustomerFile(null); setCustomerPreview(null); setCustomerValidationError(null) } else { setInternalFile(null); setInternalPreview(null); setInternalValidationError(null) } }
  const clearAll = () => { setCustomerFile(null); setInternalFile(null); setCustomerPreview(null); setInternalPreview(null); setCustomerValidationError(null); setInternalValidationError(null); setUploadComplete(false); setReconciliationId(null); toast.info('All data cleared') }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!customerFile || !internalFile) { toast.error('Please upload both files'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('customer_file', customerFile)
      formData.append('internal_file', internalFile)
      const response = await axios.post('/api/reconciliation/upload', formData)
      const reconciliation = response.data.reconciliation_id
      clearCachedGets()
      setReconciliationId(reconciliation); setUploadComplete(true); toast.success('Files uploaded successfully!'); logActivity(window.location.pathname, `START_RECONCILIATION_ID_${reconciliation}`); setUploading(false); setProcessing(true)
      await axios.post(`/api/reconciliation/process/${reconciliation}`)
      clearCachedGets()
      toast.success('Reconciliation completed!'); navigate(`/results/${reconciliation}`)
    } catch (error) {
      const validationErrors = error.response?.data?.validation_errors
      const message = validationErrors?.length ? validationErrors.join(' | ') : error.response?.data?.error || 'Upload failed'
      toast.error(message)
      if (validationErrors?.length) { const internalError = validationErrors.find(item => item.startsWith('ERP Asset Register')); const customerError = validationErrors.find(item => item.startsWith('Physical Inventory Count')); if (internalError) setInternalValidationError(internalError); if (customerError) setCustomerValidationError(customerError) }
      setUploading(false); setProcessing(false); setUploadComplete(false)
    }
  }

  const formatDate = value => {
    if (!value) return '—'
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    const date = new Date(hasTimezone ? value : `${value}Z`)
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const shortName = path => path ? path.split(/[/\\]/).pop() : '—'
  const hasUploadedFiles = Boolean(customerFile || internalFile)
  const totalRecords = (customerPreview?.totalRecords || 0) + (internalPreview?.totalRecords || 0)

  return <div className="space-y-5 pb-10">
    {!hasUploadedFiles ? <>
      <div><div className="mb-1 flex items-center gap-2 text-sm text-gray-400"><span className="font-semibold text-[#8E288D]">Upload &amp; Reconcile</span><span>›</span><span>Reconcile your Assets</span></div>
      {/* <p className="text-sm text-gray-500">Import asset registry files, validate data structure, and trigger AI-powered reconciliation across branches.</p> */}
      </div>
      <form onSubmit={handleSubmit}><div className="grid grid-cols-1 gap-5 md:grid-cols-2"><DropZone id="internal-file" file={internalFile} preview={internalPreview} onFileChange={event => handleFileChange(event, 'internal')} onRemove={() => removeFile('internal')} label="ERP Asset Register" sublabel="Upload the fixed asset register exported from the ERP" hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts" accent="purple" /><DropZone id="customer-file" file={customerFile} preview={customerPreview} onFileChange={event => handleFileChange(event, 'customer')} onRemove={() => removeFile('customer')} label="Physical Inventory Count" sublabel="Upload the physical asset count conducted" hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts" accent="green" /></div></form>
      {(customerValidationError || internalValidationError) && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{internalValidationError && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs leading-relaxed text-red-600">{internalValidationError}</p>}{customerValidationError && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs leading-relaxed text-red-600">{customerValidationError}</p>}
      </div>}
    </> : <form onSubmit={handleSubmit} className="space-y-5">
      <section><h1 className="mb-3 text-xl font-extrabold text-slate-800">Uploaded Files</h1><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{internalFile ? <UploadedFileCard file={internalFile} preview={internalPreview} error={internalValidationError} label="ERP" accent="purple" onRemove={() => removeFile('internal')} /> : <DropZone id="internal-file" file={internalFile} preview={internalPreview} onFileChange={event => handleFileChange(event, 'internal')} onRemove={() => removeFile('internal')} label="ERP Asset Register" sublabel="Upload the fixed asset register exported from the core banking system" hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts" accent="purple" />}{customerFile ? <UploadedFileCard file={customerFile} preview={customerPreview} error={customerValidationError} label="Physical" accent="green" onRemove={() => removeFile('customer')} /> : <DropZone id="customer-file" file={customerFile} preview={customerPreview} onFileChange={event => handleFileChange(event, 'customer')} onRemove={() => removeFile('customer')} label="Physical Inventory Count" sublabel="Upload the physical asset count conducted" hint="Required columns: Old Tag Number, New Tag Number, Asset Description, Department/Branch, Division/Districts" accent="green" />}</div></section>
      <section><h2 className="mb-3 text-sm font-bold text-slate-700">Quick Summary</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><SummaryCard label="ERP Records" value={(internalPreview?.totalRecords || 0).toLocaleString()} caption="of Total ERP Assets" accent="purple" icon={<FiDatabase className="h-3.5 w-3.5" />} /><SummaryCard label="Physical Records" value={(customerPreview?.totalRecords || 0).toLocaleString()} caption="of Total Physical Count" accent="amber" icon={<FiUploadCloud className="h-3.5 w-3.5" />} /><SummaryCard label="Ready to Process" caption="Both Files Validated" accent="green" icon={<FiCheckCircle className="h-3.5 w-3.5" />} ready={Boolean(internalFile && customerFile && internalPreview && customerPreview && !internalValidationError && !customerValidationError)} /></div></section>
      {(internalPreview || customerPreview) && <section><h2 className="mb-3 text-sm font-bold text-slate-700">Data Preview</h2><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{internalPreview && <DataPreviewCard title="ERP Data Preview" preview={internalPreview} accent="purple" />}{customerPreview && <DataPreviewCard title="Physical Count Preview" preview={customerPreview} accent="green" />}</div></section>}
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row"><div className="text-xs text-slate-500"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${internalFile && customerFile ? 'bg-emerald-500' : 'bg-amber-400'}`} />{internalFile && customerFile ? '2 files uploaded' : '1 file uploaded'} · {totalRecords.toLocaleString()} total records · {internalFile && customerFile ? 'Ready for reconciliation' : 'Upload the second file to continue'}</div><div className="flex items-center gap-3"><button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-500"><FiRefreshCw className="h-3.5 w-3.5" />Clear All</button><button type="submit" disabled={!customerFile || !internalFile || uploading || processing} className="inline-flex items-center gap-2 rounded-xl bg-[#972b91] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#7d2278] disabled:cursor-not-allowed disabled:opacity-50">{uploading || processing ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiPlay className="h-4 w-4" />}{uploading ? 'Uploading…' : processing ? 'Processing…' : 'Start Reconciliation'}</button></div></div>
      {processing && <p className="text-center text-xs text-gray-400">Processing reconciliation… This may take a few minutes.</p>}
    </form>}

    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-gray-50 px-5 py-4"><FiClock className="h-4 w-4 text-gray-400" /><h2 className="text-sm font-bold text-gray-800">Recent Upload History</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-50">
            {['Job ID', 'Date & Time', 'ERP File', 'Physical Count File', 'Records', 'Status', 'Actions'].map(header => 
            <th key={header} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#8E288D]">
              {header}
            </th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{history.length === 0 ? 
          <tr>
            <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">No upload history yet. Upload files above to get started.</td>
          </tr> : history.map(record => 
          <tr key={record.id} className="transition-colors hover:bg-gray-50/60">
            <td className="px-5 py-3.5 text-xs font-bold text-[#8E288D]">AR-{String(record.id).padStart(4, '0')}</td>
            <td className="whitespace-nowrap px-5 py-3.5 text-xs text-gray-500">{formatDate(record.created_at)}</td>
            <td className="max-w-[180px] truncate px-5 py-3.5 text-xs text-gray-700" title={shortName(record.internal_file)}>{shortName(record.internal_file)}</td>
            <td className="max-w-[180px] truncate px-5 py-3.5 text-xs text-gray-700" title={shortName(record.customer_file)}>{shortName(record.customer_file)}</td>
            <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-gray-800">{((record.statistics?.total_internal_records || record.total_internal_records || 0) + (record.statistics?.total_customer_records || record.total_customer_records || 0)).toLocaleString()}</td>
            <td className="px-5 py-3.5"><StatusPill status={record.status} /></td>
            <td className="px-5 py-3.5"><button onClick={() => navigate(`/results/${record.id}`)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E288D] hover:text-[#7A1E79]"><FiEye className="h-3.5 w-3.5" />View</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>
    {historyPageCount > 1 && (
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 text-xs text-gray-500">
        <span>Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, allHistory.length)} of {allHistory.length} uploads</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setHistoryPage(page => Math.max(1, page - 1))} disabled={historyPage === 1}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">Previous</button>
          <span className="px-2 font-semibold">{historyPage} / {historyPageCount}</span>
          <button type="button" onClick={() => setHistoryPage(page => Math.min(historyPageCount, page + 1))} disabled={historyPage === historyPageCount}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">Next</button>
        </div>
      </div>
    )}
  </div>
}

export default Upload
