import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Lock, Eye, EyeOff,  User, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import iconImage from '../assets/CBE_Logo.png'
// import iconImage from '../assets/AR.PNG'
const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(username, password)
      toast.success('Login successful!')
      navigate('/')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
        <div>
          <div className="flex items-center justify-center">
            <img src={iconImage} alt="AI Reconciliation Icon" className="w-32 h-18" />
            {/* The Text Overlay */}
            {/* <span className="absolute text-[#8E288D] font-black text-xs tracking-wider bg-white/80 px-1 rounded shadow-sm">
              AR
            </span> */}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Asset Reconcilation
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300
                 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 
                 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className="appearance-none rounded-md relative block w-full px-3 py-3 
                border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md 
                focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
               <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 mt-1/2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 
                px-4 border border-transparent text-sm font-medium rounded-md text-white 
                bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D]
                focus:outline-none focus:ring-2 focus:ring-offset-2 
                focus:ring-[#8E288D] disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            {/* <Link to="/register" className="font-medium text-[#8E288D] hover:text-[#7A1E79]"> */}
              Don't have an account? Contact your administrator.
            {/* </Link> */}
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
