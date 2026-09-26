import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { RoleBadge } from './RoleGuard'
import iconImage from '../assets/CBE_Logo.png'
import { 
  FiHome, FiUpload, FiBarChart2, FiLogOut, FiMenu, FiX,  FiUser, FiSettings, FiSearch, 
  FiBell, FiChevronDown, FiUsers, FiFileText, FiCheckCircle, FiAlertCircle,  FiXCircle, FiInfo, FiEye, FiTrash2, FiMoon, FiSun,
  FiChevronsLeft, FiChevronsRight
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
  const [headerSearch, setHeaderSearch] = useState('')
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light'
    }
    return 'light'
  })

  // ── Real notifications from backend ──────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await axios.get('/api/activity/notifications')
      setNotifications(r.data.notifications || [])
      setDismissedIds([])
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
    setDismissedIds(prev => [...prev, id])
  }

  const dismissAll = () => {
    setDismissedIds(prev => [...prev, ...activeNotifications.map(n => n.id)])
    setShowNotifications(false)
  }

  const handleNotificationView = async notification => {
    dismissOne(notification.id)
    setShowNotifications(false)

    try {
      await axios.post('/api/activity/notifications/dismiss', {
        notification_id: notification.id,
      })
    } catch {
      // Local dismissal keeps the viewed notification hidden if the request fails.
    }

    if (notification.link) navigate(notification.link)
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
    return 'border-l-rose-500'
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
      { path: '/upload', icon: FiUpload, label: 'Upload & Reconcile', roles: ['officer', 'manager', 'admin'] },
      { path: '/analytics', icon: FiBarChart2, label: 'Reports & Analytics', roles: ['officer', 'manager', 'admin'] },
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
    <div className="h-screen overflow-hidden bg-[#F8F9FA] text-gray-900 dark:bg-gray-950 dark:text-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${theme === 'dark' ? 'bg-[#24132d]' : 'bg-[#701460]'} 
        text-white transition-all duration-300 ease-in-out fixed h-full z-30 shadow-2xl flex flex-col justify-between`}
      >
        {/* Top Branding Section */}
        <div>
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
            <div className="flex items-center space-x-1 overflow-hidden">
              <img
                src={iconImage}
                alt="CBE Logo"
                className="w-36 h-20 object-contain p-0 flex-shrink-0"
              />

              {sidebarOpen && (
                <div className="flex flex-col min-w-0">
                  {/* Optional sidebar title */}
                </div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors flex-shrink-0"
              title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {sidebarOpen ? (
                <FiChevronsLeft className="h-4 w-4" />
              ) : (
                <FiChevronsRight className="h-4 w-4" />
              )}
            </button>
</div>

          {/* Navigation Menu */}
          <nav className="mt-4 px-3">
            <ul className="space-y-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      title={!sidebarOpen ? item.label : undefined}
                      className={`flex items-center ${
                        sidebarOpen ? 'space-x-3 px-3.5 py-2.5' : 'justify-center py-2.5 px-2'
                      } rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? theme === 'dark'
                            ? 'bg-[#3b2447] text-[#f3d7ff] font-semibold shadow-md'
                            : 'bg-white text-[#701460] font-semibold shadow-md'
                          : 'text-purple-100/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${active ? (theme === 'dark' ? 'text-[#f3d7ff]' : 'text-[#701460]') : 'text-purple-200'}`} />
                      {sidebarOpen && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className={`p-3.5 border-t border-white/10 space-y-3 ${theme === 'dark' ? 'bg-[#1b1022]' : 'bg-[#641155]'}`}>
          {/* Dark Mode Switch */}
          <div
            onClick={toggleTheme}
            className={`flex items-center ${
              sidebarOpen ? 'justify-between px-3 py-2' : 'justify-center py-2'
            } rounded-lg text-xs text-purple-100/90 hover:bg-white/10 cursor-pointer transition-colors`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="flex items-center space-x-2.5">
              <FiMoon className="h-4 w-4 text-purple-200 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium">Dark Mode</span>}
            </div>
            {sidebarOpen && (
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 duration-300 cursor-pointer ${
                  theme === 'dark' ? 'bg-[#CFB53B]' : 'bg-white/30'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Log Out Button */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${
              sidebarOpen
                ? theme === 'dark'
                  ? 'justify-between px-3 py-2 bg-[#302038] text-gray-100 hover:bg-[#432b4f]'
                  : 'justify-between px-3 py-2 bg-white text-gray-800 hover:bg-gray-100'
                : theme === 'dark'
                  ? 'justify-center py-2 bg-[#302038] text-gray-100 hover:bg-[#432b4f]'
                  : 'justify-center py-2 bg-white text-gray-800 hover:bg-gray-100'
            } rounded-lg text-xs font-semibold shadow-sm transition-colors`}
            title="Log Out"
          >
            <span className={sidebarOpen ? 'block' : 'hidden'}>Log Out</span>
            <FiLogOut className="h-4 w-4 text-red-600 flex-shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`min-w-0 min-h-0 flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300 flex flex-col`}>
        {/* Top Navbar */}
        <nav className="min-w-0 overflow-visible bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 px-6 py-3 shadow-sm flex-shrink-0">
          <div className="flex justify-between items-center gap-4">
            {/* Left: Breadcrumb / Greeting */}
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-bold text-[#701460] dark:text-purple-400 text-base">
                {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </span>
              <span className="text-gray-400">›</span>
              <span className="text-gray-500 dark:text-gray-400">
                Welcome, <span className="font-medium text-gray-700 dark:text-gray-200">{user?.full_name || 'User'} </span>
              </span>
            </div>

            {/* Middle: Search Input */}
            {/* <div className="hidden md:flex flex-1 max-w-md mx-6">
              <div className="relative w-full">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets, jobs, or branches..."
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-9 pr-4 py-1.5 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#701460]/40 focus:border-[#701460]"
                />
              </div>
            </div> */}

            {/* Right: Actions (Notification, Settings, User Profile) */}
            <div className="flex items-center space-x-3">
              {/* Notification Icon */}
              <div className="relative">
                <button
                  onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 relative transition-colors"
                  title="Notifications"
                >
                  <FiBell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={fetchNotifications}
                          className="text-xs text-gray-500 hover:text-[#701460] transition-colors">
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
                            className={`border-l-4 ${severityBg(notif.severity)} px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800 transition-colors`}>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{severityIcon(notif.severity)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{notif.title}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">{notif.message}</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0 ml-1">
                                {notif.link && (
                                  <button
                                    onClick={() => handleNotificationView(notif)}
                                    className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
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

              {/* Settings Gear Icon */}
              {/* <button
                onClick={() => {
                  setShowProfileModal(true)
                  setProfileTab('theme-only')
                }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                title="Settings"
              >
                <FiSettings className="h-5 w-5" />
              </button> */}

              {/* User Profile Pill & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu)
                    setShowNotifications(false)
                  }}
                  className={`flex items-center space-x-2.5 p-1 pl-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-[#302038] hover:bg-[#432b4f]' : 'bg-purple-100 hover:bg-purple-200'}`}
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden text-white flex items-center justify-center font-semibold text-xs ${theme === 'dark' ? 'bg-[#5b2a68] border border-[#8e5a9e]' : 'bg-[#701460] border border-purple-200'}`}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.full_name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                      {userRole || 'Officer'}
                    </p>
                  </div>
                  <FiChevronDown className="h-3.5 w-3.5 text-gray-500 hidden sm:block" />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{user?.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
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
                      className="w-full px-4 py-2 text-left text-xs hover:bg-gray-50 flex items-center space-x-2 dark:hover:bg-gray-700 dark:text-gray-200"
                    >
                      <FiUser className="h-4 w-4" />
                      <span>My Profile</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowUserMenu(false)
                        setShowProfileModal(true)
                        setProfileTab('theme-only')
                      }}
                      className="w-full px-4 py-2 text-left text-xs hover:bg-gray-50 flex items-center space-x-2 dark:hover:bg-gray-700 dark:text-gray-200"
                    >
                      <FiSettings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <div className="border-t border-gray-100 my-1 dark:border-gray-700"></div>
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-xs hover:bg-red-50 flex items-center space-x-2 text-red-600"
                    >
                      <FiLogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Scrollable Content Area */}
        <div className="min-w-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#F8F9FA] dark:bg-gray-950">
          <main className="min-w-0 p-6">
            <div className="max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-6 py-3 text-xs text-gray-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 flex justify-between items-center flex-shrink-0">
          <p>© 2026 AssetReconcile AI — Commercial Bank of Ethiopia. All rights reserved.</p>
          <p>Version 2.0</p>
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
              <button onClick={() => setConfirmAction(null)} className="w-28 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmAccountAction} className="w-28 h-10 rounded-lg bg-pink-500 text-sm font-semibold text-white hover:bg-pink-600 transition-colors">
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
                  className={`px-4 py-2 min-w-36 h-10 rounded-lg text-sm font-medium ${profileTab === 'profile' ? 'bg-[#8E288D] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setProfileTab('settings')}
                  className={`px-4 py-2 min-w-36 h-10 rounded-lg text-sm font-medium ${profileTab === 'settings' ? 'bg-[#8E288D] text-white' : 'bg-gray-100 text-gray-700'}`}
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
                  <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 min-w-36 h-10 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-2 min-w-36 h-10 rounded-lg bg-[#8E288D] text-white disabled:opacity-60">
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
                    <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 min-w-36 h-10 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 min-w-36 h-10 rounded-lg bg-[#8E288D] text-white disabled:opacity-60">
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
