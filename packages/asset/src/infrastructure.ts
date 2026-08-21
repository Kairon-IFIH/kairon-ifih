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
