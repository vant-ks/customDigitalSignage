// ─── Core entities ────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  settings: Record<string, unknown>
  max_displays: number
  max_storage_gb: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  org_id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'viewer'
  avatar_url: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// ─── Display entities ─────────────────────────────────────────────────────────

export type DisplayStatus = 'online' | 'offline' | 'pending' | 'error' | 'maintenance'
export type HardwareType = 'pi4' | 'pi5' | 'nuc' | 'x86' | 'mac_mini' | 'unknown'
export type Orientation = 'landscape' | 'portrait' | 'portrait_left'

export interface CachePolicy {
  max_gb: number
  depth_days: number
  priority: 'current_first' | 'scheduled_first'
  fallback: 'last_known_good' | 'fallback_media' | 'blank'
  fallback_media_id?: string | null
}

export interface TelemetrySnapshot {
  cpu_percent: number | null
  memory_percent: number | null
  disk_percent: number | null
  disk_free_gb: number | null
  cpu_temp_c: number | null
  uptime_sec: number | null
  net_connected: boolean | null
  net_type: string | null
  playback_status: string | null
  cache_used_gb: number | null
  sync_status: string | null
  recorded_at: string | null
}

export interface DisplayGroup {
  id: string
  org_id: string
  name: string
  description: string | null
  color: string | null
  display_count: number
  online_count: number
  created_at: string
  updated_at: string
}

export interface Display {
  id: string
  org_id: string
  group_id: string | null
  name: string
  description: string | null
  hardware_type: HardwareType
  os_type: string | null
  agent_version: string | null
  resolution_w: number | null
  resolution_h: number | null
  orientation: Orientation
  refresh_rate: number | null
  device_token: string
  ip_address: string | null
  mac_address: string | null
  hostname: string | null
  status: DisplayStatus
  last_heartbeat: string | null
  last_screenshot: string | null
  cache_policy: CachePolicy
  location_name: string | null
  location_lat: number | null
  location_lng: number | null
  tags: string[]
  created_at: string
  updated_at: string
  group: DisplayGroup | null
  latest_telemetry: TelemetrySnapshot | null
}

// ─── Media entities ───────────────────────────────────────────────────────────

export type FileType = 'image' | 'video' | 'html_template' | 'url' | 'pdf'
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'error'

export interface MediaAsset {
  id: string
  org_id: string
  storage_id: string | null
  name: string
  file_type: FileType
  mime_type: string | null
  file_size_bytes: number | null
  source_path: string
  source_hash: string | null
  thumbnail_url: string | null
  processed_url: string | null
  processing_status: ProcessingStatus
  processing_error: string | null
  width: number | null
  height: number | null
  duration_sec: number | null
  codec: string | null
  framerate: number | null
  template_schema: Record<string, unknown> | null
  template_data: Record<string, unknown> | null
  folder: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface PlaylistItem {
  id: string
  playlist_id: string
  media_id: string
  position: number
  duration_sec: number
  weight: number
  transition_type: string | null
  transition_ms: number | null
  valid_from: string | null
  valid_until: string | null
  created_at: string
}

export type PlayMode = 'sequential' | 'shuffle' | 'weighted'

export interface Playlist {
  id: string
  org_id: string
  name: string
  description: string | null
  play_mode: PlayMode
  transition_type: string
  transition_ms: number
  is_active: boolean
  items: PlaylistItem[]
  created_at: string
  updated_at: string
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export type ScheduleType = 'always' | 'recurring' | 'one_time'

export interface Schedule {
  id: string
  org_id: string
  name: string
  description: string | null
  display_id: string | null
  group_id: string | null
  playlist_id: string
  schedule_type: ScheduleType
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  days_of_week: number[]
  priority: number
  is_override: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Provisioning ─────────────────────────────────────────────────────────────

export interface ProvisioningToken {
  id: string
  org_id: string
  token: string
  display_id: string | null
  hardware_type: string | null
  config: Record<string, unknown>
  is_used: boolean
  expires_at: string
  created_at: string
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface AuthResponse {
  user: User
  organization: Organization
  tokens: TokenResponse
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string | { msg: string; type: string }[]
  status?: number
}

// ─── WebSocket types ──────────────────────────────────────────────────────────

export type WSMessageType =
  | 'heartbeat'
  | 'heartbeat_ack'
  | 'status_change'
  | 'telemetry'
  | 'sync_status'
  | 'screenshot'
  | 'command'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
}

export interface StatusChangePayload {
  deviceToken: string
  status: DisplayStatus
  heartbeat: string
}

export interface TelemetryPayload extends TelemetrySnapshot {
  displayId: string
  recordedAt: string
}

export interface CommandPayload {
  command: 'reboot' | 'restart_agent' | 'take_screenshot' | 'refresh_content' | 'update_config'
  deviceToken: string
  params?: Record<string, unknown>
}

// ─── Content Manifest (for display agents) ────────────────────────────────────

export interface ManifestMediaItem {
  id: string
  name: string
  file_type: FileType
  source_url: string          // signed download URL
  source_hash: string         // SHA-256 for cache verification
  file_size_bytes: number
  duration_sec: number | null
  width: number | null
  height: number | null
}

export interface ManifestPlaylistItem {
  id: string
  media: ManifestMediaItem
  position: number
  duration_sec: number
  transition_type: string
  transition_ms: number
}

export interface ManifestPlaylist {
  id: string
  name: string
  play_mode: PlayMode
  items: ManifestPlaylistItem[]
}

export interface ManifestScheduleEntry {
  id: string
  playlist: ManifestPlaylist
  schedule_type: ScheduleType
  days_of_week: number[]
  start_time: string | null
  end_time: string | null
  start_date: string | null
  end_date: string | null
  priority: number
  is_override: boolean
}

export interface ContentManifest {
  display_id: string
  manifest_hash: string
  generated_at: string
  cache_policy: CachePolicy
  schedules: ManifestScheduleEntry[]
  fallback_playlist: ManifestPlaylist | null
}

// ─── Phase 6: Telemetry history ───────────────────────────────────────────────

export interface TelemetryDataPoint {
  id: string
  recorded_at: string
  cpu_percent: number | null
  memory_percent: number | null
  disk_percent: number | null
  disk_free_gb: number | null
  cpu_temp_c: number | null
  uptime_sec: number | null
  net_connected: boolean | null
  net_type: string | null
  net_ssid: string | null
  net_signal_dbm: number | null
  net_bandwidth_mbps: number | null
  playback_status: string | null
  cache_used_gb: number | null
  cache_item_count: number | null
  sync_status: string | null
  last_sync_at: string | null
}

export interface TelemetryResponse {
  display_id: string
  period: string
  data: TelemetryDataPoint[]
}

// ─── Phase 6: Alert rules ─────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRule {
  id: string
  org_id: string
  name: string
  event_type: string
  threshold: Record<string, unknown> | null
  display_id: string | null
  group_id: string | null
  channels: string[]
  webhook_url: string | null
  email_recipients: string[] | null
  is_active: boolean
  cooldown_min: number
  last_fired_at: string | null
  created_at: string
  updated_at: string
}

export interface AlertRuleCreate {
  name: string
  event_type: string
  threshold?: Record<string, unknown>
  display_id?: string | null
  group_id?: string | null
  channels?: string[]
  webhook_url?: string | null
  email_recipients?: string[] | null
  is_active?: boolean
  cooldown_min?: number
}

// ─── Phase 6: Notifications ───────────────────────────────────────────────────

export interface Notification {
  id: string
  org_id: string
  alert_rule_id: string | null
  severity: AlertSeverity
  title: string
  message: string | null
  display_id: string | null
  is_read: boolean
  read_by: string | null
  read_at: string | null
  created_at: string
}

// ─── Phase 6: Audit log ───────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
