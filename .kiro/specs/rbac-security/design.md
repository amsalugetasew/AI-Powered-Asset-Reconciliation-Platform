# Technical Design Document - RBAC Security

## 1. Introduction

This document describes the technical design for implementing Role-Based Access Control (RBAC) in the Asset Reconciliation System. The design extends the existing Flask-JWT authentication system with three hierarchical roles: Officer, Manager, and Admin.

### 1.1 Design Goals

1. Seamless integration with existing Flask-JWT-Extended authentication
2. Minimal changes to current codebase structure
3. Clear separation of concerns (authorization vs authentication)
4. Scalable role hierarchy system
5. Comprehensive audit trail for compliance

### 1.2 Current System Architecture

**Backend:**
- Flask 3.0.0 with Blueprints architecture
- Flask-JWT-Extended for JWT token management
- SQLAlchemy ORM with MySQL database
- Existing models: User, Reconciliation, ReconciliationRecord, ActivityLog

**Frontend:**
- React with React Router
- AuthContext for state management
- Axios for API communication
- Protected routes using ProtectedRoute component

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ AuthContext  │  │ RoleContext  │  │  UI Guards   │     │
│  │  + Role      │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                           │                                   │
│                    JWT Token (with role)                      │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│                     Backend (Flask)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   JWT Auth   │  │ Role Decorator│  │ Audit Logger │      │
│  │  Middleware  │  │ @require_role │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
│         └──────────────────┴──────────────────┘               │
│                           │                                    │
│  ┌─────────────────────────────────────────────────┐         │
│  │              Route Blueprints                    │         │
│  │  • auth_bp  • reconciliation_bp  • admin_bp     │         │
│  └─────────────────────────────────────────────────┘         │
│                           │                                    │
│  ┌─────────────────────────────────────────────────┐         │
│  │            SQLAlchemy Models                     │         │
│  │  • User (+ role)  • AuditLog  • Reconciliation  │         │
│  └─────────────────────────────────────────────────┘         │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │ MySQL Database │
                    └────────────────┘
```

### 2.2 Role Hierarchy

```
Admin (level 3)
  │
  ├─ All Manager permissions
  ├─ User Management
  └─ System Configuration
  
Manager (level 2)
  │
  ├─ All Officer permissions
  ├─ Approve Exceptions
  ├─ Finalize Reconciliations
  └─ System-wide Analytics
  
Officer (level 1)
  │
  ├─ Upload Files
  ├─ View Own Reconciliations
  ├─ Resolve Matches
  └─ Download Own Reports
```

## 3. Database Design

### 3.1 Schema Changes

#### 3.1.1 Updated User Model

```python
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('officer', 'manager', 'admin'), 
                     default='officer', nullable=False)  # NEW
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    reconciliations = db.relationship('Reconciliation', backref='user', 
                                     lazy=True, cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='user',
                                lazy=True)  # NEW
```

#### 3.1.2 New AuditLog Model

```python
class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    operation_type = db.Column(db.String(50), nullable=False)  
    # e.g., 'CREATE_USER', 'UPDATE_ROLE', 'DELETE_USER', 
    # 'APPROVE_EXCEPTION', 'FINALIZE_RECONCILIATION'
    resource_type = db.Column(db.String(50), nullable=False)  
    # e.g., 'user', 'reconciliation', 'configuration'
    resource_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.JSON, nullable=True)  
    # Additional context: old_value, new_value, etc.
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'operation_type': self.operation_type,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': self.details,
            'ip_address': self.ip_address,
            'timestamp': self.timestamp.isoformat()
        }
```

### 3.2 Database Migration

**File:** `backend/migrations/versions/add_rbac_support.py`

```python
"""Add RBAC support

Revision ID: rbac_20260702_001
Revises: 4764544f4a05
Create Date: 2026-07-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = 'rbac_20260702_001'
down_revision = '4764544f4a05'

def upgrade():
    # Add role column to users table
    op.add_column('users', sa.Column('role', 
        sa.Enum('officer', 'manager', 'admin', name='user_role'),
        server_default='officer', nullable=False))
    
    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('operation_type', sa.String(50), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], 
                               ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_timestamp', 'audit_logs', ['timestamp'])

def downgrade():
    op.drop_index('idx_audit_timestamp', 'audit_logs')
    op.drop_index('idx_audit_user_id', 'audit_logs')
    op.drop_table('audit_logs')
    op.drop_column('users', 'role')
```

## 4. Backend Implementation

### 4.1 JWT Token Structure

**Current Token Payload:**
```json
{
  "sub": "123",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**New Token Payload (with role):**
```json
{
  "sub": "123",
  "role": "officer",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### 4.2 Role-Based Decorators

**File:** `backend/utils/rbac.py` (NEW)

```python
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from models import User

# Role hierarchy
ROLE_HIERARCHY = {
    'officer': 1,
    'manager': 2,
    'admin': 3
}

def get_user_role():
    """Extract role from JWT token"""
    verify_jwt_in_request()
    claims = get_jwt()
    return claims.get('role', 'officer')

def get_user_from_token():
    """Get User object from JWT token"""
    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)

def require_role(required_role):
    """
    Decorator to enforce role-based access control.
    
    Usage:
        @require_role('manager')
        def some_endpoint():
            pass
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                # Verify JWT token
                verify_jwt_in_request()
                
                # Get user role from token
                claims = get_jwt()
                user_role = claims.get('role')
                
                if not user_role:
                    return jsonify({
                        'error': 'Invalid token: missing role information'
                    }), 401
                
                # Validate role value
                if user_role not in ROLE_HIERARCHY:
                    return jsonify({
                        'error': 'Invalid role in token'
                    }), 401
                
                # Check if user has sufficient permissions
                user_level = ROLE_HIERARCHY.get(user_role, 0)
                required_level = ROLE_HIERARCHY.get(required_role, 999)
                
                if user_level < required_level:
                    return jsonify({
                        'error': 'Insufficient permissions',
                        'message': f'Required role: {required_role}',
                        'your_role': user_role
                    }), 403
                
                # User has sufficient permissions
                return fn(*args, **kwargs)
                
            except Exception as e:
                return jsonify({
                    'error': 'Authorization failed',
                    'message': str(e)
                }), 401
        
        return wrapper
    return decorator

def require_admin(fn):
    """Shortcut decorator for admin-only endpoints"""
    return require_role('admin')(fn)

def require_manager(fn):
    """Shortcut decorator for manager-level endpoints"""
    return require_role('manager')(fn)
```

### 4.3 Audit Logging Service

**File:** `backend/services/audit_service.py` (NEW)

```python
from models import db, AuditLog
from flask import request
from datetime import datetime

class AuditService:
    """Service for logging privileged operations"""
    
    @staticmethod
    def log_operation(user_id, operation_type, resource_type, 
                     resource_id=None, details=None):
        """
        Log a privileged operation to the audit trail.
        
        Args:
            user_id: ID of user performing the operation
            operation_type: Type of operation (CREATE_USER, UPDATE_ROLE, etc.)
            resource_type: Type of resource affected (user, reconciliation, etc.)
            resource_id: ID of affected resource (optional)
            details: Additional context as dictionary (optional)
        """
        try:
            audit_log = AuditLog(
                user_id=user_id,
                operation_type=operation_type,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=request.remote_addr if request else None,
                timestamp=datetime.utcnow()
            )
            db.session.add(audit_log)
            db.session.commit()
            return True
        except Exception as e:
            print(f"Failed to log audit: {str(e)}")
            db.session.rollback()
            return False
    
    @staticmethod
    def get_user_audit_logs(user_id, limit=100):
        """Get audit logs for a specific user"""
        return AuditLog.query.filter_by(user_id=user_id)\
            .order_by(AuditLog.timestamp.desc())\
            .limit(limit).all()
    
    @staticmethod
    def get_all_audit_logs(limit=1000):
        """Get all audit logs (admin only)"""
        return AuditLog.query.order_by(AuditLog.timestamp.desc())\
            .limit(limit).all()
    
    @staticmethod
    def get_resource_audit_logs(resource_type, resource_id, limit=100):
        """Get audit logs for a specific resource"""
        return AuditLog.query.filter_by(
            resource_type=resource_type,
            resource_id=resource_id
        ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
```

### 4.4 Updated Authentication Routes

**File:** `backend/routes/auth_routes.py` (MODIFIED)

```python
from flask_jwt_extended import create_access_token
from models import db, User

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with default officer role"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('email') \
           or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user with default officer role
        user = User(
            username=data['username'],
            email=data['email'],
            role='officer'  # DEFAULT ROLE
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Generate JWT token with role claim
        additional_claims = {'role': user.role}
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        # Return user info with role
        user_dict = user.to_dict()
        user_dict['role'] = user.role  # Include role in response
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user_dict,
            'access_token': access_token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user and return JWT with role"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Missing username or password'}), 400
        
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Generate JWT token with role claim
        additional_claims = {'role': user.role}
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        # Return user info with role
        user_dict = user.to_dict()
        user_dict['role'] = user.role
        
        return jsonify({
            'message': 'Login successful',
            'user': user_dict,
            'access_token': access_token
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info with role"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_dict = user.to_dict()
        user_dict['role'] = user.role  # Include role
        
        return jsonify({'user': user_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 4.5 Admin User Management Routes

**File:** `backend/routes/admin_routes.py` (NEW)

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User
from utils.rbac import require_admin, get_user_from_token
from services.audit_service import AuditService

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@require_admin
def list_users():
    """List all users (admin only)"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [
                {**u.to_dict(), 'role': u.role} 
                for u in users
            ]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
@require_admin
def create_user():
    """Create a new user (admin only)"""
    try:
        data = request.get_json()
        admin_user = get_user_from_token()
        
        # Validate input
        required_fields = ['username', 'email', 'password', 'role']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Validate role
        if data['role'] not in ['officer', 'manager', 'admin']:
            return jsonify({
                'error': 'Invalid role',
                'message': 'Allowed values: officer, manager, admin'
            }), 400
        
        # Check if user exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            role=data['role']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Log audit
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
            'user': {**user.to_dict(), 'role': user.role}
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
```

@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@jwt_required()
@require_admin
def update_user_role(user_id):
    """Update user role (admin only)"""
    try:
        data = request.get_json()
        admin_user = get_user_from_token()
        
        # Prevent self-modification
        if admin_user.id == user_id:
            return jsonify({
                'error': 'Cannot modify own role'
            }), 403
        
        # Validate role
        new_role = data.get('role')
        if not new_role or new_role not in ['officer', 'manager', 'admin']:
            return jsonify({
                'error': 'Invalid role',
                'message': 'Allowed values: officer, manager, admin'
            }), 400
        
        # Get target user
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        old_role = user.role
        user.role = new_role
        db.session.commit()
        
        # Log audit
        AuditService.log_operation(
            user_id=admin_user.id,
            operation_type='UPDATE_ROLE',
            resource_type='user',
            resource_id=user.id,
            details={
                'target_username': user.username,
                'old_role': old_role,
                'new_role': new_role
            }
        )
        
        return jsonify({
            'message': 'User role updated successfully',
            'user': {**user.to_dict(), 'role': user.role}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_user(user_id):
    """Delete user (admin only)"""
    try:
        admin_user = get_user_from_token()
        
        # Prevent self-deletion
        if admin_user.id == user_id:
            return jsonify({
                'error': 'Cannot delete own account'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        username = user.username
        role = user.role
        
        # Delete user (cascade deletes reconciliations)
        db.session.delete(user)
        db.session.commit()
        
        # Log audit
        AuditService.log_operation(
            user_id=admin_user.id,
            operation_type='DELETE_USER',
            resource_type='user',
            resource_id=user_id,
            details={
                'deleted_username': username,
                'deleted_role': role
            }
        )
        
        return jsonify({
            'message': 'User deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
@require_admin
def get_audit_logs():
    """Get all audit logs (admin only)"""
    try:
        limit = request.args.get('limit', 1000, type=int)
        logs = AuditService.get_all_audit_logs(limit=limit)
        
        return jsonify({
            'audit_logs': [log.to_dict() for log in logs]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 4.6 Updated Reconciliation Routes

**File:** `backend/routes/reconciliation_routes.py` (MODIFIED)

Key changes:
- Add role-based filtering for list endpoint
- Add role checks for view/download operations
- Add Manager-only approve/finalize endpoints

```python
from utils.rbac import require_role, get_user_role, get_user_from_token

@reconciliation_bp.route('/list', methods=['GET'])
@jwt_required()
def list_reconciliations():
    """List reconciliations based on user role"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        # Officers see only their own reconciliations
        # Managers and Admins see all reconciliations
        if user_role == 'officer':
            reconciliations = Reconciliation.query.filter_by(user_id=user_id)\
                .order_by(Reconciliation.created_at.desc()).all()
        else:  # manager or admin
            reconciliations = Reconciliation.query\
                .order_by(Reconciliation.created_at.desc()).all()
        
        return jsonify({
            'reconciliations': [r.to_dict() for r in reconciliations]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_reconciliation(reconciliation_id):
    """Get reconciliation details with role-based access"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Officers can only view their own reconciliations
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own reconciliations'
            }), 403
        
        return jsonify({
            'reconciliation': reconciliation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

@reconciliation_bp.route('/<int:reconciliation_id>/approve', methods=['POST'])
@jwt_required()
@require_role('manager')
def approve_exception(reconciliation_id):
    """Approve reconciliation exception (Manager+ only)"""
    try:
        user = get_user_from_token()
        
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Add approval logic here (e.g., update status, add approval field)
        # For now, just log the approval
        
        # Log audit
        AuditService.log_operation(
            user_id=user.id,
            operation_type='APPROVE_EXCEPTION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'reconciliation_status': reconciliation.status
            }
        )
        
        return jsonify({
            'message': 'Exception approved successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/<int:reconciliation_id>/finalize', methods=['POST'])
@jwt_required()
@require_role('manager')
def finalize_reconciliation(reconciliation_id):
    """Finalize reconciliation (Manager+ only)"""
    try:
        user = get_user_from_token()
        
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        if reconciliation.status != 'completed':
            return jsonify({
                'error': 'Cannot finalize',
                'message': 'Reconciliation must be completed first'
            }), 400
        
        # Add finalized status/field
        # For now, just log the finalization
        
        # Log audit
        AuditService.log_operation(
            user_id=user.id,
            operation_type='FINALIZE_RECONCILIATION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'total_records': reconciliation.total_customer_records
            }
        )
        
        return jsonify({
            'message': 'Reconciliation finalized successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Get analytics with role-based filtering"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        # Officers see only their analytics
        # Managers and Admins see all analytics
        if user_role == 'officer':
            reconciliations = Reconciliation.query.filter_by(
                user_id=user_id,
                status='completed'
            ).all()
        else:  # manager or admin
            reconciliations = Reconciliation.query.filter_by(
                status='completed'
            ).all()
        
        if not reconciliations:
            return jsonify({
                'total_reconciliations': 0,
                'total_records_processed': 0,
                'total_matches': 0,
                'average_match_rate': 0
            }), 200
        
        # Calculate statistics
        total_customer = sum(r.total_customer_records for r in reconciliations)
        total_internal = sum(r.total_internal_records for r in reconciliations)
        total_rule_matched = sum(r.rule_matched for r in reconciliations)
        total_ai_matched = sum(r.ai_matched for r in reconciliations)
        total_manual = sum(r.manual_review for r in reconciliations)
        
        total_matches = total_rule_matched + total_ai_matched
        avg_match_rate = (total_matches / total_customer * 100) \
                        if total_customer > 0 else 0
        
        return jsonify({
            'total_reconciliations': len(reconciliations),
            'total_customer_records': total_customer,
            'total_internal_records': total_internal,
            'total_rule_matched': total_rule_matched,
            'total_ai_matched': total_ai_matched,
            'total_manual_review': total_manual,
            'average_match_rate': round(avg_match_rate, 2),
            'scope': 'own' if user_role == 'officer' else 'all'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## 5. Frontend Implementation

### 5.1 Role Context

**File:** `frontend/src/context/RoleContext.jsx` (NEW or extend AuthContext)

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'

const RoleContext = createContext()

export const useRole = () => {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole must be used within RoleProvider')
  }
  return context
}

export const RoleProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null)
  
  useEffect(() => {
    // Get role from JWT token
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const decoded = jwtDecode(token)
        setUserRole(decoded.role || 'officer')
      } catch (error) {
        console.error('Failed to decode token:', error)
        setUserRole(null)
      }
    }
  }, [])
  
  const updateRole = (token) => {
    if (token) {
      try {
        const decoded = jwtDecode(token)
        setUserRole(decoded.role || 'officer')
      } catch (error) {
        setUserRole(null)
      }
    } else {
      setUserRole(null)
    }
  }
  
  const hasRole = (requiredRole) => {
    const roleHierarchy = {
      'officer': 1,
      'manager': 2,
      'admin': 3
    }
    const userLevel = roleHierarchy[userRole] || 0
    const requiredLevel = roleHierarchy[requiredRole] || 999
    return userLevel >= requiredLevel
  }
  
  const isOfficer = () => userRole === 'officer'
  const isManager = () => hasRole('manager')
  const isAdmin = () => hasRole('admin')
  
  return (
    <RoleContext.Provider value={{
      userRole,
      updateRole,
      hasRole,
      isOfficer,
      isManager,
      isAdmin
    }}>
      {children}
    </RoleContext.Provider>
  )
}
```

### 5.2 Role-Based UI Guards

**File:** `frontend/src/components/RoleGuard.jsx` (NEW)

```jsx
import { useRole } from '../context/RoleContext'

export const RoleGuard = ({ requiredRole, children, fallback = null }) => {
  const { hasRole } = useRole()
  
  if (!hasRole(requiredRole)) {
    return fallback
  }
  
  return <>{children}</>
}

export const OfficerOnly = ({ children, fallback }) => (
  <RoleGuard requiredRole="officer" fallback={fallback}>
    {children}
  </RoleGuard>
)

export const ManagerOnly = ({ children, fallback }) => (
  <RoleGuard requiredRole="manager" fallback={fallback}>
    {children}
  </RoleGuard>
)

export const AdminOnly = ({ children, fallback }) => (
  <RoleGuard requiredRole="admin" fallback={fallback}>
    {children}
  </RoleGuard>
)
```

### 5.3 Updated Navigation

**File:** `frontend/src/components/Layout.jsx` (MODIFIED)

```jsx
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import { Link } from 'react-router-dom'
import { FiHome, FiUpload, FiBarChart2, FiUsers, FiSettings } from 'react-icons/fi'

const Layout = () => {
  const { user, logout } = useAuth()
  const { userRole, isManager, isAdmin } = useRole()
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: FiHome, roles: ['officer'] },
    { path: '/upload', label: 'Upload', icon: FiUpload, roles: ['officer'] },
    { path: '/analytics', label: 'Analytics', icon: FiBarChart2, roles: ['manager'] },
    { path: '/audit', label: 'Audit Trail', icon: FiFileText, roles: ['manager'] },
    { path: '/users', label: 'User Management', icon: FiUsers, roles: ['admin'] },
    { path: '/settings', label: 'Settings', icon: FiSettings, roles: ['admin'] }
  ]
  
  const roleHierarchy = { 'officer': 1, 'manager': 2, 'admin': 3 }
  const userLevel = roleHierarchy[userRole] || 0
  
  const visibleNavItems = navItems.filter(item => {
    const requiredLevel = roleHierarchy[item.roles[0]] || 999
    return userLevel >= requiredLevel
  })
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              {visibleNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="inline-flex items-center px-1 pt-1 text-gray-700 
                           hover:text-primary-600"
                >
                  <item.icon className="mr-2" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.username} ({userRole})
              </span>
              <button onClick={logout} className="btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  )
}
```

### 5.4 Updated Dashboard with Role-Based Buttons

**File:** `frontend/src/pages/Dashboard.jsx` (MODIFIED)

```jsx
import { useRole } from '../context/RoleContext'
import { ManagerOnly } from '../components/RoleGuard'

const Dashboard = () => {
  const { isManager } = useRole()
  // ... existing code ...
  
  const handleApprove = async (id) => {
    try {
      await axios.post(`/api/reconciliation/${id}/approve`)
      toast.success('Exception approved successfully')
      fetchReconciliations()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve exception')
    }
  }
  
  const handleFinalize = async (id) => {
    try {
      await axios.post(`/api/reconciliation/${id}/finalize`)
      toast.success('Reconciliation finalized successfully')
      fetchReconciliations()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to finalize')
    }
  }
  
  return (
    <div>
      {/* ... existing code ... */}
      
      {recon.status === 'completed' && (
        <div className="ml-6 flex flex-col space-y-2">
          <button onClick={() => navigate(`/results/${recon.id}`)}
                  className="btn-primary">
            View Results
          </button>
          <button onClick={() => handleDownload(recon.id)}
                  className="btn-success">
            Download
          </button>
          
          {/* Manager-only buttons */}
          <ManagerOnly>
            <button onClick={() => handleApprove(recon.id)}
                    className="btn-warning">
              Approve Exception
            </button>
            <button onClick={() => handleFinalize(recon.id)}
                    className="btn-info">
              Finalize
            </button>
          </ManagerOnly>
        </div>
      )}
    </div>
  )
}
```

### 5.5 Admin User Management Page

**File:** `frontend/src/pages/UserManagement.jsx` (NEW)

```jsx
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiEdit, FiTrash2, FiUserPlus } from 'react-icons/fi'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  useEffect(() => {
    fetchUsers()
  }, [])
  
  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users')
      setUsers(response.data.users)
    } catch (error) {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/admin/users/${userId}/role`, { role: newRole })
      toast.success('User role updated successfully')
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update role')
    }
  }
  
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await axios.delete(`/api/admin/users/${userId}`)
      toast.success('User deleted successfully')
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete user')
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <button onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center">
          <FiUserPlus className="mr-2" />
          Create User
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="border rounded px-2 py-1">
                    <option value="officer">Officer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800">
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Create User Modal - implementation omitted for brevity */}
    </div>
  )
}

export default UserManagement
```

## 6. API Specification

### 6.1 Authentication Endpoints (Modified)

#### POST /api/auth/register
**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T14:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/auth/login
**Request:**
```json
{
  "username": "john_doe",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T14:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET /api/auth/me
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T14:30:00Z"
  }
}
```

### 6.2 Admin User Management Endpoints (New)

#### GET /api/admin/users
**Role Required:** Admin  
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "officer",
      "created_at": "2026-07-02T14:30:00Z"
    },
    {
      "id": 2,
      "username": "jane_manager",
      "email": "jane@example.com",
      "role": "manager",
      "created_at": "2026-07-01T10:00:00Z"
    }
  ]
}
```

#### POST /api/admin/users
**Role Required:** Admin  
**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "username": "new_user",
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "officer"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 3,
    "username": "new_user",
    "email": "newuser@example.com",
    "role": "officer",
    "created_at": "2026-07-02T15:00:00Z"
  }
}
```

#### PUT /api/admin/users/:id/role
**Role Required:** Admin  
**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "role": "manager"
}
```

**Response (200):**
```json
{
  "message": "User role updated successfully",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "manager",
    "created_at": "2026-07-02T14:30:00Z"
  }
}
```

**Error (403):**
```json
{
  "error": "Cannot modify own role"
}
```

#### DELETE /api/admin/users/:id
**Role Required:** Admin  
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

**Error (403):**
```json
{
  "error": "Cannot delete own account"
}
```

#### GET /api/admin/audit-logs
**Role Required:** Admin  
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `?limit=1000`

**Response (200):**
```json
{
  "audit_logs": [
    {
      "id": 1,
      "user_id": 2,
      "username": "admin_user",
      "operation_type": "UPDATE_ROLE",
      "resource_type": "user",
      "resource_id": 1,
      "details": {
        "target_username": "john_doe",
        "old_role": "officer",
        "new_role": "manager"
      },
      "ip_address": "192.168.1.100",
      "timestamp": "2026-07-02T15:30:00Z"
    }
  ]
}
```

### 6.3 Reconciliation Endpoints (Modified)

#### POST /api/reconciliation/:id/approve
**Role Required:** Manager  
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Exception approved successfully"
}
```

**Error (403):**
```json
{
  "error": "Insufficient permissions",
  "message": "Required role: manager",
  "your_role": "officer"
}
```

#### POST /api/reconciliation/:id/finalize
**Role Required:** Manager  
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Reconciliation finalized successfully"
}
```

**Error (400):**
```json
{
  "error": "Cannot finalize",
  "message": "Reconciliation must be completed first"
}
```

### 6.4 Error Responses

#### 401 Unauthorized
```json
{
  "error": "Authorization required",
  "message": "Request does not contain a valid token."
}
```

#### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "message": "Required role: manager",
  "your_role": "officer"
}
```

#### 422 Unprocessable Entity
```json
{
  "error": "Invalid token",
  "message": "Signature verification failed"
}
```

## 7. Implementation Sequence

### Phase 1: Database and Backend Core (Week 1)
1. Create database migration for role field and AuditLog model
2. Run migration: `flask db upgrade`
3. Update User model with role field
4. Create AuditLog model
5. Update `models.py` to include new relationships

### Phase 2: Backend RBAC Infrastructure (Week 1-2)
6. Create `backend/utils/rbac.py` with decorators
7. Create `backend/services/audit_service.py`
8. Update JWT token generation in `auth_routes.py`
9. Add role claim to login and register responses
10. Test role extraction and validation

### Phase 3: Backend API Endpoints (Week 2)
11. Create `backend/routes/admin_routes.py`
12. Implement user management endpoints
13. Update `reconciliation_routes.py` with role-based filtering
14. Add approve and finalize endpoints
15. Register admin blueprint in `app.py`

### Phase 4: Frontend Role Context (Week 3)
16. Create `frontend/src/context/RoleContext.jsx`
17. Create `frontend/src/components/RoleGuard.jsx`
18. Update `AuthContext` to extract and store role
19. Add role update on login/register

### Phase 5: Frontend UI Updates (Week 3-4)
20. Update `Layout.jsx` with role-based navigation
21. Update `Dashboard.jsx` with role-based buttons
22. Create `UserManagement.jsx` page
23. Add route for user management in `App.jsx`
24. Add role badge to user profile display

### Phase 6: Testing and Documentation (Week 4)
25. Write unit tests for RBAC decorators
26. Write integration tests for role-based endpoints
27. Test privilege escalation prevention
28. Test audit logging
29. Update API documentation
30. Create user guide for role management

## 8. Security Considerations

### 8.1 Token Security
- JWT tokens contain role claims but are signed
- Tampering with role claims invalidates signature
- Tokens expire after 24 hours (configurable)
- No token refresh mechanism (requires re-login for role changes)

### 8.2 Privilege Escalation Prevention
- Users cannot modify their own role
- Role validation happens on every protected endpoint
- Role hierarchy enforced server-side
- Audit logs track all role changes

### 8.3 Audit Trail Integrity
- Audit logs are append-only (no updates/deletes)
- Includes IP address for forensics
- Timestamps are immutable
- Foreign key constraints prevent orphaned logs

### 8.4 Input Validation
- Role values validated against enum
- User ID validation on all operations
- Self-modification checks (can't delete/modify self)
- SQL injection protection via SQLAlchemy ORM

## 9. Testing Strategy

### 9.1 Unit Tests

**Test:** `test_role_hierarchy`
```python
def test_role_hierarchy():
    assert ROLE_HIERARCHY['admin'] > ROLE_HIERARCHY['manager']
    assert ROLE_HIERARCHY['manager'] > ROLE_HIERARCHY['officer']
```

**Test:** `test_require_role_decorator`
```python
def test_officer_cannot_access_manager_endpoint(client, officer_token):
    response = client.post('/api/reconciliation/1/approve',
                          headers={'Authorization': f'Bearer {officer_token}'})
    assert response.status_code == 403
```

### 9.2 Integration Tests

**Test:** `test_role_based_reconciliation_list`
```python
def test_officer_sees_only_own_reconciliations(client, officer_token):
    response = client.get('/api/reconciliation/list',
                         headers={'Authorization': f'Bearer {officer_token}'})
    data = response.json
    # Verify all returned reconciliations belong to the officer
```

### 9.3 Security Tests

**Test:** `test_privilege_escalation_prevention`
```python
def test_officer_cannot_promote_self(client, officer_token, officer_id):
    response = client.put(f'/api/admin/users/{officer_id}/role',
                         json={'role': 'admin'},
                         headers={'Authorization': f'Bearer {officer_token}'})
    assert response.status_code in [401, 403]
```

## 10. Deployment Notes

### 10.1 Database Migration
```bash
cd backend
flask db upgrade
```

### 10.2 Environment Variables
No new environment variables required. Existing JWT configuration is sufficient.

### 10.3 First Admin User
After deployment, manually update the first user to admin role:
```sql
UPDATE users SET role = 'admin' WHERE id = 1;
```

Or create a script: `backend/create_admin.py`

### 10.4 Backward Compatibility
- Existing JWT tokens without role claim default to 'officer'
- Existing users get 'officer' role via migration default
- No breaking changes to existing API endpoints

## 11. Future Enhancements

1. **Fine-grained Permissions:** Replace role hierarchy with permission-based system
2. **Role Templates:** Predefined role templates with custom permissions
3. **Multi-tenancy:** Organization-level role assignments
4. **Session Management:** Track active sessions and force logout
5. **Two-Factor Authentication:** Add 2FA for admin accounts
6. **Role Change Notifications:** Email notifications on role changes
7. **Temporary Permissions:** Time-limited elevated permissions
8. **Activity Monitoring:** Real-time dashboard for admin activities
