import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiAlertCircle } from 'react-icons/fi'
import { ManagerOnly } from '../components/RoleGuard'

const ApprovalPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reconciliation, setReconciliation] = useState(null)
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(null)

  const categories = [
    { key: 'Exact Match', label: 'Exact Match', color: 'green' },
    { key: 'AI Match', label: 'AI Match', color: 'purple' },
    { key: 'Manual Review', label: 'Manual Review', color: 'yellow' },
    { key: 'Unmatched', label: 'Unmatched', color: 'red' }
  ]

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch reconciliation details
      const reconResponse = await axios.get(`/api/reconciliation/${id}`)
      setReconciliation(reconResponse.data.reconciliation)

      // Fetch approval summary
      const summaryResponse = await axios.get(`/api/reconciliation/records/approval-summary/${id}`)
      setSummary(summaryResponse.data.summary)

      // Fetch records for each category
      const recordsData = {}
      for (const category of categories) {
        const response = await axios.get(`/api/reconciliation/records/${id}`, {
          params: {
            category: category.key,
            per_page: 100 // Fetch more records for approval view
          }
        })
        recordsData[category.key] = response.data.records
      }
      setRecords(recordsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load approval data')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (category, decision) => {
    try {
      setApproving(`${category}-${decision}`)
      
      const response = await axios.post('/api/reconciliation/records/approve-group', {
        reconciliation_id: parseInt(id),
        category: category,
        approval_decision: decision
      })

      toast.success(response.data.message)
      
      // Refresh data
      await fetchData()
    } catch (error) {
      console.error('Error approving:', error)
      toast.error(error.response?.data?.error || 'Failed to approve records')
    } finally {
      setApproving(null)
    }
  }

  const getApprovalStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: FiClock, label: 'Pending' },
      reconciled: { color: 'bg-green-100 text-green-800 border-green-300', icon: FiCheckCircle, label: 'Reconciled' },
      not_reconciled: { color: 'bg-red-100 text-red-800 border-red-300', icon: FiXCircle, label: 'Not Reconciled' }
    }
    const badge = badges[status] || badges.pending
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </span>
    )
  }

  const getCategoryColor = (color) => {
    const colors = {
      green: 'border-green-500 bg-green-50',
      purple: 'border-purple-500 bg-purple-50',
      yellow: 'border-yellow-500 bg-yellow-50',
      red: 'border-red-500 bg-red-50'
    }
    return colors[color] || colors.green
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!reconciliation) {
    return <div>Reconciliation not found</div>
  }

  return (
    <ManagerOnly>
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

        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Approval Page - Reconciliation #{id}
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Review and approve reconciliation records by category
            </p>
          </div>
        </div>

        {/* Category Cards */}
        <div className="space-y-6">
          {categories.map(category => {
            const categorySummary = summary?.[category.key] || { total: 0, pending: 0, reconciled: 0, not_reconciled: 0 }
            const categoryRecords = records[category.key] || []
            const allApproved = categorySummary.pending === 0 && categorySummary.total > 0

            return (
              <div key={category.key} className={`border-l-4 ${getCategoryColor(category.color)} rounded-lg shadow-lg overflow-hidden`}>
                {/* Category Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{category.label}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {categorySummary.total} total records
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">{categorySummary.pending}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{categorySummary.reconciled}</div>
                        <div className="text-xs text-gray-500">Reconciled</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{categorySummary.not_reconciled}</div>
                        <div className="text-xs text-gray-500">Not Reconciled</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Records Table */}
                {categoryRecords.length > 0 ? (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Tag</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Internal Tag</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {categoryRecords.slice(0, 5).map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.customer_tag}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.internal_tag}</td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{record.description}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.match_method}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {getApprovalStatusBadge(record.approval_status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {categoryRecords.length > 5 && (
                      <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600 text-center border-t">
                        Showing 5 of {categoryRecords.length} records
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white px-6 py-8 text-center text-gray-500">
                    <FiAlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p>No records in this category</p>
                  </div>
                )}

                {/* Approval Actions */}
                {categorySummary.total > 0 && (
                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
                    {allApproved ? (
                      <div className="text-green-600 font-medium flex items-center">
                        <FiCheckCircle className="mr-2" />
                        All records approved
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(category.key, 'reconciled')}
                          disabled={approving === `${category.key}-reconciled`}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          {approving === `${category.key}-reconciled` ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Approving...
                            </>
                          ) : (
                            <>
                              <FiCheckCircle className="mr-2" />
                              Mark as Reconciled
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleApprove(category.key, 'not_reconciled')}
                          disabled={approving === `${category.key}-not_reconciled`}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          {approving === `${category.key}-not_reconciled` ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Approving...
                            </>
                          ) : (
                            <>
                              <FiXCircle className="mr-2" />
                              Mark as Not Reconciled
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </ManagerOnly>
  )
}

export default ApprovalPage
