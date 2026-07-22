FROM python:3.14.5-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

RUN useradd --create-home --uid 10001 traceframe \
    && apt-get update \
    && apt-get install --yes --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY services/worker/requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=traceframe:traceframe services/worker/src ./src
COPY --chown=traceframe:traceframe apps/web/drizzle /migrations
COPY --chown=traceframe:traceframe scripts/run-migrations.sh /scripts/run-migrations.sh

USER traceframe

CMD ["python", "-m", "traceframe_worker"]
