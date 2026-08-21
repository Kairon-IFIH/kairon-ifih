import type { NextFunction, Request, Response } from "express";
import { NotImplementedError, UnauthorizedError } from "@kairon/shared-kernel";

/**
 * Verifies the Bearer JWT (ARCHITECTURE.md §7 Auth strategy). Runs before
 * tenant-context.middleware, which trusts this middleware to have already
 * rejected anything unverified.
 */
export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(new UnauthorizedError());
      return;
    }
    try {
      verifyAccessToken(header.slice("Bearer ".length));
      next();
    } catch (err) {
      next(err);
    }
  };
}

function verifyAccessToken(_token: string): void {
  throw new NotImplementedError("verifyAccessToken — Phase 2, JWT verification");
}

/** RBAC check re-run at the use-case boundary too (ARCHITECTURE.md §9) — this is the HTTP-layer half. */
export function requirePermission(_resource: string, _action: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next(new NotImplementedError("requirePermission — Phase 2, RBAC check"));
  };
}
