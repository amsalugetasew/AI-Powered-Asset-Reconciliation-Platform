import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiDownload, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiXCircle, FiDatabase, FiUsers } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const Results = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reconciliation, setReconciliation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReconciliation()
  }, [id])

  const fetchReconciliation = async () => {
    try {
      const response = await axios.get(`/api/reconciliation/${id}`)
      setReconciliation(response.data.reconciliation)
    } catch (error) {
      toast.error('Failed to fetch reconciliation details')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
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
  const totalRecords = stats.total_customer_records
  const customerDuplicates = stats.customer_duplicates || 0
  const uniqueRecords = totalRecords - customerDuplicates
  const matchRate = uniqueRecords > 0 ? ((totalMatched / uniqueRecords) * 100).toFixed(2) : 0

  // Overall distribution chart
  const chartData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Unmatched', value: stats.customer_unmatched, color: '#ef4444' }
  ]

  // Customer records breakdown
  const customerReconciled = stats.rule_matched + stats.ai_matched
  const customerData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
    { name: 'AI Matched', value: stats.ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: stats.manual_review, color: '#f59e0b' },
    { name: 'Not Reconciled', value: stats.customer_unmatched, color: '#ef4444' }
  ]

  // Internal records breakdown (assuming similar distribution)
  const internalReconciled = stats.rule_matched + stats.ai_matched
  const internalData = [
    { name: 'Rule Matched', value: stats.rule_matched, color: '#8E288D' },
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
          <h1 className="text-3xl font-semibold text-gray-900">
            Reconciliation Results #{id}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Completed on {new Date(reconciliation.completed_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <FiDownload className="mr-2" />
          Download Report
        </button>
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
                <FiCheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Rule Matched</dt>
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
                <FiAlertCircle className="h-6 w-6 text-blue-500" />
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
                <FiXCircle className="h-6 w-6 text-red-500" />
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
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Records Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiUsers className="h-6 w-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Customer Records Breakdown</h3>
          </div>
          <div className="mb-4 p-4 bg-purple-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Customer Records:</span>
              <span className="text-2xl font-bold text-purple-600">{stats.total_customer_records}</span>
            </div>
          </div>
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
          <div className="mt-4 space-y-2">
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
        </div>

        {/* Internal Records Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiDatabase className="h-6 w-6 text-teal-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Finance Records Breakdown</h3>
          </div>
          <div className="mb-4 p-4 bg-teal-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Finance Records:</span>
              <span className="text-2xl font-bold text-teal-600">{stats.total_internal_records}</span>
            </div>
          </div>
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
          <div className="mt-4 space-y-2">
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
      </div>

      {/* Overall Statistics Summary */}
      <div className="mt-0 bg-white shadow rounded-lg p-6">
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
            <Legend wrapperStyle={{ fontSize: '14px', fontWeight: '500' }} />
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
