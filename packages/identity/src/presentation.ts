import { Router, type Request, type Response, type NextFunction } from "express";
import { loginSchema, refreshTokenSchema, apiSuccess } from "@kairon/api-contracts";
import type { IdentityModule } from "./application";

/**
 * Route table for the `/auth` API module (ARCHITECTURE.md §7).
 * Controllers only parse/validate/delegate/format — zero domain logic.
 */
export function createIdentityRouter(module: IdentityModule): Router {
  const router = Router();

  router.post("/auth/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await module.login.execute(body);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "Login successful"));
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/refresh", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshTokenSchema.parse(req.body);
      const result = await module.refreshToken.execute(body);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "Token refreshed"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
