import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@kairon/shared-kernel";
import { verifyAccessToken, type AccessTokenClaims } from "@kairon/identity";

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
      next(new UnauthorizedError());
      return;
    }
    try {
      const claims = verifyAccessToken(header.slice("Bearer ".length));
      (req as RequestWithClaims).accessTokenClaims = claims;
      next();
    } catch (err) {
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
      next(new ForbiddenError(allowedRoles.join(" or ")));
      return;
    }
    next();
  };
}
