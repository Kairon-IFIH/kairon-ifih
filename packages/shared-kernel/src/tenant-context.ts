import { AsyncLocalStorage } from "node:async_hooks";
import type { OrganizationId, TenantId, UserId } from "./identifiers";

/**
 * Propagated per-request (ARCHITECTURE.md §4.3). Never optional, never read from
 * req.body/req.query — only ever populated by the tenant-context middleware in
 * apps/api from verified JWT claims.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly roles: readonly string[];
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) {
    throw new Error(
      "TenantContext not set — this code path did not go through the tenant-context middleware"
    );
  }
  return ctx;
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantContextStorage.run(ctx, fn);
}
