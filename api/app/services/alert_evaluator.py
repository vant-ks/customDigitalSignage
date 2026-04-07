"""
Alert evaluator — background service that checks the latest device telemetry
against active AlertRules and fires Notification rows + WebSocket pushes.

Evaluation logic per event_type:
  cpu_high       → threshold {"gt": 90}   → fires if cpu_percent > value
  memory_high    → threshold {"gt": 85}   → fires if memory_percent > value
  disk_high      → threshold {"gt": 90}   → fires if disk_percent > value
  temp_high      → threshold {"gt": 80}   → fires if cpu_temp_c > value
  offline        → no threshold           → fires if display.status == "offline"
  sync_error     → no threshold           → fires if sync_status == "error"

Cooldown: if last_fired_at is within cooldown_min minutes the rule is skipped.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.models import AlertRule, DeviceTelemetry, Display, Notification

logger = logging.getLogger("vant.alert_evaluator")

# How often the evaluator loop runs (seconds)
EVAL_INTERVAL_SEC = 60
# Prune telemetry older than this many days
TELEMETRY_RETAIN_DAYS = 90
# Run pruning once per day: 86400s / 60s = 1440 cycles
_PRUNE_EVERY_N_CYCLES = 1440


def _threshold_met(event_type: str, rule: AlertRule, display: Display, telemetry: DeviceTelemetry | None) -> bool:
    """Return True if the rule condition is satisfied for this display."""
    threshold = rule.threshold or {}

    if event_type == "offline":
        return display.status == "offline"

    if event_type == "sync_error":
        return telemetry is not None and telemetry.sync_status == "error"

    if telemetry is None:
        return False

    metric_map = {
        "cpu_high": telemetry.cpu_percent,
        "memory_high": telemetry.memory_percent,
        "disk_high": telemetry.disk_percent,
        "temp_high": telemetry.cpu_temp_c,
    }
    value = metric_map.get(event_type)
    if value is None:
        return False

    gt = threshold.get("gt")
    lt = threshold.get("lt")
    if gt is not None and value > float(gt):
        return True
    if lt is not None and value < float(lt):
        return True
    return False


def _severity_for_event(event_type: str) -> str:
    critical = {"offline", "sync_error", "cpu_high", "temp_high"}
    return "critical" if event_type in critical else "warning"


def _title_for_event(event_type: str, display_name: str, threshold: dict | None) -> str:
    threshold = threshold or {}
    labels = {
        "cpu_high":    f"High CPU on {display_name} (>{threshold.get('gt', '?')}%)",
        "memory_high": f"High memory on {display_name} (>{threshold.get('gt', '?')}%)",
        "disk_high":   f"High disk use on {display_name} (>{threshold.get('gt', '?')}%)",
        "temp_high":   f"High CPU temp on {display_name} (>{threshold.get('gt', '?')}°C)",
        "offline":     f"Display offline: {display_name}",
        "sync_error":  f"Sync error on {display_name}",
    }
    return labels.get(event_type, f"Alert on {display_name}: {event_type}")


async def evaluate_alerts(session_factory: async_sessionmaker) -> None:
    """Run one evaluation pass across all orgs."""
    async with session_factory() as db:
        try:
            await _run_evaluation(db)
        except Exception:
            logger.exception("Error during alert evaluation pass")


async def prune_old_telemetry(session_factory: async_sessionmaker) -> None:
    """Delete device_telemetry rows older than TELEMETRY_RETAIN_DAYS."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=TELEMETRY_RETAIN_DAYS)
    async with session_factory() as db:
        try:
            result = await db.execute(
                delete(DeviceTelemetry).where(DeviceTelemetry.recorded_at < cutoff)
            )
            await db.commit()
            deleted = result.rowcount
            if deleted:
                logger.info("Pruned %d telemetry rows older than %d days", deleted, TELEMETRY_RETAIN_DAYS)
        except Exception:
            logger.exception("Error during telemetry pruning")


async def _run_evaluation(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)

    # Load all active rules
    rules_result = await db.execute(
        select(AlertRule).where(AlertRule.is_active == True)  # noqa: E712
    )
    rules: list[AlertRule] = list(rules_result.scalars().all())

    if not rules:
        return

    # Collect all display IDs referenced (explicit or all-org)
    # For efficiency, load all displays and latest telemetry per display once
    display_ids_explicit: set[UUID] = {
        r.display_id for r in rules if r.display_id is not None
    }

    # Fetch all relevant displays
    displays_result = await db.execute(select(Display))
    all_displays: list[Display] = list(displays_result.scalars().all())
    display_map: dict[UUID, Display] = {d.id: d for d in all_displays}

    # Fetch latest telemetry per display (subquery: max recorded_at per display_id)
    from sqlalchemy import func
    subq = (
        select(
            DeviceTelemetry.display_id,
            func.max(DeviceTelemetry.recorded_at).label("max_ts"),
        )
        .group_by(DeviceTelemetry.display_id)
        .subquery()
    )
    telemetry_result = await db.execute(
        select(DeviceTelemetry).join(
            subq,
            (DeviceTelemetry.display_id == subq.c.display_id)
            & (DeviceTelemetry.recorded_at == subq.c.max_ts),
        )
    )
    telemetry_map: dict[UUID, DeviceTelemetry] = {
        t.display_id: t for t in telemetry_result.scalars().all()
    }

    for rule in rules:
        # Respect cooldown
        if rule.last_fired_at is not None:
            cooldown_end = rule.last_fired_at + timedelta(minutes=rule.cooldown_min)
            if now < cooldown_end:
                continue

        # Determine which displays to evaluate for this rule
        if rule.display_id is not None:
            targets = [display_map[rule.display_id]] if rule.display_id in display_map else []
        else:
            # org-wide rule — evaluate every display in the org
            targets = [d for d in all_displays if d.org_id == rule.org_id]

        for display in targets:
            telemetry = telemetry_map.get(display.id)
            if not _threshold_met(rule.event_type, rule, display, telemetry):
                continue

            # Fire notification
            notif = Notification(
                org_id=rule.org_id,
                alert_rule_id=rule.id,
                severity=_severity_for_event(rule.event_type),
                title=_title_for_event(rule.event_type, display.name, rule.threshold),
                message=f"Rule '{rule.name}' triggered for display '{display.name}'.",
                display_id=display.id,
            )
            db.add(notif)
            rule.last_fired_at = now

            # WebSocket push (best-effort; import here to avoid circular deps)
            try:
                from app.websocket.manager import ws_manager
                await ws_manager.broadcast_to_org(
                    str(rule.org_id),
                    {
                        "type": "alert",
                        "severity": notif.severity,
                        "title": notif.title,
                        "display_id": str(display.id),
                        "rule_id": str(rule.id),
                    },
                )
            except Exception:
                logger.debug("WebSocket push failed (no active connections?)")

            # Email / webhook delivery (best-effort)
            channels = rule.channels or []
            if "email" in channels and rule.email_recipients:
                from app.services.notifier import send_email
                await send_email(
                    recipients=rule.email_recipients,
                    subject=notif.title,
                    title=notif.title,
                    message=notif.message or "",
                    severity=notif.severity,
                )
            if "webhook" in channels and rule.webhook_url:
                from app.services.notifier import send_webhook
                await send_webhook(
                    url=rule.webhook_url,
                    title=notif.title,
                    message=notif.message or "",
                    severity=notif.severity,
                    event_type=rule.event_type,
                    display_id=str(display.id),
                    rule_id=str(rule.id),
                )

    await db.commit()


async def run_alert_evaluator_loop(session_factory: async_sessionmaker) -> None:
    """Infinite loop — run alert evaluation every EVAL_INTERVAL_SEC seconds.

    Also prunes old telemetry rows once per day (_PRUNE_EVERY_N_CYCLES cycles).
    """
    logger.info("Alert evaluator started (interval=%ds)", EVAL_INTERVAL_SEC)
    cycle = 0
    while True:
        await asyncio.sleep(EVAL_INTERVAL_SEC)
        await evaluate_alerts(session_factory)
        cycle += 1
        if cycle % _PRUNE_EVERY_N_CYCLES == 0:
            await prune_old_telemetry(session_factory)
