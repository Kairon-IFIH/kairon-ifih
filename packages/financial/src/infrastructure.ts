import { AssetId, NotImplementedError, TenantContext } from "@kairon/shared-kernel";
import type { FinancialExposure, FinancialExposureRepository } from "./domain";

export class PrismaFinancialExposureRepository implements FinancialExposureRepository {
  constructor(private readonly prisma: unknown) {}

  async findByAsset(_ctx: TenantContext, _assetId: AssetId): Promise<FinancialExposure[]> {
    throw new NotImplementedError("PrismaFinancialExposureRepository.findByAsset — Phase 3");
  }

  async save(_ctx: TenantContext, _exposure: FinancialExposure): Promise<void> {
    throw new NotImplementedError("PrismaFinancialExposureRepository.save — Phase 3");
  }
}
