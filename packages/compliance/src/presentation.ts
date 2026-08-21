import { Router, type Request, type Response, type NextFunction } from "express";
import type { AssetId, TenantContext } from "@kairon/shared-kernel";
import {
  createComplianceMappingSchema,
  listComplianceGapsQuerySchema,
  apiSuccess,
} from "@kairon/api-contracts";
import type { ComplianceModule } from "./application";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

export function createComplianceRouter(module: ComplianceModule): Router {
  const router = Router();

  router.post("/compliance/mappings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createComplianceMappingSchema.parse(req.body);
      const result = await module.mapAssetToControl.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(result.value, "Compliance mapping created"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/compliance/gaps", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listComplianceGapsQuerySchema.parse(req.query);
      const result = await module.runGapAnalysis.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/compliance/assets/:assetId/traceability",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await module.getTraceability.execute(
          tenantContextOf(req),
          req.params.assetId as AssetId
        );
        if (!result.isSuccess) return next(result.error);
        res.status(200).json(apiSuccess(result.value, "OK"));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
