import { Router, type Request, type Response, type NextFunction } from "express";
import type { OptimizationJobId, TenantContext } from "@kairon/shared-kernel";
import { createOptimizationJobSchema, apiSuccess } from "@kairon/api-contracts";
import type { QuantumModule } from "./application";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
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
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
