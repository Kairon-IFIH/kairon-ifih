import {
  AggregateRoot,
  DomainEvent,
  Entity,
  Money,
  OptimizationJobId,
  OptimizationResultId,
  TenantContext,
  TenantId,
  ValidationError,
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
    return new ObjectiveFunction({ description: "MINIMIZE_RESIDUAL_FINANCIAL_RISK" });
  }
}

export interface BudgetConstraintProps {
  readonly maxSpend: Money;
}

export class BudgetConstraint extends ValueObject<BudgetConstraintProps> {
  private constructor(props: BudgetConstraintProps) {
    super(props);
  }

  static create(maxSpend: Money): BudgetConstraint {
    return new BudgetConstraint({ maxSpend });
  }

  get maxSpend(): Money {
    return this.props.maxSpend;
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

  static create(id: OptimizationJobId, props: OptimizationConstraintProps): OptimizationConstraint {
    return new OptimizationConstraint(id, props);
  }

  get type(): OptimizationConstraintProps["type"] {
    return this.props.type;
  }

  get value(): unknown {
    return this.props.value;
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

  static create(id: OptimizationResultId, props: OptimizationResultProps): OptimizationResult {
    if (props.riskReductionPercent < 0 || props.riskReductionPercent > 100) {
      throw new ValidationError(["riskReductionPercent must be between 0 and 100"]);
    }
    return new OptimizationResult(id, props);
  }

  get selectedActionIds(): readonly string[] {
    return this.props.selectedActionIds;
  }

  get totalCost(): Money {
    return this.props.totalCost;
  }

  get riskReductionPercent(): number {
    return this.props.riskReductionPercent;
  }

  get residualRisk(): Money {
    return this.props.residualRisk;
  }

  get classicalBaselineComparison(): OptimizationResultProps["classicalBaselineComparison"] {
    return this.props.classicalBaselineComparison;
  }
}

// ---- Domain Event ----

export class OptimizationExecutedEvent extends DomainEvent {
  readonly eventName = "OptimizationExecuted" as const;
  constructor(
    tenantId: TenantId,
    readonly jobId: OptimizationJobId,
    readonly selectedActions: string[],
    readonly totalCost: number,
    readonly riskReduction: number,
    readonly residualRisk: number
  ) {
    super(tenantId);
  }
}

// ---- Aggregate Root ----

export type OptimizationJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface CandidateAction {
  readonly actionId: string;
  readonly cost: Money;
  readonly riskReduction: number; // 0..1
}

export interface OptimizationJobProps {
  readonly objective: ObjectiveFunction;
  readonly constraints: OptimizationConstraint[];
  readonly candidateActions: CandidateAction[];
  readonly mandatoryActionIds: string[];
  readonly budgetConstraint: BudgetConstraint;
  readonly status: OptimizationJobStatus;
  readonly result?: OptimizationResult;
}

export class OptimizationJob extends AggregateRoot<OptimizationJobId> {
  private constructor(
    id: OptimizationJobId,
    private readonly tenantId: TenantId,
    private props: OptimizationJobProps
  ) {
    super(id);
  }

  static create(id: OptimizationJobId, tenantId: TenantId, props: Omit<OptimizationJobProps, "status">): OptimizationJob {
    if (props.candidateActions.length === 0) {
      throw new ValidationError(["An optimization job needs at least one candidate action"]);
    }
    return new OptimizationJob(id, tenantId, { ...props, status: "PENDING" });
  }

  get status(): OptimizationJobStatus {
    return this.props.status;
  }

  get candidateActions(): readonly CandidateAction[] {
    return this.props.candidateActions;
  }

  get mandatoryActionIds(): readonly string[] {
    return this.props.mandatoryActionIds;
  }

  get budgetConstraint(): BudgetConstraint {
    return this.props.budgetConstraint;
  }

  get result(): OptimizationResult | undefined {
    return this.props.result;
  }

  markRunning(): void {
    this.props = { ...this.props, status: "RUNNING" };
  }

  /** Raises OptimizationExecuted (ARCHITECTURE.md §8) once the solver returns. */
  complete(result: OptimizationResult): void {
    this.props = { ...this.props, status: "COMPLETED", result };
    this.addDomainEvent(
      new OptimizationExecutedEvent(
        this.tenantId,
        this.id,
        [...result.selectedActionIds],
        result.totalCost.amount,
        result.riskReductionPercent,
        result.residualRisk.amount
      )
    );
  }

  markFailed(): void {
    this.props = { ...this.props, status: "FAILED" };
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
