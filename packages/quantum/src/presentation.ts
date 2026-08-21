import { Router, type Request, type Response, type NextFunction } from "express";
import type { OptimizationJobId, TenantContext } from "@kairon/shared-kernel";
import { createOptimizationJobSchema, apiSuccess } from "@kairon/api-contracts";
import type { QuantumModule } from "./application";
import type { OptimizationJob } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens OptimizationJob — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toOptimizationJobDTO(job: OptimizationJob) {
  return {
    id: job.id,
    status: job.status,
    candidateActions: job.candidateActions.map((a) => ({
      actionId: a.actionId,
      costAmount: a.cost.amount,
      costCurrency: a.cost.currency,
      riskReduction: a.riskReduction,
    })),
    mandatoryActionIds: job.mandatoryActionIds,
    budget: { amount: job.budgetConstraint.maxSpend.amount, currency: job.budgetConstraint.maxSpend.currency },
    result: job.result
      ? {
          selectedActionIds: job.result.selectedActionIds,
          totalCostAmount: job.result.totalCost.amount,
          totalCostCurrency: job.result.totalCost.currency,
          riskReductionPercent: job.result.riskReductionPercent,
          residualRiskAmount: job.result.residualRisk.amount,
          residualRiskCurrency: job.result.residualRisk.currency,
          classicalBaselineComparison: job.result.classicalBaselineComparison,
        }
      : null,
  };
}

/**
 * Async job pattern (ARCHITECTURE.md §7): POST returns 202 + job id immediately;
 * QAOA/classical-baseline solving never blocks the HTTP request.
 */
export function createQuantumRouter(module: QuantumModule): Router {
  const router = Router();

  router.post("/optimization-jobs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createOptimizationJobSchema.parse(req.body);
      const result = await module.createOptimizationJob.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(202).json(apiSuccess(result.value, "Optimization job accepted"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/optimization-jobs/:jobId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await module.getOptimizationResult.execute(
        tenantContextOf(req),
        req.params.jobId as OptimizationJobId
      );
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toOptimizationJobDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
