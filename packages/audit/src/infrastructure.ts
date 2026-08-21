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
