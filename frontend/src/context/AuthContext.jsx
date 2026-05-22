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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Configure axios defaults when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchCurrentUser()
    } else {
      delete axios.defaults.headers.common['Authorization']
      setLoading(false)
    }
  }, [token])

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/auth/me')
      setUser(response.data.user)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Don't logout on initial load, just clear invalid token
      if (error.response?.status === 422 || error.response?.status === 401) {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
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
    
    // Update state
    setToken(access_token)
    setUser(user)
    
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
    
    // Update state
    setToken(access_token)
    setUser(user)
    
    return response.data
  }

  const logout = () => {
    logActivity(window.location.pathname, 'USER_LOGOUT');
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
