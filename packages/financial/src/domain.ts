import {
  AggregateRoot,
  AssetId,
  Entity,
  FinancialExposureId,
  Money,
  NotImplementedError,
  RiskId,
  TenantContext,
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

  static create(_exposure: Money): ResidualRisk {
    throw new NotImplementedError("ResidualRisk.create — Phase 3");
  }
}

// ---- Entities ----

export interface ExpectedLossProps {
  readonly annualizedAmount: Money;
}

export class ExpectedLoss extends Entity<FinancialExposureId> {
  private constructor(id: FinancialExposureId, private readonly props: ExpectedLossProps) {
    super(id);
  }

  static create(_id: FinancialExposureId, _props: ExpectedLossProps): ExpectedLoss {
    throw new NotImplementedError(
      "ExpectedLoss.create — Phase 3; loss-model assumptions must be disclosed (ARCHITECTURE.md §12 Decision 6)"
    );
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

  static create(_id: FinancialExposureId, _props: RemediationCostProps): RemediationCost {
    throw new NotImplementedError("RemediationCost.create — Phase 3");
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

  /** Raises FinancialExposureQuantified (ARCHITECTURE.md §8) — deferred. */
  static create(_id: FinancialExposureId, _props: FinancialExposureProps): FinancialExposure {
    throw new NotImplementedError("FinancialExposure.create — Phase 3");
  }
}

// ---- Repository ----

export interface FinancialExposureRepository {
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
