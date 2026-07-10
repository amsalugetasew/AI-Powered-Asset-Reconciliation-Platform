import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { RoleBadge } from './RoleGuard'
import iconImage from '../assets/CBE_Logo.png'
import { 
  FiHome, FiUpload, FiBarChart2, FiLogOut, FiMenu, FiX,
  FiUser, FiSettings, FiSearch, FiBell, FiChevronDown,
  FiUsers, FiFileText, FiCheckCircle, FiAlertCircle,
  FiXCircle, FiInfo, FiEye, FiTrash2
} from 'react-icons/fi'

const Layout = () => {
  const { user, logout, userRole, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

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
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    return location.pathname === path
  }

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
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-[#F8F8FF] to-[#F8F8FF] text-gray-700 transition-all duration-300 ease-in-out fixed h-full z-30 shadow-2xl`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-0 border-b border-[#F8F8F8]">
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
        <nav className="mt-0 px-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-[#F3F4F6] to-[#E5E7EB] text-gray-700 rounded-lg hover:from-[#E5E7EB] hover:to-[#F3F4F6] shadow-lg transform scale-105'
                        : 'text-gray-500 hover:bg-gradient-to-r from-[#EDE9FE] to-gray-300 hover:text-gray-700 hover:transform hover:scale-105'
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
        <div className="absolute bottom-0 w-full p-4 border-t border-[#8E288D]/20">
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="bg-[#8E288D] p-2 rounded-full">
              <FiUser className="h-5 w-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium truncate text-[#8E288D]">{user?.username}</p>
                <p className="text-xs text-[#CFB53C] truncate">{user?.email}</p>
                {userRole && (
                  <div className="mt-1">
                    <RoleBadge role={userRole} size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300 flex flex-col h-screen`}>
        {/* Top Navbar - Sticky */}
        <nav className="bg-white shadow-md sticky top-0 z-20 flex-shrink-0">
          <div className="px-2 py-2">
            <div className="flex justify-between items-center">
              {/* Left side - Toggle and Title */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  // className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  className="relative z-50 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {sidebarOpen ? (
                    <FiX className="h-6 w-6 text-gray-600" />
                  ) : (
                    <FiMenu className="h-6 w-6 text-gray-600" />
                  )}
                </button>
                <div className='flex'>
                  <h1 className="text-2xl font-bold text-[#8E288D] mr-3">
                    {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-2 mr-10">Welcome To, {user?.username}!</p>
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
                <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group">
                  <FiSearch className="h-5 w-5 text-gray-600" />
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded
                   opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Search
                  </span>
                </button>

                {/* Notifications Icon */}
                <div className="relative">
                  <button
                    onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group"
                  >
                    <FiBell className="h-5 w-5 text-gray-600" />
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
                <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group">
                  <FiSettings className="h-5 w-5 text-gray-600" />
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
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[#8E288D] to-[#CFB53C] rounded-full flex items-center justify-center text-white font-semibold">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <FiChevronDown className="h-4 w-4 text-gray-600" />
                  </button>

                  {/* User Dropdown */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="font-semibold text-gray-800">{user?.username}</p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        {userRole && (
                          <div className="mt-2">
                            <RoleBadge role={userRole} size="sm" />
                          </div>
                        )}
                      </div>
                      <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2">
                        <FiUser className="h-4 w-4" />
                        <span>Profile</span>
                      </button>
                      <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2">
                        <FiSettings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      <div className="border-t border-gray-200 my-2"></div>
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
          <main className="p-1 bg-gray-50">
            <div className="max-w-[1550px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
          {/* Footer */}
          <footer className="bg-white border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <p>© 2026 AssetReconcile AI. All rights reserved.</p>
                <p>Version 1.0.0</p>
              </div>
            </div>
          </footer>
        </div>

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
