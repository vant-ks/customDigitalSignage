"""
Unit tests for schedule resolution helpers in app.api.routes.schedules.

Tested functions:
  _is_schedule_active_at(s, at) -> bool
  _specificity(s) -> int
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from app.api.routes.schedules import _is_schedule_active_at, _specificity


def make_schedule(**kwargs) -> Any:
    """Build a minimal Schedule-like object for testing."""
    defaults = {
        "is_active": True,
        "schedule_type": "always",
        "start_date": None,
        "end_date": None,
        "days_of_week": None,
        "start_time": None,
        "end_time": None,
        "display_id": None,
        "group_id": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def dt(iso: str) -> datetime:
    """Parse a UTC ISO string into a timezone-aware datetime."""
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# _is_schedule_active_at — always
# ---------------------------------------------------------------------------

def test_always_active():
    s = make_schedule(schedule_type="always")
    assert _is_schedule_active_at(s, dt("2024-06-15T14:00:00"))


def test_always_inactive_when_disabled():
    s = make_schedule(schedule_type="always", is_active=False)
    assert not _is_schedule_active_at(s, dt("2024-06-15T14:00:00"))


# ---------------------------------------------------------------------------
# _is_schedule_active_at — one_time
# ---------------------------------------------------------------------------

def test_one_time_within_range():
    s = make_schedule(
        schedule_type="one_time",
        start_date=dt("2024-06-01T00:00:00"),
        end_date=dt("2024-06-30T23:59:59"),
    )
    assert _is_schedule_active_at(s, dt("2024-06-15T12:00:00"))


def test_one_time_before_start():
    s = make_schedule(
        schedule_type="one_time",
        start_date=dt("2024-06-10T00:00:00"),
        end_date=dt("2024-06-30T23:59:59"),
    )
    assert not _is_schedule_active_at(s, dt("2024-06-05T12:00:00"))


def test_one_time_after_end():
    s = make_schedule(
        schedule_type="one_time",
        start_date=dt("2024-06-01T00:00:00"),
        end_date=dt("2024-06-30T23:59:59"),
    )
    assert not _is_schedule_active_at(s, dt("2024-07-01T00:00:00"))


def test_one_time_no_bounds():
    s = make_schedule(schedule_type="one_time")
    assert _is_schedule_active_at(s, dt("2099-01-01T00:00:00"))


# ---------------------------------------------------------------------------
# _is_schedule_active_at — recurring, day-of-week
# ---------------------------------------------------------------------------
# 2024-06-10 is a Monday (weekday() == 0)
# 2024-06-11 is a Tuesday (weekday() == 1)

def test_recurring_correct_weekday():
    s = make_schedule(schedule_type="recurring", days_of_week=[0])  # Monday only
    assert _is_schedule_active_at(s, dt("2024-06-10T10:00:00"))


def test_recurring_wrong_weekday():
    s = make_schedule(schedule_type="recurring", days_of_week=[0])  # Monday only
    assert not _is_schedule_active_at(s, dt("2024-06-11T10:00:00"))  # Tuesday


def test_recurring_all_weekdays():
    s = make_schedule(schedule_type="recurring", days_of_week=[0, 1, 2, 3, 4, 5, 6])
    for offset in range(7):
        assert _is_schedule_active_at(s, dt(f"2024-06-{10 + offset}T10:00:00"))


# ---------------------------------------------------------------------------
# _is_schedule_active_at — recurring, time window (daytime)
# ---------------------------------------------------------------------------

def test_recurring_within_time_window():
    s = make_schedule(schedule_type="recurring", start_time="09:00", end_time="17:00")
    assert _is_schedule_active_at(s, dt("2024-06-10T12:00:00"))  # noon


def test_recurring_before_time_window():
    s = make_schedule(schedule_type="recurring", start_time="09:00", end_time="17:00")
    assert not _is_schedule_active_at(s, dt("2024-06-10T08:00:00"))  # 8 AM


def test_recurring_after_time_window():
    s = make_schedule(schedule_type="recurring", start_time="09:00", end_time="17:00")
    assert not _is_schedule_active_at(s, dt("2024-06-10T18:00:00"))  # 6 PM


def test_recurring_at_window_boundary_start():
    s = make_schedule(schedule_type="recurring", start_time="09:00", end_time="17:00")
    assert _is_schedule_active_at(s, dt("2024-06-10T09:00:00"))


# ---------------------------------------------------------------------------
# _is_schedule_active_at — recurring, overnight window
# ---------------------------------------------------------------------------

def test_overnight_during_overnight():
    s = make_schedule(schedule_type="recurring", start_time="22:00", end_time="06:00")
    assert _is_schedule_active_at(s, dt("2024-06-10T23:30:00"))  # 11:30 PM


def test_overnight_around_midnight():
    s = make_schedule(schedule_type="recurring", start_time="22:00", end_time="06:00")
    assert _is_schedule_active_at(s, dt("2024-06-10T00:30:00"))  # 12:30 AM


def test_overnight_outside_window():
    s = make_schedule(schedule_type="recurring", start_time="22:00", end_time="06:00")
    assert not _is_schedule_active_at(s, dt("2024-06-10T12:00:00"))  # noon


# ---------------------------------------------------------------------------
# _specificity
# ---------------------------------------------------------------------------

def test_specificity_display():
    s = make_schedule(display_id="abc-123")
    assert _specificity(s) == 2


def test_specificity_group():
    s = make_schedule(group_id="grp-456")
    assert _specificity(s) == 1


def test_specificity_global():
    s = make_schedule()
    assert _specificity(s) == 0
