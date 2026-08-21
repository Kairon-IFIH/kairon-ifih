import { randomUUID } from "node:crypto";
import { asOptimizationJobId, fail, Money, NotFoundError, ok, OptimizationJobId, Result, TenantContext } from "@kairon/shared-kernel";
import type { CreateOptimizationJobRequest } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import { createLogger } from "@kairon/logger";
import {
  BudgetConstraint,
  ObjectiveFunction,
  OptimizationExecutedEvent,
  OptimizationJob,
  OptimizationJobRepository,
  QuantumSolverGateway,
} from "./domain";

const log = createLogger("quantum");

export interface CreateOptimizationJobUseCase {
  execute(ctx: TenantContext, request: CreateOptimizationJobRequest): Promise<Result<{ jobId: string }>>;
}

export interface GetOptimizationResultUseCase {
  execute(ctx: TenantContext, jobId: OptimizationJobId): Promise<Result<OptimizationJob>>;
}

export interface Dependencies {
  optimizationJobRepository: OptimizationJobRepository;
  quantumSolverGateway: QuantumSolverGateway;
  eventPublisher: EventPublisher;
}

export class CreateOptimizationJobUseCaseImpl implements CreateOptimizationJobUseCase {
  constructor(private readonly deps: Dependencies) {}

  /** Returns 202-Accepted-shaped output per ARCHITECTURE.md §7 async job pattern. */
  async execute(ctx: TenantContext, request: CreateOptimizationJobRequest): Promise<Result<{ jobId: string }>> {
    const job = OptimizationJob.create(asOptimizationJobId(randomUUID()), ctx.tenantId, {
      objective: ObjectiveFunction.default(),
      constraints: [],
      candidateActions: request.candidateActions.map((a) => ({
        actionId: a.actionId,
        cost: Money.create(a.cost, request.currency),
        riskReduction: a.riskReduction,
      })),
      mandatoryActionIds: request.mandatoryActionIds,
      budgetConstraint: BudgetConstraint.create(Money.create(request.budget, request.currency)),
    });

    await this.deps.optimizationJobRepository.save(ctx, job);
    log.info("optimization job created", {
      tenantId: ctx.tenantId,
      jobId: job.id,
      candidateCount: job.candidateActions.length,
    });

    job.markRunning();
    await this.deps.optimizationJobRepository.save(ctx, job);

    // Synchronous for the MVP greedy gateway (near-instant on small N); the
    // real Qiskit sidecar (Phase 5) will make this genuinely async and the
    // job will sit in RUNNING until a worker polls getResult().
    await this.deps.quantumSolverGateway.submitJob(job);
    const result = await this.deps.quantumSolverGateway.getResult(job.id);
    if (result) {
      job.complete(result);
      await this.deps.optimizationJobRepository.save(ctx, job);
      log.info("optimization job completed", {
        tenantId: ctx.tenantId,
        jobId: job.id,
        selectedCount: result.selectedActionIds.length,
        riskReductionPercent: result.riskReductionPercent,
        totalCost: result.totalCost.amount,
      });

      for (const event of job.pullDomainEvents()) {
        if (event instanceof OptimizationExecutedEvent) {
          await this.deps.eventPublisher.publish({
            eventId: randomUUID(),
            eventName: "OptimizationExecuted",
            occurredAt: event.occurredAt.toISOString(),
            payload: {
              tenantId: event.tenantId,
              jobId: event.jobId,
              selectedActions: event.selectedActions,
              totalCost: event.totalCost,
              riskReduction: event.riskReduction,
              residualRisk: event.residualRisk,
              timestamp: event.occurredAt.toISOString(),
            },
          });
        }
      }
    }

    return ok({ jobId: job.id });
  }
}

export class GetOptimizationResultUseCaseImpl implements GetOptimizationResultUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, jobId: OptimizationJobId): Promise<Result<OptimizationJob>> {
    const job = await this.deps.optimizationJobRepository.findById(ctx, jobId);
    if (!job) {
      return fail(new NotFoundError("OptimizationJob", jobId));
    }
    return ok(job);
  }
}

export function createQuantumModule(deps: Dependencies) {
  return {
    createOptimizationJob: new CreateOptimizationJobUseCaseImpl(deps),
    getOptimizationResult: new GetOptimizationResultUseCaseImpl(deps),
  };
}

export type QuantumModule = ReturnType<typeof createQuantumModule>;
