<div align="center">

# ⚡ KAIRON

### Quantum-Powered Financial Risk Intelligence Platform

*Continuously discover assets · Quantify cyber exposure in financial terms · Optimize remediation through quantum-enhanced decision making*

---

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-Queue-E44C29?style=flat-square)
![License](https://img.shields.io/badge/License-Private-red?style=flat-square)
![Status](https://img.shields.io/badge/Status-Scaffold-yellow?style=flat-square)

</div>

---

## 🧭 Overview

**KAIRON** is a next-generation Financial Risk Intelligence Platform built for financial institutions that need to answer one critical executive question:

> *"Given limited capital, limited manpower, and increasing regulatory obligations — where should we invest next to achieve the greatest reduction in financial risk?"*

Existing GRC, SIEM, and vulnerability management platforms answer **what exists** and **what is vulnerable**. KAIRON answers **what to do about it, in what order, and at what cost**.

> **Note:** This repository is a scaffold generated from [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). All bounded-context packages, interfaces, and dependency graphs are real. Business logic is not implemented yet — see [`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md) for the phased build order.

---

## 🗂️ Repository Layout

```
kairon-ifih/
├── apps/
│   ├── api/                  Express composition root (HTTP layer)
│   ├── worker/               BullMQ consumer composition root
│   └── quantum-runner/       Python / Qiskit-PennyLane sidecar (separate runtime)
│
├── packages/
│   ├── shared-kernel/        Entity, AggregateRoot, ValueObject, DomainEvent bases
│   │                         Result<T>, Money, TenantContext, branded IDs, domain errors
│   ├── event-contracts/      Domain event payload types + BullMQ queue name mapping
│   ├── api-contracts/        Response envelope, pagination, Zod request/query schemas
│   │
│   ├── identity/             Bounded context: Tenant, Organization, Department, User, Role, Auth
│   ├── asset/                Bounded context: Asset, AssetOwner, BusinessService
│   ├── compliance/           Bounded context: Framework, Regulation, Control, Requirement
│   ├── risk/                 Bounded context: Risk, RiskFactor, RiskScore
│   ├── financial/            Bounded context: FinancialExposure, ExpectedLoss, RemediationCost, Q-Risk
│   ├── quantum/              Bounded context: OptimizationJob, Constraint, OptimizationResult
│   ├── audit/                Bounded context: AuditEvent (append-only, no update/delete)
│   ├── notification/         Bounded context: Notification (HITL / job-complete alerts)
│   └── logger/               Shared structured logger
│
├── prisma/                   Schema, migrations, seed
├── docs/                     Architecture, roadmap, backend spec, deployment guides
├── infra/                    Infrastructure-as-code
├── docker-compose.yml        Local development stack
└── docker-compose.prod.yml   Production stack
```

---

## 🚀 Quickstart

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker** (for local Postgres + Redis via `docker-compose`)

### 1. Install dependencies

```bash
npm install
```

### 2. Verify the type graph

```bash
npm run typecheck --workspaces
# All 13 packages pass clean — no errors expected
```

### 3. Start the API

```bash
npm run dev --workspace @kairon/api
```

The server boots immediately. Every route returns a correctly typed response:

```json
{
  "success": false,
  "message": "Not implemented: <use-case>, see ARCHITECTURE.md §<section>, Phase <n>",
  "errors": []
}
```

The full request pipeline — **Zod validation → auth middleware → tenant-context middleware → use case → centralized error handler** — is wired end-to-end. Only the behavior inside each use case is pending.

### 4. Database (when implementing a context)

```bash
docker-compose up -d          # Start Postgres + Redis
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Run migrations (dev)
npm run seed                  # Optional: seed reference data
```

---

## 🏛️ Architecture Conventions

This scaffold enforces a strict **Clean Architecture** with unidirectional dependencies:

```
presentation.ts
    └── application.ts
            └── domain.ts
                    └── @kairon/shared-kernel
                    └── @kairon/event-contracts
```

| Convention | Details |
|---|---|
| **Factory pattern** | Every entity and value object exposes a `static create(...)` factory. No `new Entity()` at call sites. |
| **NotImplementedError** | All use-case and factory method bodies throw `NotImplementedError(...)` in this scaffold phase. Shape is real; behavior is not. |
| **Repository interfaces** | Defined in `domain.ts`. Prisma-backed stub implementations live in `infrastructure.ts`. No live Prisma calls yet. |
| **Append-only audit log** | `AuditEventRepository` intentionally has no `update` or `delete` methods. This is structural, not an oversight. |
| **TenantContext** | Every tenant-scoped repository method takes `TenantContext` (from `@kairon/shared-kernel`) as its **first, non-optional** parameter. |
| **Build tooling** | `tsconfig.base.json` sets `noEmit: true`. `tsx` runs apps in dev. A real `tsc`/project-references build for `dist/` is a Phase 2 tooling decision. |

---

## 📚 Documentation

| Document | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Full domain model, bounded contexts, dependency rules |
| [`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md) | File-by-file phased build order |
| [`docs/BACKEND.md`](./docs/BACKEND.md) | Backend API spec and middleware design |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Production deployment guide |
| [`docs/IDEA.md`](./docs/IDEA.md) | Product vision, problem framing, market context |

---

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/R0h1tAnand">
        <img src="https://github.com/R0h1tAnand.png" width="80px" style="border-radius:50%" alt="R0h1tAnand"/><br/>
        <sub><b>Rohit Anand</b></sub>
      </a><br/>
      <sub>Architecture · Domain Modelling · Infrastructure</sub>
    </td>
    <td align="center">
      <a href="https://github.com/sanaysarthak">
        <img src="https://github.com/sanaysarthak.png" width="80px" style="border-radius:50%" alt="sanaysarthak"/><br/>
        <sub><b>Sarthak Sanay</b></sub>
      </a><br/>
      <sub>Architecture Review · Bounded-Context Design</sub>
    </td>
  </tr>
</table>

---

<div align="center">
  <sub>Built with precision. Designed for scale. Powered by quantum.</sub>
</div>
