import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUser, FiMail, FiLock, FiShield } from 'react-icons/fi'
import { RoleBadge } from '../components/RoleGuard'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from "lucide-react";
const UserManagement = () => {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'officer'
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/users')
      setUsers(response.data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      const payload = { ...formData }
      delete payload.confirmPassword
      await axios.post('/api/admin/users', payload)
      toast.success('User created successfully')
      setShowCreateModal(false)
      setFormData({ username: '', email: '', password: '', confirmPassword: '', role: 'officer' })
      fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(error.response?.data?.error || 'Failed to create user')
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await axios.put(`/api/admin/users/${userId}/role`, { role: newRole })
      toast.success('Role updated successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to update role')
    }
  }

  const handleDeleteUser = async () => {
    try {
      await axios.delete(`/api/admin/users/${selectedUser.id}`)
      toast.success('User deleted successfully')
      setShowDeleteModal(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to delete user')
    }
  }

  const openDeleteModal = (user) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const handleUserAction = (user, action) => {
    if (action === 'delete') {
      openDeleteModal(user)
      return
    }

    if (user.id === currentUser.id) {
      toast.error('You cannot perform this action on your own account')
      return
    }

    setSelectedUser(user)
    setPendingAction(action)

    if (action === 'reset-password') {
      setResetForm({ newPassword: '', confirmPassword: '' })
      setShowResetPasswordModal(true)
      setShowActionModal(false)
    } else {
      setShowResetPasswordModal(false)
      setShowActionModal(true)
    }
  }

  const confirmPendingAction = async () => {
    if (!selectedUser || !pendingAction) return

    try {
      if (pendingAction === 'deactivate') {
        await axios.put(`/api/admin/users/${selectedUser.id}/deactivate`)
        toast.success(`User ${selectedUser.username} deactivated successfully`)
      } else if (pendingAction === 'activate') {
        await axios.put(`/api/admin/users/${selectedUser.id}/activate`)
        toast.success(`User ${selectedUser.username} activated successfully`)
      }

      setShowActionModal(false)
      setSelectedUser(null)
      setPendingAction(null)
      fetchUsers()
    } catch (error) {
      console.error('Error performing user action:', error)
      toast.error(error.response?.data?.error || 'Failed to complete action')
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      await axios.post(`/api/admin/users/${selectedUser.id}/reset-password`, { new_password: resetForm.newPassword })
      toast.success(`Password reset for ${selectedUser.username}`)
      setShowResetPasswordModal(false)
      setSelectedUser(null)
      setResetForm({ newPassword: '', confirmPassword: '' })
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error(error.response?.data?.error || 'Failed to reset password')
    }
  }

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
          <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] px-4 py-2 transition-colors"
        >
          <FiPlus className="h-5 w-5" />
          Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] hover:from-[#CFB53B] hover:to-[#8E288D] rounded-full flex items-center justify-center text-white font-semibold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        {user.id === currentUser.id && (
                          <span className="text-xs text-gray-500">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.id === currentUser.id ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        className="text-sm rounded-full px-3 py-1 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8E288D] focus:border-transparent"
                      >
                        <option value="officer">Officer</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleUserAction(user, user.is_active ? 'deactivate' : 'activate')}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition ${user.is_active ? 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700' : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        <FiShield className="h-4 w-4" />
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleUserAction(user, 'reset-password')}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <FiLock className="h-4 w-4" />
                        Reset Password
                      </button>
                      {user.id !== currentUser.id ? (
                        <button
                          onClick={() => handleUserAction(user, 'delete')}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <FiTrash2 className="h-4 w-4" />
                          Delete
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 font-semibold mb-1">Officers</div>
          <div className="text-2xl font-bold text-blue-900">
            {users.filter(u => u.role === 'officer').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 font-semibold mb-1">Managers</div>
          <div className="text-2xl font-bold text-green-900">
            {users.filter(u => u.role === 'manager').length}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-semibold mb-1">Admins</div>
          <div className="text-2xl font-bold text-red-900">
            {users.filter(u => u.role === 'admin').length}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Create New User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiUser className="inline h-4 w-4 mr-1" />
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiMail className="inline h-4 w-4 mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiLock className="inline h-4 w-4 mr-1" />
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiLock className="inline h-4 w-4 mr-1" />
                  Confirm Password
                </label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiShield className="inline h-4 w-4 mr-1" />
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                >
                  <option value="officer">Officer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {showActionModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pendingAction === 'deactivate' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                {pendingAction === 'deactivate' ? <FiShield className="h-6 w-6 text-yellow-600" /> : <FiLock className="h-6 w-6 text-blue-600" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {pendingAction === 'deactivate' ? 'Deactivate User' : 'Reset Password'}
                </h3>
                <p className="text-sm text-gray-600">
                  {pendingAction === 'deactivate'
                    ? 'This will disable the user account.'
                    : 'This will generate a temporary password for the user.'}
                </p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to {pendingAction === 'deactivate' ? 'deactivate' : 'reset the password for'} <strong>{selectedUser.username}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowActionModal(false)
                  setSelectedUser(null)
                  setPendingAction(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingAction}
                className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${pendingAction === 'deactivate' || pendingAction === 'activate' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {pendingAction === 'deactivate' ? 'Deactivate' : pendingAction === 'activate' ? 'Activate' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                <p className="text-sm text-gray-600">Set a new password for {selectedUser.username}</p>
              </div>
              <button onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }} className="text-gray-400 hover:text-gray-600">
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E288D]"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-[#8E288D] text-white rounded-lg hover:bg-[#75206f] transition-colors">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <FiTrash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete user <strong>{selectedUser.username}</strong>? 
              All associated reconciliations will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedUser(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
