"""Add indexes for dashboard and approval table queries.

Revision ID: add_dashboard_table_indexes_20260929_001
Revises: add_reconciliation_soft_delete_20260924_001
Create Date: 2026-09-29 10:00:00.000000
"""
from alembic import op

revision = 'add_dashboard_table_indexes_20260929_001'
down_revision = 'add_reconciliation_soft_delete_20260924_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_reconciliations_deleted_created',
        'reconciliations',
        ['is_deleted', 'created_at'],
    )
    op.create_index(
        'ix_reconciliations_user_deleted_created',
        'reconciliations',
        ['user_id', 'is_deleted', 'created_at'],
    )
    op.create_index(
        'ix_reconciliations_assignee_deleted_created',
        'reconciliations',
        ['assigned_to', 'is_deleted', 'created_at'],
    )
    op.create_index(
        'ix_reconciliations_scope_deleted_created',
        'reconciliations',
        ['assignment_scope', 'is_deleted', 'created_at'],
    )
    op.create_index(
        'ix_records_recon_category_approval_id',
        'reconciliation_records',
        ['reconciliation_id', 'match_category', 'approval_status', 'id'],
    )
    op.create_index(
        'ix_records_recon_category_checker',
        'reconciliation_records',
        ['reconciliation_id', 'match_category', 'check_status', 'checker_status'],
    )


def downgrade():
    op.drop_index('ix_records_recon_category_checker', table_name='reconciliation_records')
    op.drop_index('ix_records_recon_category_approval_id', table_name='reconciliation_records')
    op.drop_index('ix_reconciliations_scope_deleted_created', table_name='reconciliations')
    op.drop_index('ix_reconciliations_assignee_deleted_created', table_name='reconciliations')
    op.drop_index('ix_reconciliations_user_deleted_created', table_name='reconciliations')
    op.drop_index('ix_reconciliations_deleted_created', table_name='reconciliations')