#!/bin/sh
set -e

echo "=== VANT Signage: Starting ===" >&2
echo "PORT=${PORT:-8000}" >&2

echo "=== Running alembic upgrade head (timeout 60s) ===" >&2
timeout 60 alembic upgrade head && echo "=== Alembic OK ===" >&2 || echo "WARNING: alembic timed out or failed — DB schema may already be at head, continuing" >&2

echo "=== Starting uvicorn on port ${PORT:-8000} ===" >&2
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
