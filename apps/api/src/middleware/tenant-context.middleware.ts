import type { NextFunction, Request, Response } from "express";
import {
  asOrganizationId,
  asTenantId,
  asUserId,
  runWithTenantContext,
  type TenantContext,
} from "@kairon/shared-kernel";
import type { RequestWithClaims } from "./auth.middleware";

/**
 * Runs after requireAuth() (ARCHITECTURE.md §4.3). Builds TenantContext from
 * verified JWT claims — never from req.body/req.query — and makes it available
 * via AsyncLocalStorage for the whole request, plus attaches it to
 * req.tenantContext for route handlers.
 */
export function tenantContextMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const claims = (req as RequestWithClaims).accessTokenClaims;
    const ctx: TenantContext = {
      tenantId: asTenantId(claims.tenantId),
      organizationId: asOrganizationId(claims.organizationId),
      userId: asUserId(claims.sub),
      roles: claims.roles,
    };
    (req as Request & { tenantContext: TenantContext }).tenantContext = ctx;
    runWithTenantContext(ctx, () => next());
  };
}
