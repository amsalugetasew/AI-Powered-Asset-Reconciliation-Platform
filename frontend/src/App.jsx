import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Results from './pages/Results'
import Analytics from './pages/Analytics'
import UserManagement from './pages/UserManagement'
import AuditTrail from './pages/AuditTrail'
import ApprovalPage from './pages/ApprovalPage'
import Layout from './components/Layout'
import ActivityLogger from './components/ActivityLogger'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" />
}

// Role-Based Route Protection
const RoleProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, hasRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E288D]"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. 
            This section requires {requiredRole} role or higher.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-[#8E288D] text-white px-6 py-2 rounded-lg hover:bg-[#7a2279] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ActivityLogger />
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
            <Route path="results/:id" element={<Results />} />
            <Route path="analytics" element={<Analytics />} />
            
            {/* Manager+ Routes */}
            <Route path="approval/:id" element={
              <RoleProtectedRoute requiredRole="manager">
                <ApprovalPage />
              </RoleProtectedRoute>
            } />
            <Route path="audit" element={
              <RoleProtectedRoute requiredRole="manager">
                <AuditTrail />
              </RoleProtectedRoute>
            } />
            
            {/* Admin Only Routes */}
            <Route path="users" element={
              <RoleProtectedRoute requiredRole="admin">
                <UserManagement />
              </RoleProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
