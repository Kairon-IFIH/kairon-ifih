import type { NextFunction, Request, Response } from "express";
import { NotImplementedError, runWithTenantContext, type TenantContext } from "@kairon/shared-kernel";

/**
 * First middleware in the chain (ARCHITECTURE.md §4.3). Extracts tenantId/
 * organizationId/userId/roles from verified JWT claims (never from req.body
 * or req.query) and makes them available via AsyncLocalStorage for the whole
 * request, plus attaches them to req.tenantContext for route handlers.
 */
export function tenantContextMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    let ctx: TenantContext;
    try {
      ctx = extractTenantContextFromVerifiedJwt(req);
    } catch (err) {
      next(err);
      return;
    }
    (req as Request & { tenantContext: TenantContext }).tenantContext = ctx;
    runWithTenantContext(ctx, () => next());
  };
}

function extractTenantContextFromVerifiedJwt(_req: Request): TenantContext {
  throw new NotImplementedError(
    "extractTenantContextFromVerifiedJwt — Phase 2, runs after auth.middleware verifies the JWT"
  );
}
