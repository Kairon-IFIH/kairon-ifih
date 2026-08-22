import {
  AggregateRoot,
  AssetId,
  CryptoAssetId,
  CryptoScanResultId,
  DomainEvent,
  Entity,
  TenantContext,
  TenantId,
  ValidationError,
  ValueObject,
} from "@kairon/shared-kernel";

/**
 * Bounded Context: Quantum Cryptography Exposure Scanning (reference/QShield-scanner-reference).
 * Scoped strictly to ONE question per asset: "if a cryptographically relevant
 * quantum computer (CRQC) arrives, is this asset's cryptography still safe, and
 * for how long?" This is a different concern from @kairon/quantum (which picks
 * a remediation PORTFOLIO under budget) — this context DISCOVERS and SCORES the
 * crypto exposure that portfolio spends money reducing.
 *
 * The scan itself is simulated over KAIRON's own Asset registry rather than
 * performing live TLS handshakes/OpenSSL probing (the reference implementation's
 * approach) — the demo's seeded assets are not real hosts, and network egress
 * from the API/EC2 box for a hackathon MVP is out of scope. What is NOT
 * simulated is the math: the classification taxonomy, the QARS rubric weights,
 * and Mosca's Theorem HNDL deadline below are the reference's logic ported
 * line-for-line, not approximated.
 */

// ---- Value Objects: classification taxonomy (cbom_generator.py) ----

/** What kind of cryptographic primitive a finding describes. */
export type CryptoAssetType =
  | "TLS_VERSION"
  | "CIPHER_SUITE"
  | "KEY_EXCHANGE"
  | "CERTIFICATE"
  | "SIGNATURE"
  | "HASH_ALGORITHM";

/**
 * NIST-guideline security strength band (cbom_generator.py `CryptoStrength`).
 * BROKEN/WEAK are always quantum-vulnerable; QUANTUM_SAFE is a genuine PQC or
 * hybrid-PQC primitive; STRONG/ACCEPTABLE are classical and quantum-vulnerable
 * even though they resist today's classical attacks — that gap is the entire
 * point of a quantum-readiness scan.
 */
export type CryptoStrength = "BROKEN" | "WEAK" | "ACCEPTABLE" | "STRONG" | "QUANTUM_SAFE" | "UNKNOWN";

const STRENGTH_ORDER: Record<CryptoStrength, number> = {
  BROKEN: 0,
  WEAK: 1,
  UNKNOWN: 2,
  ACCEPTABLE: 3,
  STRONG: 4,
  QUANTUM_SAFE: 5,
};

/** Classical vs. post-quantum vs. hybrid, per algorithm name (universal_pqc_detection.py). */
export type AlgorithmCategory = "CLASSICAL" | "HYBRID_PQC" | "PQC" | "UNKNOWN";

const QUANTUM_VULNERABLE_STRENGTHS = new Set<CryptoStrength>(["BROKEN", "WEAK", "ACCEPTABLE", "STRONG", "UNKNOWN"]);

export interface CryptoFindingProps {
  readonly assetType: CryptoAssetType;
  readonly algorithm: string;
  readonly category: AlgorithmCategory;
  readonly strength: CryptoStrength;
  readonly keySizeBits?: number;
  readonly notes?: string;
}

/** One discovered cryptographic primitive in use by a scanned asset. */
export class CryptoFinding extends ValueObject<CryptoFindingProps> {
  private constructor(props: CryptoFindingProps) {
    super(props);
  }

  static create(props: CryptoFindingProps): CryptoFinding {
    if (!props.algorithm.trim()) {
      throw new ValidationError(["CryptoFinding algorithm cannot be empty"]);
    }
    return new CryptoFinding(props);
  }

  get assetType(): CryptoAssetType {
    return this.props.assetType;
  }

  get algorithm(): string {
    return this.props.algorithm;
  }

  get category(): AlgorithmCategory {
    return this.props.category;
  }

  get strength(): CryptoStrength {
    return this.props.strength;
  }

  get keySizeBits(): number | undefined {
    return this.props.keySizeBits;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  /** A finding is quantum-vulnerable unless it's a genuine PQC/hybrid-PQC primitive. */
  get quantumVulnerable(): boolean {
    return this.props.category !== "PQC" && this.props.category !== "HYBRID_PQC";
  }
}

// ---- Entity: a discovered crypto asset (cbom_generator.py `CryptoAsset`) ----

export interface CryptoAssetProps {
  readonly hostname: string;
  readonly finding: CryptoFinding;
}

/**
 * One row of the estate's Cryptographic Bill of Materials (CBOM) — a single
 * algorithm instance in use somewhere on one asset. A ScanResult aggregates
 * many of these, exactly the way a real TLS handshake yields a TLS version, a
 * cipher suite, a key-exchange group, and a certificate chain all at once.
 */
export class CryptoAsset extends Entity<CryptoAssetId> {
  private constructor(id: CryptoAssetId, private readonly props: CryptoAssetProps) {
    super(id);
  }

  static create(id: CryptoAssetId, props: CryptoAssetProps): CryptoAsset {
    if (!props.hostname.trim()) {
      throw new ValidationError(["CryptoAsset hostname cannot be empty"]);
    }
    return new CryptoAsset(id, props);
  }

  get hostname(): string {
    return this.props.hostname;
  }

  get finding(): CryptoFinding {
    return this.props.finding;
  }
}

// ---- Value Object: HNDL / Mosca's Theorem (scoring_engine.py) ----

/**
 * How long a class of data must remain confidential once captured. Data
 * intercepted today and decrypted once a CRQC exists is the "Harvest Now,
 * Decrypt Later" (HNDL) threat — the shelf life is what makes HNDL urgent or
 * not for a given asset, independent of how strong its crypto looks today.
 */
export type DataSensitivityTier = "TRANSACTION" | "AUTHENTICATION" | "STATIC";

const SHELF_LIFE_YEARS: Record<DataSensitivityTier, number> = {
  TRANSACTION: 7,
  AUTHENTICATION: 1,
  STATIC: 0,
};

/**
 * Disclosed MVP placeholders (ARCHITECTURE.md §12 Decision 6 pattern — same
 * disclosure discipline as RiskScoringServiceImpl's IMPACT_PER_CRITICALITY_POINT_INR):
 * the reference tool's own constants for when a cryptographically relevant
 * quantum computer is expected, and the migration lead time assumed once a
 * decision to migrate is made.
 */
export const CRQC_ARRIVAL_YEAR = 2030;
const MIGRATION_LEAD_TIME_YEARS = 1;

export interface HndlAssessmentProps {
  readonly tier: DataSensitivityTier;
  readonly actNow: boolean;
  readonly safeUntilYear?: number;
}

/** Mosca's Theorem: if (shelf life + migration time) > (years until CRQC), act now. */
export class HndlAssessment extends ValueObject<HndlAssessmentProps> {
  private constructor(props: HndlAssessmentProps) {
    super(props);
  }

  static calculate(tier: DataSensitivityTier, currentYear: number): HndlAssessment {
    const shelfLife = SHELF_LIFE_YEARS[tier];
    const yearsToCrqc = CRQC_ARRIVAL_YEAR - currentYear;
    const dangerPoint = shelfLife + MIGRATION_LEAD_TIME_YEARS;

    if (dangerPoint > yearsToCrqc) {
      return new HndlAssessment({ tier, actNow: true });
    }
    return new HndlAssessment({ tier, actNow: false, safeUntilYear: CRQC_ARRIVAL_YEAR - dangerPoint });
  }

  /** Rehydrates a previously-persisted assessment — bypasses recomputing against "now". */
  static reconstitute(props: HndlAssessmentProps): HndlAssessment {
    return new HndlAssessment(props);
  }

  get tier(): DataSensitivityTier {
    return this.props.tier;
  }

  get actNow(): boolean {
    return this.props.actNow;
  }

  /** e.g. "ACT NOW (Harvest Now Decrypt Later risk)" or "Safe until 2027". */
  get status(): string {
    return this.props.actNow
      ? "ACT NOW (Harvest Now Decrypt Later risk)"
      : `Safe until ${this.props.safeUntilYear}`;
  }
}

// ---- Value Object: QARS — Quantum-Adjusted Risk Score (scoring_engine.py `calculate_qars`) ----

export type QarsRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface QarsInputs {
  readonly totalCryptoAssets: number;
  readonly quantumVulnerableAssets: number;
  readonly weakOrBrokenAssets: number;
  readonly hndlActNow: boolean;
}

export interface QarsRubricProps {
  readonly weights: {
    readonly vulnerableAssets: number;
    readonly weakAssets: number;
    readonly hndlActNow: number;
  };
  readonly ratios: {
    readonly vulnerableAssetsRatio: number;
    readonly weakAssetsRatio: number;
  };
  readonly penalties: {
    readonly vulnerableAssets: number;
    readonly weakAssets: number;
    readonly hndlActNow: number;
  };
}

/** Full transparency into how the 0-100 figure was produced — never a black box. */
export class QarsRubric extends ValueObject<QarsRubricProps> {
  private constructor(props: QarsRubricProps) {
    super(props);
  }

  static create(props: QarsRubricProps): QarsRubric {
    return new QarsRubric(props);
  }

  get weights(): QarsRubricProps["weights"] {
    return this.props.weights;
  }

  get ratios(): QarsRubricProps["ratios"] {
    return this.props.ratios;
  }

  get penalties(): QarsRubricProps["penalties"] {
    return this.props.penalties;
  }
}

export interface QarsScoreProps {
  readonly score: number; // 0..100
  readonly riskLevel: QarsRiskLevel;
  readonly rubric: QarsRubric;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function riskLevelFor(score: number): QarsRiskLevel {
  if (score >= 85) return "LOW";
  if (score >= 65) return "MEDIUM";
  if (score >= 45) return "HIGH";
  return "CRITICAL";
}

/**
 * Quantum-Adjusted Risk Score — a weighted 0-100 rubric ported exactly from
 * scoring_engine.py's `calculate_qars` (asset-level variant: this scan works
 * over one asset's crypto inventory rather than a whole endpoint fleet, so the
 * endpoint-level terms — weak_endpoints/pqc_ready/forward_secrecy ratios — are
 * folded into the single-asset weak/vulnerable ratios below; the weight ported
 * 1:1 is 40 (vulnerable assets), 10 (weak/broken assets), 10 (HNDL act-now)).
 * Never mutated after construction — a new scan produces a new QarsScore.
 */
export class QarsScore extends ValueObject<QarsScoreProps> {
  private constructor(props: QarsScoreProps) {
    super(props);
  }

  static calculate(inputs: QarsInputs): QarsScore {
    const weights = { vulnerableAssets: 40, weakAssets: 10, hndlActNow: 10 };

    const vulnerableAssetsRatio = safeRatio(inputs.quantumVulnerableAssets, inputs.totalCryptoAssets);
    const weakAssetsRatio = safeRatio(inputs.weakOrBrokenAssets, inputs.totalCryptoAssets);

    const penaltyVulnerable = weights.vulnerableAssets * vulnerableAssetsRatio;
    const penaltyWeak = weights.weakAssets * weakAssetsRatio;
    const penaltyHndl = inputs.hndlActNow && inputs.quantumVulnerableAssets > 0 ? weights.hndlActNow : 0;

    let score = 100 - penaltyVulnerable - penaltyWeak - penaltyHndl;
    score = Math.max(0, Math.min(100, score));
    score = Math.round(score * 10) / 10;

    const rubric = QarsRubric.create({
      weights,
      ratios: {
        vulnerableAssetsRatio: Math.round(vulnerableAssetsRatio * 10000) / 10000,
        weakAssetsRatio: Math.round(weakAssetsRatio * 10000) / 10000,
      },
      penalties: {
        vulnerableAssets: Math.round(penaltyVulnerable * 100) / 100,
        weakAssets: Math.round(penaltyWeak * 100) / 100,
        hndlActNow: Math.round(penaltyHndl * 100) / 100,
      },
    });

    return new QarsScore({ score, riskLevel: riskLevelFor(score), rubric });
  }

  get score(): number {
    return this.props.score;
  }

  get riskLevel(): QarsRiskLevel {
    return this.props.riskLevel;
  }

  get rubric(): QarsRubric {
    return this.props.rubric;
  }
}

// ---- Domain Event ----

export class CryptoScanCompletedEvent extends DomainEvent {
  readonly eventName = "CryptoScanCompleted" as const;
  constructor(
    tenantId: TenantId,
    readonly scanResultId: CryptoScanResultId,
    readonly assetId: AssetId,
    readonly qarsScore: number,
    readonly riskLevel: QarsRiskLevel,
    readonly quantumVulnerable: boolean,
    readonly hndlStatus: string
  ) {
    super(tenantId);
  }
}

// ---- Aggregate Root ----

export interface ScanResultProps {
  readonly assetId: AssetId;
  readonly dataSensitivityTier: DataSensitivityTier;
  readonly findings: CryptoAsset[];
  readonly hndl: HndlAssessment;
  readonly qars: QarsScore;
  readonly scannedAt: Date;
}

export class ScanResult extends AggregateRoot<CryptoScanResultId> {
  private constructor(
    id: CryptoScanResultId,
    private readonly tenantId: TenantId,
    private readonly props: ScanResultProps
  ) {
    super(id);
  }

  /** Raises CryptoScanCompleted (ARCHITECTURE.md §8 pattern). */
  static create(id: CryptoScanResultId, tenantId: TenantId, props: Omit<ScanResultProps, "scannedAt">): ScanResult {
    if (props.findings.length === 0) {
      throw new ValidationError(["A scan result needs at least one crypto finding"]);
    }
    const scan = new ScanResult(id, tenantId, { ...props, scannedAt: new Date() });
    scan.addDomainEvent(
      new CryptoScanCompletedEvent(
        tenantId,
        id,
        props.assetId,
        props.qars.score,
        props.qars.riskLevel,
        scan.quantumVulnerable,
        props.hndl.status
      )
    );
    return scan;
  }

  get assetId(): AssetId {
    return this.props.assetId;
  }

  get dataSensitivityTier(): DataSensitivityTier {
    return this.props.dataSensitivityTier;
  }

  get findings(): readonly CryptoAsset[] {
    return this.props.findings;
  }

  get hndl(): HndlAssessment {
    return this.props.hndl;
  }

  get qars(): QarsScore {
    return this.props.qars;
  }

  get scannedAt(): Date {
    return this.props.scannedAt;
  }

  /** True if any finding still relies on classical (non-PQC) cryptography. */
  get quantumVulnerable(): boolean {
    return this.props.findings.some((f) => f.finding.quantumVulnerable);
  }

  get weakestStrength(): CryptoStrength {
    return this.props.findings.reduce<CryptoStrength>((worst, f) => {
      return STRENGTH_ORDER[f.finding.strength] < STRENGTH_ORDER[worst] ? f.finding.strength : worst;
    }, "QUANTUM_SAFE");
  }
}

export function isQuantumVulnerableStrength(strength: CryptoStrength): boolean {
  return QUANTUM_VULNERABLE_STRENGTHS.has(strength);
}

// ---- Repository ----

export interface ScanResultRepository {
  list(ctx: TenantContext): Promise<ScanResult[]>;
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult[]>;
  findLatestByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult | null>;
  findById(ctx: TenantContext, scanResultId: CryptoScanResultId): Promise<ScanResult | null>;
  save(ctx: TenantContext, scanResult: ScanResult): Promise<void>;
}

// ---- Domain Service: the scan itself ----

/**
 * Runs a crypto-exposure scan for one asset. The reference implementation
 * (tls_scanner.py) performs a live TLS handshake, probes OpenSSL for hybrid
 * PQC groups, and walks the certificate chain; this port simulates the same
 * discovery deterministically from the asset's own KAIRON attributes
 * (criticality, data classification, asset type), so the same asset always
 * yields the same finding set — required for a demo run to be reproducible.
 */
export interface CryptoScannerService {
  scanAsset(
    ctx: TenantContext,
    input: { assetId: AssetId; assetType: string; criticality: string; dataClassification: string; hostname: string }
  ): Promise<{ findings: CryptoAsset[]; dataSensitivityTier: DataSensitivityTier }>;
}
