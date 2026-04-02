#!/usr/bin/env python3
"""
vant-agent CLI entry point.

Usage:
    vant-agent run [--config /path/to/config.yaml]
    vant-agent register --token vprov_xxx [--config ...]
    vant-agent status [--config ...]
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="vant-agent",
        description="VANT Signage Display Agent",
    )
    parser.add_argument(
        "--config",
        default=None,
        metavar="PATH",
        help="Path to config YAML (default: /etc/vant-agent/config.yaml)",
    )

    sub = parser.add_subparsers(dest="command", help="Command")
    sub.add_parser("run", help="Start the agent (default when no command given)")

    reg = sub.add_parser("register", help="Provision this device with a token")
    reg.add_argument("--token", required=True, help="Provisioning token (vprov_...)")

    sub.add_parser("status", help="Print current agent status from local cache")

    args = parser.parse_args()
    command = args.command or "run"

    config_path = Path(args.config) if args.config else None

    if command == "run":
        from vant_agent.agent import VantAgent
        try:
            asyncio.run(VantAgent.run(config_path))
        except KeyboardInterrupt:
            print("\n[vant-agent] Stopped.")
        except Exception as e:
            print(f"[vant-agent] Fatal: {e}", file=sys.stderr)
            sys.exit(1)

    elif command == "register":
        from vant_agent.agent import VantAgent
        try:
            asyncio.run(VantAgent.provision(config_path, args.token))
        except Exception as e:
            print(f"[vant-agent] Registration failed: {e}", file=sys.stderr)
            sys.exit(1)

    elif command == "status":
        from vant_agent.core.config import AgentConfig, DEFAULT_CONFIG_PATH
        path = config_path or DEFAULT_CONFIG_PATH
        try:
            cfg = AgentConfig.load(path)
        except Exception as e:
            print(f"Config error: {e}", file=sys.stderr)
            sys.exit(1)

        status = {
            "display_id": cfg.display_id,
            "device_token_prefix": (cfg.device_token or "")[:16] + "..." if cfg.device_token else None,
            "server_url": cfg.server_url,
            "cache_dir": str(cfg.cache_dir),
        }
        # Check local manifest
        manifest_path = cfg.cache_dir / "manifest.json"
        if manifest_path.exists():
            try:
                import json as _json
                m = _json.loads(manifest_path.read_text())
                status["manifest_hash"] = m.get("manifest_hash")
                status["manifest_generated_at"] = m.get("generated_at")
                status["schedules"] = len(m.get("schedules", []))
            except Exception:
                status["manifest"] = "corrupt"
        else:
            status["manifest"] = "not cached"

        print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()
