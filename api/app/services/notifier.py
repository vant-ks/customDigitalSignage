"""
Notification delivery: email (SMTP) and webhook (HTTP POST).

Both are best-effort — failures are logged but do not propagate exceptions
to the caller, so alert evaluation continues even if delivery fails.

Configuration (via environment variables / .env):
  SMTP_HOST         SMTP server hostname (leave empty to disable email)
  SMTP_PORT         (default 587)
  SMTP_USERNAME
  SMTP_PASSWORD
  SMTP_FROM_EMAIL   (default: alerts@vant.signage)
  SMTP_FROM_NAME    (default: VANT Signage)
  SMTP_USE_TLS      (default: true)
"""

import asyncio
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import get_settings

logger = logging.getLogger("vant.notifier")


def _email_html(title: str, message: str, severity: str) -> str:
    colour = {"critical": "#f87171", "warning": "#fbbf24"}.get(severity, "#5eb7f1")
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,sans-serif;background:#07090f;color:#d0d8e8;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#0b0f1a;border-radius:12px;overflow:hidden">
    <div style="background:{colour};padding:4px 0"></div>
    <div style="padding:24px 28px">
      <p style="font-size:18px;font-weight:600;margin:0 0 6px;color:#ffffff">{title}</p>
      <p style="font-size:14px;margin:0 0 24px;color:#8899b4">{message}</p>
      <p style="font-size:12px;color:#556680;margin:0">Sent by VANT Signage alerting system.</p>
    </div>
  </div>
</body>
</html>"""


async def send_email(
    recipients: list[str],
    subject: str,
    title: str,
    message: str,
    severity: str = "warning",
) -> None:
    """Send an HTML alert email via SMTP (async, non-blocking)."""
    settings = get_settings()
    if not settings.smtp_host:
        logger.debug("SMTP not configured — skipping email delivery")
        return
    if not recipients:
        return

    def _send() -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = ", ".join(recipients)

        plain = f"{title}\n\n{message}"
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(_email_html(title, message, severity), "html"))

        context = ssl.create_default_context()
        if settings.smtp_use_tls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.sendmail(settings.smtp_from_email, recipients, msg.as_string())
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.sendmail(settings.smtp_from_email, recipients, msg.as_string())

    try:
        await asyncio.to_thread(_send)
        logger.info("Email sent to %s: %s", recipients, subject)
    except Exception:
        logger.exception("Failed to send email to %s", recipients)


async def send_webhook(
    url: str,
    title: str,
    message: str,
    severity: str,
    event_type: str,
    display_id: str | None = None,
    rule_id: str | None = None,
) -> None:
    """POST a JSON payload to a webhook URL (best-effort, 10s timeout)."""
    payload = {
        "title": title,
        "message": message,
        "severity": severity,
        "event_type": event_type,
        "display_id": display_id,
        "rule_id": rule_id,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        logger.info("Webhook delivered to %s (status %s)", url, resp.status_code)
    except Exception:
        logger.exception("Failed to deliver webhook to %s", url)
