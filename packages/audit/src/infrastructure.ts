import type { PrismaClient } from "@prisma/client";
import { asAuditEventId, asTenantId, TenantContext, UserId } from "@kairon/shared-kernel";
import { ActorRef, AuditEvent, BeforeAfterDiff } from "./domain";
import type { AuditEventRepository } from "./domain";

/**
 * No update()/delete() methods exist on this class — there is nothing to override
 * even if a caller wanted to. The Postgres role backing this repository additionally
 * has UPDATE/DELETE revoked at the grant level (ARCHITECTURE.md §5.4) as a second,
 * independent enforcement layer.
 */
export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    tenantId: string;
    timestamp: Date;
    actorUserId: string;
    actorName: string;
    action: string;
    entityType: string;
    entityId: string;
    before: unknown;
    after: unknown;
  }): AuditEvent {
    return AuditEvent.record(asAuditEventId(row.id), {
      tenantId: asTenantId(row.tenantId),
      timestamp: row.timestamp,
      actor: ActorRef.create(row.actorUserId as UserId, row.actorName),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: BeforeAfterDiff.create(
        row.before as Record<string, unknown>,
        row.after as Record<string, unknown>
      ),
    });
  }

  async append(event: AuditEvent): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        id: event.id,
        tenantId: event.tenantId,
        timestamp: event.timestamp,
        actorUserId: event.actor.userId,
        actorName: event.actor.displayName,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        before: event.diff.before as object,
        after: event.diff.after as object,
      },
    });
  }

  async findByEntity(ctx: TenantContext, entityType: string, entityId: string): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { tenantId: ctx.tenantId, entityType, entityId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByDateRange(ctx: TenantContext, from: Date, to: Date): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { tenantId: ctx.tenantId, timestamp: { gte: from, lte: to } },
      orderBy: { timestamp: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
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
