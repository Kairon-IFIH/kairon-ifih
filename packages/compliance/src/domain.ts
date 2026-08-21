import {
  AggregateRoot,
  AssetId,
  ComplianceMappingId,
  ControlId,
  Entity,
  EvidenceId,
  FrameworkId,
  NotImplementedError,
  RegulationId,
  RequirementId,
  TenantContext,
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

  static create(_id: RequirementId, _props: RequirementProps): Requirement {
    throw new NotImplementedError("Requirement.create — Phase 4");
  }
}

export interface ControlProps {
  readonly name: string;
  readonly requirementIds: RequirementId[];
  readonly maturityLevel: number;
}

export class Control extends Entity<ControlId> {
  private constructor(id: ControlId, private readonly props: ControlProps) {
    super(id);
  }

  static create(_id: ControlId, _props: ControlProps): Control {
    throw new NotImplementedError("Control.create — Phase 4");
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

  static create(_id: RegulationId, _props: RegulationProps): Regulation {
    throw new NotImplementedError("Regulation.create — Phase 4");
  }
}

export interface FrameworkProps {
  readonly code: "DPDP" | "GDPR" | "DORA" | "NIST" | "ISO27001";
  readonly version: string;
  readonly regulationIds: RegulationId[];
}

export class Framework extends Entity<FrameworkId> {
  private constructor(id: FrameworkId, private readonly props: FrameworkProps) {
    super(id);
  }

  static create(_id: FrameworkId, _props: FrameworkProps): Framework {
    throw new NotImplementedError("Framework.create — Phase 4, ARCHITECTURE.md §1.13 (1-2 hardcoded frameworks for MVP)");
  }
}

// ---- Tenant-scoped aggregate ----

export type GapStatusValue = "COMPLIANT" | "GAP" | "PARTIAL";

export interface GapStatusProps {
  readonly value: GapStatusValue;
}

export class GapStatus extends ValueObject<GapStatusProps> {
  private constructor(props: GapStatusProps) {
    super(props);
  }

  static create(_value: GapStatusValue): GapStatus {
    throw new NotImplementedError("GapStatus.create — Phase 4");
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

  static create(_id: EvidenceId, _props: EvidenceProps): Evidence {
    throw new NotImplementedError("Evidence.create — Phase 4/6");
  }
}

export interface ComplianceMappingProps {
  readonly assetId: AssetId;
  readonly controlId: ControlId;
  readonly gapStatus: GapStatus;
  readonly evidence: Evidence[];
}

export class ComplianceMapping extends AggregateRoot<ComplianceMappingId> {
  private constructor(id: ComplianceMappingId, private readonly props: ComplianceMappingProps) {
    super(id);
  }

  /** Raises ComplianceMapped (ARCHITECTURE.md §8) — deferred. */
  static create(_id: ComplianceMappingId, _props: ComplianceMappingProps): ComplianceMapping {
    throw new NotImplementedError("ComplianceMapping.create — Phase 4");
  }
}

// ---- Repositories ----

export interface FrameworkRepository {
  findByCode(code: FrameworkProps["code"]): Promise<Framework | null>;
  list(): Promise<Framework[]>;
}

export interface ComplianceMappingRepository {
  findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ComplianceMapping[]>;
  save(ctx: TenantContext, mapping: ComplianceMapping): Promise<void>;
}

// ---- Domain Services ----

export interface RegulatoryTraceabilityService {
  /** Walks Regulation -> Control -> Asset (ARCHITECTURE.md §3.5) to justify a recommendation. */
  traceAssetToRegulation(
    ctx: TenantContext,
    assetId: AssetId
  ): Promise<Array<{ regulation: Regulation; control: Control }>>;
}
