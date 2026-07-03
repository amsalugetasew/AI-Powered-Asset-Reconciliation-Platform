"""
Audit Service for logging privileged operations

Provides centralized audit logging functionality for tracking
all sensitive operations performed in the system.
"""

from models import db, AuditLog
from flask import request
from datetime import datetime


class AuditService:
    """Service for logging privileged operations to audit trail"""
    
    @staticmethod
    def log_operation(user_id, operation_type, resource_type, 
                     resource_id=None, details=None):
        """
        Log a privileged operation to the audit trail.
        
        Args:
            user_id (int): ID of user performing the operation
            operation_type (str): Type of operation
                - CREATE_USER, UPDATE_ROLE, DELETE_USER
                - APPROVE_EXCEPTION, FINALIZE_RECONCILIATION
                - UPDATE_CONFIG, etc.
            resource_type (str): Type of resource affected
                - user, reconciliation, configuration, system
            resource_id (int, optional): ID of affected resource
            details (dict, optional): Additional context as dictionary
                - old_value, new_value, affected_username, etc.
                
        Returns:
            bool: True if logged successfully, False otherwise
            
        Example:
            AuditService.log_operation(
                user_id=1,
                operation_type='UPDATE_ROLE',
                resource_type='user',
                resource_id=5,
                details={
                    'target_username': 'john_doe',
                    'old_role': 'officer',
                    'new_role': 'manager'
                }
            )
        """
        try:
            # Get IP address from request context if available
            ip_address = None
            if request:
                ip_address = request.remote_addr or request.environ.get('HTTP_X_FORWARDED_FOR')
            
            # Create audit log entry
            audit_log = AuditLog(
                user_id=user_id,
                operation_type=operation_type,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
                timestamp=datetime.utcnow()
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            print(f"✓ Audit log created: {operation_type} on {resource_type}:{resource_id} by user {user_id}")
            return True
            
        except Exception as e:
            print(f"✗ Failed to log audit: {str(e)}")
            db.session.rollback()
            return False
    
    @staticmethod
    def get_user_audit_logs(user_id, limit=100):
        """
        Get audit logs for a specific user.
        
        Args:
            user_id (int): User ID to filter by
            limit (int): Maximum number of logs to return
            
        Returns:
            list: List of AuditLog objects
            
        Example:
            logs = AuditService.get_user_audit_logs(user_id=1, limit=50)
            for log in logs:
                print(log.to_dict())
        """
        try:
            logs = AuditLog.query.filter_by(user_id=user_id)\
                .order_by(AuditLog.timestamp.desc())\
                .limit(limit)\
                .all()
            return logs
        except Exception as e:
            print(f"✗ Failed to fetch user audit logs: {str(e)}")
            return []
    
    @staticmethod
    def get_all_audit_logs(limit=1000, offset=0):
        """
        Get all audit logs (admin only).
        
        Args:
            limit (int): Maximum number of logs to return
            offset (int): Number of logs to skip (for pagination)
            
        Returns:
            list: List of AuditLog objects
            
        Example:
            # Get first page
            logs = AuditService.get_all_audit_logs(limit=100, offset=0)
            
            # Get second page
            logs = AuditService.get_all_audit_logs(limit=100, offset=100)
        """
        try:
            logs = AuditLog.query\
                .order_by(AuditLog.timestamp.desc())\
                .limit(limit)\
                .offset(offset)\
                .all()
            return logs
        except Exception as e:
            print(f"✗ Failed to fetch audit logs: {str(e)}")
            return []
    
    @staticmethod
    def get_resource_audit_logs(resource_type, resource_id, limit=100):
        """
        Get audit logs for a specific resource.
        
        Args:
            resource_type (str): Type of resource (user, reconciliation, etc.)
            resource_id (int): ID of the resource
            limit (int): Maximum number of logs to return
            
        Returns:
            list: List of AuditLog objects
            
        Example:
            # Get all audit logs for reconciliation #5
            logs = AuditService.get_resource_audit_logs('reconciliation', 5)
            for log in logs:
                print(f"{log.operation_type} by {log.user.username}")
        """
        try:
            logs = AuditLog.query.filter_by(
                resource_type=resource_type,
                resource_id=resource_id
            ).order_by(AuditLog.timestamp.desc())\
             .limit(limit)\
             .all()
            return logs
        except Exception as e:
            print(f"✗ Failed to fetch resource audit logs: {str(e)}")
            return []
    
    @staticmethod
    def get_operation_audit_logs(operation_type, limit=100):
        """
        Get audit logs for a specific operation type.
        
        Args:
            operation_type (str): Type of operation to filter by
            limit (int): Maximum number of logs to return
            
        Returns:
            list: List of AuditLog objects
            
        Example:
            # Get all role update operations
            logs = AuditService.get_operation_audit_logs('UPDATE_ROLE')
        """
        try:
            logs = AuditLog.query.filter_by(operation_type=operation_type)\
                .order_by(AuditLog.timestamp.desc())\
                .limit(limit)\
                .all()
            return logs
        except Exception as e:
            print(f"✗ Failed to fetch operation audit logs: {str(e)}")
            return []
    
    @staticmethod
    def get_audit_stats():
        """
        Get audit trail statistics.
        
        Returns:
            dict: Statistics about audit trail
            
        Example:
            stats = AuditService.get_audit_stats()
            print(f"Total logs: {stats['total_logs']}")
        """
        try:
            from sqlalchemy import func
            
            total_logs = db.session.query(func.count(AuditLog.id)).scalar()
            
            # Count by operation type
            operation_counts = db.session.query(
                AuditLog.operation_type,
                func.count(AuditLog.id)
            ).group_by(AuditLog.operation_type).all()
            
            # Count by user
            user_counts = db.session.query(
                AuditLog.user_id,
                func.count(AuditLog.id)
            ).group_by(AuditLog.user_id).all()
            
            return {
                'total_logs': total_logs,
                'by_operation': {op: count for op, count in operation_counts},
                'by_user': {user_id: count for user_id, count in user_counts}
            }
        except Exception as e:
            print(f"✗ Failed to fetch audit stats: {str(e)}")
            return {
                'total_logs': 0,
                'by_operation': {},
                'by_user': {}
            }


# Convenience function for common operations
def log_user_created(admin_user_id, created_user_id, created_username, created_role):
    """Log user creation"""
    return AuditService.log_operation(
        user_id=admin_user_id,
        operation_type='CREATE_USER',
        resource_type='user',
        resource_id=created_user_id,
        details={
            'created_username': created_username,
            'created_role': created_role
        }
    )


def log_role_updated(admin_user_id, target_user_id, target_username, old_role, new_role):
    """Log role update"""
    return AuditService.log_operation(
        user_id=admin_user_id,
        operation_type='UPDATE_ROLE',
        resource_type='user',
        resource_id=target_user_id,
        details={
            'target_username': target_username,
            'old_role': old_role,
            'new_role': new_role
        }
    )


def log_user_deleted(admin_user_id, deleted_user_id, deleted_username, deleted_role):
    """Log user deletion"""
    return AuditService.log_operation(
        user_id=admin_user_id,
        operation_type='DELETE_USER',
        resource_type='user',
        resource_id=deleted_user_id,
        details={
            'deleted_username': deleted_username,
            'deleted_role': deleted_role
        }
    )


def log_exception_approved(manager_user_id, reconciliation_id):
    """Log exception approval"""
    return AuditService.log_operation(
        user_id=manager_user_id,
        operation_type='APPROVE_EXCEPTION',
        resource_type='reconciliation',
        resource_id=reconciliation_id
    )


def log_reconciliation_finalized(manager_user_id, reconciliation_id, total_records):
    """Log reconciliation finalization"""
    return AuditService.log_operation(
        user_id=manager_user_id,
        operation_type='FINALIZE_RECONCILIATION',
        resource_type='reconciliation',
        resource_id=reconciliation_id,
        details={
            'total_records': total_records
        }
    )
