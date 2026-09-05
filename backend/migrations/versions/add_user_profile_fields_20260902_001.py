"""Add full_name, employee_id, department to users table

Revision ID: add_user_profile_20260902_001
Revises: add_approval_status_20260703_001
Create Date: 2026-09-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_user_profile_20260902_001'
down_revision = 'add_approval_status_20260703_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('full_name',    sa.String(150), nullable=True))
    op.add_column('users', sa.Column('employee_id',  sa.String(50),  nullable=True))
    op.add_column('users', sa.Column('department',   sa.String(100), nullable=True))


def downgrade():
    op.drop_column('users', 'department')
    op.drop_column('users', 'employee_id')
    op.drop_column('users', 'full_name')
