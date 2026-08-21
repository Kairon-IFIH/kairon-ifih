import { NotImplementedError, Result, TenantContext } from "@kairon/shared-kernel";
import type { QuantifyExposureRequest } from "@kairon/api-contracts";
import type { FinancialExposure, FinancialExposureRepository, QRiskAggregationService } from "./domain";

export interface QuantifyExposureUseCase {
  execute(ctx: TenantContext, request: QuantifyExposureRequest): Promise<Result<FinancialExposure>>;
}

export interface CalculateQRiskUseCase {
  execute(ctx: TenantContext): Promise<Result<{ qRisk: number }>>;
}

export interface Dependencies {
  financialExposureRepository: FinancialExposureRepository;
  qRiskAggregationService: QRiskAggregationService;
}

export class QuantifyExposureUseCaseImpl implements QuantifyExposureUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _request: QuantifyExposureRequest
  ): Promise<Result<FinancialExposure>> {
    throw new NotImplementedError(
      "QuantifyExposureUseCase.execute — Phase 3, ARCHITECTURE.md §6 Financial Service"
    );
  }
}

export class CalculateQRiskUseCaseImpl implements CalculateQRiskUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext): Promise<Result<{ qRisk: number }>> {
    throw new NotImplementedError("CalculateQRiskUseCase.execute — Phase 3/6, IDEA.md Q-Risk Score");
  }
}

export function createFinancialModule(deps: Dependencies) {
  return {
    quantifyExposure: new QuantifyExposureUseCaseImpl(deps),
    calculateQRisk: new CalculateQRiskUseCaseImpl(deps),
  };
}

export type FinancialModule = ReturnType<typeof createFinancialModule>;
