import {
  AggregateRoot,
  Entity,
  Money,
  NotImplementedError,
  OptimizationJobId,
  OptimizationResultId,
  TenantContext,
  ValueObject,
} from "@kairon/shared-kernel";

/**
 * Bounded Context: Quantum Optimization (ARCHITECTURE.md §3.1).
 * Scoped strictly to ONE problem: select remediation actions minimizing residual
 * financial risk under budget/dependency/regulatory constraints (BACKEND.md
 * Quantum Optimization Domain). Never used for auth/CRUD/compliance logic.
 */

// ---- Value Objects ----

export interface ObjectiveFunctionProps {
  readonly description: "MINIMIZE_RESIDUAL_FINANCIAL_RISK";
}

export class ObjectiveFunction extends ValueObject<ObjectiveFunctionProps> {
  private constructor(props: ObjectiveFunctionProps) {
    super(props);
  }

  static default(): ObjectiveFunction {
    throw new NotImplementedError("ObjectiveFunction.default — Phase 5");
  }
}

export interface BudgetConstraintProps {
  readonly maxSpend: Money;
}

export class BudgetConstraint extends ValueObject<BudgetConstraintProps> {
  private constructor(props: BudgetConstraintProps) {
    super(props);
  }

  static create(_maxSpend: Money): BudgetConstraint {
    throw new NotImplementedError("BudgetConstraint.create — Phase 5");
  }
}

// ---- Entities ----

export interface OptimizationConstraintProps {
  readonly type: "BUDGET" | "MANDATORY_CONTROL" | "DEPENDENCY" | "OPERATIONAL" | "CAPACITY";
  readonly value: unknown;
}

export class OptimizationConstraint extends Entity<OptimizationJobId> {
  private constructor(id: OptimizationJobId, private readonly props: OptimizationConstraintProps) {
    super(id);
  }

  static create(_id: OptimizationJobId, _props: OptimizationConstraintProps): OptimizationConstraint {
    throw new NotImplementedError("OptimizationConstraint.create — Phase 5");
  }
}

export interface OptimizationResultProps {
  readonly selectedActionIds: string[];
  readonly totalCost: Money;
  readonly riskReductionPercent: number;
  readonly residualRisk: Money;
  readonly classicalBaselineComparison: {
    readonly classicalRuntimeMs: number;
    readonly quantumRuntimeMs: number;
    readonly qualityDelta: number;
  };
}

export class OptimizationResult extends Entity<OptimizationResultId> {
  private constructor(id: OptimizationResultId, private readonly props: OptimizationResultProps) {
    super(id);
  }

  static create(_id: OptimizationResultId, _props: OptimizationResultProps): OptimizationResult {
    throw new NotImplementedError(
      "OptimizationResult.create — Phase 5, must carry the classical-vs-quantum comparison chart data (Hackathon brief §4)"
    );
  }
}

// ---- Aggregate Root ----

export type OptimizationJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface OptimizationJobProps {
  readonly objective: ObjectiveFunction;
  readonly constraints: OptimizationConstraint[];
  readonly candidateActionIds: string[];
  readonly status: OptimizationJobStatus;
  readonly result?: OptimizationResult;
}

export class OptimizationJob extends AggregateRoot<OptimizationJobId> {
  private constructor(id: OptimizationJobId, private readonly props: OptimizationJobProps) {
    super(id);
  }

  static create(_id: OptimizationJobId, _props: OptimizationJobProps): OptimizationJob {
    throw new NotImplementedError("OptimizationJob.create — Phase 5");
  }

  /** Raises OptimizationExecuted (ARCHITECTURE.md §8) once the solver returns. */
  complete(_result: OptimizationResult): void {
    throw new NotImplementedError("OptimizationJob.complete — Phase 5");
  }
}

// ---- Repository ----

export interface OptimizationJobRepository {
  findById(ctx: TenantContext, jobId: OptimizationJobId): Promise<OptimizationJob | null>;
  save(ctx: TenantContext, job: OptimizationJob): Promise<void>;
}

// ---- Port to the isolated solver runtime (apps/quantum-runner) ----

/**
 * The TS side never runs QAOA itself — it submits a job and polls/receives a
 * result from the Python/Qiskit-PennyLane sidecar (ARCHITECTURE.md §2, §6).
 * This is the seam between the Node monorepo and apps/quantum-runner.
 */
export interface QuantumSolverGateway {
  submitJob(job: OptimizationJob): Promise<void>;
  getResult(jobId: OptimizationJobId): Promise<OptimizationResult | null>;
}
