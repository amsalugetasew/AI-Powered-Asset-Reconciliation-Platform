import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { RoleBadge } from './RoleGuard'
import iconImage from '../assets/CBE_Logo.png'
import { 
  FiHome, FiUpload, FiBarChart2, FiLogOut, FiMenu, FiX,  FiUser, FiSettings, FiSearch, 
  FiBell, FiChevronDown,FiUsers, FiFileText, FiCheckCircle, FiAlertCircle,  FiXCircle, FiInfo, FiEye, FiTrash2, FiMoon, FiSun
} from 'react-icons/fi'
import { Eye, EyeOff } from "lucide-react";
const Layout = () => {
  const { user, logout, userRole, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileTab, setProfileTab] = useState('profile')
  const [profileForm, setProfileForm] = useState({ username: user?.username || '', email: user?.email || '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || '')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light'
    }
    return 'light'
  })

  // ── Real notifications from backend ──────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissedNotifs') || '[]') }
    catch { return [] }
  })

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await axios.get('/api/activity/notifications')
      setNotifications(r.data.notifications || [])
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000) // refresh every 60s
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    if (user) {
      setProfileForm({ username: user.username || '', email: user.email || '' })
      setProfilePicture(user.profile_picture || '')
    }
  }, [user])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id))
  const unreadCount = activeNotifications.length

  const dismissOne = (id) => {
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    localStorage.setItem('dismissedNotifs', JSON.stringify(updated))
  }

  const dismissAll = () => {
    const updated = [...dismissedIds, ...activeNotifications.map(n => n.id)]
    setDismissedIds(updated)
    localStorage.setItem('dismissedNotifs', JSON.stringify(updated))
    setShowNotifications(false)
  }

  const severityIcon = (s) => {
    if (s === 'success') return <FiCheckCircle className="text-green-500 flex-shrink-0" />
    if (s === 'warning') return <FiAlertCircle className="text-yellow-500 flex-shrink-0" />
    if (s === 'error')   return <FiXCircle className="text-red-500 flex-shrink-0" />
    return <FiInfo className="text-blue-500 flex-shrink-0" />
  }

  const severityBg = (s) => {
    if (s === 'success') return 'border-l-green-500'
    if (s === 'warning') return 'border-l-yellow-500'
    if (s === 'error')   return 'border-l-red-500'
    return 'border-l-blue-500'
  }

  const handleLogout = () => {
    setConfirmAction('logout')
  }

  const confirmLogout = () => {
    logout()
    setConfirmAction(null)
    navigate('/login')
  }

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setProfilePicture(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      const response = await axios.put('/api/auth/profile', {
        username: profileForm.username,
        email: profileForm.email,
        profile_picture: profilePicture
      })

      toast.success('Profile updated successfully')
      setShowProfileModal(false)
      window.location.reload()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }

    setIsSaving(true)

    try {
      await axios.post('/api/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      })

      toast.success('Password updated successfully')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setProfileTab('profile')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to change password')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAccountAction = async (action) => {
    setConfirmAction(action)
  }

  const confirmAccountAction = () => {
    if (confirmAction === 'deactivate') {
      toast.info('Deactivate account is not enabled yet in the backend.')
    } else if (confirmAction === 'delete') {
      toast.info('Delete account is not enabled yet in the backend.')
    } else if (confirmAction === 'logout') {
      confirmLogout()
      return
    }
    setConfirmAction(null)
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const avatarSrc = profilePicture || user?.profile_picture || ''

  // Role-based menu items
  const getMenuItems = () => {
    const baseItems = [
      { path: '/', icon: FiHome, label: 'Dashboard', roles: ['officer', 'manager', 'admin'] },
      { path: '/upload', icon: FiUpload, label: 'Reconciliation', roles: ['officer', 'manager', 'admin'] },
      { path: '/analytics', icon: FiBarChart2, label: 'Reports', roles: ['officer', 'manager', 'admin'] },
    ]

    // Only Admin sees audit trail and user management
    if (hasRole('admin')) {
      baseItems.push({ 
        path: '/audit', 
        icon: FiFileText, 
        label: 'Audit Trail', 
        roles: ['admin'] 
      })
      baseItems.push({ 
        path: '/users', 
        icon: FiUsers, 
        label: 'User Management', 
        roles: ['admin'] 
      })
    }

    return baseItems.filter(item => 
      !item.roles || item.roles.includes(userRole)
    )
  }

  const menuItems = getMenuItems()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white/95 text-gray-700 transition-all duration-300 ease-in-out fixed h-full z-30 shadow-2xl border-r border-gray-200 transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-0 border-b border-[#F8F8F8] bg-white/80 transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/70">
          <div className="flex items-center space-x-3">
            <div
              className={`${sidebarOpen ? "w-60 h-28" : "w-20 h-20"
                } flex items-center justify-center relative transition-all duration-300`}
            >
              <img
                src={iconImage}
                alt="AI Reconciliation Icon"
                className={`${sidebarOpen ? "w-40 h-28" : "w-12 h-16"
                  } object-contain transition-all duration-300`}
              />
            </div>
            {/* <div className="w-60 h-28 flex items-center justify-center relative">
              <img src={iconImage} alt="AI Reconciliation Icon" className="w-40 h-28" />
            </div> */}
            {/* {sidebarOpen && (
              // <span className="text-xl font-bold">AssetReconcile</span>
              <span className="text-xl font-bold">AR</span>
            )} */}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-0 px-4 py-3 transition-colors duration-300">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-[#EDE9FE] to-[#F3E8FF] text-[#8E288D] shadow-lg transform scale-105 dark:from-[#8E288D]/30 dark:to-[#CFB53C]/20 dark:text-gray-100'
                        : 'text-gray-500 hover:bg-gradient-to-r from-[#EDE9FE] to-gray-300 hover:text-gray-700 hover:transform hover:scale-105 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
                  {/* <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] shadow-lg transform scale-105'
                        : 'text-[#8E288D] hover:bg-gradient-to-r from-[#CFB53C] to-[#8E288D] hover:text-white hover:transform hover:scale-105'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link> */}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 w-full p-4 border-t border-[#8E288D]/20 bg-white/80 transition-colors duration-300 dark:border-gray-700 dark:bg-gray-900/70">
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#8E288D]/20 bg-[#8E288D] flex items-center justify-center text-white">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <FiUser className="h-5 w-5" />
              )}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium truncate text-[#8E288D] dark:text-purple-300">{user?.username}</p>
                <p className="text-xs text-[#CFB53C] truncate dark:text-yellow-300">{user?.email}</p>
                {userRole && (
                  <div className="mt-1">
                    <RoleBadge role={userRole} size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className={`mt-3 flex ${sidebarOpen ? 'w-full' : 'w-10 mx-auto'} items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700`}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            {sidebarOpen && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300 flex flex-col h-screen`}>
        {/* Top Navbar - Sticky */}
        <nav className="bg-white shadow-md sticky top-0 z-20 flex-shrink-0 dark:bg-gray-800 dark:text-gray-100">
          <div className="px-2 py-2">
            <div className="flex justify-between items-center">
              {/* Left side - Toggle and Title */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="relative z-50 p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-700"
                >
                  {sidebarOpen ? (
                    <FiX className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                  ) : (
                    <FiMenu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                  )}
                </button>
                <div className='flex'>
                  <h1 className="text-2xl font-bold text-[#8E288D] mr-3">
                    {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-2 mr-10 dark:text-gray-400">Welcome To, {user?.username}!</p>
                  <div className="flex items-center justify-between p-0 border-b border-[#F8F8F8] ml-10">
                    <div className="flex items-center space-x-3">
                      <div className="w-60 h-10 flex items-center justify-center relative">
                        <img src={iconImage} alt="AI Reconciliation Icon" className="w-40 h-24" />
                        <span className="absolute text-[#8E288D] font-black text-xs tracking-wider bg-white/80 px-1 rounded shadow-sm">
                          {/* AR */}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Icon Actions */}
              <div className="flex items-center space-x-2">
                {/* Search Icon */}
                {/* <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group">
                  <FiSearch className="h-5 w-5 text-gray-600" />
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded
                   opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Search
                  </span>
                </button> */}

                {/* Notifications Icon */}
                <div className="relative">
                  <button
                    onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group dark:hover:bg-gray-700"
                  >
                    <FiBell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
                    </span>
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={fetchNotifications}
                            className="text-xs text-gray-500 hover:text-[#8E288D] transition-colors">
                            Refresh
                          </button>
                          {unreadCount > 0 && (
                            <button onClick={dismissAll}
                              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                              Dismiss All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* List */}
                      <div className="max-h-[420px] overflow-y-auto">
                        {activeNotifications.length === 0 ? (
                          <div className="px-4 py-10 text-center text-gray-400">
                            <FiBell className="mx-auto h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No new notifications</p>
                          </div>
                        ) : (
                          activeNotifications.map(notif => (
                            <div key={notif.id}
                              className={`border-l-4 ${severityBg(notif.severity)} px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors`}>
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">{severityIcon(notif.severity)}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-800">{notif.title}</p>
                                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.message}</p>
                                </div>
                                <div className="flex gap-1 flex-shrink-0 ml-1">
                                  {notif.link && (
                                    <button
                                      onClick={() => { navigate(notif.link); setShowNotifications(false) }}
                                      className="p-1 rounded text-gray-400 hover:text-[#8E288D] hover:bg-purple-50 transition-colors"
                                      title="View">
                                      <FiEye className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => dismissOne(notif.id)}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Dismiss">
                                    <FiTrash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings Icon */}
                <button
                  onClick={() => {
                    setShowProfileModal(true)
                    setProfileTab('theme-only')
                  }}
                  className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group dark:hover:bg-gray-700"
                >
                  <FiSettings className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Settings
                  </span>
                </button>

                {/* User Menu Icon */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowUserMenu(!showUserMenu)
                      setShowNotifications(false)
                    }}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-700"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[#8E288D] to-[#CFB53C] rounded-full overflow-hidden flex items-center justify-center text-white font-semibold">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        user?.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <FiChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>

                  {/* User Dropdown */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 dark:bg-gray-800 dark:border-gray-700">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{user?.username}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                        {userRole && (
                          <div className="mt-2">
                            <RoleBadge role={userRole} size="sm" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setShowUserMenu(false)
                          setShowProfileModal(true)
                          setProfileTab('profile')
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 dark:hover:bg-gray-700 dark:text-gray-200"
                      >
                        <FiUser className="h-4 w-4" />
                        <span>Profile</span>
                      </button>
                      <button 
                        onClick={() => {
                          setShowUserMenu(false)
                          setShowProfileModal(true)
                          setProfileTab('theme-only')
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 dark:hover:bg-gray-700 dark:text-gray-200"
                      >
                        <FiSettings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      <div className="border-t border-gray-200 my-2 dark:border-gray-700"></div>
                      <button 
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center space-x-2 text-red-600"
                      >
                        <FiLogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Scrollable Content Area (Main + Footer) */}
        <div className="flex-1 overflow-y-auto">
          {/* Main Content */}
          <main className="p-1 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-[1550px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <p>© 2026 AssetReconcile AI. All rights reserved.</p>
                <p>Version 1.0.0</p>
              </div>
            </div>
          </footer>
        </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {confirmAction === 'delete'
                ? 'Delete account?'
                : confirmAction === 'logout'
                  ? 'Logout?'
                  : 'Deactivate account?'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {confirmAction === 'delete'
                ? 'This action is permanent and cannot be undone.'
                : confirmAction === 'logout'
                  ? 'Are you sure you want to sign out?'
                  : 'This will disable your access until reactivated.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 max-w-24 h-10 rounded-lg border border-gray-300 text-gray-700">
                Cancel
              </button>
              <button onClick={confirmAccountAction} className="flex-1 max-w-24 h-10 rounded-lg bg-pink-500 text-white">
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {profileTab === 'theme-only' ? 'Settings' : 'My Profile'}
                </h3>
                <p className="text-sm text-gray-500">
                  {profileTab === 'theme-only' ? 'Adjust the app appearance' : 'Manage your picture, account details, and password'}
                </p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {profileTab !== 'theme-only' && (
              <div className="px-6 py-4 border-b border-gray-200 flex gap-2">
                <button
                  onClick={() => setProfileTab('profile')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${profileTab === 'profile' ? 'bg-[#8E288D] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setProfileTab('settings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${profileTab === 'settings' ? 'bg-[#8E288D] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Password
                </button>
              </div>
            )}

            {profileTab === 'profile' ? (
              <form onSubmit={handleProfileSave} className="p-6 space-y-5">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={profilePicture || 'https://ui-avatars.com/api/?name=' + (user?.username || 'User')}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-[#8E288D]/20"
                    />
                    <label className="cursor-pointer rounded-lg border border-dashed border-[#8E288D] px-3 py-2 text-sm text-[#8E288D] hover:bg-purple-50">
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureChange} />
                      Change picture
                    </label>
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-[#8E288D] text-white disabled:opacity-60">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : profileTab === 'theme-only' ? (
              <div className="p-6 space-y-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Theme</h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose the app appearance you prefer.</p>
                  <div className="mt-4 inline-flex items-center rounded-full border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-700">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${theme === 'light' ? 'bg-[#8E288D] text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      <FiSun className="h-4 w-4" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${theme === 'dark' ? 'bg-[#8E288D] text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      <FiMoon className="h-4 w-4" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <form onSubmit={handlePasswordSave} className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-2 mt-1/2 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600"
                      aria-label={showCurrentPassword ? "Hide password" : "Show password"}>
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2 mt-1/2 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}>
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2 mt-1/2 top-1/2 -translate-y-0 text-slate-400 hover:text-slate-600"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-[#8E288D] text-white disabled:opacity-60">
                      {isSaving ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </form>

                <div className="border-t border-gray-200 pt-4">
                  {/* <h4 className="text-sm font-semibold text-gray-800">Password update</h4> */}
                  <p className="mt-1 text-sm text-gray-500">Use this form to change your account password.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showUserMenu || showNotifications) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowUserMenu(false)
            setShowNotifications(false)
          }}
        ></div>
      )}
    </div>
  )
}

export default Layout
