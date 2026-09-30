import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App'
import './index.css'

// Safeguard against third-party extension / browser PerformanceObserver errors (e.g., reportAllChanges / startTime)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes("reading 'startTime'") ||
      event.message?.includes('reportAllChanges') ||
      (event.error?.stack && event.error.stack.includes('reportAllChanges'))
    ) {
      event.preventDefault?.()
      event.stopImmediatePropagation?.()
    }
  })
}

// Configure axios defaults
// baseURL removed so axios uses relative paths and goes through the Vite proxy

// Add request interceptor to include token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to handle errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 422) {
      // Token expired or invalid
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
