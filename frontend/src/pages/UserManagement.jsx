import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiPlus, FiTrash2, FiX, FiShield, FiLock, FiEdit2,
  FiSearch, FiChevronLeft, FiChevronRight, FiUsers, FiUserCheck, FiUserX,FiUserPlus,FiClock,
  FiMoreVertical,
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
  officer: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  manager: 'bg-purple-50 text-[#8E288D] border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  admin:   'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
}

const STATUS_COLORS = {
  active:    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  pending:   'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  suspended: 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
}

const getUserStatus = user => user.status || (user.is_active ? 'active' : 'suspended')

const ITEMS_PER_PAGE = 5

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
    return <img src={picture} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-700" />
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8E288D] to-[#CFB53B] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-700">
      {initials}
    </div>
  )
}

// ── Shared form input helper (defined OUTSIDE component to prevent remount on every render) ──
const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
    {children}
  </div>
)

const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-9 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]'

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
  const [openActionMenu, setOpenActionMenu] = useState(null)

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

  useEffect(() => {
    if (!openActionMenu) return undefined
    const closeMenu = event => {
      if (!event.target.closest('[data-user-action-menu]')) setOpenActionMenu(null)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpenActionMenu(null)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openActionMenu])

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
    if (filterStatus !== 'all' && filterStatus !== getUserStatus(u)) return false
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
  const activeUsers = users.filter(u => getUserStatus(u) === 'active').length
  const pendingUsers = users.filter(u => getUserStatus(u) === 'pending').length
  const suspendedUsers = users.filter(u => getUserStatus(u) === 'suspended').length

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
      <div className="flex h-[48px] w-full flex-col gap-1">
        <h2 className="text-[22px] font-extrabold text-[#1E293B] dark:text-gray-100 leading-[100%]"
          style={{
            height: '27px',
            fontFamily: 'inter sans-serif',
            fontWeight: 800,
            fontStyle: 'extra-bold',
          }}>User &amp; Permission Directory</h2>
        <p className="text-[14px] text-[#64748B] dark:text-gray-400"
          style={{
            height: '17px',
            fontFamily: 'inter sans-serif',
            fontWeight: 400,
            fontStyle: 'normal',
          }}>Manage system access, user roles, and permissions for the reconciliation platform.</p>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#E1C3DF] dark:from-gray-900 dark:to-purple-950/30 dark:border-gray-800 p-0 shadow-sm transition-shadow hover:shadow-md">

          {/* KPI Label + Icon */}
          <div className="relative h-[32px] flex items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#E1C3DF] dark:bg-purple-900/40 text-black dark:text-purple-200">
            <span className="absolute width-[20px] h-[20px] left-0 text-sm rounded-[6px] px-3 py-0.5 text-[16px] font-extrabold text-[#8E288D] dark:text-purple-400">
              <FiUsers />
            </span>
            <span className="ml-8 mt-1 text-center text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-gray-300"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
                fontStyle: 'normal',}}> Total Users
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-white"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 800,
                }}>
                {totalUsers}
              </p>

              <p
                className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}>
                Users
              </p>
            </div>
            <div className="flex h-[17px] w-full flex-row items-center gap-3 justify-between">
              <p
                className="text-[13px] font_regular leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}>
                Total Registered Users
              </p>
              <span className="inline-flex h-[24px] w-[77px] flex-row items-center justify-center gap-1 rounded-[8px] bg-purple-100 dark:bg-purple-900/50 px-2 text-[14px] font-extrabold text-[#8E288D] dark:text-purple-300">
                Validated
              </span>
            </div>
          </div>
        </div>


        {/* Active Users */}
        <div className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#ECFDF5] dark:from-gray-900 dark:to-emerald-950/30 dark:border-gray-800 p-0 shadow-sm transition-shadow hover:shadow-md">
          {/* KPI Label + Icon */}
          <div className="relative text-[#059669] dark:text-emerald-300 bg-[#ECFDF5] dark:bg-emerald-900/40 h-[32px] flex items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
            <span className="absolute width-[20px] h-[20px] left-0 text-sm rounded-[6px] px-3 py-0.5 text-[16px] font-extrabold text-[#059669] dark:text-emerald-400">
              <FiUserCheck />
            </span>
            <span className="ml-8 mt-1 text-center text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-gray-300"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
                fontStyle: 'normal',}}>Active Users
            </span>
            
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-white">
                {activeUsers}
              </p>

              <p className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}>
                Users
              </p>
            </div>

            <div className="flex h-[17px] w-full flex-row items-center gap-3 justify-between">
              <p
                className="text-[13px] font_regular leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}>
                Total Active Users
              </p>
              <span className="inline-flex h-[24px] w-[77px] flex-row items-center justify-center gap-1 rounded-[8px] bg-emerald-100 dark:bg-emerald-900/50 px-2 text-[14px] font-extrabold text-emerald-700 dark:text-emerald-300">
                Validated
              </span>
            </div>
          </div>
        </div>


        {/* Suspended Users */}
        <div className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#FEE2E2] dark:from-gray-900 dark:to-rose-950/30 dark:border-gray-800 p-0 shadow-sm transition-shadow hover:shadow-md">

          {/* KPI Label + Icon */}
          <div className="relative h-[32px] flex items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-900/40 text-[#DC2626] dark:text-rose-300">
            <span className="ml-8 mt-1 text-center text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-gray-300"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
                fontStyle: 'normal',}}>Suspended Users
            </span>

            <span className="absolute width-[20px] h-[20px] left-0 text-sm rounded-[6px] px-3 py-0.5 text-[16px] font-extrabold text-[#DC2626] dark:text-rose-400">
              <FiUserX />
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-white">
                {suspendedUsers}
              </p>

              <p className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}>
                Users
              </p>
            </div>
              
            
            <div className="flex h-[17px] w-full flex-row items-center gap-3 justify-between">
              <p className="text-[13px] font_regular leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}>
                Total Suspended Users
              </p>
              <span className="inline-flex h-[24px] w-[77px] flex-row items-center justify-center gap-1 rounded-[8px] bg-rose-100 dark:bg-rose-900/50 px-2 text-[14px] font-extrabold text-rose-700 dark:text-rose-300">
                Validated
              </span>
            </div>
          </div>
        </div>


        {/* Pending Approval */}
        <div className="w-full h-[140px] rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-[#FEF3C7] dark:from-gray-900 dark:to-amber-950/30 dark:border-gray-800 p-0 shadow-sm transition-shadow hover:shadow-md">

          {/* KPI Label + Icon */}
          <div
            className="relative h-[32px] flex items-center justify-start rounded-[8px] gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/40 text-[#D97706] dark:text-amber-300"
          >
            <span className="ml-8 mt-1 text-center text-[11px] font-bold uppercase leading-[100%] tracking-[0.30px] text-[#6B7280] dark:text-gray-300"
              style={{
                height: '14px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 700,
                fontStyle: 'normal',}}> Pending Approval
            </span>

            <span className="absolute width-[20px] h-[20px] left-0 text-sm rounded-[6px] px-3 py-0.5 text-[16px] font-extrabold text-[#D97706] dark:text-amber-400">
              <FiClock />
            </span>
          </div>

          {/* KPI Value */}
          <div className="flex h-[98px] w-full flex-col gap-2 px-5 py-[15px]">
            <div className="flex h-[36px] w-full flex-row items-center gap-2">
              <p className="text-[28px] font-extrabold leading-[100%] tracking-[0%] text-[#0F172A] dark:text-white">
                {pendingUsers}
              </p>

              <p className="text-[14px] font-semibold leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                }}>
                Users
              </p>
            </div>

            <div className="flex h-[17px] w-full flex-row items-center gap-3 justify-between">
              <p
                className="text-[13px] font_regular leading-[100%] tracking-[0%] text-[#94A3B8] dark:text-gray-400"
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 400,
                }}>
                Total Pending Users
              </p>
              <span className="inline-flex h-[24px] w-[77px] flex-row items-center justify-center gap-1 rounded-[8px] bg-amber-100 dark:bg-amber-900/50 px-2 text-[14px] font-extrabold text-amber-700 dark:text-amber-300">
                Validated
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex min-h-[76px] w-full flex-wrap items-center gap-4 rounded-[14px] border border-[#E2E8F0] dark:border-gray-800 bg-[#FFFFFF] dark:bg-gray-900 p-5 shadow-sm">

        {/* Role */}
        <div className="flex h-[34px] min-w-[220px] flex-1 items-center gap-2 text-sm xl:max-w-[321.5px]">
          <span
            className="shrink-0 text-[13px] font-semibold leading-[100%] tracking-[0%] text-[#64748B] dark:text-gray-300"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            Role
          </span>

          <select
            value={filterRole}
            onChange={e => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
            className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-[#E2E8F0] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-[#334155] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
          >
            <option value="all">All Roles</option>
            <option value="officer">Officer</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex h-[40px] min-w-[220px] flex-1 items-center gap-2 text-sm xl:max-w-[321.5px]">
          <span
            className="shrink-0 text-[13px] font-semibold leading-[100%] tracking-[0%] text-[#64748B] dark:text-gray-300"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            Status
          </span>

          <select
            value={filterStatus}
            onChange={e => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-[#E2E8F0] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-[#334155] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Department */}
        <div className="flex h-[40px] min-w-[220px] flex-1 items-center gap-2 text-sm xl:max-w-[321.5px]">
          <span
            className="shrink-0 text-[13px] font-semibold leading-[100%] tracking-[0%] text-[#64748B] dark:text-gray-300"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            Department
          </span>

          <select
            value={filterDept}
            onChange={e => {
              setFilterDept(e.target.value);
              setPage(1);
            }}
            className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-[#E2E8F0] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-[#334155] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
          >
            <option value="all">All Departments</option>
            {allDepts.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex h-[40px] min-w-[220px] flex-1 items-center gap-2 text-sm xl:max-w-[321.5px]">
          <span
            className="shrink-0 text-[13px] font-semibold leading-[100%] tracking-[0%] text-[#64748B] dark:text-gray-300"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            Search
          </span>

          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8] dark:text-gray-400" />

            <input
              type="text"
              placeholder="Search directory..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-[40px] w-full rounded-[8px] border border-[#E2E8F0] dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 text-sm text-[#334155] dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
            />
          </div>
        </div>

        {/* Add User */}
        <button
          onClick={() => {
            setFormData(EMPTY_FORM);
            setShowCreateModal(true);
          }}
          className="flex h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-[#8E288D] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#7A1E79]"
        >
          <FiPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-[#E2E8F0] dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="h-[43px] w-full bg-[#F8FAFC] dark:bg-gray-800/80">
              <tr className="border-b border-[#E2E8F0] dark:border-gray-800">
                {['User', 'Role', 'Department', 'Last Active', 'Status', 'Actions'].map(h => (
                  <th key={h} className={`px-5 py-3.5 text-left text-[12px] font-bold uppercase leading-[100%] text-[#64748B] dark:text-gray-400 ${h === 'Actions' ? 'text-right' : ''}`}
                  style={{height: '15px', fontWeight: 700, fontStyle: 'bold'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-gray-800">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#94A3B8] dark:text-gray-400">
                    No users match the current filters.
                  </td>
                </tr>
              ) : paginated.map(user => (
                <tr key={user.id} className="hover:bg-[#F8FAFC]/70 dark:hover:bg-gray-800/50 transition-colors group">
                  {/* User cell */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.full_name || user.username} picture={user.profile_picture} />
                      <div>
                        <p className="text-sm font-semibold text-[#334155] dark:text-gray-200 leading-tight">
                          {user.full_name || user.username}
                          {user.id === currentUser?.id && (
                            <span className="ml-1.5 text-[10px] text-[#94A3B8] dark:text-gray-400 font-normal">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                    {user.department || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>

                  {/* Last Active (created_at as proxy) */}
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[getUserStatus(user)]}`}>
                      {getUserStatus(user).charAt(0).toUpperCase() + getUserStatus(user).slice(1)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="relative inline-block" data-user-action-menu>
                      <button
                        type="button"
                        onClick={event => {
                          if (openActionMenu?.id === user.id) {
                            setOpenActionMenu(null)
                            return
                          }
                          const buttonRect = event.currentTarget.getBoundingClientRect()
                          const menuWidth = 176
                          setOpenActionMenu({
                            id: user.id,
                            left: Math.max(8, buttonRect.right - menuWidth),
                            top: buttonRect.bottom + 4,
                          })
                        }}
                        aria-label={`Actions for ${user.full_name || user.username}`}
                        aria-expanded={openActionMenu?.id === user.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8E288D] dark:text-purple-400 transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/40 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30"
                      >
                        <FiMoreVertical className="h-5 w-5" />
                      </button>

                      {openActionMenu?.id === user.id && (
                        createPortal(
                        <div
                          data-user-action-menu
                          className="fixed z-[100] w-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-left shadow-xl"
                          style={{
                            left: openActionMenu.left,
                            top: openActionMenu.top,
                            maxHeight: `max(80px, calc(100vh - ${openActionMenu.top}px - 8px))`,
                          }}
                        >
                          <button type="button" onClick={() => { setOpenActionMenu(null); openEditModal(user) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-purple-50 dark:hover:bg-gray-700">
                            <FiEdit2 className="h-4 w-4 text-[#8E288D] dark:text-purple-400" /> Edit User
                          </button>
                          <button type="button" disabled={user.id === currentUser?.id} onClick={() => { setOpenActionMenu(null); handleUserAction(user, user.is_active ? 'deactivate' : 'activate') }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-40">
                            {user.is_active ? <FiUserX className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <FiUserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                            {user.is_active ? 'Suspend User' : 'Activate User'}
                          </button>
                          <button type="button" disabled={user.id === currentUser?.id} onClick={() => { setOpenActionMenu(null); handleUserAction(user, 'reset-password') }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:cursor-not-allowed disabled:opacity-40">
                            <FiLock className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Reset Password
                          </button>
                          <button type="button" disabled={user.id === currentUser?.id} onClick={() => { setOpenActionMenu(null); handleUserAction(user, 'delete') }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-40">
                            <FiTrash2 className="h-4 w-4" /> Delete User
                          </button>
                        </div>,
                        document.body
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} users
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <FiChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold border transition ${n === safePage
                  ? 'bg-[#8E288D] text-white border-[#8E288D]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'}`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-lg border border-[#8E288D]/30 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex min-h-20 items-center justify-between bg-[#efdfed] dark:bg-purple-950/50 px-7 py-4">
              <h3 className="text-xl font-extrabold text-[#8E288D] dark:text-purple-300">Add New User</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} aria-label="Close add user form" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3c5df] dark:bg-purple-900/40 text-[#8E288D] dark:text-purple-300 transition hover:bg-[#d9b2d4] dark:hover:bg-purple-800/50">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="flex flex-col">
              <div className="grid grid-cols-1 gap-4 px-7 py-6">
                <Field label="Full Name">
                  <input type="text" placeholder="e.g. Yoseph Daniel" value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className={`${inputCls} rounded-lg py-3 pl-4`} />
                </Field>
                <Field label="Email Address">
                  <input type="email" required placeholder="e.g. yoseph@cbe.com.et" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className={`${inputCls} rounded-lg py-3 pl-4`} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Role">
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className={`${inputCls} appearance-none rounded-lg py-3 pl-4`}>
                      <option value="officer">Officer</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Field>
                  <Field label="Department">
                    <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className={`${inputCls} appearance-none rounded-lg py-3 pl-4`}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Security Password">
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} required placeholder="············" value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className={`${inputCls} rounded-lg py-3 pl-4 pr-10`} />
                      <button type="button" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm Password">
                    <div className="relative">
                      <input type={showConfirmPassword ? 'text' : 'password'} required placeholder="············" value={formData.confirmPassword}
                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`${inputCls} rounded-lg py-3 pl-4 pr-10`} />
                      <button type="button" onClick={() => setShowConfirmPassword(p => !p)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 px-7 py-5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-36 h-10 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors sm:w-24"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="min-w-32 h-10 rounded-lg bg-[#8E288D] px-5 text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────────────────────────────── */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-lg border border-[#8E288D]/30 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex min-h-20 items-center justify-between bg-[#efdfed] dark:bg-purple-950/50 px-7 py-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-[#8E288D] dark:text-purple-300">Edit User</h3>
                <FiEdit2 className="text-[#8E288D] dark:text-purple-300" size={18} />
              </div>
              <button type="button" onClick={() => setShowEditModal(false)} aria-label="Close edit user form" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3c5df] dark:bg-purple-900/40 text-[#8E288D] dark:text-purple-300 transition hover:bg-[#d9b2d4] dark:hover:bg-purple-800/50">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="flex flex-col">
              <div className="grid grid-cols-1 gap-4 px-7 py-6">
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
                      className={`${inputCls} pr-7 appearance-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400`}>
                      <option value="officer">Officer</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </Field>
              </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 px-7 py-5">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="w-36 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button type="submit"
                  className="w-36 h-10 rounded-lg bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors">
                    Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Activate / Deactivate Confirmation Modal ───────────────────── */}
      {showActionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-[#8E288D]/30 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex min-h-20 items-center gap-3 bg-[#efdfed] dark:bg-purple-950/50 px-7 py-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pendingAction === 'deactivate' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
                {pendingAction === 'deactivate'
                  ? <FiUserX className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  : <FiUserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#8E288D] dark:text-purple-300">
                  {pendingAction === 'deactivate' ? 'Deactivate User' : 'Activate User'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {pendingAction === 'deactivate' ? 'This will disable the user account.' : 'This will re-enable the user account.'}
                </p>
              </div>
            </div>
            <div className="px-7 py-6">
              <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to {pendingAction === 'deactivate' ? 'deactivate' : 'activate'} <strong>{selectedUser.username}</strong>?
              </p>
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 px-7 py-5 -mx-7 -mb-6">
                <button onClick={() => { setShowActionModal(false); setSelectedUser(null); setPendingAction(null) }}
                  className="w-36 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button onClick={confirmPendingAction}
                  className={`w-36 h-10 rounded-lg text-sm font-semibold text-white transition-colors ${pendingAction === 'deactivate' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {pendingAction === 'deactivate' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────────────────────────────── */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-[#8E288D]/30 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex min-h-20 items-center justify-between bg-[#efdfed] dark:bg-purple-950/50 px-7 py-4">
              <div>
                <h3 className="text-xl font-extrabold text-[#8E288D] dark:text-purple-300">Reset Password</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Set a new password for <strong>{selectedUser.username}</strong></p>
              </div>
              <button type="button" onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }} aria-label="Close reset password form"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3c5df] dark:bg-purple-900/40 text-[#8E288D] dark:text-purple-300 transition hover:bg-[#d9b2d4] dark:hover:bg-purple-800/50">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col">
              <div className="grid grid-cols-1 gap-4 px-7 py-6 sm:grid-cols-2">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">New Password</label>
                  <input type={showPassword ? 'text' : 'password'} required placeholder="············" value={resetForm.newPassword}
                    onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 py-3 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]" />
                  <button type="button" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-[2.35rem] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Confirm Password</label>
                  <input type={showConfirmPassword ? 'text' : 'password'} required placeholder="············" value={resetForm.confirmPassword}
                    onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 py-3 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]" />
                  <button type="button" onClick={() => setShowConfirmPassword(p => !p)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-3 top-[2.35rem] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 px-7 py-5">
                <button type="button" onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetForm({ newPassword: '', confirmPassword: '' }) }}
                  className="w-36 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button type="submit"
                  className="w-36 h-10 rounded-lg bg-[#8E288D] text-sm font-semibold text-white hover:bg-[#7A1E79] transition-colors">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-[#8E288D]/30 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex min-h-20 items-center gap-3 bg-[#efdfed] dark:bg-purple-950/50 px-7 py-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                <FiTrash2 className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#8E288D] dark:text-purple-300">Delete User</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <div className="px-7 py-6">
              <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <strong>{selectedUser.full_name}</strong>? All associated reconciliations will also be deleted.
              </p>
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 px-7 py-5 -mx-7 -mb-6">
                <button onClick={() => { setShowDeleteModal(false); setSelectedUser(null) }}
                  className="w-36 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button onClick={handleDeleteUser}
                  className="w-36 h-10 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Delete User</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default UserManagement
