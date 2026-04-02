"""
Local schedule resolver — mirrors the server's resolver logic.

Given the cached manifest and the current datetime, resolves which
playlist should be playing. Resolution order:
  1. is_override=True schedules first
  2. Higher priority wins
  No server call required — fully offline capable.
"""

from __future__ import annotations

import logging
from datetime import datetime, time as dt_time, timezone
from typing import Optional

logger = logging.getLogger("vant.playback.scheduler")


def resolve_active_playlist(manifest: Optional[dict], at: Optional[datetime] = None) -> Optional[dict]:
    """
    Return the active playlist dict (from manifest) for the given time,
    or None if nothing is scheduled (caller should show fallback/holding screen).
    """
    if not manifest:
        return None

    at = at or datetime.now(timezone.utc)
    schedules = manifest.get("schedules", [])

    active = [s for s in schedules if _is_active(s, at)]
    if not active:
        return manifest.get("fallback_playlist")

    # Sort: is_override DESC, priority DESC
    active.sort(key=lambda s: (s.get("is_override", False), s.get("priority", 0)), reverse=True)
    return active[0].get("playlist")


def _is_active(schedule: dict, at: datetime) -> bool:
    stype = schedule.get("schedule_type", "always")

    if stype == "always":
        return True

    if stype == "recurring":
        # days_of_week: 0=Mon ... 6=Sun (Python weekday())
        dow = at.weekday()
        dow_list = schedule.get("days_of_week") or []
        if dow_list and dow not in dow_list:
            return False
        return _in_time_window(schedule, at)

    if stype == "one_time":
        start_date = _parse_dt(schedule.get("start_date"))
        end_date = _parse_dt(schedule.get("end_date"))
        if start_date and at < start_date:
            return False
        if end_date and at > end_date:
            return False
        return _in_time_window(schedule, at)

    return False


def _in_time_window(schedule: dict, at: datetime) -> bool:
    """Check HH:MM time range; returns True if no time constraint defined."""
    start_str = schedule.get("start_time")
    end_str = schedule.get("end_time")
    if not start_str or not end_str:
        return True
    try:
        st = dt_time.fromisoformat(start_str[:8])
        et = dt_time.fromisoformat(end_str[:8])
        t = at.astimezone().time()  # convert to local time for comparison
        if st <= et:
            return st <= t < et
        # Overnight window (e.g. 22:00 – 06:00)
        return t >= st or t < et
    except ValueError:
        logger.warning(f"Invalid time in schedule: {start_str} / {end_str}")
        return True


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        s = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except ValueError:
        return None
