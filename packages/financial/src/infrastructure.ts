import type { PrismaClient } from "@prisma/client";
import { asAssetId, asFinancialExposureId, asRiskId, asTenantId, AssetId, CurrencyCode, Money, TenantContext } from "@kairon/shared-kernel";
import { ExpectedLoss, FinancialExposure, ResidualRisk } from "./domain";
import type { FinancialExposureRepository } from "./domain";

export class PrismaFinancialExposureRepository implements FinancialExposureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    tenantId: string;
    assetId: string;
    riskId: string;
    expectedLossAmount: number;
    expectedLossCurrency: string;
    financialExposureAmount: number;
    financialExposureCurrency: string;
    residualRiskAmount: number;
  }): FinancialExposure {
    const id = asFinancialExposureId(row.id);
    const financialExposure = Money.create(row.financialExposureAmount, row.financialExposureCurrency as CurrencyCode);
    return FinancialExposure.create(id, asTenantId(row.tenantId), {
      assetId: asAssetId(row.assetId),
      riskId: asRiskId(row.riskId),
      expectedLoss: ExpectedLoss.create(id, {
        annualizedAmount: Money.create(row.expectedLossAmount, row.expectedLossCurrency as CurrencyCode),
      }),
      financialExposure,
      // MVP: residual-risk exposure tracks the same currency as the financial
      // exposure figure (see QuantifyExposureUseCaseImpl) — no separate column.
      residualRisk: ResidualRisk.create(Money.create(row.residualRiskAmount, row.financialExposureCurrency as CurrencyCode)),
    });
  }

  async list(ctx: TenantContext): Promise<FinancialExposure[]> {
    const rows = await this.prisma.financialExposure.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<FinancialExposure[]> {
    const rows = await this.prisma.financialExposure.findMany({
      where: { tenantId: ctx.tenantId, assetId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(ctx: TenantContext, exposure: FinancialExposure): Promise<void> {
    await this.prisma.financialExposure.upsert({
      where: { id: exposure.id },
      create: {
        id: exposure.id,
        tenantId: ctx.tenantId,
        assetId: exposure.assetId,
        riskId: exposure.riskId,
        expectedLossAmount: exposure.expectedLoss.annualizedAmount.amount,
        expectedLossCurrency: exposure.expectedLoss.annualizedAmount.currency,
        financialExposureAmount: exposure.financialExposure.amount,
        financialExposureCurrency: exposure.financialExposure.currency,
        residualRiskAmount: exposure.residualRisk.exposure.amount,
      },
      update: {
        expectedLossAmount: exposure.expectedLoss.annualizedAmount.amount,
        expectedLossCurrency: exposure.expectedLoss.annualizedAmount.currency,
        financialExposureAmount: exposure.financialExposure.amount,
        financialExposureCurrency: exposure.financialExposure.currency,
        residualRiskAmount: exposure.residualRisk.exposure.amount,
      },
    });
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
