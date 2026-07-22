# Production deployment

Traceframe's production topology is defined in the repository by
[`render.yaml`](../render.yaml). Render is the deployment controller and GitHub
Actions is the release gate: Render deploys a `main` commit only after its
checks pass.

## Hosted topology

```text
Internet
   |
   | HTTPS (Render TLS)
   v
Next.js web service ---- private network ---- Render PostgreSQL
          |                                      ^
          v                                      |
  private MinIO service <---------------- Python worker
    persistent disk
```

- `traceframe-web` is the only public service.
- `traceframe-worker` and `traceframe-minio` are private Render services.
- `traceframe-db` is managed PostgreSQL with public access disabled.
- The web and worker images contain the migration runner. A PostgreSQL advisory
  lock serialises concurrent pre-deploy attempts and each migration is rechecked
  inside its transaction.
- The web pre-deploy step also creates the synthetic demo identity
  idempotently. Its password is a Render secret and is never committed.

The Render Blueprint intentionally uses paid Starter services and a paid
database. Free PostgreSQL expires after 30 days and has no backups, so it is not
a production choice. Verify Render's current estimate before approving the
Blueprint; the defined web, worker, database, private MinIO service, and 10 GB
disk are expected to be roughly US$30/month before bandwidth and other usage.

## First deployment

1. Merge the deployment files into the protected `main` branch and confirm the
   GitHub `verify` check passes.
2. In Render, create a new Blueprint from the Traceframe GitHub repository.
3. Review every proposed resource, the Frankfurt region, plans, and monthly
   estimate before applying it.
4. Set `AUTH_DEMO_PASSWORD` to a strong, unique synthetic-demo password when
   Render prompts for the unsynchronised secret. Do not reuse the local fixture.
5. Apply the Blueprint and wait for PostgreSQL, MinIO, worker, migration, and web
   deployment to become healthy.
6. Record the generated `https://traceframe-web.onrender.com` URL, or the exact
   Render-assigned alternative, in the project README after the first successful
   deployment.

Render supplies TLS and the service `PORT`. `AUTH_COOKIE_SECURE=true` is fixed in
the Blueprint. Database, MinIO credentials, and the authentication throttle key
are generated or connected through Render environment references rather than
stored in Git.

## Release gate and smoke checks

The stable GitHub check name is `verify`. It runs linting, unit tests, production
builds, dependency audits, all three Render Docker builds, and the containerised
Playwright integration suite. Failed runs upload Compose and Playwright
diagnostics and always remove their isolated volumes.

After each production deployment:

1. Confirm `GET /api/health` returns `200` over HTTPS.
2. Sign in with the synthetic demo identity.
3. Open the dashboard and one case.
4. Create a synthetic case and upload a small synthetic text source.
5. Confirm the worker moves the source to `ready` and observations appear.
6. Review Render web and worker logs for correlated errors without copying
   secrets or source content into an incident record.

Automate this smoke path later with a dedicated low-privilege synthetic account.
Do not run destructive end-to-end tests against persistent production records.

## Data safety and rollback

Enable the managed PostgreSQL retention available on the selected plan and test
a restore before relying on it. Take a manual recovery point before a risky
schema deployment. Migrations are immutable and forward-only; use
expand/migrate/contract changes and a reviewed corrective migration where a
restore is not appropriate.

Render persistent disks provide snapshots, but a disk-backed service is tied to
one instance and cannot provide zero-downtime multi-instance deployment. That is
acceptable for this synthetic portfolio workload, not for irreplaceable
evidence. Before handling higher availability or meaningful retention needs,
move source objects to a managed S3-compatible store with independent versioning
and lifecycle policy, then perform and document a restore drill.

To roll back application code, redeploy the last healthy Render commit only when
its schema remains compatible. If a migration changed the schema incompatibly,
follow the migration recovery plan instead of blindly reverting the container.

## Operational follow-up

- Add external uptime monitoring for `/api/health` and alerts for repeated
  worker failures or ingestion backlog growth.
- Add a scheduled authenticated production smoke test using synthetic data.
- Establish PostgreSQL and object-store restore objectives and test them.
- Add a custom domain only after ownership and DNS are stable.
- Consider a separate staging environment only when its cost buys a concrete
  release-safety benefit.

Render references: [Blueprint specification](https://render.com/docs/blueprint-spec),
[deploys and checks](https://render.com/docs/deploys),
[private services](https://render.com/docs/private-services), and
[persistent disks](https://render.com/docs/disks).
