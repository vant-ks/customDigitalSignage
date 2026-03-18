"""initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-03-18

Creates all 14 tables for the VANT Signage Platform.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable UUID generation
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # ── organizations ──────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("plan", sa.String(50), server_default="starter", nullable=False),
        sa.Column(
            "settings",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("max_displays", sa.Integer(), server_default="25", nullable=False),
        sa.Column("max_storage_gb", sa.Integer(), server_default="50", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), server_default="viewer", nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "email", name="uq_users_org_email"),
    )

    # ── storage_providers ──────────────────────────────────────────────────
    op.create_table(
        "storage_providers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_type", sa.String(50), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column(
            "credentials",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("root_folder", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── display_groups ─────────────────────────────────────────────────────
    op.create_table(
        "display_groups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── displays ───────────────────────────────────────────────────────────
    op.create_table(
        "displays",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "hardware_type", sa.String(50), server_default="unknown", nullable=False
        ),
        sa.Column("os_type", sa.String(50), nullable=True),
        sa.Column("agent_version", sa.String(50), nullable=True),
        sa.Column("resolution_w", sa.Integer(), nullable=True),
        sa.Column("resolution_h", sa.Integer(), nullable=True),
        sa.Column(
            "orientation", sa.String(20), server_default="landscape", nullable=False
        ),
        sa.Column("refresh_rate", sa.Integer(), server_default="60", nullable=True),
        sa.Column("device_token", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("mac_address", sa.String(17), nullable=True),
        sa.Column("hostname", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), server_default="pending", nullable=False),
        sa.Column("last_heartbeat", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_screenshot", sa.Text(), nullable=True),
        sa.Column(
            "cache_policy",
            postgresql.JSONB(),
            server_default=sa.text(
                '\'{"max_gb": 8, "depth_days": 7, "priority": "current_first", "fallback": "last_known_good"}\'::jsonb'
            ),
            nullable=False,
        ),
        sa.Column("location_name", sa.String(255), nullable=True),
        sa.Column("location_lat", sa.Numeric(10, 7), nullable=True),
        sa.Column("location_lng", sa.Numeric(10, 7), nullable=True),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("ARRAY[]::text[]"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["display_groups.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_token"),
    )
    op.create_index("ix_displays_org_status", "displays", ["org_id", "status"])
    op.create_index("ix_displays_org_group", "displays", ["org_id", "group_id"])

    # ── media_assets ───────────────────────────────────────────────────────
    op.create_table(
        "media_assets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("source_path", sa.Text(), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("processed_url", sa.Text(), nullable=True),
        sa.Column(
            "processing_status",
            sa.String(50),
            server_default="pending",
            nullable=True,
        ),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_sec", sa.Numeric(10, 2), nullable=True),
        sa.Column("codec", sa.String(50), nullable=True),
        sa.Column("framerate", sa.Numeric(5, 2), nullable=True),
        sa.Column("template_schema", postgresql.JSONB(), nullable=True),
        sa.Column("template_data", postgresql.JSONB(), nullable=True),
        sa.Column("folder", sa.String(500), server_default="/", nullable=True),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("ARRAY[]::text[]"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["storage_id"], ["storage_providers.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── playlists ──────────────────────────────────────────────────────────
    op.create_table(
        "playlists",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "play_mode", sa.String(50), server_default="sequential", nullable=False
        ),
        sa.Column(
            "transition_type", sa.String(50), server_default="cut", nullable=False
        ),
        sa.Column("transition_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── playlist_items ─────────────────────────────────────────────────────
    op.create_table(
        "playlist_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("playlist_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("duration_sec", sa.Integer(), server_default="10", nullable=False),
        sa.Column("weight", sa.Integer(), server_default="1", nullable=True),
        sa.Column("transition_type", sa.String(50), nullable=True),
        sa.Column("transition_ms", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["media_id"], ["media_assets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["playlist_id"], ["playlists.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── schedules ──────────────────────────────────────────────────────────
    op.create_table(
        "schedules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("playlist_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "schedule_type", sa.String(50), server_default="always", nullable=False
        ),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_time", sa.String(8), nullable=True),
        sa.Column("end_time", sa.String(8), nullable=True),
        sa.Column(
            "days_of_week",
            postgresql.ARRAY(sa.Integer()),
            server_default=sa.text("ARRAY[0,1,2,3,4,5,6]"),
            nullable=True,
        ),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "is_override", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["display_id"], ["displays.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["display_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["playlist_id"], ["playlists.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── provisioning_tokens ────────────────────────────────────────────────
    op.create_table(
        "provisioning_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("display_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("hardware_type", sa.String(50), nullable=True),
        sa.Column(
            "config",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("is_used", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_ip", sa.String(45), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["display_id"], ["displays.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )

    # ── device_telemetry ───────────────────────────────────────────────────
    op.create_table(
        "device_telemetry",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("display_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cpu_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("memory_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("disk_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("disk_free_gb", sa.Numeric(10, 2), nullable=True),
        sa.Column("cpu_temp_c", sa.Numeric(5, 1), nullable=True),
        sa.Column("uptime_sec", sa.BigInteger(), nullable=True),
        sa.Column("net_connected", sa.Boolean(), nullable=True),
        sa.Column("net_type", sa.String(20), nullable=True),
        sa.Column("net_ssid", sa.String(100), nullable=True),
        sa.Column("net_signal_dbm", sa.Integer(), nullable=True),
        sa.Column("net_bandwidth_mbps", sa.Numeric(8, 2), nullable=True),
        sa.Column("current_playlist_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("current_media_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("playback_status", sa.String(50), nullable=True),
        sa.Column("cache_used_gb", sa.Numeric(10, 2), nullable=True),
        sa.Column("cache_item_count", sa.Integer(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(50), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["display_id"], ["displays.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_device_telemetry_display_recorded",
        "device_telemetry",
        ["display_id", "recorded_at"],
    )

    # ── audit_log ──────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "details",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=True,
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_log_org_created", "audit_log", ["org_id", "created_at"]
    )

    # ── alert_rules ────────────────────────────────────────────────────────
    op.create_table(
        "alert_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("threshold", postgresql.JSONB(), nullable=True),
        sa.Column("display_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "channels",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("ARRAY['dashboard']::text[]"),
            nullable=False,
        ),
        sa.Column("webhook_url", sa.Text(), nullable=True),
        sa.Column("email_recipients", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("cooldown_min", sa.Integer(), server_default="30", nullable=False),
        sa.Column("last_fired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["display_id"], ["displays.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["display_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── notifications ──────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("severity", sa.String(20), server_default="info", nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("display_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("read_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["alert_rule_id"], ["alert_rules.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["display_id"], ["displays.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["read_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notifications_org_created", "notifications", ["org_id", "created_at"]
    )
    op.create_index(
        "ix_notifications_unread", "notifications", ["org_id", "is_read"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_unread")
    op.drop_index("ix_notifications_org_created")
    op.drop_table("notifications")
    op.drop_table("alert_rules")
    op.drop_index("ix_audit_log_org_created")
    op.drop_table("audit_log")
    op.drop_index("ix_device_telemetry_display_recorded")
    op.drop_table("device_telemetry")
    op.drop_table("provisioning_tokens")
    op.drop_table("schedules")
    op.drop_table("playlist_items")
    op.drop_table("playlists")
    op.drop_table("media_assets")
    op.drop_index("ix_displays_org_group")
    op.drop_index("ix_displays_org_status")
    op.drop_table("displays")
    op.drop_table("display_groups")
    op.drop_table("storage_providers")
    op.drop_table("users")
    op.drop_table("organizations")
