import { NotImplementedError, OptimizationJobId, TenantContext } from "@kairon/shared-kernel";
import type { OptimizationJob, OptimizationJobRepository, OptimizationResult, QuantumSolverGateway } from "./domain";

export class PrismaOptimizationJobRepository implements OptimizationJobRepository {
  constructor(private readonly prisma: unknown) {}

  async findById(_ctx: TenantContext, _jobId: OptimizationJobId): Promise<OptimizationJob | null> {
    throw new NotImplementedError("PrismaOptimizationJobRepository.findById — Phase 5");
  }

  async save(_ctx: TenantContext, _job: OptimizationJob): Promise<void> {
    throw new NotImplementedError("PrismaOptimizationJobRepository.save — Phase 5");
  }
}

/**
 * Calls apps/quantum-runner (Qiskit/PennyLane simulator process, see its README
 * for the JSON contract) — via HTTP, a local job queue, or a subprocess call.
 * Choice of transport is a Phase 5 implementation decision, not an architectural one.
 */
export class HttpQuantumSolverGateway implements QuantumSolverGateway {
  constructor(private readonly quantumRunnerBaseUrl: string) {}

  async submitJob(_job: OptimizationJob): Promise<void> {
    throw new NotImplementedError("HttpQuantumSolverGateway.submitJob — Phase 5, ARCHITECTURE.md §6 Quantum Service");
  }

  async getResult(_jobId: OptimizationJobId): Promise<OptimizationResult | null> {
    throw new NotImplementedError("HttpQuantumSolverGateway.getResult — Phase 5");
  }
}
