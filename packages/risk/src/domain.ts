import {
  AggregateRoot,
  AssetId,
  DomainEvent,
  Entity,
  Money,
  RiskFactorId,
  RiskId,
  TenantContext,
  TenantId,
  ValidationError,
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

  static create(value: number): Likelihood {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new ValidationError([`Likelihood must be between 0 and 1, got ${value}`]);
    }
    return new Likelihood({ value });
  }

  get value(): number {
    return this.props.value;
  }
}

export interface ImpactProps {
  readonly money: Money;
}

export class Impact extends ValueObject<ImpactProps> {
  private constructor(props: ImpactProps) {
    super(props);
  }

  static create(amount: number, currency: "INR" | "USD"): Impact {
    return new Impact({ money: Money.create(amount, currency) });
  }

  get money(): Money {
    return this.props.money;
  }
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskScoreProps {
  readonly inherentScore: number; // 0..100
  readonly residualScore: number; // 0..100
  readonly level: RiskLevel;
}

/**
 * Reference impact that maps to 100% severity on the 0-100 scale. This is an
 * explicit, disclosed MVP placeholder (ARCHITECTURE.md §12 Decision 6 requires
 * loss-model assumptions to be disclosed, not left implicit) — swap for a real
 * methodology (e.g. FAIR) once one is chosen.
 */
const MAX_REFERENCE_IMPACT_INR = 100_00_000; // ₹1 Crore

function levelFor(residualScore: number): RiskLevel {
  if (residualScore < 25) return "LOW";
  if (residualScore < 50) return "MEDIUM";
  if (residualScore < 75) return "HIGH";
  return "CRITICAL";
}

/** Immutable once calculated (ARCHITECTURE.md §3.2) — never mutated after construction. */
export class RiskScore extends ValueObject<RiskScoreProps> {
  private constructor(props: RiskScoreProps) {
    super(props);
  }

  static calculate(likelihood: Likelihood, impact: Impact, controlEffectiveness: number): RiskScore {
    if (!Number.isFinite(controlEffectiveness) || controlEffectiveness < 0 || controlEffectiveness > 1) {
      throw new ValidationError([`controlEffectiveness must be between 0 and 1, got ${controlEffectiveness}`]);
    }
    const normalizedImpact = Math.min(impact.money.amount / MAX_REFERENCE_IMPACT_INR, 1) * 100;
    const inherentScore = Math.round(likelihood.value * normalizedImpact);
    const residualScore = Math.round(inherentScore * (1 - controlEffectiveness));
    return new RiskScore({ inherentScore, residualScore, level: levelFor(residualScore) });
  }

  get inherentScore(): number {
    return this.props.inherentScore;
  }

  get residualScore(): number {
    return this.props.residualScore;
  }

  get level(): RiskLevel {
    return this.props.level;
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

  static create(id: RiskFactorId, props: RiskFactorProps): RiskFactor {
    if (!props.name.trim()) {
      throw new ValidationError(["RiskFactor name cannot be empty"]);
    }
    return new RiskFactor(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get weight(): number {
    return this.props.weight;
  }
}

// ---- Domain Event ----

export class RiskCalculatedEvent extends DomainEvent {
  readonly eventName = "RiskCalculated" as const;
  constructor(
    tenantId: TenantId,
    readonly riskId: RiskId,
    readonly assetId: AssetId,
    readonly likelihood: number,
    readonly impact: number,
    readonly riskScore: number,
    readonly residualRisk: number
  ) {
    super(tenantId);
  }
}

// ---- Aggregate Root ----

export interface RiskProps {
  readonly assetId: AssetId;
  readonly factors: RiskFactor[];
  readonly likelihood: Likelihood;
  readonly impact: Impact;
  readonly score: RiskScore;
}

export class Risk extends AggregateRoot<RiskId> {
  private constructor(id: RiskId, private readonly tenantId: TenantId, private readonly props: RiskProps) {
    super(id);
  }

  /** Raises RiskCalculated (ARCHITECTURE.md §8). */
  static create(id: RiskId, tenantId: TenantId, props: RiskProps): Risk {
    const risk = new Risk(id, tenantId, props);
    risk.addDomainEvent(
      new RiskCalculatedEvent(
        tenantId,
        id,
        props.assetId,
        props.likelihood.value,
        props.impact.money.amount,
        props.score.inherentScore,
        props.score.residualScore
      )
    );
    return risk;
  }

  get assetId(): AssetId {
    return this.props.assetId;
  }

  get likelihood(): Likelihood {
    return this.props.likelihood;
  }

  get impact(): Impact {
    return this.props.impact;
  }

  get score(): RiskScore {
    return this.props.score;
  }
}

// ---- Repository ----

export interface RiskRepository {
  list(ctx: TenantContext): Promise<Risk[]>;
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<Risk[]>;
  findById(ctx: TenantContext, riskId: RiskId): Promise<Risk | null>;
  save(ctx: TenantContext, risk: Risk): Promise<void>;
}

// ---- Domain Service ----

export interface RiskAssessment {
  readonly likelihood: Likelihood;
  readonly impact: Impact;
  readonly controlEffectiveness: number;
  readonly score: RiskScore;
}

export interface RiskScoringService {
  /** Applies control-effectiveness discount to derive Residual Risk (ARCHITECTURE.md §3.5). */
  scoreAsset(ctx: TenantContext, assetId: AssetId): Promise<RiskAssessment>;
}
