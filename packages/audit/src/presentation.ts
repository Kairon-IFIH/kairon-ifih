import { Router, type Request, type Response, type NextFunction } from "express";
import type { TenantContext } from "@kairon/shared-kernel";
import { listAuditEventsQuerySchema, apiSuccess, type PaginatedResult } from "@kairon/api-contracts";
import type { AuditModule } from "./application";
import type { AuditEvent } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens AuditEvent — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toAuditEventDTO(event: AuditEvent) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    timestamp: event.timestamp.toISOString(),
    actor: { userId: event.actor.userId, displayName: event.actor.displayName },
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    diff: { before: event.diff.before, after: event.diff.after },
  };
}

function toAuditTrailDTO(page: PaginatedResult<AuditEvent>) {
  return { ...page, items: page.items.map(toAuditEventDTO) };
}

/** Read-only router: no POST/PUT/DELETE — audit writes only ever happen via the queue consumer. */
export function createAuditRouter(module: AuditModule): Router {
  const router = Router();

  router.get("/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listAuditEventsQuerySchema.parse(req.query);
      const result = await module.getAuditTrail.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toAuditTrailDTO(result.value), "OK"));
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
