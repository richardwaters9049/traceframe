FROM oven/bun:1.3.14-debian AS dependencies

WORKDIR /app
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS web-builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web ./
RUN bun run build

FROM oven/bun:1.3.14-debian AS bun-runtime

FROM python:3.14.5-slim AS runner

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/worker/src

WORKDIR /app

RUN useradd --create-home --uid 10001 traceframe \
    && apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY services/worker/requirements.txt /worker/requirements.txt
RUN python -m pip install --no-cache-dir --requirement /worker/requirements.txt

COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
COPY --from=web-builder --chown=traceframe:traceframe /app/public ./public
COPY --from=web-builder --chown=traceframe:traceframe /app/.next/standalone ./
COPY --from=web-builder --chown=traceframe:traceframe /app/.next/static ./.next/static
COPY --chown=traceframe:traceframe services/worker/src /worker/src
COPY --chown=traceframe:traceframe apps/web/drizzle /migrations
COPY --chown=traceframe:traceframe db/seed-demo-user.sql /seed/seed-demo-user.sql
COPY --chown=traceframe:traceframe scripts/run-migrations.sh scripts/seed-demo-user.sh /scripts/
COPY --chown=traceframe:traceframe deploy/render/portfolio-supervisor.py /app/portfolio-supervisor.py

USER traceframe
EXPOSE 10000

CMD ["python", "/app/portfolio-supervisor.py"]
