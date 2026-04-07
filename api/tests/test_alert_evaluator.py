"""
Unit tests for alert evaluation helpers in app.services.alert_evaluator.

Tested functions:
  _threshold_met(event_type, rule, display, telemetry) -> bool
  _severity_for_event(event_type) -> str
"""

from types import SimpleNamespace

import pytest

from app.services.alert_evaluator import _severity_for_event, _threshold_met


def make_rule(**kwargs):
    defaults = {"threshold": {}, "channels": ["dashboard"], "email_recipients": None, "webhook_url": None}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def make_display(**kwargs):
    defaults = {"status": "online"}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def make_telemetry(**kwargs):
    defaults = {
        "cpu_percent": None,
        "memory_percent": None,
        "disk_percent": None,
        "cpu_temp_c": None,
        "sync_status": "ok",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


# ---------------------------------------------------------------------------
# _threshold_met — CPU
# ---------------------------------------------------------------------------

def test_cpu_high_above_threshold():
    rule = make_rule(threshold={"gt": 80})
    telemetry = make_telemetry(cpu_percent=95)
    assert _threshold_met("cpu_high", rule, make_display(), telemetry)


def test_cpu_high_below_threshold():
    rule = make_rule(threshold={"gt": 80})
    telemetry = make_telemetry(cpu_percent=70)
    assert not _threshold_met("cpu_high", rule, make_display(), telemetry)


def test_cpu_high_exactly_at_threshold_not_triggered():
    """gt means strictly greater than — == should not fire."""
    rule = make_rule(threshold={"gt": 80})
    telemetry = make_telemetry(cpu_percent=80)
    assert not _threshold_met("cpu_high", rule, make_display(), telemetry)


# ---------------------------------------------------------------------------
# _threshold_met — memory & disk
# ---------------------------------------------------------------------------

def test_memory_high_above_threshold():
    rule = make_rule(threshold={"gt": 85})
    telemetry = make_telemetry(memory_percent=92)
    assert _threshold_met("memory_high", rule, make_display(), telemetry)


def test_disk_high_above_threshold():
    rule = make_rule(threshold={"gt": 90})
    telemetry = make_telemetry(disk_percent=95)
    assert _threshold_met("disk_high", rule, make_display(), telemetry)


def test_disk_high_below_threshold():
    rule = make_rule(threshold={"gt": 90})
    telemetry = make_telemetry(disk_percent=50)
    assert not _threshold_met("disk_high", rule, make_display(), telemetry)


# ---------------------------------------------------------------------------
# _threshold_met — lt threshold
# ---------------------------------------------------------------------------

def test_lt_threshold_triggered():
    rule = make_rule(threshold={"lt": 20})
    telemetry = make_telemetry(cpu_percent=10)
    assert _threshold_met("cpu_high", rule, make_display(), telemetry)


def test_lt_threshold_not_triggered():
    rule = make_rule(threshold={"lt": 20})
    telemetry = make_telemetry(cpu_percent=30)
    assert not _threshold_met("cpu_high", rule, make_display(), telemetry)


# ---------------------------------------------------------------------------
# _threshold_met — offline event
# ---------------------------------------------------------------------------

def test_offline_fires_when_display_offline():
    rule = make_rule()
    assert _threshold_met("offline", rule, make_display(status="offline"), None)


def test_offline_does_not_fire_when_online():
    rule = make_rule()
    assert not _threshold_met("offline", rule, make_display(status="online"), None)


# ---------------------------------------------------------------------------
# _threshold_met — sync_error event
# ---------------------------------------------------------------------------

def test_sync_error_fires_on_error_status():
    telemetry = make_telemetry(sync_status="error")
    assert _threshold_met("sync_error", make_rule(), make_display(), telemetry)


def test_sync_error_does_not_fire_on_ok():
    telemetry = make_telemetry(sync_status="ok")
    assert not _threshold_met("sync_error", make_rule(), make_display(), telemetry)


def test_sync_error_does_not_fire_without_telemetry():
    assert not _threshold_met("sync_error", make_rule(), make_display(), None)


# ---------------------------------------------------------------------------
# _threshold_met — no telemetry for metric-based event
# ---------------------------------------------------------------------------

def test_metric_event_no_telemetry_returns_false():
    rule = make_rule(threshold={"gt": 80})
    assert not _threshold_met("cpu_high", rule, make_display(), None)
    assert not _threshold_met("memory_high", rule, make_display(), None)
    assert not _threshold_met("disk_high", rule, make_display(), None)
    assert not _threshold_met("temp_high", rule, make_display(), None)


# ---------------------------------------------------------------------------
# _threshold_met — unknown event type
# ---------------------------------------------------------------------------

def test_unknown_event_type_returns_false():
    rule = make_rule(threshold={"gt": 80})
    telemetry = make_telemetry(cpu_percent=99)
    assert not _threshold_met("unknown_event", rule, make_display(), telemetry)


# ---------------------------------------------------------------------------
# _severity_for_event
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("event_type", ["offline", "sync_error", "cpu_high", "temp_high"])
def test_critical_events(event_type):
    assert _severity_for_event(event_type) == "critical"


@pytest.mark.parametrize("event_type", ["memory_high", "disk_high"])
def test_warning_events(event_type):
    assert _severity_for_event(event_type) == "warning"


def test_severity_unknown_event_is_warning():
    assert _severity_for_event("some_future_event") == "warning"
