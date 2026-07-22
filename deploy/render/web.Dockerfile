FROM oven/bun:1.3.14-alpine AS dependencies

WORKDIR /app
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY apps/web ./
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runner

WORKDIR /app
ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000

RUN apk add --no-cache postgresql-client

COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --chown=bun:bun apps/web/drizzle /migrations
COPY --chown=bun:bun db/seed-demo-user.sql /seed/seed-demo-user.sql
COPY --chown=bun:bun scripts/run-migrations.sh scripts/seed-demo-user.sh /scripts/

USER bun
EXPOSE 10000

CMD ["bun", "server.js"]
