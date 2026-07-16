"""add subscription fields to users

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "subscription_status",
            sa.String(20),
            nullable=False,
            server_default="trial",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "trial_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "trial_started_at")
    op.drop_column("users", "subscription_ends_at")
