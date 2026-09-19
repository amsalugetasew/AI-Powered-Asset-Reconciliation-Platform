from flask import Flask, jsonify, render_template_string, redirect
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from models import db
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import inspect, text
import os
import logging

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Log JWT configuration
    logger.info(f"JWT_SECRET_KEY configured: {bool(app.config.get('JWT_SECRET_KEY'))}")
    logger.info(f"JWT_TOKEN_LOCATION: {app.config.get('JWT_TOKEN_LOCATION')}")
    
    # Initialize extensions
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    jwt = JWTManager(app)
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        logger.error("Token expired")
        return jsonify({
            'error': 'Token has expired',
            'message': 'The token has expired. Please login again.'
        }), 401
    
    @jwt.token_verification_loader
    def verify_account_status(jwt_header, jwt_payload):
        """Require every authenticated request to belong to an active user."""
        try:
            from models import User
            user = User.query.get(int(jwt_payload['sub']))
            status = (getattr(user, 'status', None) or
                      ('active' if user and user.is_active else 'suspended')) if user else 'suspended'
            return bool(user and user.is_active and status == 'active')
        except (KeyError, TypeError, ValueError):
            return False

    @jwt.token_verification_failed_loader
    def inactive_account_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'Account is not active',
            'message': 'Your account must be active to access the system.'
        }), 403
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        logger.error(f"Invalid token: {error}")
        return jsonify({
            'error': 'Invalid token',
            'message': f'Signature verification failed: {error}'
        }), 422
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        logger.error(f"Missing token: {error}")
        return jsonify({
            'error': 'Authorization required',
            'message': 'Request does not contain a valid token.'
        }), 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        logger.error("Token revoked")
        return jsonify({
            'error': 'Token revoked',
            'message': 'The token has been revoked.'
        }), 401
    
    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.reconciliation_routes import reconciliation_bp
    from routes.activity_routes import activity_bp
    from routes.admin_routes import admin_bp
    from routes.analysis_routes import analysis_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(reconciliation_bp)
    app.register_blueprint(activity_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(analysis_bp)
    
    # Create database tables is handled by Flask-Migrate/Alembic now, but keeping for safety if tables don't exist
    with app.app_context():
        db.create_all()

        inspector = inspect(db.engine)
        if 'users' in inspector.get_table_names():
            user_columns = {column['name'] for column in inspector.get_columns('users')}
            if 'profile_picture' not in user_columns:
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users ADD COLUMN profile_picture TEXT'))
            if 'is_active' not in user_columns:
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1'))
            if 'full_name' not in user_columns:
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users ADD COLUMN full_name VARCHAR(150)'))
            if 'employee_id' not in user_columns:
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users ADD COLUMN employee_id VARCHAR(50)'))
            if 'department' not in user_columns:
                with db.engine.begin() as connection:
                    connection.execute(text('ALTER TABLE users ADD COLUMN department VARCHAR(100)'))
            if 'status' not in user_columns:
                with db.engine.begin() as connection:
                    if db.engine.dialect.name == 'mysql':
                        connection.execute(text(
                            "ALTER TABLE users ADD COLUMN status "
                            "ENUM('pending','active','suspended') NOT NULL DEFAULT 'active'"
                        ))
                    else:
                        connection.execute(text(
                            "ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'"
                        ))
                    connection.execute(text(
                        "UPDATE users SET status = CASE "
                        "WHEN is_active = 1 THEN 'active' ELSE 'suspended' END"
                    ))
            else:
                # Repair only legacy rows made inconsistent during the status rollout.
                # Valid active/suspended users and new inactive pending users are preserved.
                with db.engine.begin() as connection:
                    connection.execute(text(
                        "UPDATE users SET status = 'active' "
                        "WHERE status = 'pending' AND is_active = 1"
                    ))
                    connection.execute(text(
                        "UPDATE users SET status = 'suspended' "
                        "WHERE status = 'pending' AND is_active = 0 "
                        "AND created_at < '2026-09-19 00:00:00'"
                    ))
    
        # Health check endpoint
        @app.route('/api/health', methods=['GET'])
        def health_check():
                return {'status': 'healthy', 'message': 'AssetSync AI API is running'}, 200

        # Root friendly status page
        @app.route('/', methods=['GET'])
        def index():
                # In development, redirect to the Vite frontend login page. Can be overridden with FRONTEND_URL env var.
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3002/login')
                return redirect(frontend_url)
    
    return app

if __name__ == '__main__':
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    app.run(host='0.0.0.0', port=6000, debug=True)
