from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    reconciliations = db.relationship('Reconciliation', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

class Reconciliation(db.Model):
    """Reconciliation job model"""
    __tablename__ = 'reconciliations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    customer_file = db.Column(db.String(255), nullable=False)
    internal_file = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Statistics
    total_customer_records = db.Column(db.Integer, default=0)
    total_internal_records = db.Column(db.Integer, default=0)
    rule_matched = db.Column(db.Integer, default=0)
    ai_matched = db.Column(db.Integer, default=0)
    manual_review = db.Column(db.Integer, default=0)
    customer_unmatched = db.Column(db.Integer, default=0)
    internal_unmatched = db.Column(db.Integer, default=0)
    customer_duplicates = db.Column(db.Integer, default=0)
    internal_duplicates = db.Column(db.Integer, default=0)
    
    # Report file path
    report_path = db.Column(db.String(255))
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'customer_file': self.customer_file,
            'internal_file': self.internal_file,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'statistics': {
                'total_customer_records': self.total_customer_records,
                'total_internal_records': self.total_internal_records,
                'rule_matched': self.rule_matched,
                'ai_matched': self.ai_matched,
                'manual_review': self.manual_review,
                'customer_unmatched': self.customer_unmatched,
                'internal_unmatched': self.internal_unmatched,
                'customer_duplicates': self.customer_duplicates,
                'internal_duplicates': self.internal_duplicates
            },
            'report_path': self.report_path
        }
