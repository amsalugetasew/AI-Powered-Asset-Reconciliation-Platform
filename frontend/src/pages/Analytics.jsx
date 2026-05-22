import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiTrendingUp, FiCheckCircle, FiAlertCircle, FiFileText, FiBarChart2 } from 'react-icons/fi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/reconciliation/analytics')
      setAnalytics(response.data)
    } catch (error) {
      toast.error('Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!analytics || analytics.total_reconciliations === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">Analytics</h1>
        <div className="text-center py-12">
          <FiBarChart2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
          <p className="mt-1 text-sm text-gray-500">
            Complete some reconciliations to see analytics.
          </p>
        </div>
      </div>
    )
  }

  const chartData = [
    {
      name: 'Matches',
      'Rule-Based': analytics.total_rule_matched,
      'AI-Assisted': analytics.total_ai_matched,
      'Manual Review': analytics.total_manual_review
    }
  ]

  const pieData = [
    { name: 'Rule-Based', value: analytics.total_rule_matched, color: '#008080' },
    { name: 'AI-Assisted', value: analytics.total_ai_matched, color: '#CFB53B' },
    { name: 'Manual Review', value: analytics.total_manual_review, color: '#f59e0b' }
  ]

  const totalMatched = analytics.total_rule_matched + analytics.total_ai_matched
  const totalRecords = analytics.total_customer_records

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">Analytics Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiFileText className="h-6 w-6 text-[#8E288D]" />
              </div>
              <div className="ml-5 w-10 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Reconciliations
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics.total_reconciliations}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiTrendingUp className="h-6 w-6 text-[#008080]" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Average Match Rate
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics.average_match_rate}%
                  </dd>
                </dl>
              </div>
            </div>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Records Processed
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics.total_customer_records}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiAlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Manual Reviews
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics.total_manual_review}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"> */}
      <div className='mt-0 bg-white shadow rounded-lg p-6'>
        {/* <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Match Type Distribution</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" style={{ fontSize: '14px', fontWeight: '500' }} />
              <YAxis style={{ fontSize: '14px' }} />
              <Tooltip 
                contentStyle={{ fontSize: '14px', fontWeight: '500' }}
                labelStyle={{ fontSize: '15px', fontWeight: '600' }}
              />
              <Legend wrapperStyle={{ fontSize: '14px', fontWeight: '500' }} />
              <Bar dataKey="Rule-Based" fill="#8E288D" radius={[8, 8, 0, 0]} />
              <Bar dataKey="AI-Assisted" fill="#CFB53B" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Manual Review" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div> */}

        {/* Match Type Pie Chart */}
        <div className="mt-0 bg-white shadow rounded-lg p-2">
          <h5 className="text-xl text-center font-semibold text-gray-900 mb-0">
            Match Type Breakdown
          </h5>
          <ResponsiveContainer width="100%" height={420}>
            <PieChart margin={{ top: 0, right: 20, bottom: 60, left: 20 }}>

              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                outerRadius={120}
                dataKey="value"
                labelLine={false}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  fontSize: "10px",
                  fontWeight: "100",
                }}
              />

              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  fontSize: "15px",
                  paddingLeft: "18px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Bars */}
        <div className="bg-white shadow rounded-lg p-6">
          <h5 className="text-xl font-semibold text-gray-900 mb-6">Detailed Breakdown</h5>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Exact Matches</span>
                <span className="font-bold text-green-600">{analytics.total_rule_matched} ({totalRecords > 0 ? ((analytics.total_rule_matched / totalRecords) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(analytics.total_rule_matched / totalRecords) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">AI-Assisted Matches</span>
                <span className="font-bold text-blue-600">{analytics.total_ai_matched} ({totalRecords > 0 ? ((analytics.total_ai_matched / totalRecords) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(analytics.total_ai_matched / totalRecords) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Manual Review Required</span>
                <span className="font-bold text-yellow-600">{analytics.total_manual_review} ({totalRecords > 0 ? ((analytics.total_manual_review / totalRecords) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(analytics.total_manual_review / totalRecords) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-gray-800">Total Matched</span>
                <span className="font-bold text-purple-600">{totalMatched} ({totalRecords > 0 ? ((totalMatched / totalRecords) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(totalMatched / totalRecords) * 100}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <h5 className="text-xl font-semibold text-gray-900 mb-6">Statistics Summary</h5>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Reconciliations</span>
                <span className="text-2xl font-bold text-purple-600">{analytics.total_reconciliations}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Average Match Rate</span>
                <span className="text-2xl font-bold text-green-600">{analytics.average_match_rate}%</span>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Records Processed</span>
                <span className="text-2xl font-bold text-blue-600">{analytics.total_customer_records}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Internal Records</span>
                <span className="text-2xl font-bold text-teal-600">{analytics.total_internal_records}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Manual Reviews Needed</span>
                <span className="text-2xl font-bold text-yellow-600">{analytics.total_manual_review}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
