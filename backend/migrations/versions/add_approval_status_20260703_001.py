"""add approval status to reconciliation records

Revision ID: add_approval_status_20260703_001
Revises: rbac_20260702_001
Create Date: 2026-07-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_approval_status_20260703_001'
down_revision = 'rbac_20260702_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add approval status columns to reconciliation_records table
    op.add_column('reconciliation_records', 
                  sa.Column('approval_status', sa.String(length=50), 
                           nullable=False, server_default='pending'))
    op.add_column('reconciliation_records', 
                  sa.Column('approved_by', sa.Integer(), nullable=True))
    op.add_column('reconciliation_records', 
                  sa.Column('approved_at', sa.DateTime(), nullable=True))
    
    # Add foreign key constraint for approved_by
    op.create_foreign_key(
        'fk_reconciliation_records_approved_by',
        'reconciliation_records', 'users',
        ['approved_by'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create index on approval_status for faster queries
    op.create_index(
        'ix_reconciliation_records_approval_status',
        'reconciliation_records',
        ['approval_status']
    )


def downgrade():
    # Drop index
    op.drop_index('ix_reconciliation_records_approval_status', 
                  table_name='reconciliation_records')
    
    # Drop foreign key
    op.drop_constraint('fk_reconciliation_records_approved_by', 
                      'reconciliation_records', type_='foreignkey')
    
    # Drop columns
    op.drop_column('reconciliation_records', 'approved_at')
    op.drop_column('reconciliation_records', 'approved_by')
    op.drop_column('reconciliation_records', 'approval_status')
