#!/bin/sh
set -e

>&2 echo "=== Running alembic upgrade head ==="
alembic upgrade head

>&2 echo "=== Starting uvicorn on port ${PORT:-8000} ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
