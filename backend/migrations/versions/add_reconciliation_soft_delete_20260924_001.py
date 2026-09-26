"""Add recoverable soft deletion to reconciliations.

Revision ID: add_reconciliation_soft_delete_20260924_001
Revises: add_user_status_20260919_001
Create Date: 2026-09-24 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_reconciliation_soft_delete_20260924_001'
down_revision = 'add_user_status_20260919_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reconciliations', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('reconciliations', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('reconciliations', sa.Column('deleted_by', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_reconciliations_deleted_by_users',
        'reconciliations', 'users', ['deleted_by'], ['id']
    )
    op.create_index('ix_reconciliations_is_deleted', 'reconciliations', ['is_deleted'])


def downgrade():
    op.drop_index('ix_reconciliations_is_deleted', table_name='reconciliations')
    op.drop_constraint('fk_reconciliations_deleted_by_users', 'reconciliations', type_='foreignkey')
    op.drop_column('reconciliations', 'deleted_by')
    op.drop_column('reconciliations', 'deleted_at')
    op.drop_column('reconciliations', 'is_deleted')