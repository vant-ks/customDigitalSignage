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

## March 2026 (Session 1) — Project documentation setup

### Branch: `main` *(pre-git / workspace init)*

### Overview
Documentation scaffold initialized. `_Utilities` symlinked, `docs/` folder created with universal symlinks and project-specific local copies.

---

### 1. Documentation scaffold initialized

**Status:** ✅ COMPLETE
**Tags:** docs, session-start, setup
**Summary:** Symlinked _Utilities, created docs/ with universal symlinks (AI_AGENT_PROTOCOL, MIGRATION rules, RAILWAY_CLI_GUIDE, SERVER_MAP) and project-specific local copies (PROJECT_RULES, SESSION_START_PROTOCOL, SESSION_JOURNAL, DEVLOG, LAUNCH_SESSION, TODO_NEXT_SESSION).

---

<!-- Add new sessions above this line, newest at top -->
