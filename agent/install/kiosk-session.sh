#!/bin/bash
# VANT Signage — X11 kiosk session startup script
# Called by the display manager auto-login session (e.g. Openbox or nodm).
# Configured in /etc/X11/Xsession.d/ or as ExecStart for a kiosk session.

set -e

DISPLAY="${DISPLAY:-:0}"
export DISPLAY

# ── Disable screen blanking and power management ──────────────────────────
xset -dpms          # disable DPMS (Energy Star) features
xset s off          # disable screensaver
xset s noblank      # do not blank the screen

# ── Hide mouse cursor ─────────────────────────────────────────────────────
if command -v unclutter &>/dev/null; then
    unclutter -idle 0.5 -root &
fi

# ── Set display orientation (edit as needed) ──────────────────────────────
# Landscape (default):
#   xrandr --output HDMI-1 --rotate normal
# Portrait (clockwise):
#   xrandr --output HDMI-1 --rotate right
# Portrait (counter-clockwise):
#   xrandr --output HDMI-1 --rotate left

# ── Start VANT agent ──────────────────────────────────────────────────────
# The agent controls mpv and Chromium as child processes.
exec /usr/local/bin/vant-agent run
