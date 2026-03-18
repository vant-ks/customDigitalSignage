"""
SQLAlchemy async ORM models for all database entities.
Mirrors schema.sql — multi-tenant with org_id scoping.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    BigInteger,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


# ─── Organizations ───────────────────────────────────────────────────────────


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="starter", nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    max_displays: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    max_storage_gb: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    displays: Mapped[list["Display"]] = relationship(back_populates="organization")
    display_groups: Mapped[list["DisplayGroup"]] = relationship(
        back_populates="organization"
    )


# ─── Users ───────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="viewer", nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    organization: Mapped["Organization"] = relationship(back_populates="users")


# ─── Storage Providers ───────────────────────────────────────────────────────


class StorageProvider(Base):
    __tablename__ = "storage_providers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    credentials: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    root_folder: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# ─── Display Groups ─────────────────────────────────────────────────────────


class DisplayGroup(Base):
    __tablename__ = "display_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    organization: Mapped["Organization"] = relationship(back_populates="display_groups")
    displays: Mapped[list["Display"]] = relationship(back_populates="group")


# ─── Displays ────────────────────────────────────────────────────────────────


class Display(Base):
    __tablename__ = "displays"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("display_groups.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Hardware
    hardware_type: Mapped[str] = mapped_column(
        String(50), default="unknown", nullable=False
    )
    os_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    agent_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Display config
    resolution_w: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resolution_h: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    orientation: Mapped[str] = mapped_column(
        String(20), default="landscape", nullable=False
    )
    refresh_rate: Mapped[Optional[int]] = mapped_column(Integer, default=60)

    # Network
    device_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    mac_address: Mapped[Optional[str]] = mapped_column(String(17), nullable=True)
    hostname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_screenshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cache policy
    cache_policy: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "max_gb": 8,
            "depth_days": 7,
            "priority": "current_first",
            "fallback": "last_known_good",
        },
        nullable=False,
    )

    # Location
    location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location_lat: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 7), nullable=True
    )
    location_lng: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 7), nullable=True
    )

    tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="displays")
    group: Mapped[Optional["DisplayGroup"]] = relationship(back_populates="displays")
    telemetry: Mapped[list["DeviceTelemetry"]] = relationship(
        back_populates="display", order_by="DeviceTelemetry.recorded_at.desc()"
    )


# ─── Media Assets ────────────────────────────────────────────────────────────


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    storage_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("storage_providers.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)
    source_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=True
    )
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_sec: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    framerate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    template_schema: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    template_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    folder: Mapped[str] = mapped_column(String(500), default="/", nullable=True)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# ─── Playlists ───────────────────────────────────────────────────────────────


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    play_mode: Mapped[str] = mapped_column(
        String(50), default="sequential", nullable=False
    )
    transition_type: Mapped[str] = mapped_column(String(50), default="cut")
    transition_ms: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    items: Mapped[list["PlaylistItem"]] = relationship(
        back_populates="playlist", order_by="PlaylistItem.position"
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    playlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False
    )
    media_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_sec: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    weight: Mapped[int] = mapped_column(Integer, default=1)
    transition_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    transition_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    valid_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    playlist: Mapped["Playlist"] = relationship(back_populates="items")


# ─── Schedules ───────────────────────────────────────────────────────────────


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("displays.id", ondelete="CASCADE"),
        nullable=True,
    )
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("display_groups.id", ondelete="CASCADE"),
        nullable=True,
    )
    playlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False
    )
    schedule_type: Mapped[str] = mapped_column(
        String(50), default="always", nullable=False
    )
    start_date = mapped_column(DateTime(timezone=True), nullable=True)
    end_date = mapped_column(DateTime(timezone=True), nullable=True)
    start_time = mapped_column(String(8), nullable=True)
    end_time = mapped_column(String(8), nullable=True)
    days_of_week: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=lambda: [0, 1, 2, 3, 4, 5, 6]
    )
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# ─── Provisioning Tokens ────────────────────────────────────────────────────


class ProvisioningToken(Base):
    __tablename__ = "provisioning_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("displays.id", ondelete="CASCADE"),
        nullable=True,
    )
    hardware_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    used_by_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


# ─── Device Telemetry ────────────────────────────────────────────────────────


class DeviceTelemetry(Base):
    __tablename__ = "device_telemetry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    display_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("displays.id", ondelete="CASCADE"), nullable=False
    )
    cpu_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    memory_percent: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    disk_percent: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    disk_free_gb: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    cpu_temp_c: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)
    uptime_sec: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    net_connected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    net_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    net_ssid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    net_signal_dbm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    net_bandwidth_mbps: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    current_playlist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    current_media_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    playback_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cache_used_gb: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    cache_item_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    display: Mapped["Display"] = relationship(back_populates="telemetry")


# ─── Audit Log ───────────────────────────────────────────────────────────────


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    details: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


# ─── Alert Rules ─────────────────────────────────────────────────────────────


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    threshold: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    display_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("displays.id", ondelete="CASCADE"),
        nullable=True,
    )
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("display_groups.id", ondelete="CASCADE"),
        nullable=True,
    )
    channels: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=lambda: ["dashboard"], nullable=False
    )
    webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email_recipients: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(Text), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cooldown_min: Mapped[int] = mapped_column(Integer, default=30)
    last_fired_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# ─── Notifications ───────────────────────────────────────────────────────────


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    alert_rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alert_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    severity: Mapped[str] = mapped_column(String(20), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("displays.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
