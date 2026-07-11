from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from models import db, User
from services.audit_service import AuditService

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email']
        )
        user.set_password(data['password'])
        # Default role is 'officer' (set in model)
        
        db.session.add(user)
        db.session.commit()
        
        # Audit: self-registration
        AuditService.log_operation(
            user_id=user.id,
            operation_type='USER_REGISTER',
            resource_type='user',
            resource_id=user.id,
            details={'username': user.username, 'email': user.email, 'role': user.role}
        )

        # Generate access token with string identity and role claim
        additional_claims = {'role': user.role}
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(),
            'access_token': access_token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Missing username or password'}), 400
        
        # Find user
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not user.check_password(data['password']):
            # Audit: failed login attempt
            AuditService.log_operation(
                user_id=0,
                operation_type='LOGIN_FAILED',
                resource_type='auth',
                details={'attempted_username': data.get('username', ''), 'ip': request.remote_addr}
            )
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Audit: successful login
        AuditService.log_operation(
            user_id=user.id,
            operation_type='USER_LOGIN',
            resource_type='auth',
            resource_id=user.id,
            details={'username': user.username, 'role': user.role, 'ip': request.remote_addr}
        )

        # Generate access token with string identity and role claim
        additional_claims = {'role': user.role}
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info"""
    try:
        user_id = int(get_jwt_identity())  # Convert back to int
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client-side token removal)"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        AuditService.log_operation(
            user_id=user_id,
            operation_type='USER_LOGOUT',
            resource_type='auth',
            resource_id=user_id,
            details={'username': user.username if user else 'unknown'}
        )
    except Exception:
        pass
    return jsonify({'message': 'Logout successful'}), 200

@auth_bp.route('/debug-token', methods=['GET'])
def debug_token():
    """Debug endpoint to check token"""
    auth_header = request.headers.get('Authorization')
    return jsonify({
        'auth_header': auth_header,
        'has_token': bool(auth_header),
        'headers': dict(request.headers)
    }), 200
