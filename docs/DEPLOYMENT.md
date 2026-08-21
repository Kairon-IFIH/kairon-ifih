# KAIRON — Deployment

## 1. Current deployment (single EC2, automated)

One EC2 instance in `ap-south-1`, running three containers behind one Elastic
IP. Provisioned and managed entirely by `infra/aws/kairon.py` (boto3); deployed
on every push to `main` by `.github/workflows/deploy.yml`.

```
Internet
   │
   ▼  :80
┌──────────────────── EC2 t3.small (Amazon Linux 2023) ───────────────────┐
│                                                                          │
│   web  (nginx)  ──serves──►  built React SPA                             │
│        └── /api/*  ──proxy──►  api :3000  ──►  postgres :5432            │
│                                                    │                     │
│                                             pgdata volume (EBS)          │
└──────────────────────────────────────────────────────────────────────────┘
```

Only port 80 is published. The API and Postgres are reachable **only** on the
internal compose network — nginx is the single ingress. Port 22 is open to the
operator's IP only; GitHub Actions opens its runner's IP for the duration of a
deploy and revokes it in an `if: always()` step.

| Resource | Choice | Why |
|---|---|---|
| Compute | 1× EC2 t3.small, AL2023 | 2 GB RAM; images are built in CI, so the instance only pulls and runs. 2 GB swap added for deploy overlap |
| Ingress | Elastic IP + nginx :80 | Stable address across reboots; no ALB needed for one instance |
| Database | `postgres:16-alpine`, named volume on EBS | Survives `compose down`, redeploys and reboots — which is what makes seeded data hold |
| Registry | GHCR (`ghcr.io/<owner>/kairon-ifih-{api,web}`) | Free for private repos, and `GITHUB_TOKEN` already authenticates to it |
| AWS auth from CI | GitHub OIDC → scoped IAM role | No long-lived AWS keys in GitHub secrets |
| Secrets | Generated once by `provision`, written to `/opt/kairon/.env` (0600) | `JWT_SECRET` and the Postgres password never leave the instance or `.state.json` |

Cost: roughly **$17/month** (t3.small ~$15, 20 GB gp3 ~$1.60, Elastic IP free
while attached) — about 16 months on a $300 credit.

### Same-origin by design

`VITE_API_BASE_URL` is baked in at **build** time as the relative path
`/api/v1`, and nginx proxies that to the api container. Consequences worth
knowing: the browser never learns the instance IP, CORS never applies, and
changing the instance address needs no frontend rebuild.

### Commands

```bash
V=infra/aws/.venv/bin/python

$V infra/aws/kairon.py provision      # create everything (idempotent)
$V infra/aws/kairon.py github-oidc    # IAM role Actions can assume
$V infra/aws/kairon.py secrets        # push deploy secrets to the repo
$V infra/aws/kairon.py status         # what exists + health check
$V infra/aws/kairon.py logs api       # tail one service
$V infra/aws/kairon.py ssh            # shell on the instance
$V infra/aws/kairon.py deploy         # manual deploy, bypassing CI
$V infra/aws/kairon.py destroy        # remove everything, stop billing
```

### Migrations vs. seeding

`prisma migrate deploy` runs automatically on every deploy — schema must lead
the code that depends on it.

**Seeding does not run automatically, by design.** `npm run seed` truncates
every table before rebuilding, so wiring it into the push path would destroy
real data on every commit. To reseed deliberately:

- Actions → *Deploy to AWS* → **Run workflow** → tick `reseed`, or
- `$V infra/aws/kairon.py seed` (prompts for confirmation)

## 2. Production target (post-hackathon)

Matches `ARCHITECTURE.md` §10 — the shape to grow into when one instance is no
longer enough.

```
Internet → ALB → ECS Fargate (api, worker) → RDS PostgreSQL (private subnet)
                                            → ElastiCache Redis (private subnet)
                              S3 (audit evidence) · Secrets Manager · CloudWatch
```

| Resource | Trigger to build it |
|---|---|
| ECS Fargate | Once one instance can't absorb the traffic, or zero-downtime deploys are required |
| RDS PostgreSQL | Once losing the EBS volume becomes unacceptable — RDS gives automated backups and PITR |
| ElastiCache Redis | Once `apps/worker`'s BullMQ consumers are load-bearing (today `InMemoryEventPublisher` does this job) |
| S3 | Once `ExportAuditEvidenceUseCase` is implemented (currently `NotImplementedError`, Phase 6) |
| ALB + ACM | Once HTTPS and a real domain are needed — the current stack is HTTP on an IP |
| Terraform | Once `kairon.py` stops being enough to describe the infrastructure |

Estimated cost: ~$45–60/month (detailed in `ARCHITECTURE.md` §10.1).

### Known limitations of the current stack

Called out rather than hidden:

- **HTTP only.** No TLS — there's no domain yet. Credentials cross the network
  in the clear. Fix by pointing a domain at the Elastic IP and terminating TLS
  (ACM + ALB, or certbot in the nginx container).
- **Single point of failure.** One instance, one AZ. An instance failure is an
  outage; losing the EBS volume loses the data. No automated backups yet —
  `docker compose exec postgres pg_dump` is the manual stopgap.
- **`docs/CONVERSATION_TRANSCRIPT.md` and `docs/` generally are excluded from
  the image** via `.dockerignore`; nothing in `docs/` is served.
