from flask import Flask, jsonify, render_template_string, redirect
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from models import db
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import text
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
    
    # Startup DB connectivity check for debugging the test server.
    with app.app_context():
        try:
            db.session.execute(text('SELECT 1'))
            logger.info('Database connection successful: SQLAlchemy can reach the configured database.')
            print('Database connection successful: SQLAlchemy can reach the configured database.')
        except Exception as exc:
            logger.error('Database connection failed: %s', exc)
            print(f'Database connection failed: {exc}')

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
