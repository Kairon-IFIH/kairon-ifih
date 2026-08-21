import { NotImplementedError, OptimizationJobId, Result, TenantContext } from "@kairon/shared-kernel";
import type { CreateOptimizationJobRequest } from "@kairon/api-contracts";
import type { OptimizationJob, OptimizationJobRepository, OptimizationResult, QuantumSolverGateway } from "./domain";

export interface CreateOptimizationJobUseCase {
  execute(ctx: TenantContext, request: CreateOptimizationJobRequest): Promise<Result<{ jobId: string }>>;
}

export interface GetOptimizationResultUseCase {
  execute(ctx: TenantContext, jobId: OptimizationJobId): Promise<Result<OptimizationJob>>;
}

export interface Dependencies {
  optimizationJobRepository: OptimizationJobRepository;
  quantumSolverGateway: QuantumSolverGateway;
}

export class CreateOptimizationJobUseCaseImpl implements CreateOptimizationJobUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _request: CreateOptimizationJobRequest
  ): Promise<Result<{ jobId: string }>> {
    throw new NotImplementedError(
      "CreateOptimizationJobUseCase.execute — Phase 5, returns 202 Accepted per ARCHITECTURE.md §7 async job pattern"
    );
  }
}

export class GetOptimizationResultUseCaseImpl implements GetOptimizationResultUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _jobId: OptimizationJobId): Promise<Result<OptimizationJob>> {
    throw new NotImplementedError("GetOptimizationResultUseCase.execute — Phase 5");
  }
}

export function createQuantumModule(deps: Dependencies) {
  return {
    createOptimizationJob: new CreateOptimizationJobUseCaseImpl(deps),
    getOptimizationResult: new GetOptimizationResultUseCaseImpl(deps),
  };
}

export type QuantumModule = ReturnType<typeof createQuantumModule>;
