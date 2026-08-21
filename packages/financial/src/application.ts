import { randomUUID } from "node:crypto";
import {
  asFinancialExposureId,
  asRiskId,
  fail,
  Money,
  NotFoundError,
  ok,
  Result,
  TenantContext,
} from "@kairon/shared-kernel";
import type { QuantifyExposureRequest } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import type { RiskRepository } from "@kairon/risk";
import type { AssetRepository } from "@kairon/asset";
import {
  ExpectedLoss,
  FinancialExposure,
  FinancialExposureQuantifiedEvent,
  FinancialExposureRepository,
  QRiskAggregationService,
  ResidualRisk,
} from "./domain";

export interface QuantifyExposureUseCase {
  execute(ctx: TenantContext, request: QuantifyExposureRequest): Promise<Result<FinancialExposure>>;
}

export interface CalculateQRiskUseCase {
  execute(ctx: TenantContext): Promise<Result<{ qRisk: number }>>;
}

export interface Dependencies {
  financialExposureRepository: FinancialExposureRepository;
  riskRepository: RiskRepository;
  qRiskAggregationService: QRiskAggregationService;
  eventPublisher: EventPublisher;
}

export class QRiskAggregationServiceImpl implements QRiskAggregationService {
  constructor(private readonly deps: { assetRepository: AssetRepository; riskRepository: RiskRepository }) {}

  /**
   * IDEA.md's "single board-level risk indicator": 100 = no residual exposure,
   * 0 = maximum. MVP composition is asset coverage (always 100% — everything
   * tracked is covered by definition) averaged with (100 - mean residual risk
   * score). Compliance coverage / quantum readiness / operational resilience
   * factors join once those contexts exist (Phase 4/6) — disclosed placeholder,
   * not hidden as if it were a finished actuarial model.
   */
  async calculateQRisk(ctx: TenantContext): Promise<number> {
    const [assets, risks] = await Promise.all([
      this.deps.assetRepository.list(ctx),
      this.deps.riskRepository.list(ctx),
    ]);

    if (assets.length === 0) {
      return 100;
    }

    const assetCoverage = 100;
    const meanResidualRisk =
      risks.length === 0 ? 0 : risks.reduce((sum, r) => sum + r.score.residualScore, 0) / risks.length;
    const riskHealth = 100 - meanResidualRisk;

    return Math.round((assetCoverage + riskHealth) / 2);
  }
}

export class QuantifyExposureUseCaseImpl implements QuantifyExposureUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, request: QuantifyExposureRequest): Promise<Result<FinancialExposure>> {
    const risk = await this.deps.riskRepository.findById(ctx, asRiskId(request.riskId));
    if (!risk) {
      return fail(new NotFoundError("Risk", request.riskId));
    }

    const annualizedLoss = risk.impact.money.multiply(risk.score.residualScore / 100);
    const expectedLoss = ExpectedLoss.create(asFinancialExposureId(randomUUID()), {
      annualizedAmount: annualizedLoss,
    });
    // MVP: financial exposure and residual-risk exposure both track the same
    // annualized-loss figure until regulatory-penalty/business-disruption
    // models (Phase 6) layer additional components on top.
    const financialExposureAmount: Money = annualizedLoss;
    const residualRisk = ResidualRisk.create(financialExposureAmount);

    const exposure = FinancialExposure.create(asFinancialExposureId(randomUUID()), ctx.tenantId, {
      assetId: risk.assetId,
      riskId: risk.id,
      expectedLoss,
      financialExposure: financialExposureAmount,
      residualRisk,
    });

    await this.deps.financialExposureRepository.save(ctx, exposure);

    for (const event of exposure.pullDomainEvents()) {
      if (event instanceof FinancialExposureQuantifiedEvent) {
        await this.deps.eventPublisher.publish({
          eventId: randomUUID(),
          eventName: "FinancialExposureQuantified",
          occurredAt: event.occurredAt.toISOString(),
          payload: {
            tenantId: event.tenantId,
            assetId: event.assetId,
            expectedLoss: event.expectedLoss,
            financialExposure: event.financialExposure,
            currency: event.currency,
            timestamp: event.occurredAt.toISOString(),
          },
        });
      }
    }

    return ok(exposure);
  }
}

export class CalculateQRiskUseCaseImpl implements CalculateQRiskUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext): Promise<Result<{ qRisk: number }>> {
    const qRisk = await this.deps.qRiskAggregationService.calculateQRisk(ctx);
    return ok({ qRisk });
  }
}

export function createFinancialModule(deps: Dependencies) {
  return {
    quantifyExposure: new QuantifyExposureUseCaseImpl(deps),
    calculateQRisk: new CalculateQRiskUseCaseImpl(deps),
  };
}

export type FinancialModule = ReturnType<typeof createFinancialModule>;
