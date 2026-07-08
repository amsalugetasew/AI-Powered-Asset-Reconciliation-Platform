import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RoleBadge } from './RoleGuard'
import iconImage from '../assets/AR.PNG'
import { 
  FiHome, 
  FiUpload, 
  FiBarChart2, 
  FiLogOut, 
  FiMenu, 
  FiX,
  FiUser,
  FiSettings,
  FiSearch,
  FiBell,
  FiChevronDown,
  FiUsers,
  FiFileText
} from 'react-icons/fi'

const Layout = () => {
  const { user, logout, userRole, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

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

    // Manager and Admin see audit trail
    if (hasRole('manager')) {
      baseItems.push({ 
        path: '/audit', 
        icon: FiFileText, 
        label: 'Audit Trail', 
        roles: ['manager', 'admin'] 
      })
    }

    // Only Admin sees user management
    if (hasRole('admin')) {
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

  const notifications = [
    { id: 1, message: 'Reconciliation #2 completed', time: '5 min ago', unread: true },
    { id: 2, message: 'New report available', time: '1 hour ago', unread: true },
    { id: 3, message: 'System update completed', time: '2 hours ago', unread: false },
  ]

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-[#F8F8FF] to-[#F8F8FF] text-[#8E288D] transition-all duration-300 ease-in-out fixed h-full z-30 shadow-2xl`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-4 border-b border-[#F8F8F8]">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 flex items-center justify-center relative">
              <img src={iconImage} alt="AI Reconciliation Icon" className="w-14 h-14" />
              <span className="absolute text-[#8E288D] font-black text-xs tracking-wider bg-white/80 px-1 rounded shadow-sm">
                AR
              </span>
            </div>
            {sidebarOpen && (
              <span className="text-xl font-bold">AssetReconcile</span>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-[#8E288D] text-white shadow-lg transform scale-105'
                        : 'text-[#8E288D] hover:bg-[#CFB53C] hover:text-white hover:transform hover:scale-105'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
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
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {sidebarOpen ? (
                    <FiX className="h-6 w-6 text-gray-600" />
                  ) : (
                    <FiMenu className="h-6 w-6 text-gray-600" />
                  )}
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-[#8E288D]">
                    {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-500">Welcome back, {user?.username}!</p>
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
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                      setShowUserMenu(false)
                    }}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-colors relative group"
                  >
                    <FiBell className="h-5 w-5 text-gray-600" />
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Notifications
                    </span>
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map(notif => (
                          <div key={notif.id} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${notif.unread ? 'bg-blue-50' : ''}`}>
                            <p className="text-sm text-gray-800">{notif.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 border-t border-gray-200 text-center">
                        <button className="text-sm text-[#8E288D] hover:text-[#CFB53C]">View all</button>
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
