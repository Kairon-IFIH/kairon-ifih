import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@kairon/shared-kernel";
import { verifyAccessToken, type AccessTokenClaims } from "@kairon/identity";
import { createLogger } from "@kairon/logger";

const log = createLogger("auth");

export type RequestWithClaims = Request & { accessTokenClaims: AccessTokenClaims };

/**
 * Verifies the Bearer JWT (ARCHITECTURE.md §7 Auth strategy) and attaches the
 * decoded claims to the request; tenant-context.middleware (which runs next)
 * trusts this middleware to have already rejected anything unverified.
 */
export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      log.warn("authorization failed — missing bearer token", { path: req.path });
      next(new UnauthorizedError());
      return;
    }
    try {
      const claims = verifyAccessToken(header.slice("Bearer ".length));
      (req as RequestWithClaims).accessTokenClaims = claims;
      next();
    } catch (err) {
      log.warn("authorization failed — invalid or expired token", { path: req.path });
      next(err);
    }
  };
}

/**
 * RBAC check re-run at the use-case boundary too (ARCHITECTURE.md §9) — this is
 * the HTTP-layer half. MVP cut: gates on role name only (fast, coarse). The
 * fine-grained resource:action check via `identity.permissionChecker` needs a
 * hydrated `User`, not raw JWT claims — wiring that through is a Phase 2 step
 * (IMPLEMENTATION_ROADMAP.md), not an architectural gap.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const claims = (req as RequestWithClaims).accessTokenClaims;
    if (!claims.roles.some((role) => allowedRoles.includes(role))) {
      log.warn("authorization failed — insufficient role", {
        path: req.path,
        userId: claims.sub,
        requiredRoles: allowedRoles,
        actualRoles: claims.roles,
      });
      next(new ForbiddenError(allowedRoles.join(" or ")));
      return;
    }
    next();
  };
}
