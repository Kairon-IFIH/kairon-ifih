import { AssetId, NotImplementedError, TenantContext } from "@kairon/shared-kernel";
import type { FinancialExposure, FinancialExposureRepository } from "./domain";

export class PrismaFinancialExposureRepository implements FinancialExposureRepository {
  constructor(private readonly prisma: unknown) {}

  async list(_ctx: TenantContext): Promise<FinancialExposure[]> {
    throw new NotImplementedError("PrismaFinancialExposureRepository.list — Phase 3");
  }

  async findByAsset(_ctx: TenantContext, _assetId: AssetId): Promise<FinancialExposure[]> {
    throw new NotImplementedError("PrismaFinancialExposureRepository.findByAsset — Phase 3");
  }

  async save(_ctx: TenantContext, _exposure: FinancialExposure): Promise<void> {
    throw new NotImplementedError("PrismaFinancialExposureRepository.save — Phase 3");
  }
}

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryFinancialExposureRepository implements FinancialExposureRepository {
  private readonly byTenant = new Map<string, Map<string, FinancialExposure>>();

  private tenantStore(ctx: TenantContext): Map<string, FinancialExposure> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async list(ctx: TenantContext): Promise<FinancialExposure[]> {
    return [...this.tenantStore(ctx).values()];
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<FinancialExposure[]> {
    return [...this.tenantStore(ctx).values()].filter((e) => e.assetId === assetId);
  }

  async save(ctx: TenantContext, exposure: FinancialExposure): Promise<void> {
    this.tenantStore(ctx).set(exposure.id, exposure);
  }
}
