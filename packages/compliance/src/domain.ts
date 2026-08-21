import {
  AggregateRoot,
  AssetId,
  ComplianceMappingId,
  ControlId,
  DomainEvent,
  Entity,
  EvidenceId,
  FrameworkId,
  RegulationId,
  RequirementId,
  TenantContext,
  TenantId,
  ValidationError,
  ValueObject,
} from "@kairon/shared-kernel";

/**
 * Bounded Context: Regulatory Intelligence (ARCHITECTURE.md §3.1).
 * Framework/Regulation/Control/Requirement are platform-owned reference data —
 * NOT tenant-scoped (ARCHITECTURE.md §4.4). ComplianceMapping (Asset<->Control)
 * is the tenant-scoped aggregate.
 */

// ---- Reference data entities (platform-owned, read-mostly) ----

export interface RequirementProps {
  readonly text: string;
  readonly clauseReference: string;
}

export class Requirement extends Entity<RequirementId> {
  private constructor(id: RequirementId, private readonly props: RequirementProps) {
    super(id);
  }

  static create(id: RequirementId, props: RequirementProps): Requirement {
    if (!props.text.trim() || !props.clauseReference.trim()) {
      throw new ValidationError(["Requirement needs text and a clauseReference"]);
    }
    return new Requirement(id, props);
  }

  get text(): string {
    return this.props.text;
  }

  get clauseReference(): string {
    return this.props.clauseReference;
  }
}

export interface ControlProps {
  readonly name: string;
  readonly requirementIds: RequirementId[];
  readonly maturityLevel: number; // 0..5
}

export class Control extends Entity<ControlId> {
  private constructor(id: ControlId, private readonly props: ControlProps) {
    super(id);
  }

  static create(id: ControlId, props: ControlProps): Control {
    if (!props.name.trim()) {
      throw new ValidationError(["Control name cannot be empty"]);
    }
    if (props.maturityLevel < 0 || props.maturityLevel > 5) {
      throw new ValidationError(["Control maturityLevel must be between 0 and 5"]);
    }
    return new Control(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get maturityLevel(): number {
    return this.props.maturityLevel;
  }

  /** Fraction 0..1, feeds RiskScoringService's control-effectiveness input once Compliance and Risk are wired together (Phase 4 follow-on). */
  get effectiveness(): number {
    return this.props.maturityLevel / 5;
  }
}

export interface RegulationProps {
  readonly name: string;
  readonly clauseReference: string;
  readonly controlIds: ControlId[];
}

export class Regulation extends Entity<RegulationId> {
  private constructor(id: RegulationId, private readonly props: RegulationProps) {
    super(id);
  }

  static create(id: RegulationId, props: RegulationProps): Regulation {
    if (!props.name.trim()) {
      throw new ValidationError(["Regulation name cannot be empty"]);
    }
    return new Regulation(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get clauseReference(): string {
    return this.props.clauseReference;
  }

  get controlIds(): readonly ControlId[] {
    return this.props.controlIds;
  }
}

export type FrameworkCode = "DPDP" | "GDPR" | "DORA" | "NIST" | "ISO27001";
const FRAMEWORK_CODES: FrameworkCode[] = ["DPDP", "GDPR", "DORA", "NIST", "ISO27001"];

export interface FrameworkProps {
  readonly code: FrameworkCode;
  readonly version: string;
  readonly regulationIds: RegulationId[];
}

export class Framework extends Entity<FrameworkId> {
  private constructor(id: FrameworkId, private readonly props: FrameworkProps) {
    super(id);
  }

  static create(id: FrameworkId, props: FrameworkProps): Framework {
    if (!FRAMEWORK_CODES.includes(props.code)) {
      throw new ValidationError([`Unknown framework code: ${props.code}`]);
    }
    if (!props.version.trim()) {
      throw new ValidationError(["Framework version cannot be empty"]);
    }
    return new Framework(id, props);
  }

  get code(): FrameworkCode {
    return this.props.code;
  }

  get version(): string {
    return this.props.version;
  }

  get regulationIds(): readonly RegulationId[] {
    return this.props.regulationIds;
  }
}

// ---- Tenant-scoped aggregate ----

export type GapStatusValue = "COMPLIANT" | "GAP" | "PARTIAL";
const GAP_STATUS_VALUES: GapStatusValue[] = ["COMPLIANT", "GAP", "PARTIAL"];

export interface GapStatusProps {
  readonly value: GapStatusValue;
}

export class GapStatus extends ValueObject<GapStatusProps> {
  private constructor(props: GapStatusProps) {
    super(props);
  }

  static create(value: GapStatusValue): GapStatus {
    if (!GAP_STATUS_VALUES.includes(value)) {
      throw new ValidationError([`Unknown gap status: ${value}`]);
    }
    return new GapStatus({ value });
  }

  /** Derives status from control maturity — COMPLIANT >=4, PARTIAL >=2, else GAP. */
  static fromControlMaturity(maturityLevel: number): GapStatus {
    if (maturityLevel >= 4) return GapStatus.create("COMPLIANT");
    if (maturityLevel >= 2) return GapStatus.create("PARTIAL");
    return GapStatus.create("GAP");
  }

  get value(): GapStatusValue {
    return this.props.value;
  }
}

export interface EvidenceProps {
  readonly description: string;
  readonly documentRef: string;
}

export class Evidence extends Entity<EvidenceId> {
  private constructor(id: EvidenceId, private readonly props: EvidenceProps) {
    super(id);
  }

  static create(id: EvidenceId, props: EvidenceProps): Evidence {
    if (!props.description.trim()) {
      throw new ValidationError(["Evidence description cannot be empty"]);
    }
    return new Evidence(id, props);
  }

  get description(): string {
    return this.props.description;
  }

  get documentRef(): string {
    return this.props.documentRef;
  }
}

// ---- Domain Event ----

export class ComplianceMappedEvent extends DomainEvent {
  readonly eventName = "ComplianceMapped" as const;
  constructor(
    tenantId: TenantId,
    readonly assetId: AssetId,
    readonly controlId: ControlId,
    readonly gapStatus: GapStatusValue
  ) {
    super(tenantId);
  }
}

export interface ComplianceMappingProps {
  readonly assetId: AssetId;
  readonly controlId: ControlId;
  readonly gapStatus: GapStatus;
  readonly evidence: Evidence[];
}

export class ComplianceMapping extends AggregateRoot<ComplianceMappingId> {
  private constructor(
    id: ComplianceMappingId,
    private readonly tenantId: TenantId,
    private readonly props: ComplianceMappingProps
  ) {
    super(id);
  }

  /** Raises ComplianceMapped (ARCHITECTURE.md §8). */
  static create(id: ComplianceMappingId, tenantId: TenantId, props: ComplianceMappingProps): ComplianceMapping {
    const mapping = new ComplianceMapping(id, tenantId, props);
    mapping.addDomainEvent(new ComplianceMappedEvent(tenantId, props.assetId, props.controlId, props.gapStatus.value));
    return mapping;
  }

  get assetId(): AssetId {
    return this.props.assetId;
  }

  get controlId(): ControlId {
    return this.props.controlId;
  }

  get gapStatus(): GapStatus {
    return this.props.gapStatus;
  }

  get evidence(): readonly Evidence[] {
    return this.props.evidence;
  }
}

// ---- Repositories ----

export interface FrameworkRepository {
  findByCode(code: FrameworkCode): Promise<Framework | null>;
  list(): Promise<Framework[]>;
}

export interface RegulationRepository {
  findByFramework(frameworkId: FrameworkId): Promise<Regulation[]>;
}

export interface ControlRepository {
  findById(controlId: ControlId): Promise<Control | null>;
  findByRegulation(regulationId: RegulationId): Promise<Control[]>;
}

export interface ComplianceMappingRepository {
  list(ctx: TenantContext): Promise<ComplianceMapping[]>;
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ComplianceMapping[]>;
  save(ctx: TenantContext, mapping: ComplianceMapping): Promise<void>;
}

// ---- Domain Services ----

export interface TraceabilityEntry {
  readonly framework: Framework;
  readonly regulation: Regulation;
  readonly control: Control;
}

export interface RegulatoryTraceabilityService {
  /** Walks Regulation -> Control -> Asset (ARCHITECTURE.md §3.5) to justify a recommendation. */
  traceAssetToRegulation(ctx: TenantContext, assetId: AssetId): Promise<TraceabilityEntry[]>;
}
