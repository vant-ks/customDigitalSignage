# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Phase 5: Provisioning Wizard (Dashboard UI)** — multi-step wizard:
   - Steps: name/group/location → hardware type → display config → cache policy → generate token
   - Output: provisioning token + downloadable `config.yaml` pre-filled with token + server URL
   - Backend: `GET /api/provisioning/tokens` (list) endpoints already exist; add token download endpoint

2. **Pi image builder script** — shell script that:
   - Takes base Raspberry Pi OS Lite (Bookworm) image
   - Installs `vant-agent` (from the `agent/` package), systemd service, mpv, Chromium
   - Drops `kiosk-session.sh` as the auto-login session
   - Output: ready-to-flash `.img`

---

## 🟡 Next Up

3. **Linux (NUC/x86) one-line installer** — `curl ... | bash -s -- --token <PROVISIONING_TOKEN>`
4. **Railway deploy verification** — confirm Phase 3 schedules endpoints are live on Railway after the Phase 3 push
5. **Agent smoke test** — run `vant-agent register --token vprov_xxx` against local API, verify config.yaml write-back

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
- Phase 4: complete display agent (`agent/` package — 21 files) ✓
- TypeScript 0 errors, Python syntax verified ✓

