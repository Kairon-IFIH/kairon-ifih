# quantum-runner

Separate Python runtime — not part of the npm workspace. Runs the QUBO/QAOA
simulation (Qiskit or PennyLane) plus the classical baseline (greedy or
brute-force for small N), per `docs/ARCHITECTURE.md` §2/§6 and the Hackathon
brief's requirement for a Classical vs. Quantum comparison chart.

This is the process boundary referenced by `@kairon/quantum`'s
`QuantumSolverGateway` interface (`packages/quantum/src/domain.ts`) and its
`HttpQuantumSolverGateway` stub (`packages/quantum/src/infrastructure.ts`).
Nothing here is implemented yet — this file fixes the contract so both sides
can be built independently.

## Contract

### Input (submitted by `HttpQuantumSolverGateway.submitJob`)

```json
{
  "jobId": "uuid",
  "objective": "MINIMIZE_RESIDUAL_FINANCIAL_RISK",
  "candidateActions": [
    { "actionId": "uuid", "cost": 100000, "riskReduction": 0.18, "regulatoryPriority": 3 }
  ],
  "budget": { "amount": 2500000, "currency": "INR" },
  "mandatoryActionIds": ["uuid"],
  "dependencies": [{ "actionId": "uuid", "requires": ["uuid"] }]
}
```

### Output (returned via `HttpQuantumSolverGateway.getResult`, matches `OptimizationResult`)

```json
{
  "jobId": "uuid",
  "selectedActionIds": ["uuid", "uuid"],
  "totalCost": { "amount": 2300000, "currency": "INR" },
  "riskReductionPercent": 74,
  "residualRisk": { "amount": 1400000, "currency": "INR" },
  "classicalBaselineComparison": {
    "classicalRuntimeMs": 40,
    "quantumRuntimeMs": 1200,
    "qualityDelta": 0.02
  }
}
```

## Build order (Phase 5, see `docs/IMPLEMENTATION_ROADMAP.md`)

1. QUBO formulation of the remediation-selection problem from the input above.
2. Classical baseline solver (greedy or brute-force — keep N small enough to run both live in a demo).
3. QAOA solver via Qiskit or PennyLane, on a simulator (no real quantum hardware — not required, not in scope per BACKEND.md).
4. HTTP wrapper (FastAPI/Flask) exposing `POST /jobs` and `GET /jobs/:jobId`, matching the contract above exactly.
5. Wire `HttpQuantumSolverGateway` in `packages/quantum/src/infrastructure.ts` to call it.
