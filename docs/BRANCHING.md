# Branching and release workflow

Traceframe uses trunk-based development with a protected `main` branch. A
branch is a line of source-code history; an environment is a running copy of
the system. Treating `development`, `test`, `production`, and `main` as four
long-lived branches would duplicate merge work and allow those histories to
drift.

## The model

| Concern | Traceframe practice |
| --- | --- |
| Development | A short-lived branch and the local Docker Compose stack |
| Test | GitHub Actions creates and verifies an isolated Compose stack for each pull request |
| Production | Render deploys the exact `main` commit only after required checks pass |
| Release history | Immutable Git tags such as `v0.2.0`, not a separate production branch |

Create branches from an up-to-date `main` using one of these prefixes:

- `feat/<short-description>` for product work.
- `fix/<short-description>` for defect fixes.
- `chore/<short-description>` for tooling and maintenance.
- `docs/<short-description>` for documentation-only work.
- `hotfix/<short-description>` for an urgent production repair.

Keep each branch focused, merge it through a pull request, and delete it after
the merge. Prefer squash merging so `main` remains linear and each pull request
becomes one intentional change.

## Normal delivery flow

1. Update local `main`, then create a short-lived branch.
2. Make a focused change and run proportionate local checks.
3. Push the branch and open a pull request into `main`.
4. Let the required `verify` check complete. Review the diff, security impact,
   migration compatibility, and operational impact—not only whether tests pass.
5. Squash-merge the pull request. Render waits for checks on `main`, runs the
   pre-deploy migration, and promotes the verified commit.
6. Run the production smoke checks and observe logs before considering the
   release complete.

Small, reversible pull requests are the primary risk-control mechanism. A
feature flag is appropriate when incomplete work must merge before it is safe
to expose; a long-lived integration branch is not a substitute.

## Recommended `main` protection

Configure the GitHub ruleset for `main` with:

- Pull requests required before merge.
- Required status check: `verify`, with the branch required to be up to date.
- Required conversation resolution and linear history.
- Force pushes and branch deletion blocked.
- Administrators included so emergency work remains visible and auditable.
- Zero required approvals while this is a solo project; change to one approval
  when a second maintainer can perform an independent review.

Allow squash merging and enable automatic source-branch deletion. Do not permit
routine direct pushes to `main`. Repository-owner bypass should be reserved for
a genuine incident and followed by a normal review.

## Releases, rollback, and hotfixes

Tag meaningful production points after a successful deployment. Application
rollback means redeploying a previously healthy commit. Database rollback is
different: migrations are forward-only, so take a managed PostgreSQL backup
before a risky schema change and use expand/migrate/contract changes that remain
compatible with both the old and new application during deployment.

For a hotfix, branch from current `main`, make the smallest safe repair, pass the
same pull-request checks, and merge normally. Skipping CI because a change is
urgent removes the evidence needed most during an incident.

## When staging becomes worthwhile

Add one `staging` environment only when Traceframe has multiple maintainers,
external integrations, scheduled releases, or changes that cannot be exercised
safely in CI. If that point arrives, use a dedicated Render environment and
database with synthetic data. A temporary pull-request preview is preferable
for UI review, but Render preview environments require a paid workspace and
create billable resources.
