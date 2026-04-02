# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Phase 4: Display Agent (Raspberry Pi)** — minimal Python service that:
   - Sends heartbeat `POST /api/devices/{id}/heartbeat`
   - Polls `GET /api/displays/{id}/manifest` and computes local hash to detect changes
   - Downloads and caches media files to local disk
   - Launches `mpv` in kiosk mode to play the current playlist
   - Reports sync status via `POST /api/devices/{id}/sync-status`

---

## 🟡 Next Up

2. **Provisioning flow** — `POST /api/provisioning/token` route + installer shell script that:
   - Downloads the agent
   - Sets device token in env
   - Registers the display via API on first boot
3. **Railway deploy of Phase 3** — git push triggers Railway autodeploy; verify schedules endpoints healthy on Railway after push

---

## 🟢 Backlog

- Phase 5: Alerts + notification rules
- Phase 6: Audit log UI, screenshots from devices
- Storage OAuth callbacks (Dropbox/GDrive/OneDrive) — need real OAuth creds to test end-to-end

---

## ⚠️ Known Issues / Blockers

- `SECRET_KEY` in `api/.env` is still the placeholder — must rotate before production

---

## ✅ Done This Sprint (Session 5)

- Session start: all services up, migrations at head, git verified ✓
- Railway volume mounted at `/data`; `/tmp` ephemeral storage issue resolved ✓
- `thumbnail_dir` config-driven; `THUMBNAIL_DIR=/data/thumbnails` set in Railway ✓
- Dockerfile editable install race condition fixed (tomllib dep extraction pattern) ✓
- Railway cached `startCommand` override fixed via explicit `startCommand = "./start.sh"` in railway.toml ✓
- CDN: `customDigitalSignage` frontend service redeployed with latest Vite build ✓
- Phase 3 backend: all schemas, CRUD routes, resolver, emergency override, manifest, sync-status ✓
- Phase 3 frontend: `scheduleStore.ts`, `SchedulesPage.tsx`, `/schedules` route wired ✓
- TypeScript 0 errors, Python import verified ✓

