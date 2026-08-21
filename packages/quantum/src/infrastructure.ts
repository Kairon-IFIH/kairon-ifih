import { randomUUID } from "node:crypto";
import { asOptimizationResultId, Money, NotImplementedError, OptimizationJobId, TenantContext } from "@kairon/shared-kernel";
import {
  OptimizationResult,
  type CandidateAction,
  type OptimizationJob,
  type OptimizationJobRepository,
  type QuantumSolverGateway,
} from "./domain";

export class PrismaOptimizationJobRepository implements OptimizationJobRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_ctx: TenantContext, _jobId: OptimizationJobId): Promise<OptimizationJob | null> {
    throw new NotImplementedError("PrismaOptimizationJobRepository.findById — Phase 5");
  }

  async save(_ctx: TenantContext, _job: OptimizationJob): Promise<void> {
    throw new NotImplementedError("PrismaOptimizationJobRepository.save — Phase 5");
  }
}

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryOptimizationJobRepository implements OptimizationJobRepository {
  private readonly byTenant = new Map<string, Map<string, OptimizationJob>>();

  private tenantStore(ctx: TenantContext): Map<string, OptimizationJob> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async findById(ctx: TenantContext, jobId: OptimizationJobId): Promise<OptimizationJob | null> {
    return this.tenantStore(ctx).get(jobId) ?? null;
  }

  async save(ctx: TenantContext, job: OptimizationJob): Promise<void> {
    this.tenantStore(ctx).set(job.id, job);
  }
}

/**
 * Calls apps/quantum-runner (Qiskit/PennyLane simulator process, see its README
 * for the JSON contract) — via HTTP, a local job queue, or a subprocess call.
 * Choice of transport is a Phase 5 implementation decision, not an architectural one.
 */
export class HttpQuantumSolverGateway implements QuantumSolverGateway {
  constructor(private readonly quantumRunnerBaseUrl: string) {}

  async submitJob(_job: OptimizationJob): Promise<void> {
    throw new NotImplementedError("HttpQuantumSolverGateway.submitJob — Phase 5, ARCHITECTURE.md §6 Quantum Service");
  }

  async getResult(_jobId: OptimizationJobId): Promise<OptimizationResult | null> {
    throw new NotImplementedError("HttpQuantumSolverGateway.getResult — Phase 5");
  }
}

/**
 * The actual Phase-"right now" solver: a classical greedy knapsack over
 * (riskReduction / cost) ratio, respecting budget and mandatory actions.
 *
 * IMPORTANT — this is the CLASSICAL BASELINE ONLY. It does not run QAOA and
 * makes no quantum-advantage claim; `classicalBaselineComparison.quantumRuntimeMs`
 * and `qualityDelta` are honest placeholders (identical to the classical run)
 * until apps/quantum-runner's actual Qiskit/PennyLane solver replaces this
 * gateway (Phase 5, IMPLEMENTATION_ROADMAP.md) — swapping it in requires no
 * change to any caller, that's what this interface is for. Presenting this
 * class's output as "quantum" in a demo would be exactly the Track 2 judging
 * trap the hackathon brief warns about (Section 2).
 */
export class GreedyClassicalSolverGateway implements QuantumSolverGateway {
  private readonly results = new Map<string, OptimizationResult>();

  async submitJob(job: OptimizationJob): Promise<void> {
    const start = performance.now();

    const currency = job.budgetConstraint.maxSpend.currency;
    const budget = job.budgetConstraint.maxSpend.amount;
    const mandatory = new Set(job.mandatoryActionIds);

    const mandatoryActions = job.candidateActions.filter((a) => mandatory.has(a.actionId));
    const optionalActions = job.candidateActions
      .filter((a) => !mandatory.has(a.actionId))
      .sort((a, b) => b.riskReduction / b.cost.amount - a.riskReduction / a.cost.amount);

    const selected: CandidateAction[] = [];
    let spent = 0;
    for (const action of [...mandatoryActions, ...optionalActions]) {
      if (spent + action.cost.amount <= budget) {
        selected.push(action);
        spent += action.cost.amount;
      }
    }

    const totalRiskReduction = Math.min(
      selected.reduce((sum, a) => sum + a.riskReduction, 0) * 100,
      100
    );
    const unaddressed = job.candidateActions.filter((a) => !selected.includes(a));
    const residualRiskAmount = unaddressed.reduce((sum, a) => sum + a.cost.amount * a.riskReduction, 0);

    const runtimeMs = Math.round(performance.now() - start);

    const result = OptimizationResult.create(asOptimizationResultId(randomUUID()), {
      selectedActionIds: selected.map((a) => a.actionId),
      totalCost: Money.create(spent, currency),
      riskReductionPercent: Math.round(totalRiskReduction),
      residualRisk: Money.create(residualRiskAmount, currency),
      classicalBaselineComparison: {
        classicalRuntimeMs: runtimeMs,
        quantumRuntimeMs: runtimeMs,
        qualityDelta: 0,
      },
    });

    this.results.set(job.id, result);
  }

  async getResult(jobId: OptimizationJobId): Promise<OptimizationResult | null> {
    return this.results.get(jobId) ?? null;
  }
}
