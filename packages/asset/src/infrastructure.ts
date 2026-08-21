import { AssetId, NotImplementedError, TenantContext } from "@kairon/shared-kernel";
import type { Asset, AssetRepository } from "./domain";

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_ctx: TenantContext, _assetId: AssetId): Promise<Asset | null> {
    throw new NotImplementedError("PrismaAssetRepository.findById — Phase 2");
  }

  async list(_ctx: TenantContext): Promise<Asset[]> {
    throw new NotImplementedError("PrismaAssetRepository.list — Phase 2");
  }

  async save(_ctx: TenantContext, _asset: Asset): Promise<void> {
    throw new NotImplementedError("PrismaAssetRepository.save — Phase 2");
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
