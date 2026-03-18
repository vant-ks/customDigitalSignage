# TODO — Next Session — VANT Signage Platform

> Keep this file short and actionable. Completed items get removed or moved to DEVLOG.md.
> Update this at the end of every session.

---

## 🔴 High Priority (do first)

1. **Scaffold project structure** — create `api/` (FastAPI), `src/` (React/Vite), `package.json`, `pyproject.toml`/`requirements.txt`
2. **Initialize git repo** — `git init`, first commit with existing artifacts
3. **Apply schema.sql** — create Railway PostgreSQL instance, apply schema, verify connectivity

---

## 🟡 Next Up

4. **Phase 1: Foundation + Security** — implement JWT auth endpoints (login, refresh, logout), bcrypt password hashing
5. **Link Railway project** — create Railway service, set env vars, configure auto-deploy from `main`, update `LAUNCH_SESSION.md` with Railway URL
6. **Vite dev server config** — configure vite.config.ts proxy for API at port 3030, confirm HMR works

---

## 🟢 Backlog

7. Phase 2: Media Pipeline + Content Management
8. Phase 3: Scheduling + Sync Engine
9. Phase 4: Display Agent + Playback
10. Phase 5: Provisioning Tools
11. Phase 6: Monitoring, Alerts, Polish

---

## ⚠️ Known Issues / Blockers

- Railway URL not yet assigned — update `LAUNCH_SESSION.md` and `docs/SESSION_START_PROTOCOL.md` once linked
- API directory structure TBD — decide between monorepo vs separate repos before scaffolding
- Port 3031 not confirmed available — run `lsof -i :3031` to verify before starting Vite

---

## ✅ Done This Sprint

- Documentation scaffold initialized (March 18, 2026)
