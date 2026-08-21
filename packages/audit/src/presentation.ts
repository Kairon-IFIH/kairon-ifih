import { Router, type Request, type Response, type NextFunction } from "express";
import type { TenantContext } from "@kairon/shared-kernel";
import { listAuditEventsQuerySchema, apiSuccess } from "@kairon/api-contracts";
import type { AuditModule } from "./application";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Read-only router: no POST/PUT/DELETE — audit writes only ever happen via the queue consumer. */
export function createAuditRouter(module: AuditModule): Router {
  const router = Router();

  router.get("/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listAuditEventsQuerySchema.parse(req.query);
      const result = await module.getAuditTrail.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/audit/export", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = new Date(String(req.query.from));
      const to = new Date(String(req.query.to));
      const result = await module.exportAuditEvidence.execute(tenantContextOf(req), from, to);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "Export ready"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
