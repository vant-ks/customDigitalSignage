"""
Pydantic v2 schemas for API request/response validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ─── Auth ────────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    org_name: str = Field(min_length=2, max_length=255)
    org_slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    admin_name: str = Field(min_length=1, max_length=255)
    admin_email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str
    org_slug: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int


class AuthResponse(BaseModel):
    user: "UserResponse"
    organization: "OrgResponse"
    tokens: TokenResponse


# ─── Organizations ───────────────────────────────────────────────────────────


class OrgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    plan: str
    settings: dict
    max_displays: int
    max_storage_gb: int
    created_at: datetime
    updated_at: datetime


# ─── Users ───────────────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str = Field(max_length=255)
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="viewer", pattern=r"^(admin|manager|viewer)$")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, pattern=r"^(admin|manager|viewer)$")
    avatar_url: Optional[str] = None


# ─── Display Groups ─────────────────────────────────────────────────────────


class DisplayGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    display_count: int = 0
    online_count: int = 0


class DisplayGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class DisplayGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


# ─── Displays ────────────────────────────────────────────────────────────────


class CachePolicySchema(BaseModel):
    max_gb: float = 8
    depth_days: int = 7
    priority: str = "current_first"
    fallback: str = "last_known_good"
    fallback_media_id: Optional[UUID] = None


class TelemetrySnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    disk_free_gb: Optional[float] = None
    cpu_temp_c: Optional[float] = None
    uptime_sec: Optional[int] = None
    net_connected: Optional[bool] = None
    net_type: Optional[str] = None
    playback_status: Optional[str] = None
    cache_used_gb: Optional[float] = None
    sync_status: Optional[str] = None
    recorded_at: Optional[datetime] = None


class DisplayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    group_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    hardware_type: str
    os_type: Optional[str] = None
    agent_version: Optional[str] = None
    resolution_w: Optional[int] = None
    resolution_h: Optional[int] = None
    orientation: str
    refresh_rate: Optional[int] = None
    device_token: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    status: str
    last_heartbeat: Optional[datetime] = None
    last_screenshot: Optional[str] = None
    cache_policy: dict
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    group: Optional[DisplayGroupResponse] = None
    latest_telemetry: Optional[TelemetrySnapshot] = None


class DisplayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    group_id: Optional[UUID] = None
    hardware_type: str = Field(default="unknown", pattern=r"^(pi4|pi5|nuc|x86|mac_mini|unknown)$")
    resolution_w: Optional[int] = Field(None, ge=1)
    resolution_h: Optional[int] = Field(None, ge=1)
    orientation: str = Field(default="landscape", pattern=r"^(landscape|portrait|portrait_left)$")
    refresh_rate: Optional[int] = Field(60, ge=1, le=240)
    cache_policy: Optional[CachePolicySchema] = None
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    tags: list[str] = Field(default_factory=list)


class DisplayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    group_id: Optional[UUID] = None
    hardware_type: Optional[str] = Field(None, pattern=r"^(pi4|pi5|nuc|x86|mac_mini|unknown)$")
    resolution_w: Optional[int] = Field(None, ge=1)
    resolution_h: Optional[int] = Field(None, ge=1)
    orientation: Optional[str] = Field(None, pattern=r"^(landscape|portrait|portrait_left)$")
    refresh_rate: Optional[int] = Field(None, ge=1, le=240)
    cache_policy: Optional[CachePolicySchema] = None
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    tags: Optional[list[str]] = None


# ─── Provisioning ────────────────────────────────────────────────────────────


class ProvisioningTokenCreate(BaseModel):
    display_id: Optional[UUID] = None
    hardware_type: Optional[str] = None
    config: dict = Field(default_factory=dict)
    expires_hours: int = Field(default=24, ge=1, le=168)


class ProvisioningTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    token: str
    display_id: Optional[UUID] = None
    hardware_type: Optional[str] = None
    config: dict
    is_used: bool
    expires_at: datetime
    created_at: datetime


# ─── Device Registration ────────────────────────────────────────────────────


class DeviceRegisterRequest(BaseModel):
    provisioning_token: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    os_type: Optional[str] = None
    agent_version: Optional[str] = None


class DeviceRegisterResponse(BaseModel):
    device_token: str
    display_id: UUID
    display_name: str
    config: dict


class DeviceHeartbeatRequest(BaseModel):
    status: str = "online"
    ip_address: Optional[str] = None
    agent_version: Optional[str] = None


class DeviceTelemetryRequest(BaseModel):
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    disk_free_gb: Optional[float] = None
    cpu_temp_c: Optional[float] = None
    uptime_sec: Optional[int] = None
    net_connected: Optional[bool] = None
    net_type: Optional[str] = None
    net_ssid: Optional[str] = None
    net_signal_dbm: Optional[int] = None
    net_bandwidth_mbps: Optional[float] = None
    current_playlist_id: Optional[UUID] = None
    current_media_id: Optional[UUID] = None
    playback_status: Optional[str] = None
    cache_used_gb: Optional[float] = None
    cache_item_count: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    sync_status: Optional[str] = None


# ─── Pagination ──────────────────────────────────────────────────────────────


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    page_size: int
    total_pages: int


# Forward ref resolution
AuthResponse.model_rebuild()
