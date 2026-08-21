import { Router, type Request, type Response, type NextFunction } from "express";
import type { NotificationId, TenantContext } from "@kairon/shared-kernel";
import { listNotificationsQuerySchema, apiSuccess, type PaginatedResult } from "@kairon/api-contracts";
import type { NotificationModule } from "./application";
import type { Notification } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens Notification — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toNotificationDTO(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

function toNotificationListDTO(page: PaginatedResult<Notification>) {
  return { ...page, items: page.items.map(toNotificationDTO) };
}

export function createNotificationRouter(module: NotificationModule): Router {
  const router = Router();

  router.get("/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await module.listNotifications.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toNotificationListDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/notifications/:notificationId/read",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await module.markNotificationRead.execute(
          tenantContextOf(req),
          req.params.notificationId as NotificationId
        );
        if (!result.isSuccess) return next(result.error);
        res.status(200).json(apiSuccess(null, "Marked as read"));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
