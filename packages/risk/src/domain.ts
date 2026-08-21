import {
  AggregateRoot,
  AssetId,
  Entity,
  NotImplementedError,
  RiskFactorId,
  RiskId,
  TenantContext,
  ValueObject,
} from "@kairon/shared-kernel";

/** Bounded Context: Risk Intelligence (ARCHITECTURE.md §3.1). Risk = Likelihood x Impact. */

// ---- Value Objects ----

export interface LikelihoodProps {
  readonly value: number; // 0..1
}

export class Likelihood extends ValueObject<LikelihoodProps> {
  private constructor(props: LikelihoodProps) {
    super(props);
  }

  static create(_value: number): Likelihood {
    throw new NotImplementedError("Likelihood.create — Phase 3, must reject value outside [0,1]");
  }

  get value(): number {
    return this.props.value;
  }
}

export interface ImpactProps {
  readonly amount: number;
  readonly currency: "INR" | "USD";
}

export class Impact extends ValueObject<ImpactProps> {
  private constructor(props: ImpactProps) {
    super(props);
  }

  static create(_amount: number, _currency: "INR" | "USD"): Impact {
    throw new NotImplementedError("Impact.create — Phase 3");
  }
}

export interface RiskScoreProps {
  readonly inherentScore: number; // 0..100
  readonly residualScore: number; // 0..100
  readonly level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** Immutable once calculated (ARCHITECTURE.md §3.2) — never mutated after construction. */
export class RiskScore extends ValueObject<RiskScoreProps> {
  private constructor(props: RiskScoreProps) {
    super(props);
  }

  static calculate(_likelihood: Likelihood, _impact: Impact, _controlEffectiveness: number): RiskScore {
    throw new NotImplementedError(
      "RiskScore.calculate — Phase 3, ARCHITECTURE.md §1.5 Risk = Likelihood x Impact"
    );
  }

  get inherentScore(): number {
    return this.props.inherentScore;
  }

  get residualScore(): number {
    return this.props.residualScore;
  }
}

// ---- Entities ----

export interface RiskFactorProps {
  readonly name: string;
  readonly weight: number;
}

export class RiskFactor extends Entity<RiskFactorId> {
  private constructor(id: RiskFactorId, private readonly props: RiskFactorProps) {
    super(id);
  }

  static create(_id: RiskFactorId, _props: RiskFactorProps): RiskFactor {
    throw new NotImplementedError("RiskFactor.create — Phase 3");
  }
}

// ---- Aggregate Root ----

export interface RiskProps {
  readonly assetId: AssetId;
  readonly factors: RiskFactor[];
  readonly score: RiskScore;
}

export class Risk extends AggregateRoot<RiskId> {
  private constructor(id: RiskId, private readonly props: RiskProps) {
    super(id);
  }

  /** Raises RiskCalculated (ARCHITECTURE.md §8) — deferred. */
  static create(_id: RiskId, _props: RiskProps): Risk {
    throw new NotImplementedError("Risk.create — Phase 3");
  }
}

// ---- Repository ----

export interface RiskRepository {
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<Risk[]>;
  findById(ctx: TenantContext, riskId: RiskId): Promise<Risk | null>;
  save(ctx: TenantContext, risk: Risk): Promise<void>;
}

// ---- Domain Service ----

export interface RiskScoringService {
  /** Applies control-effectiveness discount to derive Residual Risk (ARCHITECTURE.md §3.5). */
  scoreAsset(ctx: TenantContext, assetId: AssetId): Promise<RiskScore>;
}
