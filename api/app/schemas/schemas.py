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


# ─── Storage Providers ───────────────────────────────────────────────────────


class StorageProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    provider_type: str
    label: str
    root_folder: Optional[str] = None
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # credentials intentionally excluded


class StorageProviderCreate(BaseModel):
    provider_type: str = Field(pattern=r"^(dropbox|gdrive|onedrive|local)$")
    label: str = Field(min_length=1, max_length=255)
    root_folder: Optional[str] = None


# ─── Media Assets ─────────────────────────────────────────────────────────────


class MediaAssetCreate(BaseModel):
    storage_id: UUID
    name: str = Field(min_length=1, max_length=255)
    source_path: str = Field(min_length=1)
    file_type: str = Field(pattern=r"^(image|video|html_template|url|pdf)$")
    mime_type: Optional[str] = None
    folder: str = "/"
    tags: list[str] = Field(default_factory=list)
    template_schema: Optional[dict] = None
    template_data: Optional[dict] = None


class MediaAssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder: Optional[str] = None
    tags: Optional[list[str]] = None
    template_data: Optional[dict] = None


class MediaAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    storage_id: Optional[UUID] = None
    name: str
    file_type: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    source_path: str
    source_hash: Optional[str] = None
    thumbnail_url: Optional[str] = None
    processed_url: Optional[str] = None
    processing_status: str
    processing_error: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration_sec: Optional[float] = None
    codec: Optional[str] = None
    framerate: Optional[float] = None
    template_schema: Optional[dict] = None
    template_data: Optional[dict] = None
    folder: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime


# ─── Playlists ────────────────────────────────────────────────────────────────


class PlaylistItemCreate(BaseModel):
    media_id: UUID
    position: int = Field(ge=0)
    duration_sec: int = Field(default=10, ge=1, le=3600)
    weight: int = Field(default=1, ge=1, le=100)
    transition_type: Optional[str] = None
    transition_ms: Optional[int] = Field(None, ge=0, le=5000)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class PlaylistItemUpdate(BaseModel):
    duration_sec: Optional[int] = Field(None, ge=1, le=3600)
    weight: Optional[int] = Field(None, ge=1, le=100)
    transition_type: Optional[str] = None
    transition_ms: Optional[int] = Field(None, ge=0, le=5000)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class PlaylistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    playlist_id: UUID
    media_id: UUID
    position: int
    duration_sec: int
    weight: int
    transition_type: Optional[str] = None
    transition_ms: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    created_at: datetime
    media: Optional["MediaAssetResponse"] = None


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    play_mode: str = Field(default="sequential", pattern=r"^(sequential|shuffle|weighted)$")
    transition_type: str = Field(default="cut")
    transition_ms: int = Field(default=0, ge=0, le=5000)


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    play_mode: Optional[str] = Field(None, pattern=r"^(sequential|shuffle|weighted)$")
    transition_type: Optional[str] = None
    transition_ms: Optional[int] = Field(None, ge=0, le=5000)
    is_active: Optional[bool] = None


class PlaylistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    description: Optional[str] = None
    play_mode: str
    transition_type: str
    transition_ms: int
    is_active: bool
    items: list[PlaylistItemResponse] = []
    created_at: datetime
    updated_at: datetime

    @property
    def item_count(self) -> int:
        return len(self.items)

    @property
    def total_duration_sec(self) -> int:
        return sum(i.duration_sec for i in self.items)


# ─── Schedules ────────────────────────────────────────────────────────────────


class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    display_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    playlist_id: UUID
    schedule_type: str = Field(default="always", pattern=r"^(always|recurring|one_time)$")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    start_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}(:\d{2})?$")  # HH:MM or HH:MM:SS
    end_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    priority: int = Field(default=0, ge=0, le=100)
    is_override: bool = False
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    display_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    playlist_id: Optional[UUID] = None
    schedule_type: Optional[str] = Field(None, pattern=r"^(always|recurring|one_time)$")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    start_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    end_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    days_of_week: Optional[list[int]] = None
    priority: Optional[int] = Field(None, ge=0, le=100)
    is_override: Optional[bool] = None
    is_active: Optional[bool] = None


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    description: Optional[str] = None
    display_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    playlist_id: UUID
    schedule_type: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    days_of_week: list[int]
    priority: int
    is_override: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ScheduleOverrideRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    playlist_id: UUID
    display_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    priority: int = Field(default=99, ge=0, le=100)
    auto_expire_minutes: Optional[int] = Field(None, ge=1, le=1440)


# ─── Content Manifest (for display agents) ───────────────────────────────────


class ManifestMediaItemSchema(BaseModel):
    id: str
    name: str
    file_type: str
    source_url: str
    source_hash: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_sec: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None


class ManifestPlaylistItemSchema(BaseModel):
    id: str
    media: ManifestMediaItemSchema
    position: int
    duration_sec: int
    transition_type: str
    transition_ms: int


class ManifestPlaylistSchema(BaseModel):
    id: str
    name: str
    play_mode: str
    items: list[ManifestPlaylistItemSchema]


class ManifestScheduleEntrySchema(BaseModel):
    id: str
    playlist: ManifestPlaylistSchema
    schedule_type: str
    days_of_week: list[int]
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    priority: int
    is_override: bool


class ContentManifestResponse(BaseModel):
    display_id: str
    manifest_hash: str
    generated_at: datetime
    cache_policy: dict
    schedules: list[ManifestScheduleEntrySchema]
    fallback_playlist: Optional[ManifestPlaylistSchema] = None


# ─── Sync Status ──────────────────────────────────────────────────────────────


class SyncStatusRequest(BaseModel):
    manifest_hash: Optional[str] = None
    cache_used_gb: Optional[float] = None
    cached_item_count: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    sync_status: str = Field(default="ok", pattern=r"^(ok|error|syncing)$")
    sync_error: Optional[str] = None


class PlaylistReorderRequest(BaseModel):
    order: list[UUID]  # ordered list of PlaylistItem IDs


# Forward ref resolution
AuthResponse.model_rebuild()
