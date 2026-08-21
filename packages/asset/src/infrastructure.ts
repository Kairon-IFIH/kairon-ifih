import type { PrismaClient } from "@prisma/client";
import {
  asAssetId,
  asAssetOwnerId,
  asBusinessServiceId,
  asTenantId,
  AssetId,
  TenantContext,
} from "@kairon/shared-kernel";
import { Asset, Criticality, CriticalityLevel, DataClassification, DataClassificationLevel, RegulatoryScope } from "./domain";
import type { AssetRepository } from "./domain";

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    assetType: string;
    ownerId: string | null;
    businessServiceId: string | null;
    criticalityLevel: string;
    dataClassification: string;
    regulatoryScope: unknown;
  }): Asset {
    return Asset.create(asAssetId(row.id), asTenantId(row.tenantId), {
      name: row.name,
      assetType: row.assetType,
      ownerId: row.ownerId ? asAssetOwnerId(row.ownerId) : undefined,
      businessServiceId: row.businessServiceId ? asBusinessServiceId(row.businessServiceId) : undefined,
      criticality: Criticality.create(row.criticalityLevel as CriticalityLevel),
      dataClassification: DataClassification.create(row.dataClassification as DataClassificationLevel),
      regulatoryScope: RegulatoryScope.create(row.regulatoryScope as string[]),
    });
  }

  async findById(ctx: TenantContext, assetId: AssetId): Promise<Asset | null> {
    const row = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId: ctx.tenantId } });
    return row ? this.toDomain(row) : null;
  }

  async list(ctx: TenantContext): Promise<Asset[]> {
    const rows = await this.prisma.asset.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toDomain(r));
  }

  async save(ctx: TenantContext, asset: Asset): Promise<void> {
    await this.prisma.asset.upsert({
      where: { id: asset.id },
      create: {
        id: asset.id,
        tenantId: ctx.tenantId,
        name: asset.name,
        assetType: asset.assetType,
        ownerId: asset.ownerId ?? null,
        businessServiceId: asset.businessServiceId ?? null,
        criticalityLevel: asset.criticality.level,
        dataClassification: asset.dataClassification.level,
        regulatoryScope: [...asset.regulatoryScope.frameworkCodes],
      },
      update: {
        name: asset.name,
        assetType: asset.assetType,
        ownerId: asset.ownerId ?? null,
        businessServiceId: asset.businessServiceId ?? null,
        criticalityLevel: asset.criticality.level,
        dataClassification: asset.dataClassification.level,
        regulatoryScope: [...asset.regulatoryScope.frameworkCodes],
      },
    });
  }
}

/**
 * In-memory implementation — the actual Phase-"right now" persistence. Nested
 * by tenantId so tenant isolation (ARCHITECTURE.md §4.1) is structural here
 * too, not just a convention carried over from the Prisma version.
 */
export class InMemoryAssetRepository implements AssetRepository {
  private readonly byTenant = new Map<string, Map<string, Asset>>();

  private tenantStore(ctx: TenantContext): Map<string, Asset> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async findById(ctx: TenantContext, assetId: AssetId): Promise<Asset | null> {
    return this.tenantStore(ctx).get(assetId) ?? null;
  }

  async list(ctx: TenantContext): Promise<Asset[]> {
    return [...this.tenantStore(ctx).values()];
  }

  async save(ctx: TenantContext, asset: Asset): Promise<void> {
    this.tenantStore(ctx).set(asset.id, asset);
  }
}
