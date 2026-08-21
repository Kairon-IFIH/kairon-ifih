import { randomUUID } from "node:crypto";
import { asAssetId, asRiskId, AssetId, NotFoundError, ok, Result, TenantContext } from "@kairon/shared-kernel";
import type { CalculateRiskRequest, ListRisksQuery, PaginatedResult } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import type { AssetRepository } from "@kairon/asset";
import { createLogger } from "@kairon/logger";
import { Impact, Likelihood, Risk, RiskCalculatedEvent, RiskRepository, RiskScore, RiskScoringService } from "./domain";

const log = createLogger("risk");

export interface CalculateRiskForAssetUseCase {
  execute(ctx: TenantContext, request: CalculateRiskRequest): Promise<Result<Risk>>;
}

export interface ListRisksUseCase {
  execute(ctx: TenantContext, query: ListRisksQuery): Promise<Result<PaginatedResult<Risk>>>;
}

export interface Dependencies {
  riskRepository: RiskRepository;
  riskScoringService: RiskScoringService;
  eventPublisher: EventPublisher;
}

/**
 * Placeholder baseline scoring model (ARCHITECTURE.md §12 Decision 6 — assumptions
 * must be disclosed, not hidden): likelihood scales with asset criticality weight,
 * impact is a fixed ₹-per-criticality-point reference, control effectiveness is a
 * flat 30% until Compliance (Phase 4) supplies real per-asset control maturity.
 */
const IMPACT_PER_CRITICALITY_POINT_INR = 25_00_000; // ₹25 Lakh
const BASELINE_CONTROL_EFFECTIVENESS = 0.3;

export class RiskScoringServiceImpl implements RiskScoringService {
  constructor(private readonly deps: { assetRepository: AssetRepository }) {}

  async scoreAsset(ctx: TenantContext, assetId: AssetId) {
    const asset = await this.deps.assetRepository.findById(ctx, assetId);
    if (!asset) {
      throw new NotFoundError("Asset", assetId);
    }
    const likelihood = Likelihood.create(asset.criticality.weight / 4);
    const impact = Impact.create(asset.criticality.weight * IMPACT_PER_CRITICALITY_POINT_INR, "INR");
    const score = RiskScore.calculate(likelihood, impact, BASELINE_CONTROL_EFFECTIVENESS);
    return { likelihood, impact, controlEffectiveness: BASELINE_CONTROL_EFFECTIVENESS, score };
  }
}

export class CalculateRiskForAssetUseCaseImpl implements CalculateRiskForAssetUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, request: CalculateRiskRequest): Promise<Result<Risk>> {
    const assetId = asAssetId(request.assetId);
    const assessment = await this.deps.riskScoringService.scoreAsset(ctx, assetId);

    const risk = Risk.create(asRiskId(randomUUID()), ctx.tenantId, {
      assetId,
      factors: [],
      likelihood: assessment.likelihood,
      impact: assessment.impact,
      score: assessment.score,
    });

    await this.deps.riskRepository.save(ctx, risk);
    log.info("risk calculated", {
      tenantId: ctx.tenantId,
      assetId,
      riskId: risk.id,
      inherentScore: assessment.score.inherentScore,
      residualScore: assessment.score.residualScore,
      level: assessment.score.level,
    });

    for (const event of risk.pullDomainEvents()) {
      if (event instanceof RiskCalculatedEvent) {
        await this.deps.eventPublisher.publish({
          eventId: randomUUID(),
          eventName: "RiskCalculated",
          occurredAt: event.occurredAt.toISOString(),
          payload: {
            tenantId: event.tenantId,
            riskId: event.riskId,
            assetId: event.assetId,
            likelihood: event.likelihood,
            impact: event.impact,
            riskScore: event.riskScore,
            residualRisk: event.residualRisk,
            timestamp: event.occurredAt.toISOString(),
          },
        });
      }
    }

    return ok(risk);
  }
}

export class ListRisksUseCaseImpl implements ListRisksUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListRisksQuery): Promise<Result<PaginatedResult<Risk>>> {
    const all = query.assetId
      ? await this.deps.riskRepository.findByAsset(ctx, asAssetId(query.assetId))
      : await this.deps.riskRepository.list(ctx);

    const filtered = query.minRiskScore
      ? all.filter((r) => r.score.residualScore >= query.minRiskScore!)
      : all;

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);
    return ok({ items, page: query.page, pageSize: query.pageSize, total: filtered.length });
  }
}

export function createRiskModule(deps: Dependencies) {
  return {
    calculateRiskForAsset: new CalculateRiskForAssetUseCaseImpl(deps),
    listRisks: new ListRisksUseCaseImpl(deps),
  };
}

export type RiskModule = ReturnType<typeof createRiskModule>;
