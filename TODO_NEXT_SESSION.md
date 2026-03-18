# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Connect to Railway PostgreSQL** — set `DATABASE_URL` in `api/.env`, run `alembic upgrade head`, verify tables created
2. **Smoke-test the API** — start uvicorn (port 3030), hit `/health`, test `POST /api/auth/register` + `/login`
3. **Smoke-test the frontend** — `npm run dev` (port 3031), verify login page renders, confirm API proxy works

---

## 🟡 Next Up

4. **Phase 2: Media Library API** — `GET/POST /api/media`, storage provider integration (S3/Backblaze/local), file upload with presigned URLs
5. **Phase 2: Media page (frontend)** — Grid/list view, upload modal, folder tree, preview panel
6. **Push to Railway** — create Railway service, set env vars, configure auto-deploy from `main`

---

## 🟢 Backlog

- Phase 3: Playlists — CRUD, drag-and-drop ordering, playlist builder UI
- Phase 3: Schedules — time-based playlist assignment, weekly schedule grid UI
- Phase 4: Display Agent (Python/Electron) — heartbeat, telemetry, content playback
- Phase 5: Provisioning — token generation, agent installer script
- Phase 6: Monitoring, alerts, audit log UI

---

## ⚠️ Known Issues / Blockers

- Railway URL not yet assigned — update `LAUNCH_SESSION.md` and `docs/SESSION_START_PROTOCOL.md` once linked
- API directory structure TBD — decide between monorepo vs separate repos before scaffolding
- Port 3031 not confirmed available — run `lsof -i :3031` to verify before starting Vite

---

## ✅ Done This Sprint

- Documentation scaffold initialized (March 18, 2026)
