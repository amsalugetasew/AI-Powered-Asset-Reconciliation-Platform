"""Add pending, active, and suspended user status.

Revision ID: add_user_status_20260919_001
Revises: add_user_profile_20260902_001
Create Date: 2026-09-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_user_status_20260919_001'
down_revision = 'add_user_profile_20260902_001'
branch_labels = None
depends_on = None


def upgrade():
    user_status = sa.Enum('pending', 'active', 'suspended', name='user_status')
    user_status.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column('status', user_status, nullable=True))
    op.execute("UPDATE users SET status = CASE WHEN is_active = 1 THEN 'active' ELSE 'suspended' END")
    op.alter_column('users', 'status', nullable=False, server_default='active')


def downgrade():
    op.drop_column('users', 'status')
    sa.Enum('pending', 'active', 'suspended', name='user_status').drop(op.get_bind(), checkfirst=True)
