FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached until pyproject.toml changes)
# Uses tomllib (built-in Python 3.11) to extract dep list without needing source code present
COPY pyproject.toml .
RUN python3 -c "\
import tomllib; \
data = tomllib.load(open('pyproject.toml', 'rb')); \
deps = data['project']['dependencies']; \
open('/tmp/requirements.txt', 'w').write('\n'.join(deps))" \
    && pip install --no-cache-dir -r /tmp/requirements.txt

# App code
COPY . .

# Register the local package (app*) — deps already installed above
RUN pip install --no-cache-dir --no-deps -e . && chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
