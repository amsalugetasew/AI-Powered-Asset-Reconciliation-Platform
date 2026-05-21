import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App'
import './index.css'

// Configure axios defaults
axios.defaults.baseURL = 'http://localhost:5000'

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
