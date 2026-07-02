import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production-please-use-long-key')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret-key-change-in-production-use-long-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # Database (MySQL)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'mysql+pymysql://root:root@localhost:3306/finance')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    }
    
    # File Upload
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_FILE_SIZE', 100)) * 1024 * 1024  # MB to bytes
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.getenv('UPLOAD_FOLDER', 'uploads'))
    REPORTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.getenv('REPORTS_FOLDER', 'reports'))
    ALLOWED_EXTENSIONS = {'xlsx', 'xls'}
    
    # Batch Processing for Large Datasets
    BATCH_SIZE = int(os.getenv('BATCH_SIZE', 10000))
    MAX_AI_RECORDS = int(os.getenv('MAX_AI_RECORDS', 1000))
    
    # AI Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    AI_PROVIDER = os.getenv('AI_PROVIDER', 'openai')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
    ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229')
    
    # Reconciliation Thresholds
    AI_MATCH_THRESHOLD = float(os.getenv('AI_MATCH_THRESHOLD', 0.75))
    MANUAL_REVIEW_THRESHOLD = float(os.getenv('MANUAL_REVIEW_THRESHOLD', 0.50))
    FUZZY_PREFILTER_THRESHOLD = float(os.getenv('FUZZY_PREFILTER_THRESHOLD', 0.30))
    MIN_FUZZY_FOR_LLM = float(os.getenv('MIN_FUZZY_FOR_LLM', 0.40))
    AI_TOP_K_CANDIDATES = int(os.getenv('AI_TOP_K_CANDIDATES', 10))
    
    # Rate Limiting
    RATE_LIMIT_DELAY = float(os.getenv('RATE_LIMIT_DELAY', 1.0))
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 5))
    
    @staticmethod
    def init_app(app):
        """Initialize application configuration"""
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.REPORTS_FOLDER, exist_ok=True)

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    FLASK_ENV = 'development'

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    FLASK_ENV = 'production'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
