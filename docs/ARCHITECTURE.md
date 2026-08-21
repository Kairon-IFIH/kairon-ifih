# KAIRON — Architecture Discovery & Planning Document

**Status:** Pre-implementation. No code has been written against this document.
**Author role:** Lead Architect / Founding CTO pass
**Source of truth documents:** `BACKEND.md`, `IDEA.md`, `Hackathon-Briefing-Document.md`

---

## 0. Reality Check Before Anything Else

Two of your source documents are, honestly, in tension, and I'm not going to paper over it:

- **BACKEND.md** specifies a production-grade, bank-suitable enterprise platform: strict Clean Architecture/DDD, 80% test coverage, full RBAC, audit trail on every mutation, encryption at rest/in transit, secret rotation, multi-AZ-capable Postgres, event-driven microservice-ready boundaries.
- **Hackathon-Briefing-Document.md** gives you a **22-hour build window**, explicitly rewards *"a rough demo with a sharp, honest business case"* over polish, explicitly says UI can be a CLI, and explicitly warns that judges penalize teams who "confuse tonight's prototype with the actual product."

Building the literal BACKEND.md spec in 22 hours is not possible, and attempting it is a judging risk, not just a time-management risk — Section 11 of the brief guarantees you'll be asked *"what would break first if you tried to sell this to a real bank next week?"* The right answer to that question is **"the parts we deliberately mocked, and here's the list"** — not a scramble to defend a half-finished RBAC system.

So this document does two things simultaneously:
1. Designs the **full target architecture** (what BACKEND.md asks for — this is what you'd build as the actual company).
2. Explicitly marks, throughout, what is **Hackathon-Cut** (build tonight) vs **Post-Hackathon** (roadmap), so the same document survives the 22-hour build *and* becomes your real engineering spec afterward.

This reconciliation itself is Architecture Decision #1 — see the approval list at the end.

---

## 1. Requirements Extraction

### 1.1 Business Objective
Answer one executive question continuously and defensibly: *given limited budget and headcount, which remediation actions maximize reduction in financial risk exposure, under regulatory and operational constraints?* KAIRON is a **decision layer**, not a detection tool — it assumes asset/vulnerability data exists (discovered or ingested) and adds quantification + optimization + audit-grade justification on top.

### 1.2 User Personas / Buyers
| Persona | Role | What they want from KAIRON |
|---|---|---|
| CISO | Buyer, primary sponsor | Defensible prioritization, board-ready Q-Risk metric |
| CRO | Buyer | Financial exposure numbers, not CVSS scores |
| Compliance Head | Buyer/user | Regulation → control → evidence traceability |
| Security Analyst | Daily user | Asset/risk worklist, remediation queue |
| Risk Officer | Daily user | Residual risk tracking over time |
| Auditor (internal/external/regulator) | Read-only consumer | Immutable audit trail, evidence export |
| Executive/Board | Periodic consumer | Q-Risk score, optimization output summary |

For the hackathon specifically: name **one** persona precisely — e.g. *"Head of Cyber Risk & Compliance at a GIFT City IFSC Banking Unit (IBU)"* — per Section 10 scoring ("Customer specificity").

### 1.3 Financial Institution Stakeholders
Banks, FinTechs, Insurance companies, IFSCA-regulated entities, GIFT City IBUs. Insurance is explicitly a **future** revenue layer (underwriting intelligence), not MVP.

### 1.4 Core Workflow (must be structurally visible in every module)
```
Asset Discovery → Asset Classification → Regulatory Mapping → Risk Identification
→ Financial Quantification → Remediation Generation → Quantum Optimization
→ Executive Decision Support
```

### 1.5 Functional Requirements (from BACKEND.md + IDEA.md)
- Asset inventory with enrichment (owner, criticality, data classification, regulatory scope)
- Regulatory knowledge base (DPDP, GDPR, DORA, NIST, ISO27001) with control mapping and versioning
- Risk scoring: `Risk = Likelihood × Impact`, producing Inherent/Residual risk and Risk Level
- Financial quantification: Expected Annual Loss, Financial Exposure, Regulatory Penalty Exposure
- Remediation action catalog with cost/time/risk-reduction/dependency metadata
- Quantum (QUBO/QAOA) optimization to select remediation portfolio under budget + constraints
- Q-Risk composite score (0–100) for executive reporting
- Full audit trail on every state-changing action
- Multi-tenant SaaS with tenant/org/department/user/role hierarchy

### 1.6 Non-Functional Requirements
Security, auditability, regulatory defensibility, horizontal scalability, multi-tenancy, observability, maintainability (Clean Architecture boundaries), extensibility toward microservice extraction, 80% test coverage target (post-hackathon).

### 1.7 Regulatory Requirements
Every system recommendation must be traceable to **regulation → clause → control → evidence**. This is a hard constraint on the data model (Section 5), not just a UI feature — if the join path Regulation→Control→Asset doesn't exist relationally, the traceability claim is fiction.

### 1.8 Quantum Optimization Requirements
Strictly scoped to **one problem**: select a subset of remediation actions minimizing residual financial risk subject to budget/dependency/regulatory-mandatory constraints. Explicitly **not** used for auth, CRUD, or compliance logic (BACKEND.md is explicit and correct on this — resist scope creep here, it's a common judge trap in Track 2/Hybrid).

### 1.9 Multi-Tenant Requirements
Tenant isolation is non-negotiable for a system that will eventually hold real bank risk data. Every query must carry tenant context; cross-tenant leakage is a platform-ending bug for a company selling to regulated financial institutions, not a bug you patch later.

### 1.10 Security Requirements
JWT + refresh tokens, RBAC, MFA-ready, audit logging, rate limiting, Zod validation everywhere, Helmet, CORS, bcrypt, no plaintext secrets/PII in logs, no internal error leakage.

### 1.11 AWS Deployment Constraints
Hard budget: **$300 total credits**, must last through MVP + hackathon + a reasonable post-hackathon runway. This constrains compute (no multi-AZ RDS, no NAT Gateway sprawl, no always-on Fargate over-provisioning) — detailed in Section 10.

### 1.12 Hackathon Judging Criteria (drives what "MVP scope" means)
Technical execution 25%, Problem clarity 15%, Innovation 20%, Market viability 15%, Presentation 15%, Team assessment 10% (R1). R2 adds founder assessment weighted heavily. Track fit: this idea is architecturally **Hybrid** (an agentic/decision-support execution layer *plus* a genuine quantum-classical optimization benchmark) — you should declare Hybrid only if you can show both a working QAOA-vs-classical comparison **and** at least 2 interacting agents/services with a guardrail. If time is short, declaring **Track 2 (Quantum)** and treating the "agent" layer as a thin decision-support UI is the lower-risk choice, since Track 2 judging tolerates a longer commercial runway.

### 1.13 MVP Scope vs Future Enterprise Scope
| In MVP (hackathon-buildable) | Deferred (roadmap) |
|---|---|
| Manual/CSV asset ingestion (not live discovery agents) | Live asset discovery connectors (AWS/Azure/GCP scanners) |
| 1–2 hardcoded regulatory frameworks, static control mapping table | Full regulatory knowledge graph with versioning + AI-drafted mapping |
| Risk score = Likelihood × Impact with simple control-effectiveness factor | Full actuarial loss models, historical incident calibration |
| QUBO formulation solved via Qiskit/PennyLane simulator (QAOA) + classical brute-force/greedy baseline for comparison chart | Real quantum hardware, VQE, quantum annealing, PQC readiness module |
| Single Postgres schema with `tenant_id` column isolation | Schema-per-tenant / RLS, insurance intelligence layer |
| JWT auth + basic RBAC (2–3 roles) | Full MFA, secret rotation automation, SSO/SAML |
| Structured logs to console/CloudWatch | Full SIEM-grade audit analytics |

---

## 2. Product Architecture Blueprint

```
                                   ┌────────────────────────────┐
                                   │        FRONTEND            │
                                   │  Next.js / CLI (hackathon)  │
                                   │  Executive Dashboard, Q-Risk│
                                   └──────────────┬─────────────┘
                                                  │ HTTPS (JWT Bearer)
                                                  ▼
                                   ┌────────────────────────────┐
                                   │      API GATEWAY LAYER      │
                                   │  Express.js + ALB           │
                                   │  - AuthN/AuthZ middleware   │
                                   │  - Tenant context injection │
                                   │  - Rate limiting, Helmet    │
                                   └──────────────┬─────────────┘
                                                  │
              ┌───────────────┬───────────────────┼───────────────────┬───────────────┐
              ▼               ▼                   ▼                   ▼               ▼
        ┌──────────┐   ┌────────────┐     ┌──────────────┐    ┌──────────────┐  ┌───────────┐
        │  Auth &   │   │   Asset    │     │  Compliance   │    │     Risk      │  │ Financial │
        │ Identity  │   │  Service   │     │   Service     │    │   Service     │  │  Service  │
        │ Service   │   │            │     │ (Regulatory   │    │               │  │           │
        │           │   │            │     │ Intelligence) │    │               │  │           │
        └─────┬─────┘   └─────┬──────┘     └───────┬───────┘    └───────┬──────┘  └─────┬─────┘
              │               │                    │                    │               │
              └───────────────┴─────────┬──────────┴────────────────────┴───────────────┘
                                         │  (all writes emit domain events)
                                         ▼
                              ┌─────────────────────┐
                              │   EVENT BUS / QUEUE   │
                              │  BullMQ (Redis-backed)│
                              └──────────┬───────────┘
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
             │   Audit     │     │   Quantum      │     │ Notification  │
             │  Service     │     │  Optimization  │     │   Service      │
             │ (consumer,   │     │   Service      │     │ (consumer)     │
             │ append-only) │     │ (Qiskit/       │     │               │
             │              │     │  PennyLane)    │     │               │
             └──────┬──────┘     └───────┬────────┘     └───────────────┘
                    │                     │
                    ▼                     ▼
           ┌─────────────────┐   ┌────────────────┐
           │  AUDIT STORE     │   │  Job Results    │
           │  (append-only    │   │  → Financial     │
           │  Postgres table  │   │  Service reads   │
           │  + S3 export)    │   │  back            │
           └─────────────────┘   └────────────────┘

        ┌───────────────────────────────────────────────────────────────┐
        │                     SHARED INFRASTRUCTURE                       │
        │  PostgreSQL (RDS)  |  Redis (ElastiCache/container)             │
        │  S3 (evidence, reports, exports)  |  Secrets Manager/SSM        │
        │  CloudWatch (logs, metrics, alarms)                              │
        └───────────────────────────────────────────────────────────────┘
```

**Component explanations:**
- **Frontend** — thin presentation layer; never contains business logic; talks only to the API Gateway layer. Hackathon: a Next.js dashboard or even a CLI is acceptable per the brief.
- **API Gateway Layer (Express)** — the *only* Presentation-layer component in Clean Architecture terms. Owns HTTP concerns: parsing, auth middleware, tenant context extraction, validation invocation, response shaping. Contains **zero** domain logic.
- **Service layer (Auth, Asset, Compliance, Risk, Financial)** — each wraps an Application layer (use cases/orchestration) around a Domain layer (entities, value objects, domain services) around a Repository interface implemented by Infrastructure (Prisma). This is the DDD/Clean Architecture core — detailed in Section 3.
- **Event Bus (BullMQ/Redis)** — decouples write-side services from side effects (audit logging, notifications, optimization triggering). This is what lets you later extract any service into its own microservice without a rewrite — the event contracts *are* the future service boundaries.
- **Audit Service** — a pure consumer; appends to an append-only audit table. Deliberately **not** allowed to fail the primary transaction if it lags (eventual consistency for audit is acceptable; audit *loss* is not — see Section 8 delivery guarantees).
- **Quantum Optimization Service** — isolated because it has a fundamentally different runtime profile (long-running, CPU/simulator-bound, potentially calls out to Qiskit/PennyLane Python runtime via a job queue) — it should never sit in the request/response path of a user-facing API call.
- **Financial Service** — the aggregation point: reads Risk Service output + Quantum Service output to produce Expected Loss / Residual Exposure figures.
- **Notification Service** — consumer for HITL-style workflows (e.g., "optimization job complete, review required" — this is also your natural home for a Hybrid-track "agent" story if you go that route: an Execution Agent proposes, a human or Audit/Verification Agent signs off).

---

## 3. Domain-Driven Design Analysis

### 3.1 Bounded Contexts
| Context | Owns | Why separate |
|---|---|---|
| **Identity & Access** | User, Role, Permission, Tenant, Organization | Auth concerns change for entirely different reasons (security patches, SSO integration) than risk logic; must be reusable across every other context |
| **Asset Discovery** | Asset, AssetOwner, AssetType, BusinessService | Asset lifecycle is independent of how it's later scored or regulated |
| **Regulatory Intelligence** | Framework, Regulation, Control, Requirement, Evidence | Regulatory content changes on its own calendar (new circulars) independent of any tenant's assets |
| **Risk Intelligence** | Risk, RiskFactor, RiskExposure, RiskScore | Risk modeling logic (likelihood × impact, control effectiveness) is a distinct discipline from compliance mapping |
| **Financial Quantification** | FinancialExposure, ExpectedLoss, RemediationCost, ResidualRisk | Converts technical/regulatory risk into currency — a translation layer with its own models (loss curves, penalty tables) |
| **Quantum Optimization** | OptimizationJob, OptimizationConstraint, OptimizationResult | Fundamentally a different computational paradigm (QUBO solving); must be swappable (QAOA today, VQE/annealing later) without touching any other context |
| **Audit** | AuditEvent | Must be structurally incapable of being bypassed — treated as cross-cutting infrastructure consumed by every context, not a peer domain |

Each bounded context maps 1:1 to a "Service" in Section 6 — this is deliberate, not incidental.

### 3.2 Aggregates, Entities, Value Objects
| Context | Aggregate Root | Entities inside | Value Objects |
|---|---|---|---|
| Identity | Tenant | Organization, User, Role | Permission (immutable set), TenantId |
| Asset Discovery | Asset | AssetOwner (ref), BusinessService (ref) | Criticality (enum+weight), DataClassification, RegulatoryScope (set) |
| Regulatory | Framework | Regulation, Control, Requirement | ClauseReference, ControlMaturityLevel |
| Compliance (mapping) | ComplianceMapping | Evidence | GapStatus |
| Risk | Risk | RiskFactor | Likelihood (0-1 scaled), Impact (currency-scaled), RiskScore (derived, immutable once calculated) |
| Financial | FinancialExposure | ExpectedLoss, RemediationCost | Money (currency + amount, never a bare float), ResidualRisk |
| Quantum | OptimizationJob | OptimizationConstraint, OptimizationResult | ObjectiveFunction, BudgetConstraint |
| Audit | AuditEvent | — (audit events are immutable, never modified in place) | ActorRef, BeforeAfterDiff |

**Why Value Objects matter here specifically:** `Money` must never be a raw `number` — a financial risk platform that lets currency arithmetic silently mix INR/USD or lose precision to floating point is a credibility-ending bug in front of a bank. Same logic for `Likelihood`/`RiskScore` — these must be constructed through validated factory methods, never assigned directly, so an invalid risk score (e.g., > 1.0 likelihood) is a compile-time/construction-time impossibility, not a runtime bug someone finds in production.

### 3.3 Domain Events (see also Section 8)
`AssetDiscovered`, `AssetClassified`, `ComplianceMapped`, `RiskCalculated`, `FinancialExposureQuantified`, `RemediationGenerated`, `OptimizationExecuted`, `RemediationApproved`.

### 3.4 Repositories
One repository interface per aggregate root, defined in the Domain layer, implemented in Infrastructure via Prisma: `AssetRepository`, `RiskRepository`, `ComplianceMappingRepository`, `FinancialExposureRepository`, `OptimizationJobRepository`, `AuditEventRepository` (append-only — no `update`/`delete` methods exposed, by design, not just by convention).

### 3.5 Domain Services (logic that doesn't belong to a single entity)
- `RiskScoringService` — computes `Risk = Likelihood × Impact` and applies control-effectiveness discount to derive Residual Risk. Pure function of its inputs; no I/O.
- `QRiskAggregationService` — combines asset coverage, control maturity, compliance coverage, financial exposure into the single 0–100 Q-Risk metric.
- `RegulatoryTraceabilityService` — walks Regulation→Control→Asset graph to answer "why was this recommended" (this is what makes the traceability claim in Section 1.7 real rather than marketing).

---

## 4. Multi-Tenant Strategy

### 4.1 Isolation Model
**MVP:** Row-level isolation via a mandatory `tenant_id` column on every tenant-scoped table, enforced at the Repository layer (never trust a controller or service to remember it). **Every** repository method signature takes a `TenantContext` as its first parameter — not optional, not defaulted — so it is structurally impossible to write a query that omits tenant filtering.

**Post-hackathon hardening:** PostgreSQL Row-Level Security (RLS) policies as a second, defense-in-depth layer beneath the application-level filter — so a bug in application code cannot leak cross-tenant rows even if the `tenant_id` filter is accidentally dropped from one query. This is the single highest-leverage security investment for a fintech-facing product and should be prioritized early post-hackathon (Phase 6, but pull forward if the founders judge it worth the effort — flagged in the approval list).

**Enterprise future:** schema-per-tenant or database-per-tenant for institutions with contractual data-residency/isolation requirements (some banks will require this contractually, not just technically) — the aggregate/repository design above is deliberately compatible with this migration without a domain rewrite.

### 4.2 Authorization Model / RBAC Hierarchy
```
Tenant
 └── Organization (e.g., a banking group's IFSC entity)
      └── Department (e.g., "Trade Finance Ops", "InfoSec")
           └── User ── has one or more Role
                         Role ── has many Permission (resource:action pairs)
```
Baseline roles for MVP: `TenantAdmin`, `ComplianceOfficer`, `RiskAnalyst`, `Auditor` (read-only, cannot mutate anything — enforced at the permission level, not just UI hiding).

### 4.3 Tenant Context Propagation
JWT carries `tenantId`, `organizationId`, `userId`, `roles` as claims. An Express middleware (first in the chain, before any route logic) extracts this into an `AsyncLocalStorage`-scoped `TenantContext` object, which is what gets threaded into every Application-layer use case and Repository call. No handler ever reads `tenantId` from `req.body` or `req.query` — accepting tenant identity from client-controlled input is exactly the kind of authorization bug that turns into a headline.

### 4.4 Data Ownership Model
Tenant owns all Asset/Risk/Compliance/Financial/Optimization data created under it. Regulatory Intelligence content (Framework/Regulation/Control) is **platform-owned, shared, read-only** across tenants — it is the one deliberate exception to per-tenant isolation, and this distinction must be explicit in the schema (see Section 5) so it's never accidentally tenant-scoped or accidentally shared.

### 4.5 Security Implications
Cross-tenant leakage in this domain isn't a privacy embarrassment — it's one bank's risk exposure and remediation budget visible to a competitor bank, which is both a contract-ending and possibly regulatory-reportable event. This is why isolation is designed as layered (app-level filter + RLS), not single-point-of-failure.

---

## 5. Database Design

### 5.1 Entity Relationships (text ER diagram)
```
Tenant 1───* Organization 1───* Department 1───* User *───* Role *───* Permission

Tenant 1───* Asset ───* AssetOwner
                  │
                  ├──* ComplianceMapping *──1 Control 1──* Requirement
                  │                                 *──1 Regulation *──1 Framework
                  │
                  ├──* Risk ───1 RiskFactor
                  │        └──1 RiskScore (Inherent, Residual)
                  │
                  └──* FinancialExposure ──1 ExpectedLoss
                                          ──1 RemediationCost
                                          ──1 ResidualRisk

Tenant 1───* OptimizationJob 1───* OptimizationConstraint
                              1───1 OptimizationResult ──* (selected RemediationAction refs)

Tenant 1───* AuditEvent  (append-only; references any entity by polymorphic entityType+entityId)

Framework 1───* Regulation 1───* Control 1───* Requirement    (platform-owned, NOT tenant-scoped)
```

### 5.2 Indexing Strategy
- Composite index `(tenant_id, id)` — or `(tenant_id, <natural lookup column>)` — on **every** tenant-scoped table as the leading index; `tenant_id` first so the planner can use it as the primary filter regardless of secondary predicate.
- `(tenant_id, asset_id)` on Risk, ComplianceMapping, FinancialExposure for the asset-detail view join path.
- `(tenant_id, created_at)` on AuditEvent for time-range audit queries (this table will be the largest and most query-heavy over time — see partitioning below).
- Full-text/GIN index on `Regulation.clauseText` if free-text search over regulatory content is needed (likely post-hackathon).

### 5.3 Partitioning Strategy
`AuditEvent` is the only table that needs partitioning at MVP-adjacent scale: **range-partition by month on `created_at`**, since audit tables grow unbounded and are almost always queried by recent time range. Everything else stays unpartitioned until a tenant's asset count genuinely justifies it (premature partitioning elsewhere is unwarranted complexity at this stage).

### 5.4 Audit Tables
`AuditEvent` schema (matches BACKEND.md's required shape exactly): `id, tenant_id, timestamp, actor_user_id, action, entity_type, entity_id, before (jsonb), after (jsonb)`. Constraints:
- No `UPDATE` or `DELETE` grants on this table for the application's database role — enforced at the Postgres role/grant level, not just "we don't call update() in code." Application-layer discipline is not a substitute for a database-level guarantee here.
- Periodically exported to S3 (immutable object lock optional, post-hackathon) for long-term retention independent of the operational database's lifecycle.

### 5.5 Tenant Strategy Summary
MVP: shared schema, `tenant_id` column, app-level enforcement. Explicitly documented migration path to RLS, then schema-per-tenant, without changing the aggregate boundaries designed in Section 3 — this is why the DDD work in Section 3 was done before any schema, per BACKEND.md's own sequencing rule.

---

## 6. Service Architecture

| Service | Responsibilities | Inputs | Outputs | Depends on |
|---|---|---|---|---|
| **Auth Service** | Login, token issue/refresh, RBAC checks | Credentials, refresh token | JWT access+refresh, permission checks | Identity context only |
| **Asset Service** | Asset CRUD, enrichment, classification | Asset records (manual/CSV for MVP) | `AssetDiscovered`/`AssetClassified` events | Auth (authz), Audit (via events) |
| **Compliance Service** | Regulation/control catalog, map assets→controls, gap analysis | Asset, Framework/Control catalog | `ComplianceMapped` events, gap reports | Asset Service (reads), Regulatory KB |
| **Risk Service** | Compute Likelihood×Impact, control-effectiveness discount, Residual Risk | Asset criticality, ComplianceMapping gaps | `RiskCalculated` events, RiskScore | Asset, Compliance |
| **Financial Service** | Translate Risk → currency exposure, aggregate Q-Risk | RiskScore, OptimizationResult | `FinancialExposureQuantified`, Q-Risk score | Risk Service, Quantum Service |
| **Quantum Service** | Build QUBO from remediation candidates, run QAOA (simulator) + classical baseline, return best portfolio | Remediation candidates, budget/constraint set | `OptimizationExecuted` event, OptimizationResult (selected actions, cost, risk reduction, residual risk) | Financial Service (for inputs), isolated runtime (Python/Qiskit via job queue) |
| **Audit Service** | Append-only event log, evidence export | Any domain event | Persisted AuditEvent rows, S3 exports | Consumes from all others (queue) |
| **Notification Service** | HITL approval prompts, job-complete alerts | OptimizationExecuted, RemediationApproved-pending events | Email/webhook/in-app notification | Queue only |

Every service's Application layer exposes **use cases** (e.g., `CalculateRiskForAsset`, `RunOptimizationJob`), not CRUD verbs — this is the concrete difference between "generate CRUD endpoints" (forbidden by BACKEND.md) and a real service architecture.

---

## 7. API Architecture

- **Modules:** `/auth`, `/assets`, `/compliance`, `/risks`, `/financial`, `/optimization`, `/audit` — one module per bounded context, mirroring Section 3/6.
- **Versioning:** URI-based, `/api/v1/...` from day one (cheap now, expensive to retrofit once external institutions integrate against it).
- **REST standards:** Resource-oriented nouns, standard verbs, no verbs in URLs (`POST /optimization-jobs` not `POST /runOptimization`). Optimization jobs are asynchronous by nature (QUBO solving is not instant) — modeled as `POST /optimization-jobs` (202 Accepted + job id) then `GET /optimization-jobs/:id` for polling, never a synchronous long-held HTTP request.
- **Error handling:** Every error resolves to the `{ success: false, message, errors: [] }` contract from BACKEND.md, mapped from typed domain errors (e.g., `TenantMismatchError`, `InsufficientBudgetError`) via a single centralized Express error-handling middleware — never ad hoc `res.status(x).send(...)` scattered across controllers.
- **Auth strategy:** Bearer JWT on every endpoint except `/auth/login` and `/auth/refresh`; short-lived access token (15 min), rotating refresh token, refresh token revocation list in Redis.
- **Docs:** OpenAPI spec generated from the same Zod schemas used for request validation (single source of truth — prevents docs drifting from actual validation, a very common real-world failure mode).

---

## 8. Event-Driven Architecture

| Event | Publisher | Consumer(s) | Payload (shape) |
|---|---|---|---|
| `AssetDiscovered` | Asset Service | Compliance Service, Audit | `{ tenantId, assetId, assetType, criticality, timestamp }` |
| `ComplianceMapped` | Compliance Service | Risk Service, Audit | `{ tenantId, assetId, controlId, gapStatus, timestamp }` |
| `RiskCalculated` | Risk Service | Financial Service, Audit | `{ tenantId, riskId, assetId, likelihood, impact, riskScore, residualRisk }` |
| `FinancialExposureQuantified` | Financial Service | Notification, Audit | `{ tenantId, assetId, expectedLoss, financialExposure }` |
| `RemediationGenerated` | Risk/Financial | Quantum Service, Audit | `{ tenantId, candidateActions: [...] }` |
| `OptimizationExecuted` | Quantum Service | Financial Service, Notification, Audit | `{ tenantId, jobId, selectedActions, totalCost, riskReduction, residualRisk }` |
| `RemediationApproved` | (human action via API) | Audit, Notification | `{ tenantId, actionId, approvedBy, timestamp }` |

**Queue strategy:** BullMQ on Redis, one queue per event type (not one giant queue) so a slow consumer (e.g., Quantum Service) can't backpressure unrelated flows (e.g., Audit). Audit consumption uses **at-least-once** delivery with idempotent writes (audit events carry a unique event id; the audit table has a unique constraint on it) — duplicate audit rows are a tolerable, de-dupable side effect; **lost** audit events are not, so the queue's retry/dead-letter policy is tuned toward the Audit consumer specifically. This is also exactly the seam BACKEND.md points at for future microservice extraction — each service could become a separate deployable without changing these contracts.

---

## 9. Security Review

| Area | Design | Weakness identified now (before implementation) |
|---|---|---|
| Authentication | JWT + refresh rotation, bcrypt | Refresh token theft/replay — mitigate with refresh token rotation + reuse detection (if an old refresh token is replayed after rotation, revoke the whole token family) |
| Authorization | RBAC via Permission sets, enforced in Application layer | **Risk:** if permission checks are only in middleware and not re-checked in use cases, a service-to-service internal call path could bypass them. Decision: enforce authz checks inside use cases, not only at the HTTP boundary |
| Secrets | AWS Secrets Manager / SSM Parameter Store | SSM Parameter Store (standard tier) is free and sufficient for MVP scale; Secrets Manager costs ~$0.40/secret/month — given the $300 budget, **use SSM SecureString for MVP**, document migration to Secrets Manager when automatic rotation is actually needed |
| Tenant isolation | App-level `tenant_id` filter, RLS deferred | **Weakness:** until RLS lands, a single missed filter in one repository method is a full cross-tenant leak with no second layer of defense. Decision: treat RLS as a near-term priority, not a "someday" item, given the client base |
| OWASP — Injection | Prisma parameterized queries only, no raw SQL without justification | Low risk if the "no raw SQL" rule is actually enforced in review |
| OWASP — Broken Access Control | RBAC + tenant context | Covered above |
| OWASP — Security Misconfiguration | Helmet, CORS allowlist (not `*`), no verbose errors in prod | Must explicitly disable Express's default error stack traces in production responses |
| OWASP — Sensitive Data Exposure | TLS in transit, RDS encryption at rest, no PII in logs | Enforce via lint rule/log-sanitization middleware, not developer memory alone |
| Auditability | Append-only AuditEvent, DB-level revoke of UPDATE/DELETE | Covered in 5.4 |
| Logging | Winston structured logs, explicit redaction of token/secret/PII fields | **Weakness:** redaction must be a shared logging wrapper used everywhere, not per-call-site discipline — one missed `logger.info(req.body)` on a login route leaks credentials into CloudWatch |
| Rate limiting | Per-tenant + per-IP limits on auth endpoints especially | Prevents credential stuffing against `/auth/login` |

---

## 10. AWS Architecture ($300 Credit Budget)

### 10.1 MVP Deployment (Hackathon → early post-hackathon)
| Service | Choice | Est. monthly cost | Rationale |
|---|---|---|---|
| Compute | ECS Fargate, 1 task, 0.25 vCPU / 0.5GB (or single t3.micro EC2 if simpler for a 22hr build) | ~$9–15 (Fargate) or ~$0 (t3.micro under Free Tier if account qualifies) | Fargate avoids patching overhead; t3.micro is cheaper if Free Tier applies — check account eligibility first |
| Database | RDS PostgreSQL, single-AZ, `db.t3.micro`, 20GB gp3 | ~$13–15 | Multi-AZ explicitly not justified at this stage per BACKEND.md's own guidance — single-AZ + automated daily snapshot is the right tradeoff |
| Cache/Queue backing | Redis **containerized alongside the app** (not ElastiCache) for MVP | ~$0 incremental (shares the compute instance) | ElastiCache's cheapest node (`cache.t3.micro`) is ~$12/mo — not justified until Redis needs to survive app-container restarts independently |
| Storage | S3 Standard, low volume (evidence/report exports) | <$1 | Negligible at hackathon data volumes |
| Secrets | SSM Parameter Store (SecureString, standard tier) | $0 | Free; sufficient until automatic rotation is a real requirement |
| Monitoring | CloudWatch (basic logs + a couple of alarms) | ~$3–5 | Keep log retention short (7–14 days) initially to control ingestion/storage cost |
| Networking | VPC, 1 ALB | ~$16–18 (ALB is the biggest fixed cost in this list) | An ALB is the main recurring cost; consider a single public-facing EC2 with a security group instead of ALB if the 22-hour build doesn't need blue/green or multiple targets — cuts ~$16/mo |
| Quantum simulation | Runs **inside the app compute** (Qiskit/PennyLane simulator, Python subprocess or sidecar) | $0 incremental | No need for separate quantum-cloud service access for a simulator-based benchmark — this is explicitly what the hackathon brief expects (Section 4: "run on a Quantum Simulator using standard open-source libraries") |

**Estimated MVP monthly run rate: ~$45–60/month**, comfortably inside $300 for several months of post-hackathon iteration — the ALB is the one line item worth cutting first if the budget needs more headroom (drop to a single EC2 with an Elastic IP for the demo/MVP stage).

### 10.2 Scaling Path (documented now, not built now)
ECS Fargate → auto-scaled multi-task; RDS → Multi-AZ + read replica once read load justifies it; Redis → ElastiCache once Redis must outlive app deploys; ALB reintroduced at that point for real load balancing; CloudWatch retention extended; Secrets Manager replaces SSM when rotation automation is needed. None of this requires a domain/service rewrite — this is exactly why the DDD boundaries in Section 3 were designed first.

### 10.3 Cost Optimization Notes
- Turn off/stop the RDS instance and Fargate service outside active build/demo hours during the hackathon itself if the environment allows it — this alone can meaningfully stretch a $300 budget across a multi-week post-hackathon iteration period.
- Use RDS `db.t3.micro` with `gp3` (not `gp2`) — gp3 is cheaper at this size and has no burst-credit cliff to worry about.
- Do not enable Multi-AZ, cross-region backup, or Performance Insights at MVP stage — genuinely not justified yet per BACKEND.md's own cost-governance guidance.

---

## 11. Development Roadmap

**Note:** Phase 1 must complete before Hour 3 of the hackathon per the brief's own checkpoint; Phases 2–3 (a thin slice) are the realistic hackathon build; Phases 4–6 are explicitly post-hackathon. This mapping is itself a decision requiring founder sign-off (see Section 12).

| Phase | Deliverables | Dependencies | Effort | Key Risks |
|---|---|---|---|---|
| **1. Architecture** | This document; entity/schema design; API contracts; event contracts (no code) | Source docs finalized | Done by Hour 2 of hackathon | Scope creep into "let's just start coding" before contracts are settled |
| **2. Core Backend (Hackathon Cut)** | Auth (basic JWT+RBAC), Asset Service (manual/CSV ingest), tenant_id isolation, Postgres schema, basic Express+Zod+Prisma skeleton per Clean Architecture layers | Phase 1 | Hours 3–10 | Underestimating how much of the 22hrs Clean Architecture scaffolding consumes — consider a **pragmatic hackathon variant**: fewer layers, but keep domain logic out of Express handlers even if full DI/interfaces are simplified |
| **3. Risk Engine (Hackathon Cut)** | Likelihood×Impact calculation, static control-effectiveness table, RiskScore + basic Financial exposure numbers | Phase 2 (Asset data) | Hours 10–13 | Faking "financial exposure" numbers without disclosing the model is a Section 10 judging violation — disclose the loss-model assumptions explicitly in the 1-Pager |
| **4. Compliance Engine (Hackathon Cut — thin)** | 1–2 hardcoded frameworks (e.g., DPDP + ISO27001), static Regulation→Control→Asset mapping table, no AI-drafted mapping yet | Phase 2 | Hours 13–15 (parallel with Risk Engine if 2 people split it) | Don't attempt live regulatory-text parsing tonight — that's a Post-Hackathon Regulatory Intelligence Engine feature, not MVP |
| **5. Quantum Optimization (Hackathon Cut)** | QUBO formulation of remediation selection, QAOA run on Qiskit/PennyLane simulator, classical baseline (greedy or brute-force for small N), comparison chart (time/quality) | Phases 3–4 (needs cost/risk-reduction inputs) | Hours 13–18 | This is your single highest-differentiation deliverable for judging — protect its build time; keep N (number of candidate actions) small enough that both quantum and classical baselines run in demo-able time |
| **6. Production Readiness** | RLS tenant isolation, 80% test coverage, full audit pipeline, Secrets Manager, CI/CD, IaC (Terraform/CDK), MFA, real asset-discovery connectors, regulatory knowledge graph, insurance layer | Phases 1–5 | Weeks, post-hackathon (Startup Ideation Program timeline) | This is the actual company-building work — everything before it was proof-of-concept |

---

## Architecture Decisions Requiring Founder Approval

1. **Scope reconciliation:** Confirm the hackathon build is explicitly the "Hackathon Cut" scope in Section 1.13/Section 11, not an attempt at the full BACKEND.md spec — and that this is disclosed plainly in the "What's Fake vs. What's Real" section of the 1-Pager rather than discovered by a judge.
2. **Track declaration:** Hybrid (full agentic + quantum requirements) vs. Track 2/Quantum-primary with a thin decision-support layer. This must be locked by Hour 2 and determines jury assignment — recommend Track 2-primary framing unless a second team member can independently own a real second "agent" (e.g., an Audit/Verification agent that checks the Execution agent's optimization proposal) within the time budget.
3. **Named buyer persona** for the 1-Pager and Q&A prep (e.g., "Head of Cyber Risk & Compliance, GIFT City IBU") — needs founder decision on which persona the pitch narrative centers on.
4. **RLS timing:** whether to pull Row-Level Security forward into the immediate post-hackathon roadmap (recommended) or defer to general "Phase 6" — given the client base is regulated financial institutions, this changes the risk profile of an early pilot.
5. **AWS compute choice:** ECS Fargate vs. single EC2 instance vs. ALB vs. direct Elastic IP — a ~$16/mo difference that matters given the $300 ceiling; needs a founder call on how much "looks like real infra" matters for the demo vs. runway preservation.
6. **Financial loss model source:** what assumptions/benchmarks back the "Expected Annual Loss" and "Financial Exposure" numbers shown in the demo (industry benchmark? invented for synthetic data? a named methodology like FAIR?) — this must be defensible in R2 Q&A and is a business/credibility decision, not just an engineering one.
7. **Regulatory frameworks to hardcode for MVP** — which 1–2 of {DPDP, GDPR, DORA, NIST, ISO27001} best support the chosen buyer persona's actual regulatory reality (e.g., IFSCA/DPDP for an India/GIFT City-facing pitch) — this should be chosen for narrative coherence with the persona in Decision #3, not arbitrarily.
8. **Regulatory pathway positioning** for the 1-Pager (Section 6 of the brief): sandbox route vs. partnership-with-regulated-entity vs. explicit B2B-tool-for-regulated-players — this is a go-to-market/legal decision the architecture should support but not dictate.
