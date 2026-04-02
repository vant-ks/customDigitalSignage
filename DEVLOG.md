# Development Log — VANT Signage Platform

> **For AI Agents:** Before starting any task, add an IN PROGRESS checkpoint.
> After completing it, update to ✅ COMPLETE immediately. Never batch completions.

---

## DEVLOG RULES (for AI agents)

### Checkpoint Format

```
### [DATE] [SESSION N] — [ONE-LINE TASK DESCRIPTION]
**Status:** IN PROGRESS
**Branch:** [branch-name]
**Files to change:** [list main files]
```

When complete, update to:

```
### [DATE] [SESSION N] — [ONE-LINE TASK DESCRIPTION]
**Status:** ✅ COMPLETE
**Branch:** [branch-name]
**Tags:** [comma-separated keywords]
**Commit:** [hash]
**Files changed:** [list actual files]
**Summary:** [one sentence of what was done and why]
```

### Rules
- Every task gets a checkpoint — small or large, no exceptions
- IN PROGRESS before touching code; ✅ COMPLETE before moving to next task
- If a session ends with IN PROGRESS entries, the next session MUST re-verify those first
- Never delete old entries — the full history is the point
- **Tags:** choose from entity names (`displays`, `playlists`, `media`), change type (`fix`, `feat`, `docs`, `migration`, `session-start`), and system area (`api`, `frontend`, `websocket`, `railway`, `deployment`, `auth`)

---

## Session 5 — [Date: 2026-03-31]

### 1. Session start

**Status:** ✅ COMPLETE
**Tags:** session-start
**Files changed:** `DEVLOG.md`, `docs/SESSION_JOURNAL.md`
**Summary:** Session initialized. API :3030 healthy, Vite :3031 200, git on main (HEAD 1628910, up to date with origin/main). Unstaged: .vscode/settings.json, api/Dockerfile, api/railway.toml, docs/PROJECT_RULES.md. Untracked: api/start.sh.

---

## Session 4 — Direct Upload, Local Media Pipeline

### Branch: `main`

---

### 1. Session start

**Status:** ✅ COMPLETE
**Tags:** session-start
**Files changed:** `DEVLOG.md`
**Summary:** Session initialized. API :3030 healthy, Vite :3031 200, git on main (HEAD dbd32cd). DB had 15 tables at head. Smoke-tested registration + login — both working.

---

### 2. Phase 2: direct file upload + local processor

**Status:** ✅ COMPLETE
**Tags:** feat, api, frontend, media
**Commit:** (pending)
**Files changed:**
- `api/app/core/config.py` — added `local_media_dir` setting
- `api/app/schemas/schemas.py` — added `local` to StorageProviderCreate pattern
- `api/app/api/routes/media.py` — added `POST /api/media/upload` (multipart), `GET /api/media/{id}/file`, fixed background task commit-before-schedule bug for both upload and register_media_asset
- `api/app/services/media_processor.py` — added `process_local_asset`, `_process_local_image`, `_process_local_video`
- `src/services/apiClient.ts` — added `api.upload()` multipart helper, fixed Content-Type header logic for FormData
- `src/stores/mediaStore.ts` — added `uploadAsset()` action
- `src/pages/MediaPage.tsx` — added Upload button (file input → multipart post)
**Summary:** Full direct-upload pipeline: multipart endpoint validates MIME (allowlist, extension fallback), saves to `/tmp/vant-media/uploads/{org_id}/`, commits to DB, then background-processes (Pillow thumbnail for images, ffprobe+ffmpeg for video). TypeScript 0 errors, Python syntax clean, end-to-end smoke test passed (status: ready, 100×100, thumbnail URL populated).

---

### 3. Persistent media storage — Railway volume + alembic startup fix

**Status:** ✅ COMPLETE
**Tags:** fix, railway, deployment, media
**Commits:** 7341a16, 808682a, fd02332, e95a90f, 5680c8a
**Files changed:**
- `api/app/core/config.py` — added `thumbnail_dir` setting
- `api/app/services/media_processor.py` — `THUMBNAIL_DIR` pulled from settings (was hardcoded `/tmp`)
- `api/start.sh` — proper startup script with alembic timeout + stdout/stderr diagnostics
- `api/Dockerfile` — fixed editable install order (tomllib-extract deps → COPY . . → pip install --no-deps -e .); `ENV PYTHONPATH=/app`
- `api/railway.toml` — added explicit `startCommand = "./start.sh"` to override Railway's cached inline startCommand
**Railway env vars set:** `LOCAL_MEDIA_DIR=/data/uploads`, `THUMBNAIL_DIR=/data/thumbnails`
**Railway volume:** created and mounted at `/data`
**Summary:** Diagnosed and fixed 3 layered problems: (1) editable pip install before COPY broke `import app` in alembic; (2) Railway had cached an old inline startCommand overriding our Dockerfile CMD; (3) `/tmp` media paths replaced with persistent volume paths. Service confirmed healthy at `customdigitalsignage-api-production.up.railway.app/health`.

---

### 5. Phase 4: Display Agent

**Status:** ✅ COMPLETE
**Tags:** feat, agent, playback
**Commit:** (pending — this session)
**Files changed:** `agent/` (new directory — 21 files)
- `agent/pyproject.toml` — pip-installable package `vant-agent`
- `agent/vant_agent/core/config.py` — YAML config with save-back after registration
- `agent/vant_agent/core/api_client.py` — httpx client with X-Device-Token auth
- `agent/vant_agent/sync/manifest.py` — manifest cache, diff, media enumeration
- `agent/vant_agent/sync/downloader.py` — download queue, SHA-256 verify, LRU eviction
- `agent/vant_agent/playback/scheduler.py` — local schedule resolver (mirrors server logic)
- `agent/vant_agent/playback/player.py` — mpv IPC + Chromium kiosk launcher
- `agent/vant_agent/telemetry/collector.py` — psutil + platform-specific CPU temp
- `agent/vant_agent/commands/handler.py` — WS command dispatcher (reboot, restart, sync, screenshot, config)
- `agent/vant_agent/agent.py` — main orchestrator: 5 concurrent asyncio tasks
- `agent/vant_agent/__main__.py` — CLI (run / register / status)
- `agent/install/vant-agent.service` — systemd unit
- `agent/install/com.vant.agent.plist` — macOS launchd plist
- `agent/install/kiosk-session.sh` — X11 kiosk session script
- `agent/install/config.example.yaml` — annotated config template
**Summary:** Complete display agent: registration via provisioning token, 30s heartbeats, 5min manifest sync with SHA-256 verification + LRU cache eviction, local schedule resolver, mpv IPC playback for images/video + Chromium kiosk for HTML/URLs, psutil telemetry, WebSocket command handling, systemd/launchd service files. All Python syntax verified clean.

---

### 4. Phase 3: Scheduling + Sync Engine

**Status:** ✅ COMPLETE
**Tags:** feat, api, frontend, schedules
**Commit:** (pending — this session)
**Files changed:**
- `api/app/schemas/schemas.py` — added `ScheduleCreate`, `ScheduleUpdate`, `ScheduleResponse`, `ScheduleOverrideRequest`, `ManifestMediaItemSchema`, `ManifestPlaylistItemSchema`, `ManifestPlaylistSchema`, `ManifestScheduleEntrySchema`, `ContentManifestResponse`, `SyncStatusRequest`
- `api/app/api/routes/schedules.py` — NEW: full CRUD + active-schedule resolver + emergency override + content manifest + sync-status endpoint
- `api/app/main.py` — registered `schedules_router`
- `src/stores/scheduleStore.ts` — NEW: Zustand store (fetchSchedules, createSchedule, updateSchedule, deleteSchedule, createOverride)
- `src/pages/SchedulesPage.tsx` — NEW: weekly calendar grid UI, create dialog, emergency override dialog, schedule list table
- `src/App.tsx` — added `/schedules` route
**Summary:** Full Phase 3 implementation: 9 new API endpoints (schedule CRUD, resolver with is_override/priority/specificity sort, emergency override with WS push, SHA-256 content manifest, device sync-status), Zustand store, and weekly calendar UI with day-column grid, per-type color coding, and emergency override banner. Python import verified OK, TypeScript 0 errors.

---

 Building storage provider OAuth adapters, media asset CRUD, background processing pipeline (ffmpeg/Pillow), playlist CRUD, and frontend Media Library + Playlist Builder pages.

---

### 1. Session start

**Status:** ✅ COMPLETE
**Tags:** session-start
**Files changed:** `DEVLOG.md`, `docs/SESSION_JOURNAL.md`
**Summary:** Session initialized, both dev servers confirmed up (API :3030 healthy, Vite :3031 200), git clean on main (HEAD ddcd0f7).

---

### 2. Phase 2 build — storage adapters, media pipeline, playlists, frontend

**Status:** ✅ COMPLETE
**Tags:** feat, api, frontend, media, playlists, auth
**Commit:** dbd32cd
**Files changed:**
- `api/app/services/storage/` — new: `base.py`, `crypto.py`, `dropbox_adapter.py`, `gdrive_adapter.py`, `onedrive_adapter.py`, `factory.py`
- `api/app/services/media_processor.py` — image + video processing, thumbnail generation (Pillow + ffprobe/ffmpeg)
- `api/app/api/routes/storage.py` — OAuth URL gen, code exchange, browse
- `api/app/api/routes/media.py` — media CRUD, thumbnail serve, template preview
- `api/app/api/routes/playlists.py` — playlist + item CRUD, reorder
- `api/app/models/models.py` — PlaylistItem.media relationship
- `api/app/schemas/schemas.py` — StorageProvider, MediaAsset, Playlist schemas
- `api/app/core/config.py` — OAuth client ID/secret fields
- `api/app/main.py` — 3 new routers registered
- `api/pyproject.toml` — pillow, aiofiles, cryptography
- `api/Dockerfile` — ffmpeg added
- `src/stores/mediaStore.ts` — Zustand media + storage provider store
- `src/stores/playlistStore.ts` — Zustand playlist store
- `src/pages/MediaPage.tsx` — Media Library UI (grid/list, storage browser, detail panel)
- `src/pages/PlaylistBuilderPage.tsx` — Playlist Builder UI (drag reorder, media picker, settings)
- `src/App.tsx` — added /media and /playlists routes
**Summary:** Full Phase 2 implementation: 3 storage adapters (Dropbox v2, Google Drive v3, OneDrive Graph API) with Fernet credential encryption, background media processing (Pillow images + ffprobe/ffmpeg videos), playlist CRUD with drag-reorder, and complete React frontend for Media Library and Playlist Builder. TypeScript compiles clean (0 errors).

---

<!-- Session 2 below -->

## Session 2 — Phase 1: Backend review + React frontend scaffold

### Branch: `main`

### Overview
Reviewed vant-signage-api.zip (Phase 1 backend attempt), verified it solid, moved to `api/`, fixed structural issues, installed deps, verified imports. Then scaffolded the complete Vite+React+TypeScript frontend with all Phase 0 artifacts.

---

### 2. Backend verification + fixes

**Status:** ✅ COMPLETE
**Tags:** api, auth, migration, feat, displays, websocket
**Commit:** (initial commit)
**Files changed:** `api/` (moved from vant-signage-api/), `api/migrations/versions/001_initial_schema.py`, `api/pyproject.toml`, `api/.env`
**Summary:** Verified all 14 ORM models, auth routes, device routes, WebSocket manager. Fixed: missing initial Alembic migration (wrote 14-table migration), missing `[tool.setuptools.packages.find]` in pyproject.toml, missing .env file. All imports clean, `alembic history` shows migration at head.

---

### 3. Frontend scaffold (Phase 0 artifacts)

**Status:** ✅ COMPLETE
**Tags:** frontend, auth, displays, websocket, feat
**Commit:** feat: Phase 1 — FastAPI backend + React frontend scaffold (b27516a)
**Files changed:**
- `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- `src/index.css`, `src/main.tsx`, `src/App.tsx`
- `src/types/index.ts` — all TypeScript interfaces (14 entities + WS + manifest types)
- `src/services/apiClient.ts` — JWT fetch wrapper with auto-refresh queue
- `src/services/wsService.ts` — WebSocket service with reconnect + heartbeat
- `src/stores/authStore.ts` — Zustand auth store (persisted)
- `src/stores/displayStore.ts` — Zustand display store with WS handlers
- `src/components/layout/DashboardShell.tsx` — sidebar + topbar + theme toggle
- `src/pages/LoginPage.tsx` — login form (org_slug + email + password)
- `src/pages/DisplaysPage.tsx` — fleet view with summary cards, grid/list toggle, filtering
- `.gitignore`
**Summary:** Complete frontend scaffold matching the design spec in `vant-signage-dashboard.jsx`. TypeScript compiles clean (0 errors). `npm install` clean (0 vulnerabilities).

---

<!-- Session 1 below -->


