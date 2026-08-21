import {
  AggregateRoot,
  AssetId,
  AssetOwnerId,
  BusinessServiceId,
  Entity,
  NotImplementedError,
  TenantContext,
  ValueObject,
} from "@kairon/shared-kernel";

/** Bounded Context: Asset Discovery (ARCHITECTURE.md §3.1). */

// ---- Value Objects ----

export type CriticalityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CriticalityProps {
  readonly level: CriticalityLevel;
  readonly weight: number;
}

export class Criticality extends ValueObject<CriticalityProps> {
  private constructor(props: CriticalityProps) {
    super(props);
  }

  static create(_level: CriticalityLevel): Criticality {
    throw new NotImplementedError("Criticality.create — Phase 2, ARCHITECTURE.md §3.2");
  }

  get level(): CriticalityLevel {
    return this.props.level;
  }

  get weight(): number {
    return this.props.weight;
  }
}

export type DataClassificationLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface DataClassificationProps {
  readonly level: DataClassificationLevel;
}

export class DataClassification extends ValueObject<DataClassificationProps> {
  private constructor(props: DataClassificationProps) {
    super(props);
  }

  static create(_level: DataClassificationLevel): DataClassification {
    throw new NotImplementedError("DataClassification.create — Phase 2");
  }
}

export interface RegulatoryScopeProps {
  readonly frameworkCodes: string[];
}

export class RegulatoryScope extends ValueObject<RegulatoryScopeProps> {
  private constructor(props: RegulatoryScopeProps) {
    super(props);
  }

  static create(_frameworkCodes: string[]): RegulatoryScope {
    throw new NotImplementedError("RegulatoryScope.create — Phase 4 (Compliance Engine)");
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

  static create(_id: AssetOwnerId, _props: AssetOwnerProps): AssetOwner {
    throw new NotImplementedError("AssetOwner.create — Phase 2");
  }
}

export interface BusinessServiceProps {
  readonly name: string;
}

export class BusinessService extends Entity<BusinessServiceId> {
  private constructor(id: BusinessServiceId, private readonly props: BusinessServiceProps) {
    super(id);
  }

  static create(_id: BusinessServiceId, _props: BusinessServiceProps): BusinessService {
    throw new NotImplementedError("BusinessService.create — Phase 2");
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
  private constructor(id: AssetId, private readonly props: AssetProps) {
    super(id);
  }

  /** Raises AssetDiscovered on creation (ARCHITECTURE.md §8) — deferred. */
  static create(_id: AssetId, _props: AssetProps): Asset {
    throw new NotImplementedError("Asset.create — Phase 2, ARCHITECTURE.md §1.4 workflow entry point");
  }

  classify(_dataClassification: DataClassification, _regulatoryScope: RegulatoryScope): void {
    throw new NotImplementedError("Asset.classify — Phase 2, raises AssetClassified");
  }
}

// ---- Repository ----

export interface AssetRepository {
  findById(ctx: TenantContext, assetId: AssetId): Promise<Asset | null>;
  list(ctx: TenantContext): Promise<Asset[]>;
  save(ctx: TenantContext, asset: Asset): Promise<void>;
}
