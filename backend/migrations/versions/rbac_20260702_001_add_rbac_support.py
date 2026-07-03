"""Add RBAC support with role field and audit logs

Revision ID: rbac_20260702_001
Revises: 4764544f4a05
Create Date: 2026-07-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'rbac_20260702_001'
down_revision = '4764544f4a05'
branch_labels = None
depends_on = None


def upgrade():
    """Add role field to users table and create audit_logs table"""
    
    # Add role column to users table with ENUM type
    # Using server_default to set existing users to 'officer'
    op.add_column('users', 
        sa.Column('role', 
                 sa.Enum('officer', 'manager', 'admin', name='user_role'),
                 server_default='officer', 
                 nullable=False))
    
    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('operation_type', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], 
                               name='fk_audit_logs_user_id',
                               ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better query performance
    op.create_index('idx_audit_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('idx_audit_timestamp', 'audit_logs', ['timestamp'], unique=False)
    op.create_index('idx_audit_resource', 'audit_logs', ['resource_type', 'resource_id'], unique=False)


def downgrade():
    """Remove RBAC support"""
    
    # Drop indexes first
    op.drop_index('idx_audit_resource', table_name='audit_logs')
    op.drop_index('idx_audit_timestamp', table_name='audit_logs')
    op.drop_index('idx_audit_user_id', table_name='audit_logs')
    
    # Drop audit_logs table
    op.drop_table('audit_logs')
    
    # Remove role column from users table
    op.drop_column('users', 'role')
    
    # Drop the ENUM type (MySQL specific)
    # Note: This will only work on MySQL, for other databases adjust accordingly
    op.execute("DROP TYPE IF EXISTS user_role")
