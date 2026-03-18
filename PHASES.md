# VANT Signage Platform — Project Plan & Build Phases

## Project Overview

A self-hosted digital signage management platform for controlling monitors and vertical LED posterboards across live event venues. Built on React + Vite + TypeScript (dashboard) and Python FastAPI (backend), with cross-platform display agents for Raspberry Pi, NUC, x86 mini PCs, and Mac Minis.

**Hosting**: Railway (initial), migrating after field testing
**Media Storage**: Client-managed via Dropbox / Google Drive / OneDrive
**Display Strategy**: Offline-first with configurable caching
**Multi-tenancy**: Baked in from day one — designed to become a hosted SaaS product

---

## Tech Stack

| Layer | Tech |
|---|---|
| Dashboard | React 18 + Vite + TypeScript + Tailwind CSS |
| State | Zustand (persisted auth, display store, media store) |
| Backend API | Python FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL (Railway-hosted) |
| Real-time | WebSockets (FastAPI native) |
| Media Processing | ffmpeg, Pillow, background task queue |
| Display Agent | Python service, Chromium kiosk, mpv |
| Provisioning | Cloud-init (Pi), bootstrap scripts (NUC/Mac) |
| File Storage | Dropbox / Google Drive / OneDrive via OAuth |
| Auth | JWT with refresh tokens, bcrypt password hashing |

---

## Design System

Modeled after **gjsmedia.com** visual language with VANT brand tokens preserved.

### Theme Tokens (Dark)
- Background: `#07090f` → `#0b0f1a` → `#0f1526` → `#141c33`
- Primary accent: `#5eb7f1` (GJS light blue)
- Text: `#ffffff` / `#d0d8e8` / `#8899b4` / `#556680`
- Status: green `#34d399`, red `#f87171`, amber `#fbbf24`, orange `#fb923c`

### Theme Tokens (Light)
- Background: `#f0f2f5` → `#ffffff` → `#f7f8fa` → `#ebeef3`
- Primary accent: `#2563eb`
- Text: `#0f172a` / `#334155` / `#64748b` / `#94a3b8`

### VANT Brand (logo/gradients only)
- Navy: `#1B2A7B`
- Orange: `#E8652A`

### Typography
- Primary: Segoe UI (400/500/600/700)
- Mono: JetBrains Mono
- Minimum size: 12px labels, 13px body, 14px interactive elements

### Rules
- **Light AND dark mode required** — theme toggle in sidebar
- **No dark-on-dark text** — minimum contrast ratio maintained
- **No text smaller than 12px** — labels at 12px, everything else 13px+

---

## Database Schema

See `schema.sql` — 12 tables, all org-scoped:

`organizations` → `users` → `storage_providers` → `display_groups` → `displays` → `media_assets` → `playlists` → `playlist_items` → `schedules` → `provisioning_tokens` → `device_telemetry` → `audit_log` → `alert_rules` → `notifications`

---

## Existing Artifacts (from Phase 0)

| File | Description |
|---|---|
| `schema.sql` | Full PostgreSQL schema with indexes, triggers, constraints |
| `src/types/index.ts` | TypeScript type definitions mirroring all DB entities + API types + WebSocket types + Content Manifest |
| `src/stores/authStore.ts` | Zustand auth store with JWT login/logout/refresh |
| `src/stores/displayStore.ts` | Zustand display CRUD + real-time WebSocket handlers |
| `src/services/apiClient.ts` | Fetch wrapper with JWT interceptor, auto-refresh, retry |
| `src/services/wsService.ts` | WebSocket service with reconnection, heartbeat, event routing |
| `src/components/layout/DashboardShell.tsx` | Dashboard layout shell (sidebar, topbar, nav) |
| `src/pages/DisplaysPage.tsx` | Displays fleet view with grid/list, filtering, detail view |
| `vant-signage-dashboard.jsx` | Interactive preview artifact with full light/dark theme |

---

## Build Phases

### Phase 1 — Foundation + Security
### Phase 2 — Media Pipeline + Content Management
### Phase 3 — Scheduling + Sync Engine
### Phase 4 — Display Agent + Playback
### Phase 5 — Provisioning Tools
### Phase 6 — Monitoring, Alerts, Polish

---

## Phase Chat Prompts

Copy and paste the prompt for each phase into a new Claude chat to continue building. Each prompt contains full architectural context so the conversation can start fresh without losing state.

---

### PHASE 1 — Foundation + Security

```
I'm building the VANT Signage Platform — a self-hosted digital signage management system. I need to build Phase 1: the backend foundation.

## What exists already
- Full PostgreSQL schema (12 tables, multi-tenant, org-scoped) — I'll paste schema.sql
- TypeScript types mirroring all DB entities (types/index.ts)
- React dashboard shell with light/dark theme, Zustand stores for auth + displays
- API client with JWT interceptor and auto-refresh
- WebSocket service with reconnect and event routing

## What Phase 1 needs to deliver

### Backend (Python FastAPI)
1. **Project scaffold**: FastAPI app with SQLAlchemy async, Alembic migrations, project structure
2. **Auth system**: 
   - POST /api/auth/register — create org + admin user
   - POST /api/auth/login — JWT access + refresh tokens
   - POST /api/auth/refresh — token refresh
   - Password hashing with bcrypt, JWT with RS256 or HS256
3. **User CRUD**: org-scoped, role-based (admin/manager/viewer)
4. **Display CRUD**: 
   - GET/POST/PATCH/DELETE /api/displays
   - GET /api/displays/:id with joined group + latest telemetry
   - Pagination, filtering by status/group/search/tags
5. **Display Groups CRUD**: GET/POST/PATCH/DELETE /api/display-groups
6. **Device registration flow**:
   - POST /api/provisioning/tokens — generate single-use provisioning token (time-limited)
   - POST /api/devices/register — device uses token to register, gets permanent device_token back
   - Device heartbeat endpoint: POST /api/devices/heartbeat
7. **WebSocket server**: 
   - Auth via token query param
   - Route heartbeat, telemetry, status_change, command messages
   - Org-scoped rooms so dashboard users see only their displays
8. **Middleware**: org-scoping on all queries, rate limiting, CORS for Railway deployment
9. **Database**: Alembic initial migration from schema.sql

### Tech details
- Hosting on Railway — needs Procfile or railway.toml
- PostgreSQL on Railway
- Python 3.11+, FastAPI, SQLAlchemy async with asyncpg
- Pydantic v2 for request/response models
- Structure: app/api/routes/, app/models/, app/schemas/, app/services/, app/core/

### Design constraints
- Every DB query must be scoped to org_id — never leak cross-tenant data
- Device tokens are separate auth from user JWTs
- Provisioning tokens are single-use and time-limited (default 24h)
- WebSocket messages follow the WSMessage type from types/index.ts

Build the complete backend. Start with the project structure and work through each component.
```

---

### PHASE 2 — Media Pipeline + Content Management

```
I'm continuing the VANT Signage Platform build. Phase 1 (FastAPI backend with auth, display CRUD, device registration, WebSocket server) is complete. Now building Phase 2: Media Pipeline + Content Management.

## Platform context
- Digital signage management for monitors and LED posterboards
- React + Vite + TypeScript dashboard, Python FastAPI backend, PostgreSQL
- Multi-tenant, org-scoped, JWT auth, deployed on Railway
- Media files live in client's own cloud storage (Dropbox, Google Drive, OneDrive)
- Displays are offline-first with local content caching

## What Phase 2 needs to deliver

### Backend
1. **Storage Provider OAuth integration**:
   - POST /api/storage-providers — connect Dropbox/Google Drive/OneDrive via OAuth2 flow
   - GET /api/storage-providers — list connected providers for org
   - GET /api/storage-providers/:id/browse?path= — browse folders/files in connected storage
   - Unified StorageAdapter interface: list_files(), get_file(), get_download_url(), get_metadata()
   - Adapter implementations for Dropbox API v2, Google Drive API v3, Microsoft Graph API
   - OAuth token refresh handling per provider

2. **Media asset management**:
   - POST /api/media — register a media asset from connected storage (stores metadata, triggers processing)
   - GET /api/media — list with filtering by type/folder/tags, pagination
   - PATCH /api/media/:id — update metadata, tags, folder
   - DELETE /api/media/:id
   - GET /api/media/:id/download-url — generate time-limited download URL from cloud provider

3. **Media processing pipeline** (background tasks):
   - Video: ffmpeg transcode to H.264 MP4 (Pi-compatible), extract duration/resolution/codec/framerate
   - Images: Pillow resize/optimize, extract dimensions
   - Thumbnail generation for all media types
   - Processing status tracking (pending → processing → ready → error)
   - Store processed variants back to cloud storage or local cache
   - SHA-256 hash for change detection on sync

4. **Playlist CRUD**:
   - Full CRUD for playlists and playlist_items
   - Drag-and-drop reordering support (PATCH position array)
   - Per-item duration, transition overrides, validity windows
   - Play modes: sequential, shuffle, weighted

5. **HTML template system**:
   - Media type "html_template" with template_schema (JSON schema defining data fields)
   - template_data stores current bound data
   - Template preview endpoint that renders template with data
   - Use case: corporate wayfinding, session signage with dynamic data

### Frontend (React + TypeScript)
1. **Media Library page**:
   - Grid view with thumbnails, list view with details
   - Folder navigation, drag-and-drop upload trigger
   - Storage provider connection UI (OAuth flow initiation)
   - File type filtering, search, tags
   - Processing status indicators
   - Media detail panel: preview, metadata, edit tags

2. **Playlist Builder page**:
   - Drag-and-drop media items into playlist
   - Reorder with drag handles
   - Per-item duration slider, transition picker
   - Live duration total, item count
   - Preview mode (simulated playback sequence)

### Design system
- Light + dark mode (theme tokens defined — use the established theme context)
- GJS/VANT palette: accent #5eb7f1 (dark) / #2563eb (light), VANT navy #1B2A7B, orange #E8652A
- Segoe UI font, JetBrains Mono for technical data
- Minimum 12px for labels, 13px+ for body text
- Cards with subtle shadows, 12px border radius

### Technical notes
- Cloud storage APIs need async HTTP clients (httpx)
- ffmpeg must be available in Railway Docker image (add to Dockerfile)
- Background tasks: FastAPI BackgroundTasks for simple jobs, or Celery/ARQ for queue-based
- Processed media URLs need to be signed/time-limited for security
- All routes org-scoped via JWT middleware

Build the storage adapter system first, then media CRUD, then processing pipeline, then playlists, then the frontend pages.
```

---

### PHASE 3 — Scheduling + Sync Engine

```
I'm continuing the VANT Signage Platform build. Phases 1-2 (backend foundation, auth, displays, media pipeline, playlists) are complete. Now building Phase 3: Scheduling + Content Sync Engine.

## Platform context
- Digital signage management — React/Vite/TS dashboard, FastAPI backend, PostgreSQL, Railway
- Multi-tenant, offline-first displays, media in client cloud storage (Dropbox/GDrive/OneDrive)
- Display agents run on Pi 4/5, NUCs, x86 mini PCs, Mac Minis

## What Phase 3 needs to deliver

### Backend — Scheduling
1. **Schedule CRUD**:
   - POST/GET/PATCH/DELETE /api/schedules
   - Target: individual display, display group, or org-wide (null targets)
   - Types: always, recurring (with day-of-week + time range), one_time
   - Priority system: higher priority wins on conflict, override flag for emergency
   - Dayparting: start_time/end_time define daily active window
   - Validation: ensure no impossible configurations

2. **Schedule resolver**:
   - Given a display + datetime, determine which playlist should be playing
   - Resolution order: overrides first (highest priority), then by priority, then by specificity (display > group > org)
   - Must handle timezone-aware scheduling
   - Expose as: GET /api/displays/:id/active-schedule?at=<datetime>

3. **Emergency override**:
   - POST /api/schedules/override — create org-wide or targeted emergency schedule
   - Immediately pushes to all affected displays via WebSocket
   - Auto-expire option

### Backend — Content Sync Engine
4. **Content manifest generation**:
   - GET /api/displays/:id/manifest — returns ContentManifest for a display
   - Manifest contains all schedules within the display's cache_depth_days window
   - Each schedule includes playlist with all media items and signed download URLs
   - Manifest includes file hashes for cache diffing
   - Manifest versioned with hash so agent knows when to re-fetch

5. **Sync protocol**:
   - Device calls GET /manifest periodically (configurable interval, default 5 min)
   - Device compares manifest hash with local — skip if unchanged
   - Device diffs media items: download new, delete expired, keep existing
   - Device reports sync status back via POST /api/devices/sync-status

6. **Cache policy enforcement**:
   - Respect display's cache_policy: max_gb, depth_days, priority rules
   - Manifest generation trims content to fit within cache budget
   - Priority: current playlist > next scheduled > fallback content
   - Include fallback playlist in manifest for offline scenarios

### Frontend
7. **Schedule Calendar page**:
   - Weekly calendar view showing playlist assignments per display/group
   - Drag to create/resize schedule blocks
   - Color-coded by playlist
   - Day/week/month view toggle
   - Override creation dialog with target picker + expiry

8. **Display schedule timeline**:
   - On display detail page: 24-hour timeline showing what plays when
   - Visual conflict resolution (show priority layers)
   - Current/next playlist indicator

### Technical notes
- Manifest download URLs must be signed with expiry (cloud storage provider generates these)
- Sync interval should be configurable per-display in cache_policy
- WebSocket push for immediate manifest refresh on schedule change
- Schedule resolver must be efficient — called frequently by all agents
- Consider caching resolved schedules with invalidation on schedule CRUD

Build the schedule CRUD + resolver first, then manifest generation, then the sync protocol endpoints, then the frontend calendar.
```

---

### PHASE 4 — Display Agent + Playback

```
I'm continuing the VANT Signage Platform build. Phases 1-3 (backend, media, scheduling, sync engine) are complete. Now building Phase 4: the Display Agent that runs on endpoint hardware.

## Platform context
- Signage management platform — FastAPI backend on Railway, React dashboard
- Displays are offline-first with local content caching
- Content synced via manifest-based pull protocol over HTTPS
- Target hardware: Raspberry Pi 4/5, Intel NUC, generic x86 mini PC, Mac Mini

## What Phase 4 needs to deliver

### Display Agent (Python service)
1. **Agent core** (single Python package, installable via pip):
   - Configuration via YAML file: server_url, device_token, cache_dir, log_level
   - Systemd service (Linux) / launchd plist (macOS) for auto-start on boot
   - Watchdog: auto-restart on crash, process monitoring
   - Logging to file + remote log endpoint

2. **Registration & heartbeat**:
   - First-boot: read provisioning config, call POST /api/devices/register
   - Store returned device_token in local config
   - Heartbeat every 30s: POST /api/devices/heartbeat with basic status
   - Handle token refresh/re-registration if rejected

3. **Content sync**:
   - Poll GET /api/displays/:id/manifest at configurable interval (default 5 min)
   - Compare manifest hash with local cached version
   - Diff media items: identify new downloads, expired deletions
   - Download queue with retry logic, bandwidth throttling option
   - Cache management: enforce max_gb limit, LRU eviction if needed
   - Report sync status back to server
   - All downloaded files verified against SHA-256 hash

4. **Playback engine**:
   - Schedule resolver: given current time + cached manifest, determine active playlist
   - Content switching:
     - Video: mpv with hardware acceleration (V4L2 on Pi, VAAPI on x86)
     - Images: displayed via mpv (single-frame) or Chromium
     - HTML templates: Chromium in kiosk mode pointed at local file
     - Web URLs: Chromium in kiosk mode
   - Transition handling: cut, fade (via mpv), crossfade where supported
   - Playlist advancement: sequential with timers, shuffle, weighted random
   - Fallback chain: cached current playlist → cached next → fallback media → branded holding screen

5. **Kiosk display management**:
   - Boot into fullscreen display (no desktop, no cursor, no screensaver)
   - Display orientation: landscape, portrait, portrait_left (xrandr on Linux, displayplacer on macOS)
   - Screen on/off control (CEC on Pi, xset/dpms on x86, brightness on Mac)
   - Resolution detection and reporting

6. **Telemetry reporting**:
   - Every 60s: CPU%, memory%, disk%, CPU temp, uptime, network state
   - Playback state: current playlist/media, status
   - Cache state: used GB, item count, last sync time
   - POST /api/devices/telemetry

7. **Remote command handling**:
   - WebSocket listener for server commands
   - Commands: reboot, restart_agent, take_screenshot, refresh_content, update_config
   - Screenshot: capture display output, upload to server
   - Config update: apply new cache policy, orientation, etc. without restart where possible

8. **Offline resilience**:
   - Full playback from cache when server unreachable
   - Queue telemetry/heartbeats for batch send on reconnect
   - Automatic reconnection with exponential backoff
   - No visible errors on display — always show content or fallback

### Technical notes
- Agent must work on: Raspberry Pi OS (Bookworm), Ubuntu 22/24, macOS 13+
- Python 3.9+ (Pi OS ships 3.11)
- mpv controlled via IPC socket (mpv --input-ipc-server)
- Chromium launched in kiosk mode: chromium-browser --kiosk --disable-restore-session-state
- On Pi: use /opt/vc/bin/vcgencmd for temperature, GPU memory
- On macOS: use IOKit/sysctl for hardware monitoring
- Package as: pip-installable with entry_points for CLI commands
- Structure: vant_agent/core/, vant_agent/playback/, vant_agent/sync/, vant_agent/telemetry/, vant_agent/commands/

Build the agent core + registration first, then sync engine, then playback engine, then telemetry + commands.
```

---

### PHASE 5 — Provisioning Tools

```
I'm continuing the VANT Signage Platform build. Phases 1-4 (backend, media, scheduling, display agent) are complete. Now building Phase 5: Provisioning Tools for automated display setup.

## Platform context
- Signage management — FastAPI backend, React dashboard, Python display agent
- Target hardware: Raspberry Pi 4/5, Intel NUC, x86 mini PC, Mac Mini
- Agent is a pip-installable Python package with systemd/launchd integration
- Existing CompanionPi provisioning pattern: cloud-init, first-boot scripts, WiFi config

## What Phase 5 needs to deliver

### Dashboard — Provisioning Wizard
1. **Create Display + Generate Provisioning Package**:
   - Step 1: Name, group, location, tags
   - Step 2: Select hardware type (Pi4, Pi5, NUC, x86, Mac Mini)
   - Step 3: Display config — resolution, orientation, refresh rate
   - Step 4: Cache policy — max GB, depth days, priority, fallback
   - Step 5: Network — optional WiFi SSID/password
   - Step 6: Generate provisioning token + downloadable config package
   - Output varies by hardware type (see below)

### Raspberry Pi Image Builder
2. **Custom Pi image script** (shell script, runs on build machine):
   - Base: Raspberry Pi OS Lite (Bookworm, 64-bit)
   - Overlay: vant-agent package pre-installed, systemd service enabled
   - Kiosk setup: auto-login, Chromium kiosk, mpv, no desktop
   - First-boot script: reads config from /boot/firmware/vant-config.yaml
   - WiFi: pre-configured via wpa_supplicant or NetworkManager
   - Output: .img file ready to flash with Raspberry Pi Imager
   - Naming convention: vant-display-os-pi-{version}.img

3. **Pi SD card config injection**:
   - After flashing base image, user downloads vant-config.yaml from dashboard
   - Drops it on the boot partition
   - First-boot reads it, registers with server, starts displaying content

### Linux (NUC / x86) Bootstrap
4. **One-line installer**:
   - `curl -sL https://signage.vant.com/setup | bash -s -- --token <PROVISIONING_TOKEN>`
   - Script: installs Python, pip, vant-agent, Chromium, mpv
   - Configures auto-login user, kiosk session, systemd service
   - Fetches provisioning config from server using token
   - Sets display orientation via xrandr
   - Tested on Ubuntu 22.04 and 24.04

### macOS (Mac Mini) Installer
5. **macOS setup script or .pkg**:
   - Installs Python (via Homebrew or bundled), vant-agent
   - Creates launchd plist for auto-start
   - Configures auto-login, screen saver disabled, energy saver settings
   - Launches Chromium in kiosk mode
   - Less invasive than Linux — runs as user-level service

### OTA Agent Updates
6. **Update mechanism**:
   - Server tracks latest agent version
   - Agent checks version on heartbeat response
   - If update available: download new package, pip install --upgrade, restart service
   - Rollback: if new version fails health check within 60s, revert to previous
   - Dashboard shows agent version per display, bulk update trigger

### Technical notes
- Pi image builder follows the CompanionPi pattern: cloud-init disabled, first-boot script, hostname convention
- vant-config.yaml schema: server_url, provisioning_token, display_name, orientation, cache_policy, wifi (optional)
- Provisioning tokens from the dashboard are single-use, expire in 24h
- Bootstrap scripts must be idempotent (safe to re-run)
- All scripts should output clear progress/status for the tech running setup on-site

Build the provisioning wizard UI first, then the Pi image builder script, then Linux bootstrap, then macOS setup, then OTA updates.
```

---

### PHASE 6 — Monitoring, Alerts, Polish

```
I'm completing the VANT Signage Platform build. Phases 1-5 (backend, media, scheduling, agent, provisioning) are done. Phase 6 is the final phase: Monitoring, Alerts, and Production Polish.

## Platform context
- Full digital signage platform — React dashboard, FastAPI backend, Python display agent
- Multi-tenant SaaS architecture, deployed on Railway
- Displays report telemetry every 60s, heartbeats every 30s
- WebSocket real-time status updates already working

## What Phase 6 needs to deliver

### Dashboard — Fleet Monitoring
1. **Fleet overview dashboard** (new landing page):
   - Map view: displays plotted by location (if lat/lng set)
   - Summary cards: total, online, offline, error, pending
   - Health heatmap: grid of displays color-coded by worst metric
   - Recent activity feed: last 20 events (online/offline, sync, errors)

2. **Per-display monitoring enhancements**:
   - Telemetry charts: CPU, temp, memory, disk over last 24h/7d (recharts)
   - Live screenshot viewer with manual capture button
   - Remote log viewer: stream last 200 lines from agent
   - Network diagnostics panel: connection type, signal, bandwidth
   - Playback history: what was displayed when

### Alert System
3. **Alert rules engine**:
   - CRUD for alert rules: event type, threshold, target (display/group/org), channels
   - Event types: display.offline (with minutes threshold), temp.high, disk.full, sync.failed
   - Evaluation: background task checks conditions against latest telemetry
   - Cooldown: don't re-fire within configurable window

4. **Notification delivery**:
   - Dashboard: real-time notification bell (already built) + notification center page
   - Email: SMTP integration, HTML email templates
   - Webhook: POST to configurable URL (Slack, Companion, custom)
   - Mark as read, bulk dismiss, notification preferences per user

### Access Control Polish
5. **Role-based permissions**:
   - Admin: full access
   - Manager: CRUD displays/media/playlists/schedules, no org settings or user management
   - Viewer: read-only dashboard, no modifications
   - Enforce at API middleware level + hide/disable UI elements

6. **Audit log viewer**:
   - Searchable log of all mutations (who changed what, when)
   - Filter by entity type, user, date range
   - Detail expansion showing before/after state

### Production Hardening
7. **API documentation**: auto-generated OpenAPI/Swagger docs
8. **Error handling**: consistent error responses, Sentry integration option
9. **Database**: connection pooling, query optimization, telemetry retention policy (90 day raw, aggregate older)
10. **Security**: rate limiting on auth endpoints, CSRF protection, input sanitization
11. **Deployment**: Dockerfile, railway.toml, environment variable documentation
12. **Testing**: pytest suite for critical paths (auth, schedule resolver, manifest generation)

### Design system
- Light + dark mode with theme toggle (already built)
- GJS/VANT palette: accent #5eb7f1/#2563eb, navy #1B2A7B, orange #E8652A
- Segoe UI + JetBrains Mono, minimum 12px labels / 13px body
- Recharts for telemetry charts (already available in the React environment)

Build the fleet overview dashboard first, then per-display monitoring, then alerts, then RBAC, then production hardening.
```

---

## Project Structure

```
vant-signage/
├── README.md
├── PHASES.md                    ← this file
├── schema.sql                   ← PostgreSQL schema
│
├── dashboard/                   ← React + Vite + TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── theme/               ← design tokens, ThemeProvider
│       │   ├── tokens.ts
│       │   └── ThemeContext.tsx
│       ├── types/
│       │   └── index.ts
│       ├── stores/
│       │   ├── authStore.ts
│       │   ├── displayStore.ts
│       │   ├── mediaStore.ts
│       │   └── scheduleStore.ts
│       ├── services/
│       │   ├── apiClient.ts
│       │   └── wsService.ts
│       ├── components/
│       │   ├── layout/
│       │   │   └── DashboardShell.tsx
│       │   ├── displays/
│       │   ├── media/
│       │   ├── playlists/
│       │   ├── schedule/
│       │   └── common/
│       └── pages/
│           ├── DisplaysPage.tsx
│           ├── MediaPage.tsx
│           ├── PlaylistsPage.tsx
│           ├── SchedulePage.tsx
│           ├── ProvisioningPage.tsx
│           ├── AlertsPage.tsx
│           └── SettingsPage.tsx
│
├── api/                         ← Python FastAPI
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/              ← SQLAlchemy models
│   │   ├── schemas/             ← Pydantic request/response
│   │   ├── api/
│   │   │   └── routes/
│   │   ├── services/
│   │   │   ├── storage/         ← Dropbox/GDrive/OneDrive adapters
│   │   │   ├── media/           ← processing pipeline
│   │   │   └── scheduling/      ← resolver + manifest
│   │   └── websocket/
│   └── migrations/              ← Alembic
│
├── agent/                       ← Python display agent
│   ├── pyproject.toml
│   ├── vant_agent/
│   │   ├── __main__.py
│   │   ├── core/
│   │   ├── sync/
│   │   ├── playback/
│   │   ├── telemetry/
│   │   └── commands/
│   └── systemd/
│       └── vant-display.service
│
└── provisioning/                ← Setup scripts and image configs
    ├── pi/
    │   ├── build-image.sh
    │   ├── first-boot.sh
    │   └── vant-config.yaml.template
    ├── linux/
    │   └── bootstrap.sh
    └── macos/
        └── setup.sh
```

---

## Quick Start (after Phase 1)

```bash
# Dashboard
cd dashboard && npm install && npm run dev

# API
cd api && pip install -e . && uvicorn app.main:app --reload

# Database
# Set DATABASE_URL in .env pointing to Railway PostgreSQL
# alembic upgrade head
```
