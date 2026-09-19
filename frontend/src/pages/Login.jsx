import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Lock, Eye, EyeOff, Mail } from 'lucide-react'
import iconImage from '../assets/CBE_Logo.png'

const Login = () => {
  const [username, setUsername] = useState(() => localStorage.getItem('rememberedUsername') || '')
  const [password, setPassword] = useState(() => localStorage.getItem('rememberedPassword') || '')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true')
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!rememberMe) {
      localStorage.removeItem('rememberedUsername')
      localStorage.removeItem('rememberedPassword')
      localStorage.removeItem('rememberMe')
    }
  }, [rememberMe])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(username, password)
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username)
        localStorage.setItem('rememberedPassword', password)
        localStorage.setItem('rememberMe', 'true')
      }
      toast.success('Login successful!')
      navigate('/')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <aside className="relative hidden lg:flex w-[52%] min-h-screen flex-col justify-between overflow-hidden bg-[#6B1A78] px-12 py-10 rounded-r-[4.5rem]">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <svg viewBox="0 0 800 900" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="glow" cx="50%" cy="48%" r="45%">
                <stop offset="0%" stopColor="#9ee7ff" stopOpacity="0.55" />
                <stop offset="55%" stopColor="#6B1A78" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#4c0f56" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="900" fill="url(#glow)" />
            <g fill="none" stroke="#d7f6ff" strokeWidth="1.2" opacity="0.55">
              <ellipse cx="400" cy="430" rx="118" ry="150" />
              <ellipse cx="400" cy="430" rx="168" ry="210" />
              <path d="M400 250 C330 280 290 360 290 430 C290 530 330 610 400 640 C470 610 510 530 510 430 C510 360 470 280 400 250 Z" />
              <path d="M340 360 C360 340 440 340 460 360" />
              <circle cx="355" cy="400" r="10" />
              <circle cx="445" cy="400" r="10" />
              <path d="M360 490 Q400 520 440 490" />
              <path d="M250 200 L320 280 L280 340 L360 390" />
              <path d="M550 180 L480 270 L540 330 L460 390" />
              <path d="M180 520 L280 500 L300 560 L380 540" />
              <path d="M620 540 L520 510 L500 580 L430 555" />
              <path d="M400 640 L400 780" />
              <path d="M320 680 L400 720 L480 680" />
              <circle cx="250" cy="200" r="4" fill="#d7f6ff" />
              <circle cx="550" cy="180" r="4" fill="#d7f6ff" />
              <circle cx="180" cy="520" r="4" fill="#d7f6ff" />
              <circle cx="620" cy="540" r="4" fill="#d7f6ff" />
            </g>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center pt-2">
          <img src={iconImage} alt="Commercial Bank of Ethiopia" className="h-26 w-64 object-contain drop-shadow-lg" />
          {/* <p className="mt-4 text-[#E8C547] font-bold tracking-[0.18em] text-sm uppercase">
            Commercial Bank of Ethiopia
          </p> */}
        </div>

        <div className="relative z-10 max-w-lg mx-auto text-center">
          <h1 className="text-white text-4xl xl:text-5xl font-extrabold leading-tight">
            AI-Enabled Asset Reconciliation
          </h1>
          <p className="mt-5 text-white/90 text-base xl:text-lg leading-relaxed">
            Built exclusively for the Commercial Bank of Ethiopia to reconcile 560,000+ assets with precision and speed.
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-center mb-16">
            <p className="text-white text-sm mb-3">Don&apos;t have an account?</p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-10 py-2.5 rounded-lg border border-white text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Sign Up
            </Link>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">© 2026 Commercial Bank of Ethiopia</span>
            <span className="text-[#E8C547] font-medium">Internal System Only</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img src={iconImage} alt="Commercial Bank of Ethiopia" className="h-16 w-16 object-contain" />
            <p className="mt-3 text-[#8E288D] font-bold tracking-wider text-xs uppercase text-center">
              Commercial Bank of Ethiopia
            </p>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#5A1468]">Welcome Back</h2>
            <Lock className="text-[#8E288D]" size={22} />
          </div>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Enter your credentials to access the CBE asset reconciliation platform.
          </p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                Username or Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  className="block w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D] sm:text-sm"
                  placeholder="e.g. almaz.ayana or almaz@cbe.com.et"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-xl border border-gray-200 py-3 pl-11 pr-11 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D] sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#8E288D] focus:ring-[#8E288D]"
                />
                Remember me
              </label>
              <div className="flex flex-col items-end">
                <button
                  type="button"
                  className="text-sm font-medium text-[#8E288D] hover:text-[#6B1A78]"
                  onClick={() => setForgotPasswordMessage('Please contact your administrator to reset your password.')}
                >
                  Forgot Password?
                </button>
                {forgotPasswordMessage && (
                  <p className="mt-1 max-w-[250px] text-right text-xs font-medium text-rose-600" role="status">
                    {forgotPasswordMessage}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#8E288D] py-3.5 px-4 text-sm font-semibold text-white hover:bg-[#7A1E79] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8E288D] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default Login
