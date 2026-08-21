import { AssetId, NotImplementedError, RiskId, TenantContext } from "@kairon/shared-kernel";
import type { Risk, RiskRepository } from "./domain";

export class PrismaRiskRepository implements RiskRepository {
  constructor(private readonly prisma: unknown) {}

  async findByAsset(_ctx: TenantContext, _assetId: AssetId): Promise<Risk[]> {
    throw new NotImplementedError("PrismaRiskRepository.findByAsset — Phase 3");
  }

  async findById(_ctx: TenantContext, _riskId: RiskId): Promise<Risk | null> {
    throw new NotImplementedError("PrismaRiskRepository.findById — Phase 3");
  }

  async save(_ctx: TenantContext, _risk: Risk): Promise<void> {
    throw new NotImplementedError("PrismaRiskRepository.save — Phase 3");
  }
}
