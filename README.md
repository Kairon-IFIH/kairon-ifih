# KAIRON — Repository Structure

This is a scaffold, generated from `docs/ARCHITECTURE.md`. It defines packages, bounded-context
modules, and interfaces. **No business logic is implemented yet.**

See `docs/IMPLEMENTATION_ROADMAP.md` for the file-by-file build order.

## Layout

```
docs/                       architecture + product source-of-truth docs
packages/
  shared-kernel/            Entity/AggregateRoot/ValueObject/DomainEvent base classes, Result, Money, TenantContext, branded IDs, domain errors
  event-contracts/          Domain event payload types + queue name mapping (BullMQ)
  api-contracts/            Response envelope, pagination, Zod request/query schemas
  identity/                 Bounded context: Tenant, Organization, Department, User, Role, Auth
  asset/                    Bounded context: Asset, AssetOwner, BusinessService
  compliance/               Bounded context: Framework, Regulation, Control, Requirement, ComplianceMapping
  risk/                     Bounded context: Risk, RiskFactor, RiskScore
  financial/                Bounded context: FinancialExposure, ExpectedLoss, RemediationCost, Q-Risk
  quantum/                  Bounded context: OptimizationJob, OptimizationConstraint, OptimizationResult
  audit/                    Bounded context: AuditEvent (append-only)
  notification/             Bounded context: Notification (HITL / job-complete alerts)
apps/
  api/                      Express composition root (HTTP)
  worker/                   BullMQ consumer composition root
  quantum-runner/           Python/Qiskit-PennyLane sidecar (separate runtime, contract only)
```

## Running it right now

`npm install`, then `npm run typecheck --workspaces` (all 13 packages pass clean), then
`npm run dev --workspace @kairon/api`. The server boots and every route responds with a
correctly typed `{success:false,message:"Not implemented: ...",errors:[]}` — the whole
request pipeline (Zod validation → auth middleware → tenant-context middleware → use case
→ centralized error handler) already works end to end; only the behavior inside each
`NotImplementedError` throw is missing. `tsconfig.base.json` sets `noEmit: true` for now —
`tsx` is what actually runs the apps in dev; wiring a real `tsc`/project-references build
for `dist/` output is a Phase 2 tooling decision, not an architectural one.

## Conventions used throughout this scaffold

- Each bounded-context package follows Clean Architecture: `domain.ts` → `application.ts` → `infrastructure.ts` → `presentation.ts`. Dependencies only point inward (presentation/infrastructure depend on domain; domain depends on nothing outside `shared-kernel`/`event-contracts`).
- Every entity/value object exposes a `static create(...)` factory. In this scaffold, factories and every domain-service/use-case method body throw `NotImplementedError('<what>, see ARCHITECTURE.md §<section>, Phase <n>')` rather than containing logic — the shape and dependency graph are real, the behavior is not.
- Repository interfaces live in `domain.ts`; their Prisma-backed implementations live in `infrastructure.ts` as stub classes (no live Prisma calls yet).
- `AuditEventRepository` intentionally exposes no `update`/`delete` methods — this is structural, not a convention to remember.
- All tenant-scoped repository methods take a `TenantContext` (from `@kairon/shared-kernel`) as their first parameter — never optional.

## Contributors

Thanks to everyone who has contributed to this project:

- [R0h1tAnand](https://github.com/R0h1tAnand) — Architecture, domain modelling, infrastructure scaffolding
- [sanaysarthak](https://github.com/sanaysarthak) — Architecture review, bounded-context design
