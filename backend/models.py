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
    full_name = db.Column(db.String(150), nullable=True)
    employee_id = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    profile_picture = db.Column(db.Text, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('officer', 'manager', 'admin', name='user_role'), 
                     default='officer', nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    status = db.Column(db.Enum('pending', 'active', 'suspended', name='user_status'),
                       default='active', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    reconciliations = db.relationship(
        'Reconciliation',
        foreign_keys='Reconciliation.user_id',
        backref='user',
        lazy=True,
        cascade='all, delete-orphan'
    )
    assigned_reconciliations = db.relationship(
        'Reconciliation',
        foreign_keys='Reconciliation.assigned_to',
        backref='assignee',
        lazy=True,
    )
    audit_logs = db.relationship('AuditLog', backref='user', lazy=True, cascade='all, delete-orphan')
    
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
            'full_name': self.full_name,
            'employee_id': self.employee_id,
            'department': self.department,
            'profile_picture': self.profile_picture,
            'role': self.role,
            'is_active': self.is_active,
            'status': self.status or ('active' if self.is_active else 'suspended'),
            'created_at': self.created_at.isoformat()
        }

class Reconciliation(db.Model):
    """Reconciliation job model"""
    __tablename__ = 'reconciliations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    requester = db.relationship(
        'User',
        foreign_keys=[user_id],
        lazy='joined',
        overlaps='reconciliations,user'
    )
    customer_file = db.Column(db.String(255), nullable=False)
    internal_file = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    is_deleted = db.Column(db.Boolean, default=False, nullable=False, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assignment_scope = db.Column(db.String(50), default='none', nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assignment_note = db.Column(db.Text, nullable=True)
    assigned_at = db.Column(db.DateTime, nullable=True)
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
            'requester_username': self.requester.username if self.requester else None,
            'requester_email':    self.requester.email    if self.requester else None,
            'requester_role':     self.requester.role     if self.requester else None,
            'customer_file': self.customer_file,
            'internal_file': self.internal_file,
            'status': self.status,
            'is_deleted': self.is_deleted,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None,
            'assignment_scope': self.assignment_scope,
            'assigned_to': self.assigned_to,
            'assigned_to_username': self.assignee.username if self.assignee else None,
            'assigned_by': self.assigned_by,
            'assignment_note': self.assignment_note,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
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

    # Maker is the original uploader / creator of the reconciliation job.
    maker_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Checker stage (maker -> checker -> approver)
    check_status = db.Column(db.String(50), default='pending', nullable=True)
    checker_status = db.Column(db.String(50), default='pending', nullable=True)
    checked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    checked_at = db.Column(db.DateTime, nullable=True)

    # Final approval status (approver stage)
    approval_status = db.Column(db.String(50), default='pending', nullable=True)
    approver_status = db.Column(db.String(50), default='pending', nullable=True)
    # Values: 'pending', 'reconciled', 'unreconciled', 'surplus_assets',
    #         'exist_in_erp_not_physical'
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    
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
    
    # Relationships
    reconciliation = db.relationship('Reconciliation', backref=db.backref('records', cascade='all, delete-orphan'))
    maker = db.relationship('User', foreign_keys=[maker_user_id])
    checker = db.relationship('User', foreign_keys=[checked_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    
    def to_dict(self):
        maker_user_id = self.maker_user_id or (self.reconciliation.user_id if self.reconciliation else None)
        maker_user = self.maker or (self.reconciliation.user if self.reconciliation else None)
        return {
            'id': self.id,
            'reconciliation_id': self.reconciliation_id,
            'match_category': self.match_category,
            'maker_user_id': maker_user_id,
            'maker_username': maker_user.username if maker_user else None,
            'check_status': self.check_status or self.checker_status or 'pending',
            'checker_status': self.checker_status or self.check_status or 'pending',
            'checked_by': self.checked_by,
            'checked_by_username': self.checker.username if self.checker else None,
            'checker_username': self.checker.username if self.checker else None,
            'checked_at': self.checked_at.isoformat() if self.checked_at else None,
            'approval_status': self.approval_status or self.approver_status or 'pending',
            'approver_status': self.approver_status or self.approval_status or 'pending',
            'approved_by': self.approved_by,
            'approved_by_username': self.approver.username if self.approver else None,
            'approver_username': self.approver.username if self.approver else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'full_record_json': self.full_record_json,
            'internal_old_tag': self.internal_old_tag,
            'internal_new_tag': self.internal_new_tag,
            'customer_old_tag': self.customer_old_tag,
            'customer_new_tag': self.customer_new_tag,
            'match_type': self.match_type,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat()
        }


class AuditLog(db.Model):
    """Audit log model for tracking privileged operations"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    operation_type = db.Column(db.String(50), nullable=False)
    # Operation types: CREATE_USER, UPDATE_ROLE, DELETE_USER, 
    # APPROVE_EXCEPTION, FINALIZE_RECONCILIATION, UPDATE_CONFIG
    resource_type = db.Column(db.String(50), nullable=False)
    # Resource types: user, reconciliation, configuration, system
    resource_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.JSON, nullable=True)
    # Additional context: old_value, new_value, affected_username, etc.
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'full_name': self.user.full_name if self.user else None,
            'operation_type': self.operation_type,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': self.details,
            'ip_address': self.ip_address,
            'timestamp': self.timestamp.isoformat()
        }
    
    def __repr__(self):
        return f'<AuditLog {self.id}: {self.operation_type} by user {self.user_id}>'
