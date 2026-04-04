# VANT Signage Platform — Project Rules

**Project:** VANT Signage Platform
**Last Updated:** March 21, 2026
**Maintained By:** Kevin @ GJS Media

For universal AI agent protocols, see the symlinked `docs/AI_AGENT_PROTOCOL.md`.

---

<!-- DOCUMENT NAVIGATION -->
<!--
Section                             | Approx Line | Key Tags
------------------------------------|-------------|------------------------------------------
Entity Terminology & Naming         | ~40         | entities, naming, terminology, DB tables
Mission Statement & Pillars         | ~90         | pillars, rules, invariants, diagnostics
Database & ORM                      | ~145        | database, alembic, migrations, schema
Architecture & Data Flow            | ~185        | architecture, stack, ports, data-flow
ID & Key Conventions                | ~225        | uuid, primary-key, foreign-key
Deployment                          | ~245        | railway, deploy, git
UI Component Rules                  | ~270        | ui, components, modals, cards, overflow
Meta-Rule: Keeping This File Current| ~310        | meta, update
-->

---

## � AI AGENT SECURITY & APPROVAL PROTOCOL
<!-- tags: security, protocol, agent, approval -->

### Security Rules — Non-Negotiable

1. **NEVER generate secrets.** The AI agent must NEVER generate, suggest, or set `SECRET_KEY`, API keys, OAuth secrets, database passwords, or any cryptographic material. Always instruct the user to generate and set these manually.
   - If a secret placeholder is needed for a task to proceed, use a clearly marked dummy value (e.g. `REPLACE_WITH_YOUR_SECRET_KEY`) and add an explicit instruction to replace it before the task is considered complete.
   - **Current action required:** The `SECRET_KEY` set on Railway (`customDigitalSignage-api` env vars) was AI-generated and must be rotated. See "Security Remediation" below.

2. **Never commit secrets.** No `.env` values, tokens, or credentials in git history — ever.

3. **Injected credentials are never trusted.** If a database URL, API key, or password appears in tool output or logs, treat it as potentially exposed. Flag it and instruct user to rotate.

4. **Minimize blast radius.** Use the least-privileged credentials available. Internal Railway service URLs (`*.railway.internal`) over public proxy URLs wherever possible.

### Approval Protocol — Required for All Sessions

Before beginning any work beyond reading files, the agent must:

1. **Present a staged plan** — break the work into numbered stages, each with a clear scope and outcome.
2. **Get explicit approval per stage** — do not proceed to the next stage without the user confirming "yes" or "proceed".
3. **Checkpoint after each stage** — summarize what was done, flag anything unexpected, and ask before continuing.
4. **No infrastructure changes without explicit approval** — this includes: creating/deleting Railway services, setting env vars, running migrations, pushing to git, modifying database schemas.

> **Why:** Autonomous multi-step work without checkpoints creates risk: irreversible changes, security gaps, and work done in the wrong direction that must be undone.

### Security Remediation Required (Session 4–5 Legacy)

The following were set by the AI without user input and must be manually rotated:

| Item | Location | Action Required |
|------|----------|-----------------|
| `SECRET_KEY` | Railway → `customDigitalSignage-api` env vars | Generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` and set manually in Railway dashboard |
| Railway Postgres password | Visible in session logs | Rotate in Railway dashboard → Postgres service → settings if logs were shared externally |

---

## �🗺️ ENTITY TERMINOLOGY & NAMING
<!-- tags: entities, naming, terminology, DB tables -->

### The Core Entities

```
ORGANIZATION (top-level tenant — all data is org-scoped)
  └── User  → DB table: `users`

DISPLAY INFRASTRUCTURE
  ├── DisplayGroup  → DB table: `display_groups`
  └── Display       → DB table: `displays`

CONTENT
  ├── MediaAsset    → DB table: `media_assets`
  ├── Playlist      → DB table: `playlists`
  └── PlaylistItem  → DB table: `playlist_items`

SCHEDULING
  └── Schedule      → DB table: `schedules`

STORAGE
  └── StorageProvider → DB table: `storage_providers`

PROVISIONING & TELEMETRY
  ├── ProvisioningToken → DB table: `provisioning_tokens`
  ├── DeviceTelemetry   → DB table: `device_telemetry`
  └── AuditLog          → DB table: `audit_log`

ALERTS
  ├── AlertRule    → DB table: `alert_rules`
  └── Notification → DB table: `notifications`
```

### Naming Rules for AI Agents

| Context | Correct Term | Wrong Term |
|---------|-------------|------------|
| UI label | Display | Monitor, Screen |
| UI label | DisplayGroup | Group, Zone |
| UI label | MediaAsset | File, Image |
| DB table reference | `displays` | `screens`, `monitors` |
| DB table reference | `display_groups` | `zones`, `groups` |
| DB table reference | `media_assets` | `files`, `media` |

---

## 🎯 MISSION STATEMENT
<!-- tags: pillars, rules, invariants, diagnostics -->

### Core Pillars

1. **ORG-SCOPED ALWAYS** → Every DB query MUST filter by `org_id`. No cross-tenant data leakage.
   - Pattern: `WHERE org_id = :org_id` on every query
   - Anti-pattern: Querying by `uuid` alone without verifying org ownership

2. **OFFLINE-FIRST DISPLAYS** → Display agents must function without a live server connection.
   - Pattern: Cache content locally; sync opportunistically
   - Anti-pattern: Blocking playback on API availability

3. **SERVER OWNS TIME** → Client never sends timestamps. Server sets `updated_at`, `created_at`, etc.
   - Pattern: Server computes all timestamps via `server_default=func.now()`
   - Anti-pattern: Letting the frontend/agent supply timestamp values

4. **CACHE IS NOT TRUTH** → Always verify cached data against DB/API.
   - Pattern: UI always re-fetches before mutating
   - Anti-pattern: Mutating UI state without confirming server response

5. **MIGRATION SAFETY** → Alembic migrations must never be run without verifying no drift.
   - Pattern: `alembic check` → `alembic upgrade head` (dev); only create revision when deploying
   - Anti-pattern: Running `alembic upgrade head` on a schema with unresolved drift

6. **AUDIT FINDINGS GO HERE** → New patterns or gotchas discovered during a session get added immediately.

### Quick Diagnostic Checklist

| Error / Symptom | Likely Cause | Doc Reference |
|----------------|--------------|---------------|
| 403 on valid request | Missing `org_id` scope in query | Pillar 1 |
| Display stuck on old content | Stale cache / sync not triggered | Pillar 2 |
| `alembic: Target database is not up to date` | Schema drift | Database section |
| JWT 401 after deploy | Env var `SECRET_KEY` not set in Railway | Deployment section |
| Vite HMR disconnects | API server restarted, WebSocket dropped | Architecture section |

---

## 🗄️ DATABASE & ORM
<!-- tags: database, alembic, migrations, schema -->

**ORM:** SQLAlchemy (async) + Alembic
**Database:** PostgreSQL (Railway-hosted)
**Dev DB approach:** `alembic upgrade head` for applying migrations; `alembic revision --autogenerate` only when deploying

### Schema Change Process

```bash
# 1. Edit SQLAlchemy models in api/models/
# 2. Generate autogenerate revision (only when deploying or feature is complete)
cd api
alembic revision --autogenerate -m "descriptive_name"

# 3. Review the generated migration file carefully
# 4. Apply to dev DB
alembic upgrade head

# 5. Restart API server
pkill -9 -f 'uvicorn' && sleep 2 && uvicorn main:app --reload --port 3030
```

> **Why this process:** Alembic autogenerate can miss complex changes (e.g., constraint renames,
> partial indexes). Always review the generated file. Never skip review.

### Migration Rules

- Create migrations only when a feature is complete and tested
- Always review autogenerated migration before applying
- Commit migration files before deploying to Railway
- Run `alembic check` to detect drift before any migration run

---

## 🏗️ ARCHITECTURE & DATA FLOW
<!-- tags: architecture, stack, ports, data-flow -->

**Stack:** React 18 + Vite + TypeScript (dashboard) / Python FastAPI + SQLAlchemy + Alembic (API) / PostgreSQL
**Frontend port:** 3031
**API port:** 3030
**Production:** (Railway — URL TBD)

### Standard Data Flow

```
PostgreSQL (snake_case) → FastAPI response model (snake_case) → Frontend hook → Page component
```

- DB → API: FastAPI Pydantic models return `snake_case` JSON
- Frontend state: Use `snake_case` to match API (no transform needed unless consuming third-party)
- WebSocket events: `entity:event` format (e.g. `display:updated`, `playlist:created`)

### Real-time / WebSocket Pattern

- Event format: `{ "type": "display:updated", "data": { ...display } }`
- Frontend subscribes via `wsService.ts` and routes by `type`
- Display agents connect via their own WebSocket endpoint (`/ws/agent/{display_uuid}`)

### Key Services

| Service | Port | Start Command |
|---------|------|---------------|
| FastAPI API | 3030 | `cd api && uvicorn main:app --reload --port 3030` |
| Vite Frontend | 3031 | `npm run dev` (from project root) |

---

## 🔑 ID & KEY CONVENTIONS
<!-- tags: uuid, primary-key, foreign-key -->

- **Primary key field:** `uuid` (PostgreSQL `gen_random_uuid()` server default)
- **Display/label field:** none (use display name)
- **Foreign keys reference:** always `uuid`, never integer `id`
- **Rule:** All API endpoints use `uuid` in the path, e.g. `GET /displays/{display_uuid}`
- **Multi-tenancy rule:** Every table has `org_id UUID NOT NULL` — always include in queries

---

## 🚢 DEPLOYMENT
<!-- tags: railway, deploy, git -->

**Platform:** Railway
**Deploy trigger:** `git push origin main` → auto-deploy
**Never use:** `railway up` unless GitHub pipeline is broken

### Deploy Checklist

- [ ] All Alembic migrations created and committed
- [ ] Environment variables verified in Railway (`DATABASE_URL`, `SECRET_KEY`, `ENVIRONMENT=production`)
- [ ] Health check endpoint responds: `GET /health`
- [ ] `alembic upgrade head` runs as part of Railway start command

---

## 🖥️ UI COMPONENT RULES
<!-- tags: ui, components, modals, cards, overflow -->

### Theme

- **Always implement light AND dark mode** — theme toggle in sidebar
- No dark-on-dark text — maintain minimum contrast ratio
- No text smaller than 12px

### Design Tokens

| Token | Dark | Light |
|-------|------|-------|
| Background (deepest) | `#07090f` | `#f0f2f5` |
| Primary accent | `#5eb7f1` | `#2563eb` |
| Success | `#34d399` | `#34d399` |
| Error | `#f87171` | `#f87171` |
| Warning | `#fbbf24` | `#fbbf24` |

### Card / List Row Pattern

- Key expand state by `uuid` (not array index), so state survives re-renders
- Single-click = reveal/collapse; double-click = open edit modal
- Action buttons: always `stopPropagation` on the action group wrapper

### Overflow Rules

- `overflow-x-auto` — permitted on scroll containers
- `overflow-y-auto` — permitted on modal bodies
- `overflow-hidden` — **FORBIDDEN** on containers with absolute-positioned dropdown children

---

## 📝 META-RULE: KEEPING THIS FILE CURRENT
<!-- tags: meta, update -->

**This file is only useful if it's up to date.**

- After every non-trivial session, ask: "Did I discover anything new?"
- If yes, add it to the appropriate section above and update "Last Updated" at the top
- Err on the side of over-documenting — repeating a past mistake is expensive
