import { NotImplementedError, Result, TenantContext } from "@kairon/shared-kernel";
import type { CalculateRiskRequest, ListRisksQuery, PaginatedResult } from "@kairon/api-contracts";
import type { Risk, RiskRepository, RiskScoringService } from "./domain";

export interface CalculateRiskForAssetUseCase {
  execute(ctx: TenantContext, request: CalculateRiskRequest): Promise<Result<Risk>>;
}

export interface ListRisksUseCase {
  execute(ctx: TenantContext, query: ListRisksQuery): Promise<Result<PaginatedResult<Risk>>>;
}

export interface Dependencies {
  riskRepository: RiskRepository;
  riskScoringService: RiskScoringService;
}

export class CalculateRiskForAssetUseCaseImpl implements CalculateRiskForAssetUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _request: CalculateRiskRequest): Promise<Result<Risk>> {
    throw new NotImplementedError(
      "CalculateRiskForAssetUseCase.execute — Phase 3, ARCHITECTURE.md §6 Risk Service"
    );
  }
}

export class ListRisksUseCaseImpl implements ListRisksUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _query: ListRisksQuery): Promise<Result<PaginatedResult<Risk>>> {
    throw new NotImplementedError("ListRisksUseCase.execute — Phase 3");
  }
}

export function createRiskModule(deps: Dependencies) {
  return {
    calculateRiskForAsset: new CalculateRiskForAssetUseCaseImpl(deps),
    listRisks: new ListRisksUseCaseImpl(deps),
  };
}

export type RiskModule = ReturnType<typeof createRiskModule>;
