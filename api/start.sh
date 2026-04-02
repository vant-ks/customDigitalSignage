#!/bin/sh
set -e

echo "=== VANT Signage: Starting ==="
echo "PORT=${PORT:-8000}"
echo "LOCAL_MEDIA_DIR=${LOCAL_MEDIA_DIR}"
echo "THUMBNAIL_DIR=${THUMBNAIL_DIR}"

echo "=== Testing Python imports ==="
python -c "from app.main import app; print('Import OK')"

echo "=== Running alembic upgrade head ==="
alembic upgrade head
echo "=== Alembic complete ==="

echo "=== Starting uvicorn on port ${PORT:-8000} ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
