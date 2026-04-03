# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Agent smoke test** — run `vant-agent register --token vprov_xxx` against the local API, verify:
   - Token is consumed (`is_used=true`) in DB
   - `device_token` written back to `/etc/vant-agent/config.yaml`
   - Heartbeat + telemetry endpoints receive data

2. **Railway deploy verification** — push Phase 5 commit, confirm:
   - `GET /api/provisioning/tokens` returns 200 on Railway
   - `GET /api/provisioning/tokens/{id}/config.yaml` returns valid YAML download

---

## 🟡 Next Up

3. **Phase 6: Fleet Monitoring Dashboard**
   - Real-time display health grid (online/offline/error badges)
   - Telemetry sparklines per display (CPU, disk, uptime)
   - Alert rules: CPU > 90%, disk < 10%, offline > 5min → webhook / email

4. **Audit log UI** — paginated list of provisioning events, schedule changes, media uploads

5. **Pi image builder script** — chroot-based builder on macOS/Linux:
   - Base: Raspberry Pi OS Lite Bookworm arm64
   - Installs: `vant-agent`, mpv, Chromium, systemd service, kiosk session
   - Accepts: `--config config.yaml` to embed pre-filled agent config
   - Output: bootable `.img` ready to flash with Raspberry Pi Imager

---

## 🟢 Backlog

- Storage OAuth callbacks (Dropbox/GDrive/OneDrive) — need real OAuth creds to test end-to-end
- Screenshot capture endpoint on agent (`commands/handler.py` → `scrot` / `grim`)
- Playlist weighted shuffle visualizer in PlaylistBuilderPage

---

## ⚠️ Known Issues / Blockers

- `SECRET_KEY` in `api/.env` is still the placeholder — must rotate before production
- `setup.sh` git install URL (`YOUR_ORG/YOUR_REPO`) needs updating once repo is public / on PyPI

---

## ✅ Done This Sprint (Session 5)

- Session start: all services up, migrations at head, git verified ✓
- Railway volume mounted at `/data`; `/tmp` ephemeral storage issue resolved ✓
- `thumbnail_dir` config-driven; `THUMBNAIL_DIR=/data/thumbnails` set in Railway ✓
- Dockerfile editable install race condition fixed (tomllib dep extraction pattern) ✓
- Railway cached `startCommand` override fixed via explicit `startCommand = "./start.sh"` in railway.toml ✓
- Phase 3 backend: all schemas, CRUD routes, resolver, emergency override, manifest, sync-status ✓
- Phase 3 frontend: `scheduleStore.ts`, `SchedulesPage.tsx`, `/schedules` route wired ✓
- Phase 4: complete display agent (`agent/` package — 21 files) ✓
- Phase 5: provisioning wizard, token list/revoke/config-download backend endpoints ✓
- Phase 5: `provisioningStore.ts`, `ProvisioningPage.tsx`, `/provisioning` route + nav ✓
- Phase 5: `agent/install/setup.sh` Linux bootstrap installer ✓
- TypeScript 0 errors, Python syntax verified ✓

