# KAIRON — Implementation Roadmap (File-by-File)

Continues `docs/ARCHITECTURE.md` §11 down to file granularity, against the scaffold
generated in this pass (`packages/*`, `apps/*`). Every file below currently compiles
and every behavioral method in it throws `NotImplementedError` — this roadmap is the
literal checklist of what to replace, in what order, and why that order.

**Convention:** "fill in" means replace the `throw new NotImplementedError(...)` body
with the real logic; the method signature, its callers, and its DI wiring do not change.

---

## Phase 2 — Core Backend (Hackathon Cut: Hours 3–10)

Order matters — each step unblocks the next.

1. **Prisma schema** (new file, not yet created: `packages/*/prisma/schema.prisma` or a single root `prisma/schema.prisma` — pick one; a single root schema is simpler for a 22-hour build). Model the ER diagram from `ARCHITECTURE.md` §5.
2. `packages/shared-kernel/src/money.ts` — `Money.create/add/multiply/isGreaterThan`. Nothing downstream compiles meaningfully until currency-safe arithmetic exists.
3. `packages/identity/src/domain.ts` — `Organization.create`, `User.create`, `User.verifyPassword` (bcrypt), `Role.create`, `Role.hasPermission`, `Permission.create`, `Tenant.create`.
4. `packages/identity/src/infrastructure.ts` — `PrismaTenantRepository`, `PrismaUserRepository`, `PrismaRoleRepository` real Prisma calls, each still taking `TenantContext`/no-context appropriately (`findByEmail` is the one lookup that precedes having a tenant context — it's how login establishes one).
5. `apps/api/src/middleware/auth.middleware.ts` — `verifyAccessToken` (JWT verify), `requirePermission` (RBAC check against `PermissionCheckerService`).
6. `apps/api/src/middleware/tenant-context.middleware.ts` — `extractTenantContextFromVerifiedJwt`.
7. `packages/identity/src/application.ts` — `LoginUseCaseImpl.execute`, `RefreshTokenUseCaseImpl.execute` (rotation + reuse detection per `ARCHITECTURE.md` §9).
8. `packages/asset/src/domain.ts` — `Criticality.create`, `DataClassification.create`, `RegulatoryScope.create` (stub scope until Phase 4), `Asset.create` (raises `AssetDiscovered`), `Asset.classify` (raises `AssetClassified`).
9. `packages/asset/src/infrastructure.ts` — `PrismaAssetRepository`.
10. `packages/asset/src/application.ts` — `CreateAssetUseCaseImpl`, `ListAssetsUseCaseImpl`, `ImportAssetsFromCsvUseCaseImpl` (manual/CSV ingestion — this is the entire "Asset Discovery" hackathon cut per `ARCHITECTURE.md` §1.13; do not build a live scanner).
11. `packages/audit/src/domain.ts` + `infrastructure.ts` — `AuditEvent.record`, `ActorRef.create`, `BeforeAfterDiff.create`, `PrismaAuditEventRepository.append/findByEntity/findByDateRange`. Also apply the DB-level `REVOKE UPDATE, DELETE` grant from `ARCHITECTURE.md` §5.4 in the migration, not just in application code.
12. `packages/audit/src/application.ts` — `RecordAuditEventUseCaseImpl.execute`.
13. `apps/worker/src/main.ts` — confirm the audit consumer path end-to-end against a real Redis (containerized per `ARCHITECTURE.md` §10.1).

**Checkpoint:** you should be able to log in, create/list/import assets, and see an `AuditEvent` row for each. Everything past here (Compliance/Risk/Financial/Quantum) reads Asset data, so this phase is the hard dependency for all of them.

---

## Phase 3 — Risk Engine (Hackathon Cut: Hours 10–13)

1. `packages/risk/src/domain.ts` — `Likelihood.create` (reject outside [0,1]), `Impact.create`, `RiskScore.calculate` (`Risk = Likelihood × Impact`, control-effectiveness discount → Residual), `RiskFactor.create`, `Risk.create` (raises `RiskCalculated`).
2. `packages/risk/src/infrastructure.ts` — `PrismaRiskRepository`.
3. `packages/risk/src/application.ts` — `CalculateRiskForAssetUseCaseImpl`, `ListRisksUseCaseImpl`. Wire the real `RiskScoringService` implementation (currently stubbed inline in `apps/api/src/main.ts` — replace that inline object with a real class).
4. `packages/financial/src/domain.ts` — `ExpectedLoss.create`, `RemediationCost.create`, `ResidualRisk.create`, `FinancialExposure.create` (raises `FinancialExposureQuantified`). **Before writing this file**, resolve Architecture Decision #6 (loss-model source) — this file is where that decision becomes code.
5. `packages/financial/src/infrastructure.ts` — `PrismaFinancialExposureRepository`.
6. `packages/financial/src/application.ts` — `QuantifyExposureUseCaseImpl`.

**Checkpoint:** an asset can produce a Risk row and a FinancialExposure row with a real ₹ number behind it, end to end, no hardcoded demo numbers.

---

## Phase 4 — Compliance Engine (Hackathon Cut, thin: Hours 13–15, parallel with Phase 3 if split across teammates)

1. Seed data (script or SQL, not a package file) for the 1–2 frameworks chosen per Architecture Decision #7 — e.g. DPDP + ISO27001 — as static `Framework`/`Regulation`/`Control`/`Requirement` rows.
2. `packages/compliance/src/domain.ts` — `Requirement.create`, `Control.create`, `Regulation.create`, `Framework.create`, `GapStatus.create`, `Evidence.create`, `ComplianceMapping.create` (raises `ComplianceMapped`).
3. `packages/compliance/src/infrastructure.ts` — `PrismaFrameworkRepository`, `PrismaComplianceMappingRepository`.
4. `packages/compliance/src/application.ts` — `MapAssetToControlUseCaseImpl`, `RunGapAnalysisUseCaseImpl`, `GetTraceabilityUseCaseImpl` — this is what makes the regulation→clause→control traceability claim in `ARCHITECTURE.md` §1.7 real. Wire the real `RegulatoryTraceabilityService` (replace the `async () => []` stub in `apps/api/src/main.ts`).

**Do not** attempt live regulatory-text parsing or an AI-drafted mapping tonight — that is explicitly Phase 6 (`ARCHITECTURE.md` §1.13).

---

## Phase 5 — Quantum Optimization (Hackathon Cut: Hours 13–18 — protect this block, it's the highest-differentiation deliverable)

1. `apps/quantum-runner/` — build the Python side per its own README: QUBO formulation → classical baseline → QAOA (Qiskit/PennyLane simulator) → HTTP wrapper matching the documented JSON contract exactly. This can start in parallel with step 1 of Phase 3/4 since it only depends on the *shape* of candidate actions, not real data.
2. `packages/quantum/src/domain.ts` — `ObjectiveFunction.default`, `BudgetConstraint.create`, `OptimizationConstraint.create`, `OptimizationResult.create`, `OptimizationJob.create`, `OptimizationJob.complete` (raises `OptimizationExecuted`).
3. `packages/quantum/src/infrastructure.ts` — `PrismaOptimizationJobRepository`, and `HttpQuantumSolverGateway.submitJob`/`getResult` calling the now-real `apps/quantum-runner`.
4. `packages/quantum/src/application.ts` — `CreateOptimizationJobUseCaseImpl`, `GetOptimizationResultUseCaseImpl`.
5. `packages/notification/src/domain.ts` + `application.ts` + `infrastructure.ts` — `Notification.create/markRead`, the three use cases, `PrismaNotificationRepository`. This is also where a Hybrid-track second "agent" (an Audit/Verification agent gating `RemediationApproved`) would live, if Architecture Decision #2 goes that way.

**Checkpoint:** `POST /api/v1/optimization-jobs` → 202 with a job id → `GET /api/v1/optimization-jobs/:id` eventually returns a real `OptimizationResult` with both quantum and classical numbers, sourced from real Asset/Risk/Financial data, not fixtures.

---

## Phase 6 — Production Readiness (post-hackathon, Startup Ideation Program timeline)

Not a hackathon deliverable. When you get here:

- Postgres RLS policies underneath every tenant-scoped table (`ARCHITECTURE.md` §4.1) — pulled forward per Architecture Decision #4 if the founders prioritized it.
- `packages/audit/src/application.ts` → `ExportAuditEvidenceUseCaseImpl` (S3 export).
- `packages/compliance` — AI-drafted regulation→control mapping, regulation versioning, additional frameworks.
- Real asset-discovery connectors (AWS/Azure/GCP) replacing the Phase 2 CSV import.
- Test suites (Jest/Supertest) to 80% coverage per `BACKEND.md`, mocking Redis/Quantum/external APIs.
- Terraform/CDK for the AWS architecture in `ARCHITECTURE.md` §10, CI/CD via GitHub Actions.
- Secrets Manager migration off SSM Parameter Store once rotation automation is a real requirement.
- Insurance Intelligence layer, Quantum Readiness (PQC) module — both explicitly future scope in `IDEA.md`.

---

## What this roadmap deliberately does not cover

Anything not listed above (docker-compose, `.env.example`, CI config, the Prisma schema file itself) has not been generated yet — it is scoped out of this pass, not forgotten. Generate it when Phase 2 step 1 is actually being worked, so it's written against the real, current ER design rather than guessed in advance.
