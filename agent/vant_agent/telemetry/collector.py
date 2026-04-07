"""
System telemetry collector.
Cross-platform: Raspberry Pi, generic Linux, and macOS.
"""

from __future__ import annotations

import logging
import os
import platform
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger("vant.telemetry")


def collect(cache_stats: Optional[dict] = None, playback_state: Optional[dict] = None) -> dict:
    """Collect a full telemetry snapshot. Safe — never raises."""
    data: dict = {}

    try:
        import psutil  # type: ignore[import-untyped]

        data["cpu_percent"] = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        data["memory_percent"] = mem.percent

        # Use the OS root disk
        disk = psutil.disk_usage("/")
        data["disk_percent"] = disk.percent
        data["disk_free_gb"] = round(disk.free / 1024 ** 3, 2)
        data["uptime_sec"] = int(time.time() - psutil.boot_time())

        # Network
        try:
            nets = psutil.net_if_stats()
            connected = any(iface.isup for name, iface in nets.items() if name != "lo")
            data["net_connected"] = connected
        except Exception:
            pass

    except ImportError:
        logger.warning("psutil not installed — skipping system metrics")
    except Exception as e:
        logger.debug(f"psutil error: {e}")

    # CPU temperature (platform-specific)
    data["cpu_temp_c"] = _get_cpu_temp()

    # Cache stats
    if cache_stats:
        data["cache_used_gb"] = cache_stats.get("used_gb")
        data["cache_item_count"] = cache_stats.get("item_count")

    # Playback state
    if playback_state:
        data["current_playlist_id"] = playback_state.get("playlist_id")
        data["current_media_id"] = playback_state.get("media_id")
        data["playback_status"] = playback_state.get("status", "playing")

    return data


def _get_cpu_temp() -> Optional[float]:
    """Try several platform-specific methods to read CPU temperature."""
    # Raspberry Pi / Linux thermal zone
    for zone in (
        "/sys/class/thermal/thermal_zone0/temp",
        "/sys/class/thermal/thermal_zone1/temp",
    ):
        try:
            val = int(Path(zone).read_text()) / 1000.0
            if 0 < val < 120:
                return val
        except OSError:
            pass

    # psutil sensors_temperatures (Linux hwmon)
    try:
        import psutil  # type: ignore[import-untyped]
        temps = psutil.sensors_temperatures()  # type: ignore[attr-defined]
        for name in ("cpu_thermal", "coretemp", "k10temp", "acpitz", "cpu-thermal"):
            if name in temps and temps[name]:
                return temps[name][0].current
    except Exception:
        pass

    # macOS — IOKit via sysctl-based workaround or external tool
    if platform.system() == "Darwin":
        try:
            import subprocess
            out = subprocess.check_output(
                ["sudo", "powermetrics", "-n", "1", "-i", "100", "--samplers", "smc"],
                timeout=2, stderr=subprocess.DEVNULL, text=True
            )
            for line in out.splitlines():
                if "CPU die temperature" in line:
                    parts = line.split()
                    for p in parts:
                        try:
                            return float(p)
                        except ValueError:
                            pass
        except Exception:
            pass

    return None
