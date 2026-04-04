"""Phase 6 performance indexes.

Revision ID: 002_phase6_indexes
Revises: 001_initial_schema
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "002_phase6_indexes"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Telemetry queries filter by display_id and sort by recorded_at DESC
    op.create_index(
        "ix_device_telemetry_display_recorded",
        "device_telemetry",
        ["display_id", "recorded_at"],
    )

    # Audit log queries filter by org_id and sort by created_at DESC
    op.create_index(
        "ix_audit_log_org_created",
        "audit_log",
        ["org_id", "created_at"],
    )

    # Notification queries filter by org_id + is_read and sort by created_at DESC
    op.create_index(
        "ix_notifications_org_read_created",
        "notifications",
        ["org_id", "is_read", "created_at"],
    )

    # Alert rule queries filter by org_id + is_active
    op.create_index(
        "ix_alert_rules_org_active",
        "alert_rules",
        ["org_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_alert_rules_org_active", table_name="alert_rules")
    op.drop_index("ix_notifications_org_read_created", table_name="notifications")
    op.drop_index("ix_audit_log_org_created", table_name="audit_log")
    op.drop_index("ix_device_telemetry_display_recorded", table_name="device_telemetry")
