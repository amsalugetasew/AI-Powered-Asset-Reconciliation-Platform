import React from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * RoleGuard Component
 * 
 * Conditionally renders children based on user role.
 * Uses role hierarchy: admin > manager > officer
 * 
 * @param {string} requiredRole - Minimum role required to view content
 * @param {React.ReactNode} children - Content to render if role sufficient
 * @param {React.ReactNode} fallback - Optional content to render if role insufficient
 * 
 * @example
 * <RoleGuard requiredRole="manager">
 *   <button>Approve</button>
 * </RoleGuard>
 */
export const RoleGuard = ({ requiredRole, children, fallback = null }) => {
  const { hasRole, loading } = useAuth()

  // Don't render anything while loading
  if (loading) {
    return null
  }

  // Check if user has required role
  if (hasRole(requiredRole)) {
    return <>{children}</>
  }

  // Render fallback if provided
  return fallback ? <>{fallback}</> : null
}

/**
 * Shortcut components for common role checks
 */

/**
 * OfficerOnly - Renders for officers and above
 */
export const OfficerOnly = ({ children, fallback = null }) => {
  return (
    <RoleGuard requiredRole="officer" fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/**
 * ManagerOnly - Renders for managers and admins only
 */
export const ManagerOnly = ({ children, fallback = null }) => {
  return (
    <RoleGuard requiredRole="manager" fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/**
 * AdminOnly - Renders for admins only
 */
export const AdminOnly = ({ children, fallback = null }) => {
  return (
    <RoleGuard requiredRole="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/**
 * RoleBadge Component
 * 
 * Displays a styled badge showing user's role
 * 
 * @param {string} role - User role to display
 * @param {string} size - Badge size: 'sm', 'md', 'lg'
 */
export const RoleBadge = ({ role, size = 'md' }) => {
  if (!role) return null

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  const roleColors = {
    officer: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200'
    },
    manager: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200'
    },
    admin: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200'
    }
  }

  const colors = roleColors[role] || roleColors.officer
  const sizeClass = sizeClasses[size] || sizeClasses.md

  const roleLabels = {
    officer: 'Officer',
    manager: 'Manager',
    admin: 'Admin'
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${colors.bg} ${colors.text} ${colors.border} ${sizeClass}
      `}
      title={`Role: ${roleLabels[role]}`}
    >
      {roleLabels[role]}
    </span>
  )
}

/**
 * RoleDescription Component
 * 
 * Shows a description of what each role can do
 */
export const RoleDescription = ({ role }) => {
  const descriptions = {
    officer: 'Can upload files, view own reconciliations, and resolve matches',
    manager: 'All Officer permissions + approve exceptions, finalize reconciliations, and view system-wide analytics',
    admin: 'All Manager permissions + user management and system configuration'
  }

  return (
    <p className="text-sm text-gray-600">
      {descriptions[role] || 'Unknown role'}
    </p>
  )
}

export default RoleGuard
