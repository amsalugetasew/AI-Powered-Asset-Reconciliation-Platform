"""
Role-Based Access Control (RBAC) utilities

Provides decorators and helper functions for enforcing role-based
permissions on API endpoints.
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity

# Role hierarchy - higher number = more permissions
ROLE_HIERARCHY = {
    'officer': 1,
    'manager': 2,
    'admin': 3
}

def get_user_role():
    """
    Extract role from JWT token.
    
    Returns:
        str: User role ('officer', 'manager', or 'admin')
        
    Raises:
        Exception: If JWT verification fails or role is missing
    """
    verify_jwt_in_request()
    claims = get_jwt()
    role = claims.get('role', 'officer')  # Default to officer for backward compatibility
    return role


def get_user_from_token():
    """
    Get User object from JWT token.
    
    Returns:
        User: User object from database
        
    Raises:
        Exception: If user not found
    """
    from models import User
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    return user


def require_role(required_role):
    """
    Decorator to enforce role-based access control on endpoints.
    
    Args:
        required_role (str): Minimum role required ('officer', 'manager', or 'admin')
        
    Usage:
        @app.route('/api/admin/users')
        @jwt_required()
        @require_role('admin')
        def list_users():
            return {'users': [...]}
    
    The decorator enforces role hierarchy:
    - admin can access admin, manager, and officer endpoints
    - manager can access manager and officer endpoints
    - officer can only access officer endpoints
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                # Verify JWT token exists and is valid
                verify_jwt_in_request()
                
                # Get user role from token
                claims = get_jwt()
                user_role = claims.get('role')
                
                # Check if role claim exists
                if not user_role:
                    return jsonify({
                        'error': 'Invalid token: missing role information',
                        'message': 'Your token does not contain role information. Please login again.'
                    }), 401
                
                # Validate role value
                if user_role not in ROLE_HIERARCHY:
                    return jsonify({
                        'error': 'Invalid role in token',
                        'message': f'Role "{user_role}" is not recognized. Please contact administrator.'
                    }), 401
                
                # Check if user has sufficient permissions
                user_level = ROLE_HIERARCHY.get(user_role, 0)
                required_level = ROLE_HIERARCHY.get(required_role, 999)
                
                if user_level < required_level:
                    return jsonify({
                        'error': 'Insufficient permissions',
                        'message': f'This operation requires {required_role} role or higher.',
                        'your_role': user_role,
                        'required_role': required_role
                    }), 403
                
                # User has sufficient permissions - proceed with request
                return fn(*args, **kwargs)
                
            except Exception as e:
                # Handle any unexpected errors
                error_message = str(e)
                
                # Check for specific JWT errors
                if 'expired' in error_message.lower():
                    return jsonify({
                        'error': 'Token expired',
                        'message': 'Your session has expired. Please login again.'
                    }), 401
                elif 'invalid' in error_message.lower():
                    return jsonify({
                        'error': 'Invalid token',
                        'message': 'Your token is invalid. Please login again.'
                    }), 401
                else:
                    return jsonify({
                        'error': 'Authorization failed',
                        'message': error_message
                    }), 401
        
        return wrapper
    return decorator


def require_admin(fn):
    """
    Shortcut decorator for admin-only endpoints.
    
    Usage:
        @app.route('/api/admin/users')
        @jwt_required()
        @require_admin
        def list_users():
            return {'users': [...]}
    """
    return require_role('admin')(fn)


def require_manager(fn):
    """
    Shortcut decorator for manager-level endpoints (manager or admin).
    
    Usage:
        @app.route('/api/reconciliation/:id/approve')
        @jwt_required()
        @require_manager
        def approve_exception(id):
            return {'message': 'Approved'}
    """
    return require_role('manager')(fn)


def has_role(user_role, required_role):
    """
    Check if a user role meets the required role level.
    
    Args:
        user_role (str): User's current role
        required_role (str): Required role level
        
    Returns:
        bool: True if user has sufficient permissions
        
    Usage:
        if has_role('manager', 'officer'):
            # Manager can access officer-level resources
            pass
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(required_role, 999)
    return user_level >= required_level


def get_role_level(role):
    """
    Get numeric level for a role.
    
    Args:
        role (str): Role name
        
    Returns:
        int: Numeric level (1-3, or 0 for invalid roles)
    """
    return ROLE_HIERARCHY.get(role, 0)


def is_valid_role(role):
    """
    Check if a role value is valid.
    
    Args:
        role (str): Role to validate
        
    Returns:
        bool: True if role is valid
    """
    return role in ROLE_HIERARCHY
