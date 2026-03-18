# Session Start Protocol — VANT Signage Platform

> **NOTE:** This is the LOCAL copy for this project. Source template: `_Utilities/SESSION_START_PROTOCOL.md`.
> Do NOT use a symlink — this file contains project-specific paths and ports.
>
> Project values used:
> - PROJECT_NAME: VANT Signage Platform
> - PROJECT_DIR: `.` (workspace root)
> - API_PORT: 3030
> - FRONTEND_PORT: 3031
> - RAILWAY_URL: TBD
> - WORKSPACE_ROOT: /Users/kevin/GJS MEDIA Dropbox/Kevin Shea/Development/DigitalSignage

**Purpose:** Standard procedure for AI agents at the start of every session.
**Last Updated:** March 18, 2026
**Maintained By:** Kevin @ GJS Media

---

## Trigger Phrase

When the user says any of:
- "Let's start a new session"
- "Start a new session"
- "Begin session"
- "Session start"

Execute this protocol automatically.

---

## Session Start Checklist

### Phase 1: Review Documentation (Grep-First)

Use **targeted reading** — do NOT read large file sections wholesale.

**Step 1 — DEVLOG recent state:**
- `grep_search` for `"✅ COMPLETE|### Status"` in `DEVLOG.md` (last 60 lines)
- Shows what was last completed and any in-progress tasks

**Step 2 — PROJECT_RULES.md navigation TOC:**
- `read_file` lines 1–70 of `docs/PROJECT_RULES.md` (the `<!-- DOCUMENT NAVIGATION -->` block)
- For task-specific rules: `grep_search "tags:.*<topic>"` then `read_file` only that range
- **Always read these critical sections:**
  - Entity Terminology & Naming
  - Database & ORM (Alembic migration safety — CRITICAL)
  - Mission Statement / Pillars + Quick Diagnostic Checklist

**Step 3 — SESSION_JOURNAL most recent session:**
- `grep_search "^## Session 20"` in `docs/SESSION_JOURNAL.md` to find the newest heading
- `read_file` ~60 lines from that line number

**Step 4 — TODO_NEXT_SESSION.md (full file — always small):**
- `read_file` full file

**Step 5 — AI_AGENT_PROTOCOL.md (lines 1–100 only):**
- Check for protocol updates or critical rules

---

### Phase 2: Start Development Servers

1. **Kill existing processes:**
   ```bash
   pkill -9 -f 'uvicorn' && pkill -9 -f 'vite' && lsof -ti:3030 -ti:3031 | xargs kill -9 2>/dev/null; true
   ```

2. **Start API Server (isBackground: true):**
   ```bash
   cd "/Users/kevin/GJS MEDIA Dropbox/Kevin Shea/Development/DigitalSignage/api" && uvicorn main:app --reload --port 3030
   ```
   Wait 3 seconds. Verify port 3030 listening.

3. **Start Frontend Server (isBackground: true):**
   ```bash
   cd "/Users/kevin/GJS MEDIA Dropbox/Kevin Shea/Development/DigitalSignage" && npm run dev
   ```
   Wait 3 seconds. Verify port 3031 listening.

4. Verify both servers report "ready". Note any startup warnings.

> **If project not yet fully scaffolded:** Note which servers don't exist yet and skip those checks.

---

### Phase 3: Verify Git Pipeline

```bash
cd "/Users/kevin/GJS MEDIA Dropbox/Kevin Shea/Development/DigitalSignage"
git status
git branch --show-current
git log --oneline -5
git fetch && git status
```

Document: branch, clean/dirty, commits ahead/behind, any uncommitted changes.

---

### Phase 4: Verify Railway Production

```bash
# Railway URL TBD — update this when Railway project is created
# curl -s (RAILWAY_URL)/health
```

Expected: `{ "status": "ok", "environment": "production", "database": "connected" }`

---

### Phase 5: Report Session Status

Present this summary to the user:

```
## Session Started — VANT Signage Platform

**Local Dev:**
- API: port 3030 — up/down (FastAPI)
- Frontend: port 3031 — up/down (Vite)

**Git:**
- Branch: [branch]
- Status: clean / N changes
- Last commit: [hash] [message]

**Railway:** UP/DOWN / TBD

**Last DEVLOG checkpoint:** [last COMPLETE entry — date + one-line summary]

**IN PROGRESS tasks (must re-verify before new work):** [list or "none"]

**Top 3 priorities (TODO_NEXT_SESSION.md):**
1.
2.
3.

Ready — what would you like to work on?
```

---

## 🗓️ Phase 6: Session Close Checklist

Before ending any session, complete these steps in order:

1. **DEVLOG.md** — ensure the last entry is ✅ COMPLETE (no IN PROGRESS entries left open)

2. **TODO_NEXT_SESSION.md** — update with:
   - Move completed items out or remove them
   - Add any new tasks discovered
   - Add any blockers or gotchas to "Known Issues"

3. **docs/SESSION_JOURNAL.md** — write the final prompt entry if not already done; update session **Status** from `IN_PROGRESS` to `COMPLETED`

4. **LAUNCH_SESSION.md** — update the "Last Session Checkpoint" block:
   - Current branch name
   - Last commit hash + one-line description
   - What was completed this session
   - "Pick up from:" — the specific next task

5. **Commit** — `git add -A && git commit -m "docs(session): update session journal, devlog, launch checkpoint"`

---

## Error Handling

**Servers won't start:**
```bash
lsof -i :3030 -i :3031   # check for port conflicts
cd api && pip install -r requirements.txt
npm install
```
Report details to user. Do NOT silently retry.

**Railway down:** Note in report. Ask user before investigating. Do NOT auto-deploy.

**Git conflicts:** Report affected files. Ask user for resolution. NEVER auto-merge or force push.

---

## Critical Rules

1. Never skip Phase 1 — context is essential before any work begins
2. Always run servers with `isBackground: true`
3. Never auto-deploy to Railway — requires explicit user approval
4. Always surface issues found (failed servers, dirty git, etc.)
5. Keep the status report concise — overview only, not full logs
6. Any IN PROGRESS DEVLOG entries must be re-verified before starting new work

---

## Related Documents

- `docs/PROJECT_RULES.md` — project-specific conventions and entity naming
- `docs/AI_AGENT_PROTOCOL.md` — universal agent protocol (symlink → _Utilities)
- `docs/SESSION_JOURNAL.md` — session-by-session history
- `DEVLOG.md` — task-level checkpoints
- `LAUNCH_SESSION.md` — session opener prompt (paste at start of new chat)
- `TODO_NEXT_SESSION.md` — near-term task queue
