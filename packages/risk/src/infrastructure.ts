import { AssetId, NotImplementedError, RiskId, TenantContext } from "@kairon/shared-kernel";
import type { Risk, RiskRepository } from "./domain";

export class PrismaRiskRepository implements RiskRepository {
  constructor(private readonly prisma: unknown) {}

  async list(_ctx: TenantContext): Promise<Risk[]> {
    throw new NotImplementedError("PrismaRiskRepository.list — Phase 3");
  }

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

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryRiskRepository implements RiskRepository {
  private readonly byTenant = new Map<string, Map<string, Risk>>();

  private tenantStore(ctx: TenantContext): Map<string, Risk> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async list(ctx: TenantContext): Promise<Risk[]> {
    return [...this.tenantStore(ctx).values()];
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<Risk[]> {
    return [...this.tenantStore(ctx).values()].filter((r) => r.assetId === assetId);
  }

  async findById(ctx: TenantContext, riskId: RiskId): Promise<Risk | null> {
    return this.tenantStore(ctx).get(riskId) ?? null;
  }

  async save(ctx: TenantContext, risk: Risk): Promise<void> {
    this.tenantStore(ctx).set(risk.id, risk);
  }
}
