import React, { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'
import { logActivity } from '../services/activityService'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

/**
 * Decode JWT token to extract payload
 * Simple implementation without external library
 */
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}

/**
 * Role hierarchy values
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  officer: 1,
  manager: 2,
  admin: 3
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Configure axios defaults when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      // Extract role from token
      const payload = decodeJWT(token)
      if (payload && payload.role) {
        setUserRole(payload.role)
      }
      
      fetchCurrentUser()
    } else {
      delete axios.defaults.headers.common['Authorization']
      setUserRole(null)
      setLoading(false)
    }
  }, [token])

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/auth/me')
      const userData = response.data.user
      setUser(userData)
      
      // Update role from API response (most authoritative source)
      if (userData.role) {
        setUserRole(userData.role)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Don't logout on initial load, just clear invalid token
      if (error.response?.status === 422 || error.response?.status === 401) {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
        setUserRole(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const response = await axios.post('/api/auth/login', { username, password })
    const { access_token, user } = response.data
    
    // Store token
    localStorage.setItem('token', access_token)
    
    // Set axios header immediately
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    
    // Extract role from token
    const payload = decodeJWT(access_token)
    const role = payload?.role || user?.role || 'officer'
    
    // Update state
    setToken(access_token)
    setUser(user)
    setUserRole(role)
    
    // Log login activity using setTimeout so token is registered
    setTimeout(() => {
        logActivity('/login', 'USER_LOGIN');
    }, 100);
    
    return response.data
  }

  const register = async (username, email, password) => {
    const response = await axios.post('/api/auth/register', { username, email, password })
    const { access_token, user } = response.data
    
    // Store token
    localStorage.setItem('token', access_token)
    
    // Set axios header immediately
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    
    // Extract role from token
    const payload = decodeJWT(access_token)
    const role = payload?.role || user?.role || 'officer'
    
    // Update state
    setToken(access_token)
    setUser(user)
    setUserRole(role)
    
    return response.data
  }

  const logout = () => {
    logActivity(window.location.pathname, 'USER_LOGOUT');
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setUserRole(null)
    delete axios.defaults.headers.common['Authorization']
  }

  /**
   * Check if user has required role or higher
   * @param {string} requiredRole - Required role level
   * @returns {boolean}
   */
  const hasRole = (requiredRole) => {
    if (!userRole) return false
    const userLevel = ROLE_HIERARCHY[userRole] || 0
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 999
    return userLevel >= requiredLevel
  }

  /**
   * Helper functions for role checks
   */
  const isOfficer = () => hasRole('officer')
  const isManager = () => hasRole('manager')
  const isAdmin = () => hasRole('admin')

  const value = {
    user,
    token,
    userRole,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
    loading,
    // Role utilities
    hasRole,
    isOfficer,
    isManager,
    isAdmin
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
