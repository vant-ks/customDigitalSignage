# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Push to Railway** — create Railway service, link PostgreSQL, set env vars (`DATABASE_URL`, `SECRET_KEY`, OAuth IDs), push `main`, run `alembic upgrade head`, verify `/health`
2. **Local media persistence** — `/tmp` is ephemeral on Railway; add `MEDIA_DIR` env var pointing to a Railway volume mount and update `local_media_dir` in config

---

## 🟡 Next Up

3. **Phase 3: Schedules** — `GET/POST /api/schedules`, time-based playlist assignment, weekly schedule grid UI
4. **Display Agent (Phase 4)** — heartbeat endpoint already exists; build minimal Python agent for Raspberry Pi that sends heartbeats and polls for current playlist
5. **Provisioning flow** — `POST /api/provisioning/token` + agent installer script

---

## 🟢 Backlog

- Phase 5: Alerts + notification rules
- Phase 6: Audit log UI, screenshots from devices
- Storage OAuth callbacks (Dropbox/GDrive/OneDrive) — need real OAuth creds to test end-to-end

---

## ⚠️ Known Issues / Blockers

- `/tmp/vant-media/` used for uploads + thumbnails — ephemeral on Railway, needs volume
- `SECRET_KEY` in `api/.env` is still the placeholder — must rotate before production
- `CORS_ORIGINS` needs Railway frontend URL once deployed

---

## ✅ Done This Sprint (Session 4)

- Session start: all services up, migrations at head, auth smoke-tested ✓
- `POST /api/media/upload` — multipart upload, MIME allowlist, local disk storage ✓
- `GET /api/media/{id}/file` — serve locally stored files ✓
- `process_local_asset` — Pillow image processing + ffprobe/ffmpeg video processing ✓
- Fixed background task race: explicit `db.commit()` before `background_tasks.add_task()` ✓
- Frontend: `api.upload()` helper, `uploadAsset()` store action, Upload button in MediaPage ✓
- TypeScript 0 errors, Python syntax clean ✓
