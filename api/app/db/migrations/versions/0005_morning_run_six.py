"""Move seeded hubs' morning run from 06:30 to 06:00

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _move(old: str, new: str) -> None:
    op.execute(sa.text("UPDATE hubs SET morning_run = :new WHERE morning_run = :old").bindparams(new=new, old=old))


def upgrade() -> None:
    _move("06:30:00.000000", "06:00:00.000000")


def downgrade() -> None:
    _move("06:00:00.000000", "06:30:00.000000")
