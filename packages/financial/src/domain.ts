import {
  AggregateRoot,
  AssetId,
  DomainEvent,
  Entity,
  FinancialExposureId,
  Money,
  RiskId,
  TenantContext,
  TenantId,
  ValidationError,
  ValueObject,
} from "@kairon/shared-kernel";

/** Bounded Context: Financial Quantification (ARCHITECTURE.md §3.1). Translates risk into currency. */

// ---- Value Objects ----

export interface ResidualRiskProps {
  readonly exposure: Money;
}

export class ResidualRisk extends ValueObject<ResidualRiskProps> {
  private constructor(props: ResidualRiskProps) {
    super(props);
  }

  static create(exposure: Money): ResidualRisk {
    return new ResidualRisk({ exposure });
  }

  get exposure(): Money {
    return this.props.exposure;
  }
}

// ---- Entities ----

export interface ExpectedLossProps {
  readonly annualizedAmount: Money;
}

/**
 * Expected Annual Loss (ARCHITECTURE.md §12 Decision 6 — must be disclosed, not
 * hidden): computed upstream as ResidualRiskScore% x Impact. This entity only
 * enforces the invariant "an ExpectedLoss is always a valid, non-negative Money" —
 * the model producing that number lives in the use case that constructs it.
 */
export class ExpectedLoss extends Entity<FinancialExposureId> {
  private constructor(id: FinancialExposureId, private readonly props: ExpectedLossProps) {
    super(id);
  }

  static create(id: FinancialExposureId, props: ExpectedLossProps): ExpectedLoss {
    return new ExpectedLoss(id, props);
  }

  get annualizedAmount(): Money {
    return this.props.annualizedAmount;
  }
}

export interface RemediationCostProps {
  readonly amount: Money;
  readonly implementationTimeDays: number;
}

export class RemediationCost extends Entity<FinancialExposureId> {
  private constructor(id: FinancialExposureId, private readonly props: RemediationCostProps) {
    super(id);
  }

  static create(id: FinancialExposureId, props: RemediationCostProps): RemediationCost {
    if (props.implementationTimeDays < 0) {
      throw new ValidationError(["implementationTimeDays cannot be negative"]);
    }
    return new RemediationCost(id, props);
  }

  get amount(): Money {
    return this.props.amount;
  }

  get implementationTimeDays(): number {
    return this.props.implementationTimeDays;
  }
}

// ---- Domain Event ----

export class FinancialExposureQuantifiedEvent extends DomainEvent {
  readonly eventName = "FinancialExposureQuantified" as const;
  constructor(
    tenantId: TenantId,
    readonly assetId: AssetId,
    readonly expectedLoss: number,
    readonly financialExposure: number,
    readonly currency: string
  ) {
    super(tenantId);
  }
}

// ---- Aggregate Root ----

export interface FinancialExposureProps {
  readonly assetId: AssetId;
  readonly riskId: RiskId;
  readonly expectedLoss: ExpectedLoss;
  readonly financialExposure: Money;
  readonly residualRisk: ResidualRisk;
}

export class FinancialExposure extends AggregateRoot<FinancialExposureId> {
  private constructor(id: FinancialExposureId, private readonly props: FinancialExposureProps) {
    super(id);
  }

  /** Raises FinancialExposureQuantified (ARCHITECTURE.md §8). */
  static create(id: FinancialExposureId, tenantId: TenantId, props: FinancialExposureProps): FinancialExposure {
    const exposure = new FinancialExposure(id, props);
    exposure.addDomainEvent(
      new FinancialExposureQuantifiedEvent(
        tenantId,
        props.assetId,
        props.expectedLoss.annualizedAmount.amount,
        props.financialExposure.amount,
        props.financialExposure.currency
      )
    );
    return exposure;
  }

  get assetId(): AssetId {
    return this.props.assetId;
  }

  get riskId(): RiskId {
    return this.props.riskId;
  }

  get expectedLoss(): ExpectedLoss {
    return this.props.expectedLoss;
  }

  get financialExposure(): Money {
    return this.props.financialExposure;
  }

  get residualRisk(): ResidualRisk {
    return this.props.residualRisk;
  }
}

// ---- Repository ----

export interface FinancialExposureRepository {
  list(ctx: TenantContext): Promise<FinancialExposure[]>;
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<FinancialExposure[]>;
  save(ctx: TenantContext, exposure: FinancialExposure): Promise<void>;
}

// ---- Domain Service ----

export interface QRiskAggregationService {
  /**
   * Combines asset coverage, control maturity, compliance coverage, financial
   * exposure, operational resilience and quantum readiness into the 0-100
   * Q-Risk metric (ARCHITECTURE.md §3.5 / IDEA.md "The Q-Risk Score").
   */
  calculateQRisk(ctx: TenantContext): Promise<number>;
}
