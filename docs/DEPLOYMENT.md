# KAIRON — Deployment Architectures

## 1. Hackathon Deployment (today)

The current MVP (`apps/api`) runs entirely on in-memory repositories and an
in-memory event publisher (see `apps/api/src/main.ts`) — no Postgres, no
Redis, no queue infra is actually required for the demo to work. That
collapses the AWS footprint from `ARCHITECTURE.md` §10 down to one thing.

```
Internet → EC2 (t3.micro, public subnet, Docker) → apps/api container :3000
```

| Resource | Choice | Why |
|---|---|---|
| Compute | 1x EC2 t3.micro, Amazon Linux 2023 | Free Tier eligible; `Dockerfile` + `infra/aws/ec2-user-data.sh` bring it up unattended |
| Networking | Default VPC, security group open on 80/443 + 22 (your IP only) | No ALB needed for one instance |
| Secrets | SSM Parameter Store, `/kairon/jwt-secret` (SecureString) | Free; script falls back to a dev secret if unset so the demo never blocks |
| Database | **None** | In-memory repos are the actual Phase-"right now" persistence (`README.md`) |
| Queue/Cache | **None** | `InMemoryEventPublisher` stands in for BullMQ/Redis |
| Monitoring | EC2 default CloudWatch (free tier) | Sufficient for a 22-hour build |

Estimated cost: **$0–3 for the entire hackathon** (t3.micro Free Tier, or a few cents/hour if outside it). Data is lost on restart — acceptable for a demo, called out explicitly, not hidden.

## 2. Production Deployment (post-hackathon)

Matches `ARCHITECTURE.md` §10 exactly — this is the target once Phase 2 swaps
the in-memory repos for the `PrismaX*` implementations that already sit next
to them in every package's `infrastructure.ts`.

```
Internet → ALB → ECS Fargate (apps/api, apps/worker) → RDS PostgreSQL (private subnet)
                                                      → ElastiCache Redis (private subnet)
                                        S3 (audit evidence) · SSM/Secrets Manager · CloudWatch
```

| Resource | Choice | Trigger to build it |
|---|---|---|
| Compute | ECS Fargate, 2 services (api, worker) | Once `dist/` build pipeline replaces `tsx` (Phase 2 tooling) |
| Database | RDS PostgreSQL, single-AZ → Multi-AZ | Once Prisma repos replace InMemory ones |
| Cache/Queue | ElastiCache Redis | Once `apps/worker`'s BullMQ consumers are load-bearing (currently `InMemoryEventPublisher` does this job) |
| Storage | S3 | Once `ExportAuditEvidenceUseCase` is implemented (currently `NotImplementedError`, Phase 6) |
| Secrets | AWS Secrets Manager | Once automatic rotation is a real requirement |
| Networking | VPC, private subnets for RDS/Redis, ALB for ingress | Once more than one EC2 instance needs to share a database |
| IaC | Terraform | Once the manual `ec2-user-data.sh` step needs to be reproducible/team-shared |

Estimated cost: ~$45–60/month (detailed in `ARCHITECTURE.md` §10.1) — comfortably inside the $300 credit budget for months of iteration.

---

## Deploy This First

1. Push this repo to GitHub (or update the URL in `infra/aws/ec2-user-data.sh`).
2. Create an SSM SecureString parameter `/kairon/jwt-secret` with a real random value.
3. Launch 1x EC2 t3.micro (Amazon Linux 2023, default VPC, security group: 80/443 open, 22 restricted to your IP), pasting `infra/aws/ec2-user-data.sh` into the instance's User Data field.
4. Attach an IAM instance role with `ssm:GetParameter` on `/kairon/jwt-secret` (nothing else).
5. Wait ~2 minutes for boot, then hit `http://<instance-public-ip>/api/v1/auth/login` with the seeded demo credentials printed in the container logs (`docker logs kairon-api`).

That's it — no RDS, no ElastiCache, no ALB, no Terraform for day one.
