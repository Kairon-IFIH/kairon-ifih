import { NotImplementedError, TenantContext } from "@kairon/shared-kernel";
import type { AuditEvent, AuditEventRepository } from "./domain";

/**
 * No update()/delete() methods exist on this class — there is nothing to override
 * even if a caller wanted to. The Postgres role backing this repository additionally
 * has UPDATE/DELETE revoked at the grant level (ARCHITECTURE.md §5.4) as a second,
 * independent enforcement layer.
 */
export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: unknown) {}

  async append(_event: AuditEvent): Promise<void> {
    throw new NotImplementedError("PrismaAuditEventRepository.append — Phase 2");
  }

  async findByEntity(_ctx: TenantContext, _entityType: string, _entityId: string): Promise<AuditEvent[]> {
    throw new NotImplementedError("PrismaAuditEventRepository.findByEntity — Phase 2");
  }

  async findByDateRange(_ctx: TenantContext, _from: Date, _to: Date): Promise<AuditEvent[]> {
    throw new NotImplementedError("PrismaAuditEventRepository.findByDateRange — Phase 2");
  }
}

/**
 * In-memory implementation — the actual Phase-"right now" persistence. Still no
 * update()/delete(): append-only is structural here too, not just in Prisma.
 */
export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly byTenant = new Map<string, AuditEvent[]>();

  private tenantStore(tenantId: string): AuditEvent[] {
    let store = this.byTenant.get(tenantId);
    if (!store) {
      store = [];
      this.byTenant.set(tenantId, store);
    }
    return store;
  }

  async append(event: AuditEvent): Promise<void> {
    this.tenantStore(event.tenantId).push(event);
  }

  async findByEntity(ctx: TenantContext, entityType: string, entityId: string): Promise<AuditEvent[]> {
    return this.tenantStore(ctx.tenantId).filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  async findByDateRange(ctx: TenantContext, from: Date, to: Date): Promise<AuditEvent[]> {
    return this.tenantStore(ctx.tenantId).filter((e) => e.timestamp >= from && e.timestamp <= to);
  }
}
