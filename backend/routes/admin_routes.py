"""
Admin Routes - User Management and Audit Logs

Provides admin-only endpoints for:
- User management (create, list, update roles, delete)
- Audit log viewing
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, AuditLog
from utils.rbac import require_admin, get_user_from_token
from services.audit_service import AuditService

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@require_admin
def list_users():
    """
    List all users (Admin only)
    
    Returns:
        200: List of all users with roles
        401: Unauthorized
        403: Forbidden (insufficient permissions)
    """
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users],
            'total': len(users)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users', methods=['POST'])
@jwt_required()
@require_admin
def create_user():
    """
    Create a new user (Admin only)
    
    Request body:
        {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "SecurePass123",
            "role": "officer"  # officer, manager, or admin
        }
    
    Returns:
        201: User created successfully
        400: Invalid input
        401: Unauthorized
        403: Forbidden
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or not all(key in data for key in ['username', 'email', 'password', 'role']):
            return jsonify({'error': 'Missing required fields: username, email, password, role'}), 400
        
        # Validate role enum
        valid_roles = ['officer', 'manager', 'admin']
        if data['role'] not in valid_roles:
            return jsonify({
                'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'
            }), 400
        
        # Check for duplicate username
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        # Check for duplicate email
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            role=data['role']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Log the operation
        admin_user = get_user_from_token()
        AuditService.log_operation(
            user_id=admin_user.id,
            operation_type='CREATE_USER',
            resource_type='user',
            resource_id=user.id,
            details={
                'created_username': user.username,
                'created_role': user.role
            }
        )
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@jwt_required()
@require_admin
def update_role(user_id):
    """
    Update user role (Admin only)
    
    Request body:
        {
            "role": "manager"  # officer, manager, or admin
        }
    
    Returns:
        200: Role updated successfully
        400: Invalid role or self-modification attempt
        404: User not found
        401: Unauthorized
        403: Forbidden
    """
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'role' not in data:
            return jsonify({'error': 'Missing required field: role'}), 400
        
        # Validate role enum
        valid_roles = ['officer', 'manager', 'admin']
        if data['role'] not in valid_roles:
            return jsonify({
                'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'
            }), 400
        
        # Get admin user
        admin_user = get_user_from_token()
        
        # Prevent admin from changing own role (privilege escalation prevention)
        if admin_user.id == user_id:
            return jsonify({
                'error': 'Cannot modify your own role',
                'message': 'For security reasons, you cannot change your own role. Another admin must do this.'
            }), 400
        
        # Find target user
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Store old role for audit
        old_role = user.role
        
        # Update role
        user.role = data['role']
        db.session.commit()
        
        # Log the operation
        AuditService.log_operation(
            user_id=admin_user.id,
            operation_type='UPDATE_ROLE',
            resource_type='user',
            resource_id=user.id,
            details={
                'target_username': user.username,
                'old_role': old_role,
                'new_role': user.role
            }
        )
        
        return jsonify({
            'message': 'Role updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_user(user_id):
    """
    Delete a user (Admin only)
    
    Returns:
        200: User deleted successfully
        400: Self-deletion attempt
        404: User not found
        401: Unauthorized
        403: Forbidden
    """
    try:
        # Get admin user
        admin_user = get_user_from_token()
        
        # Prevent admin from deleting own account
        if admin_user.id == user_id:
            return jsonify({
                'error': 'Cannot delete your own account',
                'message': 'For security reasons, you cannot delete your own account. Another admin must do this.'
            }), 400
        
        # Find user to delete
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Store user info for audit log before deletion
        deleted_username = user.username
        deleted_role = user.role
        
        # Delete user (cascades to reconciliations and audit logs via model relationship)
        db.session.delete(user)
        db.session.commit()
        
        # Log the operation
        AuditService.log_operation(
            user_id=admin_user.id,
            operation_type='DELETE_USER',
            resource_type='user',
            resource_id=user_id,
            details={
                'deleted_username': deleted_username,
                'deleted_role': deleted_role
            }
        )
        
        return jsonify({
            'message': 'User deleted successfully',
            'deleted_user': {
                'id': user_id,
                'username': deleted_username,
                'role': deleted_role
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
@require_admin
def get_audit_logs():
    """
    Get audit logs (Admin only)
    
    Query parameters:
        limit (int): Maximum number of logs to return (default: 1000)
        offset (int): Number of logs to skip for pagination (default: 0)
    
    Returns:
        200: List of audit logs
        401: Unauthorized
        403: Forbidden
    """
    try:
        # Get query parameters
        limit = request.args.get('limit', 1000, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Validate limits
        if limit > 10000:
            limit = 10000  # Max 10k records per request
        if limit < 1:
            limit = 100
        
        # Get audit logs
        logs = AuditService.get_all_audit_logs(limit=limit, offset=offset)
        
        # Get total count for pagination
        total_count = db.session.query(AuditLog).count()
        
        return jsonify({
            'logs': [log.to_dict() for log in logs],
            'total': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + len(logs)) < total_count
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
