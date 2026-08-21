import { Router, type Request, type Response, type NextFunction } from "express";
import type { TenantContext } from "@kairon/shared-kernel";
import { calculateRiskSchema, listRisksQuerySchema, apiSuccess } from "@kairon/api-contracts";
import type { RiskModule } from "./application";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

export function createRiskRouter(module: RiskModule): Router {
  const router = Router();

  router.post("/risks/calculate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = calculateRiskSchema.parse(req.body);
      const result = await module.calculateRiskForAsset.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(result.value, "Risk calculated"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/risks", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listRisksQuerySchema.parse(req.query);
      const result = await module.listRisks.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
