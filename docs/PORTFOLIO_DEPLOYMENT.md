# Portfolio deployment

This profile keeps the complete Traceframe workflow available for a low-traffic,
synthetic portfolio demonstration without creating paid Render compute. It is a
demo topology, not a production service-level architecture.

## Topology and trade-off

```text
Internet
   |
   | Render TLS
   v
Render Free Web Service
   |-- Next.js web process -------- Neon Free PostgreSQL
   `-- Python worker process ------ Cloudflare R2
```

Next.js and the worker remain separate supervised processes, but share one
container because Render does not offer free background workers. If either
process exits, the supervisor stops the container so Render cannot present a
healthy UI while ingestion is unavailable. Migrations and synthetic demo-user
provisioning run at container startup because Render pre-deploy commands are not
available to free services.

The Render service spins down after 15 idle minutes and can take about a minute to
wake. Render grants 750 free instance hours per workspace each month. Neon and
R2 have their own free allowances. This profile has no uptime, backup, or
recovery guarantee and must use synthetic information only.

## 1. Merge the deployment profile

The Blueprint must exist on GitHub before Render can read it. Merge the current
pull request into `main`, confirm the `verify` check passes, and confirm that
`render.portfolio.yaml` is visible at the repository root on GitHub.

## 2. Create Neon PostgreSQL

1. Create a free Neon project in a European region, preferably Frankfurt.
2. Keep the generated role password in Neon's secret store.
3. From **Connect**, copy the pooled connection string and save it for Render as
   `DATABASE_URL`.
4. Turn connection pooling off and copy the direct connection string for
   `MIGRATION_DATABASE_URL`.
5. Preserve Neon's TLS parameters, including `sslmode=require`, in both values.

The application and worker use the pooled connection for routine traffic. The
startup migration uses the direct connection because schema tools should not run
through PgBouncer transaction pooling.

## 3. Create Cloudflare R2 storage

1. Enable R2 in the Cloudflare dashboard and review its billing controls.
2. Create a **Standard** bucket named `traceframe-source-material`.
3. Create an R2 API token with **Object Read & Write** permission scoped only to
   that bucket.
4. Copy the Access Key ID and Secret Access Key when shown. The secret cannot be
   displayed again.
5. Copy the S3 endpoint. It has the form
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; an EU-jurisdiction bucket
   uses the corresponding `.eu.r2.cloudflarestorage.com` endpoint.

The bucket stays private. Traceframe's server and worker access it through the
existing S3-compatible boundary; browsers never receive storage credentials.

## 4. Create the Render Project and Blueprint

Create a Render Project named `traceframe`, then create a Blueprint from
`richardwaters9049/traceframe` with:

```text
Branch:         main
Blueprint Path: render.portfolio.yaml
```

Render will request the unsynchronised values below:

| Render variable | Value source |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `MIGRATION_DATABASE_URL` | Neon direct connection string |
| `AUTH_DEMO_PASSWORD` | A new strong password used only for the synthetic online demo |
| `MINIO_ENDPOINT` | Cloudflare R2 S3 endpoint |
| `MINIO_ACCESS_KEY` | Bucket-scoped R2 Access Key ID |
| `MINIO_SECRET_KEY` | Bucket-scoped R2 Secret Access Key |

Before applying, confirm the proposed topology contains exactly one **Free Web
Service** and no Render database, private service, worker, or persistent disk.
Render generates the authentication throttle secret. The Blueprint fixes secure
cookies, the R2 `auto` region, bucket name, worker identity, and poll interval.

## 5. Verify the first deployment

The startup logs should complete `migrations` and `demo_user`, then report both
`worker` and `web` processes started. After Render marks the service live:

1. Open `https://traceframe-web.onrender.com/api/health`, or the exact assigned
   Render URL, and confirm a `200` response with the database available.
2. Sign in with `analyst@traceframe.local` and the Render-only demo password.
3. Create a synthetic case and upload a small synthetic TXT file.
4. Confirm the source progresses to `ready` and observations appear.
5. Confirm an object exists in the private R2 bucket and review the worker log
   for a successful ingestion attempt.

Do not publish the demo password in the repository. Share it directly with a
reviewer or rotate it in Render; restarting the service applies the configured
password idempotently.

## Operating limits

- A cold start includes Neon wake-up, migrations, seeding, worker start, and web
  start. It is expected to be slower than the paid topology.
- The worker stops whenever the free web service sleeps. On the next request it
  restarts and safely recovers expired ingestion leases.
- Keep uploads within the existing 1 MiB application limit and stay within the
  provider dashboards' free usage allowances.
- Cloudflare requires an R2 subscription even when usage remains within its free
  allowance. Configure billing notifications and a small budget alert.
- Use the paid `render.yaml` profile when availability, independent scaling,
  managed backups, private networking, or operational guarantees matter.

Provider references: [Render free instances](https://render.com/docs/free),
[Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
[Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/),
and [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).
