import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiUpload, FiFile, FiX, FiCheckCircle, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { logActivity } from '../services/activityService'

const Upload = () => {
  const [customerFile, setCustomerFile] = useState(null)
  const [internalFile, setInternalFile] = useState(null)
  const [customerPreview, setCustomerPreview] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [reconciliationId, setReconciliationId] = useState(null)
  const navigate = useNavigate()

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please upload Excel files only (.xlsx or .xls)')
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
  }

  const previewFile = async (file, type) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      
      const preview = {
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(2) + ' KB',
        totalRecords: jsonData.length,
        columns: jsonData.length > 0 ? Object.keys(jsonData[0]).length : 0,
        sampleData: jsonData.slice(0, 3)
      }
      
      if (type === 'customer') {
        setCustomerPreview(preview)
      } else {
        setInternalPreview(preview)
      }
      
      toast.success(`File loaded: ${jsonData.length} records found`)
    } catch (error) {
      toast.error('Failed to read file. Please ensure it\'s a valid Excel file.')
      if (type === 'customer') {
        setCustomerFile(null)
      } else {
        setInternalFile(null)
      }
    }
  }

  const removeFile = (type) => {
    if (type === 'customer') {
      setCustomerFile(null)
      setCustomerPreview(null)
    } else {
      setInternalFile(null)
      setInternalPreview(null)
    }
  }

  const clearAll = () => {
    setCustomerFile(null)
    setInternalFile(null)
    setCustomerPreview(null)
    setInternalPreview(null)
    setUploadComplete(false)
    setReconciliationId(null)
    toast.info('All data cleared')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!customerFile || !internalFile) {
      toast.error('Please upload both files')
      return
    }

    setUploading(true)

    try {
      // Upload files
      const formData = new FormData()
      formData.append('customer_file', customerFile)
      formData.append('internal_file', internalFile)

      const uploadResponse = await axios.post('/api/reconciliation/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const recId = uploadResponse.data.reconciliation_id
      setReconciliationId(recId)
      setUploadComplete(true)
      toast.success('Files uploaded successfully!')
      
      logActivity(window.location.pathname, `START_RECONCILIATION_ID_${recId}`)

      // Start processing
      setUploading(false)
      setProcessing(true)

      await axios.post(`/api/reconciliation/process/${recId}`)
      
      toast.success('Reconciliation completed!')
      navigate(`/results/${recId}`)

    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed')
      setUploading(false)
      setProcessing(false)
      setUploadComplete(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">Upload Files</h1>
          <p className="mt-2 text-sm text-gray-700">
            Upload Physical and ERP asset Excel files for reconciliation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer File Upload */}
            <div className="bg-white shadow rounded-lg p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Physical Asset File
              </label>
              {!customerFile ? (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex flex-col sm:flex-row text-sm text-gray-600 items-center justify-center">
                      <label
                        htmlFor="customer-file"
                        className="relative cursor-pointer bg-white
                         rounded-md font-medium text-[#8E288D] hover:text-[#7A1E79] focus-within:outline-none"
                      >
                        <span>Upload a file</span>
                        <input
                          id="customer-file"
                          name="customer-file"
                          type="file"
                          className="sr-only"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileChange(e, 'customer')}
                        />
                      </label>
                      <p className="sm:pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-md">
                  <div className="flex items-center">
                    <FiFile className="h-8 w-8 text-[#8E288D]" />
                    <span className="ml-2 text-sm text-gray-900 break-all">{customerFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile('customer')}
                    className="text-pink-500 hover:text-pink-600"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Internal File Upload */}
            <div className="bg-white shadow rounded-lg p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ERP Asset File
              </label>
              {!internalFile ? (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed 
                rounded-md hover:border-primary-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex flex-col sm:flex-row text-sm text-gray-600 items-center justify-center">
                      <label
                        htmlFor="internal-file"
                        className="relative cursor-pointer bg-white rounded-md 
                        font-medium text-[#8E288D] hover:text-[#7A1E79] 
                        focus-within:outline-none"
                      >
                        <span>Upload a file</span>
                        <input
                          id="internal-file"
                          name="internal-file"
                          type="file"
                          className="sr-only"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileChange(e, 'internal')}
                        />
                      </label>
                      <p className="sm:pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-md">
                  <div className="flex items-center">
                    <FiFile className="h-8 w-8 text-[#8E288D]" />
                    <span className="ml-2 text-sm text-gray-900 break-all">{internalFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile('internal')}
                    className="text-pink-500 hover:text-pink-600"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!customerFile || !internalFile || uploading || processing}
              className="inline-flex items-center px-6 py-3 border border-transparent 
              text-base font-medium rounded-md shadow-sm text-white 
              bg-[#8E288D] hover:bg-[#7A1E79] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Start Reconciliation'}
            </button>
          </div>

          {processing && (
            <div className="text-center text-sm text-gray-600">
              <p>Processing reconciliation... This may take a few minutes.</p>
            </div>
          )}
        </form>

        {/* File Preview Section */}
        {(customerPreview || internalPreview) && !uploadComplete && (
          <div className="mt-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">File Preview</h2>
              <button
                onClick={clearAll}
                className="inline-flex items-center px-4 py-2 border border-pink-300 rounded-md shadow-sm text-sm 
                font-medium text-pink-700 bg-white hover:bg-pink-50"
              >
                <FiRefreshCw className="mr-2" />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer File Preview */}
              {customerPreview && (
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <FiCheckCircle className="h-6 w-6 text-green-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Physical File</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">File Name:</span>
                      <span className="text-sm text-gray-900">{customerPreview.fileName}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">File Size:</span>
                      <span className="text-sm text-gray-900">{customerPreview.fileSize}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-purple-50 rounded">
                      <span className="text-sm font-medium text-gray-600">Total Records:</span>
                      <span className="text-sm font-bold text-[#8E288D]">{customerPreview.totalRecords}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">Columns:</span>
                      <span className="text-sm text-gray-900">{customerPreview.columns}</span>
                    </div>
                  </div>
                  {customerPreview.sampleData && customerPreview.sampleData.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Data (First 3 rows):</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              {Object.keys(customerPreview.sampleData[0]).slice(0, 4).map((key, idx) => (
                                <th key={idx} className="px-2 py-1 text-left font-medium text-gray-700">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {customerPreview.sampleData.map((row, idx) => (
                              <tr key={idx} className="border-t">
                                {Object.values(row).slice(0, 4).map((val, vidx) => (
                                  <td key={vidx} className="px-2 py-1 text-gray-600">{String(val).substring(0, 20)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Internal File Preview */}
              {internalPreview && (
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <FiCheckCircle className="h-6 w-6 text-teal-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">ERP File</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">File Name:</span>
                      <span className="text-sm text-gray-900">{internalPreview.fileName}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">File Size:</span>
                      <span className="text-sm text-gray-900">{internalPreview.fileSize}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-teal-50 rounded">
                      <span className="text-sm font-medium text-gray-600">Total Records:</span>
                      <span className="text-sm font-bold text-[#CFB53B]">{internalPreview.totalRecords}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-600">Columns:</span>
                      <span className="text-sm text-gray-900">{internalPreview.columns}</span>
                    </div>
                  </div>
                  {internalPreview.sampleData && internalPreview.sampleData.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Data (First 3 rows):</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              {Object.keys(internalPreview.sampleData[0]).slice(0, 4).map((key, idx) => (
                                <th key={idx} className="px-2 py-1 text-left font-medium text-gray-700">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {internalPreview.sampleData.map((row, idx) => (
                              <tr key={idx} className="border-t">
                                {Object.values(row).slice(0, 4).map((val, vidx) => (
                                  <td key={vidx} className="px-2 py-1 text-gray-600">{String(val).substring(0, 20)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Summary */}
            {customerPreview && internalPreview && (
              <div className="mt-2 bg-gradient-to-r from-purple-50 to-teal-50 shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Quick Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <FiAlertCircle className="h-8 w-8 text-[#8E288D] mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Physical Records</p>
                    <p className="text-2xl font-bold text-[#8E288D]">{customerPreview.totalRecords}</p>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <FiAlertCircle className="h-8 w-8 text-[#CFB53B] mx-auto mb-2" />
                    <p className="text-sm text-gray-600">ERP Records</p>
                    <p className="text-2xl font-bold text-[#CFB53B]">{internalPreview.totalRecords}</p>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <FiCheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Ready to Process</p>
                    <p className="text-2xl font-bold text-green-600">✓</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Upload
