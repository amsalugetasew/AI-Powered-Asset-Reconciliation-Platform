import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiPlus, FiTrash2, FiX, FiShield, FiLock, FiEdit2,
  FiSearch, FiChevronLeft, FiChevronRight, FiUsers, FiUserCheck, FiUserX,
} from 'react-icons/fi'
import { Hash, Mail, Building2, Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = [
  'Asset Management',
  'Information Technology',
  'Asset Management & Reconciliation',
  'Other',
]

const ROLE_COLORS = {
  officer: 'bg-blue-50 text-blue-700 border border-blue-200',
  manager: 'bg-purple-50 text-[#8E288D] border border-purple-200',
  admin:   'bg-red-50 text-red-600 border border-red-200',
}

const STATUS_COLORS = {
  active:   'bg-emerald-50 text-emerald-700',
  inactive: 'bg-amber-50 text-amber-600',
}

const ITEMS_PER_PAGE = 8

// ── Tooltip icon button ───────────────────────────────────────────────────────
const IconBtn = ({ onClick, title, className, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
)

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, picture }) => {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  if (picture) {
    return <img src={picture} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white" />
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8E288D] to-[#CFB53B] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
      {initials}
    </div>
  )
}

// ── Shared form input helper (defined OUTSIDE component to prevent remount on every render) ──
const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    {children}
  </div>
)

const inputCls = 'w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]'

const UserManagement = () => {
  const { user: currentUser } = useAuth()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  // filters
  const [filterRole,   setFilterRole]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept,   setFilterDept]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)

  // modals
  const [showCreateModal,        setShowCreateModal]        = useState(false)
  const [showEditModal,          setShowEditModal]          = useState(false)
  const [showDeleteModal,        setShowDeleteModal]        = useState(false)
  const [showActionModal,        setShowActionModal]        = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)

  const [selectedUser,  setSelectedUser]  = useState(null)
  const [pendingAction, setPendingAction] = useState(null)

  const [showPassword,        setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetForm,  setResetForm]  = useState({ newPassword: '', confirmPassword: '' })

  const EMPTY_FORM = {
    fullName: '', username: '', email: '',
    department: '', password: '', confirmPassword: '', role: 'officer',
  }
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [editData, setEditData] = useState({
    fullName: '', username: '', email: '', department: '', role: 'officer',
  })

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/admin/users')
      setUsers(res.data.users)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    try {
      await axios.post('/api/admin/users', {
        username:    formData.username || formData.email,
        email:       formData.email,
        password:    formData.password,
        role:        formData.role,
        full_name:   formData.fullName   || undefined,
        department:  formData.department || undefined,
      })
      toast.success('User created successfully')
      setShowCreateModal(false)
      setFormData(EMPTY_FORM)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEditModal = (user) => {
    setSelectedUser(user)
    setEditData({
      fullName:   user.full_name   || '',
      username:   user.username    || '',
      email:      user.email       || '',
      department: user.department  || '',
      role:       user.role        || 'officer',
    })
    setShowEditModal(true)
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    try {
      await axios.put(`/api/admin/users/${selectedUser.id}`, {
        full_name:   editData.fullName   || undefined,
        username:    editData.username   || undefined,
        email:       editData.email      || undefined,
        department:  editData.department || undefined,
        role:        selectedUser.id !== currentUser.id ? editData.role : undefined,
      })
      toast.success('User updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user')
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    try {
      await axios.delete(`/api/admin/users/${selectedUser.id}`)
      toast.success('User deleted successfully')
      setShowDeleteModal(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user')
    }
  }

  // ── Activate / Deactivate ───────────────────────────────────────────────────
  const handleUserAction = (user, action) => {
    if (action === 'delete') { setSelectedUser(user); setShowDeleteModal(true); return }
    if (user.id === currentUser.id) { toast.error('You cannot perform this action on your own account'); return }
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
        toast.success(`${selectedUser.username} deactivated`)
      } else if (pendingAction === 'activate') {
        await axios.put(`/api/admin/users/${selectedUser.id}/activate`)
        toast.success(`${selectedUser.username} activated`)
      }
      setShowActionModal(false); setSelectedUser(null); setPendingAction(null)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  // ── Reset Password ──────────────────────────────────────────────────────────
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    if (resetForm.newPassword !== resetForm.confirmPassword) { toast.error('Passwords do not match'); return }
    try {
      await axios.post(`/api/admin/users/${selectedUser.id}/reset-password`, { new_password: resetForm.newPassword })
      toast.success(`Password reset for ${selectedUser.username}`)
      setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password')
    }
  }

  // ── Derived filter state ────────────────────────────────────────────────────
  const allDepts = [...new Set(users.map(u => u.department).filter(Boolean))]

  const filtered = users.filter(u => {
    if (filterRole   !== 'all' && u.role !== filterRole) return false
    if (filterStatus !== 'all') {
      if (filterStatus === 'active'   && !u.is_active) return false
      if (filterStatus === 'inactive' &&  u.is_active) return false
    }
    if (filterDept !== 'all' && u.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (u.username    || '').toLowerCase().includes(q) ||
        (u.email       || '').toLowerCase().includes(q) ||
        (u.full_name   || '').toLowerCase().includes(q) ||
        (u.employee_id || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages  = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage    = Math.min(page, totalPages)
  const paginated   = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const totalUsers    = users.length
  const activeUsers   = users.filter(u => u.is_active).length
  const suspendedUsers = users.filter(u => !u.is_active).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D]" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">User &amp; Permission Directory</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage system access, user roles, and permissions for the reconciliation platform.</p>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total */}
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-100 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#8E288D] flex items-center justify-center">
              <FiUsers className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E288D]">Total Users</span>
          </div>
          <div className="flex w-full items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-gray-900">{totalUsers}</p>
              <p className="text-xl font-semibold text-gray-500">Users</p>
            </div>
              <span className="mt-1 inline-block text-[14px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-[#8E288D]">
                Validated
              </span>
          </div>
        </div>
        {/* Active */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <FiUserCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Users</span>
          </div>
          <div className="flex w-full items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-gray-900">{activeUsers}</p>
              <p className="text-xl font-semibold text-gray-500">Users</p>
            </div>
              <span className="mt-1 inline-block text-[14px] font-extrabold px-2 py-0.5 rounded-full bg-green-100 text-emerald-700">
                Validated
              </span>
          </div>
        </div>
        {/* Suspended */}
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-400 flex items-center justify-center">
              <FiUserX className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-500">Suspended Users</span>
          </div>
          <div className="flex w-full items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-gray-900">{suspendedUsers}</p>
              <p className="text-xl font-semibold text-gray-500">Users</p>
            </div>
              <span className="mt-1 inline-block text-[14px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Suspended
              </span>
          </div>
          
          {/* <p className="text-4xl font-extrabold text-gray-900">{suspendedUsers}</p>
          <p className="text-xs text-gray-500 mt-1">invites</p>
          <p className="text-xs text-gray-400 mt-3">Action needed</p>
          <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Validated</span> */}
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        {/* Role */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">Role</span>
          <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 bg-white min-w-[120px]">
            <option value="all">All Roles</option>
            <option value="officer">Officer</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">Status</span>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 bg-white min-w-[130px]">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Suspended</option>
          </select>
        </div>
        {/* Department */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">Department</span>
          <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 bg-white min-w-[160px]">
            <option value="all">All Departments</option>
            {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 text-sm ml-auto">
          <span className="text-gray-500 font-medium">Search</span>
          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Search directory..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 w-48 bg-white"
            />
          </div>
        </div>
        {/* Add User */}
        <button
          onClick={() => { setFormData(EMPTY_FORM); setShowCreateModal(true) }}
          className="flex items-center gap-1.5 bg-[#8E288D] hover:bg-[#7A1E79] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          <FiPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['User', 'Role', 'Department', 'Last Active', 'Status', 'Actions'].map(h => (
                  <th key={h} className={`px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 ${h === 'Actions' ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                    No users match the current filters.
                  </td>
                </tr>
              ) : paginated.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/70 transition-colors group">
                  {/* User cell */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.full_name || user.username} picture={user.profile_picture} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          {user.full_name || user.username}
                          {user.id === currentUser?.id && (
                            <span className="ml-1.5 text-[10px] text-gray-400 font-normal">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    {user.department || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Last Active (created_at as proxy) */}
                  <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.is_active ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                      {user.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <IconBtn
                        onClick={() => openEditModal(user)}
                        title="Edit user"
                        className="text-[#8E288D] hover:bg-purple-50 border border-purple-200"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </IconBtn>

                      {/* Activate / Deactivate */}
                      <IconBtn
                        onClick={() => handleUserAction(user, user.is_active ? 'deactivate' : 'activate')}
                        title={user.is_active ? 'Deactivate user' : 'Activate user'}
                        disabled={user.id === currentUser?.id}
                        className={user.is_active
                          ? 'text-amber-600 hover:bg-amber-50 border border-amber-200'
                          : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'}
                      >
                        {user.is_active
                          ? <FiUserX className="h-3.5 w-3.5" />
                          : <FiUserCheck className="h-3.5 w-3.5" />}
                      </IconBtn>

                      {/* Reset Password */}
                      <IconBtn
                        onClick={() => handleUserAction(user, 'reset-password')}
                        title="Reset password"
                        disabled={user.id === currentUser?.id}
                        className="text-blue-600 hover:bg-blue-50 border border-blue-200"
                      >
                        <FiLock className="h-3.5 w-3.5" />
                      </IconBtn>

                      {/* Delete */}
                      <IconBtn
                        onClick={() => handleUserAction(user, 'delete')}
                        title="Delete user"
                        disabled={user.id === currentUser?.id}
                        className="text-red-500 hover:bg-red-50 border border-red-200"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} users
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <FiChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold border transition ${n === safePage
                  ? 'bg-[#8E288D] text-white border-[#8E288D]'
                  : 'border-gray-200 text-gray-600 hover:bg-white'}`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <FiChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── Create User Modal ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-[#5A1468]">Create New User</h3>
                <Lock className="text-[#8E288D]" size={18} />
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="px-7 py-6 space-y-4">
              <Field label="Full Name">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type="text" placeholder="e.g. Yoseph Daniel" value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className={inputCls} />
                </div>
              </Field>
              <Field label="User Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type="email" required placeholder="e.g. yoseph@cbe.com.et" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className={inputCls} />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                    <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className={`${inputCls} pr-7 appearance-none`}>
                      <option value="">Select Dept.</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </Field>
                <Field label="Role">
                  <div className="relative">
                    <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className={`${inputCls} pr-7 appearance-none`}>
                      <option value="officer">Officer</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </Field>
              </div>
              <Field label="Security Password">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type={showPassword ? 'text' : 'password'} required placeholder="············" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type={showConfirmPassword ? 'text' : 'password'} required placeholder="············" value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────────────────────────────── */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-[#5A1468]">Edit User</h3>
                <FiEdit2 className="text-[#8E288D]" size={18} />
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="px-7 py-6 space-y-4">
              <Field label="Full Name">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type="text" placeholder="e.g. Yoseph Daniel" value={editData.fullName}
                    onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                    className={inputCls} />
                </div>
              </Field>
              <Field label="Username">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type="text" required placeholder="e.g. yoseph.daniel" value={editData.username}
                    onChange={e => setEditData({ ...editData, username: e.target.value })}
                    className={inputCls} />
                </div>
              </Field>
              <Field label="User Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input type="email" required placeholder="e.g. yoseph@cbe.com.et" value={editData.email}
                    onChange={e => setEditData({ ...editData, email: e.target.value })}
                    className={inputCls} />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                    <select value={editData.department} onChange={e => setEditData({ ...editData, department: e.target.value })}
                      className={`${inputCls} pr-7 appearance-none`}>
                      <option value="">Select Dept.</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </Field>
                <Field label="Role">
                  <div className="relative">
                    <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                    <select value={editData.role}
                      disabled={selectedUser.id === currentUser?.id}
                      onChange={e => setEditData({ ...editData, role: e.target.value })}
                      className={`${inputCls} pr-7 appearance-none disabled:bg-gray-50 disabled:text-gray-400`}>
                      <option value="officer">Officer</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </Field>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Activate / Deactivate Confirmation Modal ───────────────────── */}
      {showActionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pendingAction === 'deactivate' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                {pendingAction === 'deactivate'
                  ? <FiUserX className="h-6 w-6 text-amber-600" />
                  : <FiUserCheck className="h-6 w-6 text-emerald-600" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {pendingAction === 'deactivate' ? 'Deactivate User' : 'Activate User'}
                </h3>
                <p className="text-sm text-gray-500">
                  {pendingAction === 'deactivate' ? 'This will disable the user account.' : 'This will re-enable the user account.'}
                </p>
              </div>
            </div>
            <p className="text-gray-700 mb-6 text-sm">
              Are you sure you want to {pendingAction === 'deactivate' ? 'deactivate' : 'activate'} <strong>{selectedUser.username}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowActionModal(false); setSelectedUser(null); setPendingAction(null) }}
                className="flex-1 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={confirmPendingAction}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors ${pendingAction === 'deactivate' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {pendingAction === 'deactivate' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────────────────────────────── */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FiLock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                  <p className="text-xs text-gray-500">Set a new password for <strong>{selectedUser.username}</strong></p>
                </div>
              </div>
              <button onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                <Hash className="absolute left-3 top-[2.35rem] text-gray-400" size={15} />
                <input type={showPassword ? 'text' : 'password'} required placeholder="············" value={resetForm.newPassword}
                  onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]" />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-[2.35rem] text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <Hash className="absolute left-3 top-[2.35rem] text-gray-400" size={15} />
                <input type={showConfirmPassword ? 'text' : 'password'} required placeholder="············" value={resetForm.confirmPassword}
                  onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]" />
                <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-[2.35rem] text-gray-400 hover:text-gray-600">
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }}
                  className="flex-1 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2 rounded-full bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <FiTrash2 className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{selectedUser.username}</strong>? All associated reconciliations will also be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setSelectedUser(null) }}
                className="flex-1 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 rounded-full bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors">Delete User</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default UserManagement
