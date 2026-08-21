import { AssetId, NotImplementedError, Result, TenantContext } from "@kairon/shared-kernel";
import type { CreateComplianceMappingRequest, ListComplianceGapsQuery, PaginatedResult } from "@kairon/api-contracts";
import type {
  ComplianceMapping,
  ComplianceMappingRepository,
  FrameworkRepository,
  RegulatoryTraceabilityService,
} from "./domain";

export interface MapAssetToControlUseCase {
  execute(ctx: TenantContext, request: CreateComplianceMappingRequest): Promise<Result<ComplianceMapping>>;
}

export interface RunGapAnalysisUseCase {
  execute(ctx: TenantContext, query: ListComplianceGapsQuery): Promise<Result<PaginatedResult<ComplianceMapping>>>;
}

export interface GetTraceabilityUseCase {
  execute(
    ctx: TenantContext,
    assetId: AssetId
  ): Promise<Result<Array<{ regulationName: string; controlName: string }>>>;
}

export interface Dependencies {
  frameworkRepository: FrameworkRepository;
  complianceMappingRepository: ComplianceMappingRepository;
  traceabilityService: RegulatoryTraceabilityService;
}

export class MapAssetToControlUseCaseImpl implements MapAssetToControlUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _request: CreateComplianceMappingRequest
  ): Promise<Result<ComplianceMapping>> {
    throw new NotImplementedError("MapAssetToControlUseCase.execute — Phase 4");
  }
}

export class RunGapAnalysisUseCaseImpl implements RunGapAnalysisUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _query: ListComplianceGapsQuery
  ): Promise<Result<PaginatedResult<ComplianceMapping>>> {
    throw new NotImplementedError("RunGapAnalysisUseCase.execute — Phase 4");
  }
}

export class GetTraceabilityUseCaseImpl implements GetTraceabilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _assetId: AssetId
  ): Promise<Result<Array<{ regulationName: string; controlName: string }>>> {
    throw new NotImplementedError(
      "GetTraceabilityUseCase.execute — Phase 4, ARCHITECTURE.md §1.7 traceability requirement"
    );
  }
}

export function createComplianceModule(deps: Dependencies) {
  return {
    mapAssetToControl: new MapAssetToControlUseCaseImpl(deps),
    runGapAnalysis: new RunGapAnalysisUseCaseImpl(deps),
    getTraceability: new GetTraceabilityUseCaseImpl(deps),
  };
}

export type ComplianceModule = ReturnType<typeof createComplianceModule>;
