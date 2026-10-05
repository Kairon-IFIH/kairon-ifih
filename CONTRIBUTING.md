<div align="center">

# Contributing to KAIRON

Thank you for your interest in contributing. KAIRON is a precision-engineered platform — contributions are expected to meet the same standard.

</div>

---

## 📋 Table of Contents

- [Ground Rules](#ground-rules)
- [Getting Started](#getting-started)
- [Branch Naming](#branch-naming)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Architecture Rules](#architecture-rules)
- [Code Style](#code-style)

---

## 🧭 Ground Rules

- **Read the architecture first.** Every bounded context, interface, and dependency rule is documented in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Do not work around it.
- **Follow the phased roadmap.** Check [`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md) before starting any implementation. Work in phase order.
- **No business logic in the scaffold phase.** If you are not implementing a specific phase, do not add business logic — only fix structure, types, or tooling.
- **All PRs must pass typecheck.** Run `npm run typecheck --workspaces` before opening a PR. Zero errors expected.

---

## 🚀 Getting Started

```bash
# 1. Fork the repository and clone your fork
git clone https://github.com/<your-username>/kairon-ifih.git
cd kairon-ifih

# 2. Install dependencies
npm install

# 3. Verify the type graph is clean
npm run typecheck --workspaces

# 4. Create a branch (see naming conventions below)
git checkout -b feat/identity-user-aggregate
```

---

## 🌿 Branch Naming

| Prefix | Use case |
|---|---|
| `feat/<context>-<thing>` | New feature or implementation within a bounded context |
| `fix/<context>-<thing>` | Bug fix |
| `docs/<thing>` | Documentation only changes |
| `refactor/<thing>` | Code restructure with no behaviour change |
| `chore/<thing>` | Tooling, dependencies, CI |
| `test/<thing>` | Adding or fixing tests |

**Examples:**
```
feat/identity-user-aggregate
fix/risk-score-calculation
docs/deployment-guide
chore/update-prisma-client
```

---

## ✍️ Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>

<optional body>

<optional co-author trailer>
```

**Types:** `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `perf`

**Examples:**

```bash
git commit -m "feat(identity): implement User aggregate with create factory"

git commit -m "fix(risk): correct RiskScore value object boundary validation"

git commit -m "docs: add architecture diagram to README"
```

**Co-authoring** (pair programming):
```bash
git commit -m "feat(compliance): implement Control domain entity" \
           -m "Co-authored-by: username <id+username@users.noreply.github.com>"
```

---

## 🔀 Pull Request Process

1. **Ensure your branch is up to date** with `main` before opening a PR
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run the full check suite**
   ```bash
   npm run typecheck --workspaces
   npm test
   ```

3. **Open a PR against `main`** with:
   - A clear title following commit conventions
   - A summary of what changed and why
   - Reference to the roadmap phase being implemented (if applicable)

4. **Request a review** — at least one approval is required before merge

5. **Squash or rebase merge only** — no merge commits on `main`

---

## 🏛️ Architecture Rules

These are **non-negotiable**:

| Rule | Details |
|---|---|
| **Dependency direction** | `presentation` → `application` → `domain` → `shared-kernel`. Never inward-to-outward. |
| **No cross-context imports** | Packages must communicate via `event-contracts`, never by importing each other's internals. |
| **Factory pattern** | All entities and value objects must expose a `static create(...)` factory. No `new` at call sites outside the domain layer. |
| **TenantContext** | All tenant-scoped repository methods must accept `TenantContext` as the first, non-optional parameter. |
| **Audit log immutability** | `AuditEventRepository` must never expose `update` or `delete` methods. |
| **NotImplementedError in scaffold** | During the scaffold phase, leave `NotImplementedError` throws in place. Replace only when implementing the specific phase. |

---

## 🎨 Code Style

- **TypeScript strict mode** is enabled — no `any`, no `ts-ignore` without a comment explaining why
- **No inline styles or magic numbers** — use named constants
- **Errors are values** — use the `Result<T, E>` type from `@kairon/shared-kernel`, do not throw raw errors from domain or application layers
- **Prettier** is the formatter — run before committing

---

<div align="center">
  <sub>Questions? Open a discussion or reach out to the maintainers.</sub>
</div>
