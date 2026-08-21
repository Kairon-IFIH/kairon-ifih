import type { PrismaClient } from "@prisma/client";
import { asAssetId, asRiskId, asTenantId, AssetId, CurrencyCode, RiskId, TenantContext } from "@kairon/shared-kernel";
import { Impact, Likelihood, Risk, RiskScore } from "./domain";
import type { RiskRepository } from "./domain";

export class PrismaRiskRepository implements RiskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RiskScore has no public constructor other than `calculate()` — but it's a
   * pure function of (likelihood, impact, controlEffectiveness), so replaying
   * it against the stored inputs deterministically reproduces the persisted
   * inherentScore/residualScore/level exactly, without re-deriving new numbers.
   */
  private toDomain(row: {
    id: string;
    tenantId: string;
    assetId: string;
    likelihood: number;
    impactAmount: number;
    impactCurrency: string;
    controlEffectiveness: number;
  }): Risk {
    const likelihood = Likelihood.create(row.likelihood);
    const impact = Impact.create(row.impactAmount, row.impactCurrency as CurrencyCode);
    const score = RiskScore.calculate(likelihood, impact, row.controlEffectiveness);
    return Risk.create(asRiskId(row.id), asTenantId(row.tenantId), {
      assetId: asAssetId(row.assetId),
      factors: [],
      likelihood,
      impact,
      score,
    });
  }

  async list(ctx: TenantContext): Promise<Risk[]> {
    const rows = await this.prisma.risk.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toDomain(r));
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<Risk[]> {
    const rows = await this.prisma.risk.findMany({
      where: { tenantId: ctx.tenantId, assetId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(ctx: TenantContext, riskId: RiskId): Promise<Risk | null> {
    const row = await this.prisma.risk.findFirst({ where: { id: riskId, tenantId: ctx.tenantId } });
    return row ? this.toDomain(row) : null;
  }

  async save(ctx: TenantContext, risk: Risk): Promise<void> {
    // controlEffectiveness isn't exposed on the Risk aggregate (only baked into
    // its already-computed score) — recover it algebraically: residual =
    // round(inherent * (1 - ce)), so ce = 1 - residual/inherent (0 when inherent is 0).
    const controlEffectiveness =
      risk.score.inherentScore === 0 ? 0 : 1 - risk.score.residualScore / risk.score.inherentScore;

    await this.prisma.risk.upsert({
      where: { id: risk.id },
      create: {
        id: risk.id,
        tenantId: ctx.tenantId,
        assetId: risk.assetId,
        likelihood: risk.likelihood.value,
        impactAmount: risk.impact.money.amount,
        impactCurrency: risk.impact.money.currency,
        controlEffectiveness,
        inherentScore: risk.score.inherentScore,
        residualScore: risk.score.residualScore,
        level: risk.score.level,
      },
      update: {
        likelihood: risk.likelihood.value,
        impactAmount: risk.impact.money.amount,
        impactCurrency: risk.impact.money.currency,
        controlEffectiveness,
        inherentScore: risk.score.inherentScore,
        residualScore: risk.score.residualScore,
        level: risk.score.level,
      },
    });
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
