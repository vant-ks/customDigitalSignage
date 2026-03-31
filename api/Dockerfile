FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# App code
COPY . .

RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
