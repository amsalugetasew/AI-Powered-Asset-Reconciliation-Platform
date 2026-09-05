import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Lock, Eye, EyeOff, Mail, Hash, Building2 } from 'lucide-react'
import iconImage from '../assets/CBE_Logo.jpg'

const DEPARTMENTS = [
  'Asset Management',
  'Information Technology',
  'Asset Management & Reconciliation',
  'Other',
]

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const set = (field) => (e) => setFormData((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      // Use email as username (CBE corporate email is the unique identifier)
      await register(formData.email, formData.email, formData.password, {
        full_name: formData.fullName,
        department: formData.department,
      })
      toast.success('Account created successfully!')
      navigate('/')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left: Form Panel ──────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-8 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={iconImage} alt="CBE" className="h-14 w-14 object-contain" />
            <p className="mt-2 text-[#8E288D] font-bold tracking-wider text-xs uppercase text-center">
              Commercial Bank of Ethiopia
            </p>
          </div>

          {/* Heading */}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-extrabold text-[#5A1468]">Create Account</h2>
            <Lock className="text-[#8E288D]" size={20} />
          </div>
          <p className="text-gray-500 text-sm mb-7">
            Register to access the Commercial Bank of Ethiopia asset reconciliation platform.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Almaz Ayana"
                  value={formData.fullName}
                  onChange={set('fullName')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]"
                />
              </div>
            </div>

            {/* Employee ID */}
            {/* <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Employee ID
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="e.g. CBE-2024-0451"
                  value={formData.employeeId}
                  onChange={set('employeeId')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]"
                />
              </div> 
            </div>*/}

            {/* Corporate Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                User Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="e.g. almaz.ayana@cbe.com.et"
                  value={formData.email}
                  onChange={set('email')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Department
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <select
                  value={formData.department}
                  onChange={set('department')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D] appearance-none bg-white"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Security Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="············"
                  value={formData.password}
                  onChange={set('password')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="············"
                  value={formData.confirmPassword}
                  onChange={set('confirmPassword')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8E288D]/30 focus:border-[#8E288D]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-full bg-[#8E288D] py-3 text-sm font-semibold text-white hover:bg-[#7A1E79] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8E288D] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>
        </div>
      </main>

      {/* ── Right: CBE Purple Panel ───────────────────────────────────── */}
      <aside className="relative hidden lg:flex w-[48%] min-h-screen flex-col justify-between overflow-hidden bg-[#6B1A78] px-12 py-10 rounded-l-[4.5rem]">
        {/* Background SVG decoration */}
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <svg viewBox="0 0 800 900" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="glow2" cx="50%" cy="48%" r="45%">
                <stop offset="0%" stopColor="#9ee7ff" stopOpacity="0.55" />
                <stop offset="55%" stopColor="#6B1A78" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#4c0f56" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="900" fill="url(#glow2)" />
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

        {/* Logo + brand */}
        <div className="relative z-10 flex flex-col items-center text-center pt-6">
          <img src={iconImage} alt="Commercial Bank of Ethiopia" className="h-24 w-24 object-contain drop-shadow-lg" />
          <p className="mt-4 text-[#E8C547] font-bold tracking-[0.18em] text-sm uppercase">
            Commercial Bank of Ethiopia
          </p>
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-lg mx-auto text-center">
          <h1 className="text-white text-4xl xl:text-5xl font-extrabold leading-tight">
            AI-Enabled Asset<br />Reconciliation
          </h1>
          <p className="mt-5 text-white/90 text-base xl:text-lg leading-relaxed">
            Built exclusively for the Commercial Bank of Ethiopia to manage 560,000+ assets with precision and speed.
          </p>
        </div>

        {/* Login link + footer */}
        <div className="relative z-10">
          <div className="text-center mb-10">
            <p className="text-white text-sm mb-3">Already have an account?</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-10 py-2.5 rounded-full border border-white text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Log In
            </Link>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">© 2026 Commercial Bank of Ethiopia</span>
            <span className="text-[#E8C547] font-medium">Internal System Only</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default Register
