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
                'customer_duplicates': getattr(self, 'customer_duplicates', 0),
                'internal_duplicates': getattr(self, 'internal_duplicates', 0)
            },
            'report_path': self.report_path
        }

class ActivityLog(db.Model):
    """Log of user actions"""
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(120), nullable=False)
    page_visited = db.Column(db.String(255))
    action_performed = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_email': self.user_email,
            'page_visited': self.page_visited,
            'action_performed': self.action_performed,
            'timestamp': self.timestamp.isoformat()
        }

class ReconciliationRecord(db.Model):
    """Row-by-row reconciliation results from the report"""
    __tablename__ = 'reconciliation_records'
    
    id = db.Column(db.Integer, primary_key=True)
    reconciliation_id = db.Column(db.Integer, db.ForeignKey('reconciliations.id', ondelete='CASCADE'), nullable=False)
    match_category = db.Column(db.String(100), nullable=False)
    
    # Unified JSON
    full_record_json = db.Column(db.JSON, nullable=True)
    
    # Internal physical columns
    internal_old_tag = db.Column(db.String(255), nullable=True)
    internal_new_tag = db.Column(db.String(255), nullable=True)
    internal_year = db.Column(db.String(50), nullable=True)
    internal_category = db.Column(db.String(100), nullable=True)
    internal_description = db.Column(db.Text, nullable=True)
    internal_serial_no = db.Column(db.String(255), nullable=True)
    internal_department = db.Column(db.String(255), nullable=True)
    internal_district = db.Column(db.String(255), nullable=True)
    internal_book_value = db.Column(db.Float, nullable=True)
    internal_asset_number = db.Column(db.String(100), nullable=True)
    
    # Customer physical columns
    customer_old_tag = db.Column(db.String(255), nullable=True)
    customer_new_tag = db.Column(db.String(255), nullable=True)
    customer_year = db.Column(db.String(50), nullable=True)
    customer_category = db.Column(db.String(100), nullable=True)
    customer_description = db.Column(db.Text, nullable=True)
    customer_serial_no = db.Column(db.String(255), nullable=True)
    customer_department = db.Column(db.String(255), nullable=True)
    customer_district = db.Column(db.String(255), nullable=True)
    customer_book_value = db.Column(db.Float, nullable=True)
    
    # Match metadata
    match_type = db.Column(db.String(100), nullable=True)
    match_method = db.Column(db.String(100), nullable=True)
    confidence_score = db.Column(db.Float, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship back to Reconciliation
    reconciliation = db.relationship('Reconciliation', backref=db.backref('records', cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'reconciliation_id': self.reconciliation_id,
            'match_category': self.match_category,
            'full_record_json': self.full_record_json,
            'internal_old_tag': self.internal_old_tag,
            'internal_new_tag': self.internal_new_tag,
            'customer_old_tag': self.customer_old_tag,
            'customer_new_tag': self.customer_new_tag,
            'match_type': self.match_type,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat()
        }
