import {
  AggregateRoot,
  AssetId,
  AssetOwnerId,
  BusinessServiceId,
  DomainEvent,
  Entity,
  TenantContext,
  TenantId,
  ValidationError,
  ValueObject,
} from "@kairon/shared-kernel";

/** Bounded Context: Asset Discovery (ARCHITECTURE.md §3.1). */

// ---- Value Objects ----

export type CriticalityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const CRITICALITY_WEIGHTS: Record<CriticalityLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface CriticalityProps {
  readonly level: CriticalityLevel;
  readonly weight: number;
}

export class Criticality extends ValueObject<CriticalityProps> {
  private constructor(props: CriticalityProps) {
    super(props);
  }

  static create(level: CriticalityLevel): Criticality {
    const weight = CRITICALITY_WEIGHTS[level];
    if (weight === undefined) {
      throw new ValidationError([`Unknown criticality level: ${level}`]);
    }
    return new Criticality({ level, weight });
  }

  get level(): CriticalityLevel {
    return this.props.level;
  }

  get weight(): number {
    return this.props.weight;
  }
}

export type DataClassificationLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

const DATA_CLASSIFICATION_LEVELS: DataClassificationLevel[] = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
];

export interface DataClassificationProps {
  readonly level: DataClassificationLevel;
}

export class DataClassification extends ValueObject<DataClassificationProps> {
  private constructor(props: DataClassificationProps) {
    super(props);
  }

  static create(level: DataClassificationLevel): DataClassification {
    if (!DATA_CLASSIFICATION_LEVELS.includes(level)) {
      throw new ValidationError([`Unknown data classification level: ${level}`]);
    }
    return new DataClassification({ level });
  }

  get level(): DataClassificationLevel {
    return this.props.level;
  }
}

export interface RegulatoryScopeProps {
  readonly frameworkCodes: string[];
}

/** Populated meaningfully once Compliance mapping runs (Phase 4) — empty is a valid MVP default. */
export class RegulatoryScope extends ValueObject<RegulatoryScopeProps> {
  private constructor(props: RegulatoryScopeProps) {
    super(props);
  }

  static create(frameworkCodes: string[] = []): RegulatoryScope {
    return new RegulatoryScope({ frameworkCodes: [...frameworkCodes] });
  }

  get frameworkCodes(): readonly string[] {
    return this.props.frameworkCodes;
  }
}

// ---- Entities ----

export interface AssetOwnerProps {
  readonly name: string;
  readonly department: string;
}

export class AssetOwner extends Entity<AssetOwnerId> {
  private constructor(id: AssetOwnerId, private readonly props: AssetOwnerProps) {
    super(id);
  }

  static create(id: AssetOwnerId, props: AssetOwnerProps): AssetOwner {
    if (!props.name.trim() || !props.department.trim()) {
      throw new ValidationError(["AssetOwner requires a name and department"]);
    }
    return new AssetOwner(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get department(): string {
    return this.props.department;
  }
}

export interface BusinessServiceProps {
  readonly name: string;
}

export class BusinessService extends Entity<BusinessServiceId> {
  private constructor(id: BusinessServiceId, private readonly props: BusinessServiceProps) {
    super(id);
  }

  static create(id: BusinessServiceId, props: BusinessServiceProps): BusinessService {
    if (!props.name.trim()) {
      throw new ValidationError(["BusinessService name cannot be empty"]);
    }
    return new BusinessService(id, props);
  }

  get name(): string {
    return this.props.name;
  }
}

// ---- Domain Events ----

export class AssetDiscoveredEvent extends DomainEvent {
  readonly eventName = "AssetDiscovered" as const;
  constructor(
    tenantId: TenantId,
    readonly assetId: AssetId,
    readonly assetType: string,
    readonly criticality: CriticalityLevel
  ) {
    super(tenantId);
  }
}

export class AssetClassifiedEvent extends DomainEvent {
  readonly eventName = "AssetClassified" as const;
  constructor(
    tenantId: TenantId,
    readonly assetId: AssetId,
    readonly dataClassification: DataClassificationLevel,
    readonly regulatoryScope: readonly string[]
  ) {
    super(tenantId);
  }
}

// ---- Aggregate Root ----

export interface AssetProps {
  readonly name: string;
  readonly assetType: string;
  readonly ownerId?: AssetOwnerId;
  readonly businessServiceId?: BusinessServiceId;
  readonly criticality: Criticality;
  readonly dataClassification: DataClassification;
  readonly regulatoryScope: RegulatoryScope;
}

export class Asset extends AggregateRoot<AssetId> {
  private constructor(
    id: AssetId,
    private readonly tenantId: TenantId,
    private props: AssetProps
  ) {
    super(id);
  }

  /** Raises AssetDiscovered (ARCHITECTURE.md §8) — the MVP workflow's entry point. */
  static create(id: AssetId, tenantId: TenantId, props: AssetProps): Asset {
    if (!props.name.trim()) {
      throw new ValidationError(["Asset name cannot be empty"]);
    }
    if (!props.assetType.trim()) {
      throw new ValidationError(["Asset type cannot be empty"]);
    }
    const asset = new Asset(id, tenantId, props);
    asset.addDomainEvent(
      new AssetDiscoveredEvent(tenantId, id, props.assetType, props.criticality.level)
    );
    return asset;
  }

  get name(): string {
    return this.props.name;
  }

  get assetType(): string {
    return this.props.assetType;
  }

  get criticality(): Criticality {
    return this.props.criticality;
  }

  get dataClassification(): DataClassification {
    return this.props.dataClassification;
  }

  get regulatoryScope(): RegulatoryScope {
    return this.props.regulatoryScope;
  }

  /** Raises AssetClassified (ARCHITECTURE.md §8). */
  classify(dataClassification: DataClassification, regulatoryScope: RegulatoryScope): void {
    this.props = { ...this.props, dataClassification, regulatoryScope };
    this.addDomainEvent(
      new AssetClassifiedEvent(this.tenantId, this.id, dataClassification.level, regulatoryScope.frameworkCodes)
    );
  }
}

// ---- Repository ----

export interface AssetRepository {
  findById(ctx: TenantContext, assetId: AssetId): Promise<Asset | null>;
  list(ctx: TenantContext): Promise<Asset[]>;
  save(ctx: TenantContext, asset: Asset): Promise<void>;
}
