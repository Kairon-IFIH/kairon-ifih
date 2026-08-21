import { NotImplementedError, Result, TenantContext } from "@kairon/shared-kernel";
import type { ListAuditEventsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";
import type { AuditEvent, AuditEventConsumer, AuditEventRepository } from "./domain";

export interface RecordAuditEventUseCase {
  execute(envelope: AnyDomainEventEnvelope): Promise<Result<void>>;
}

export interface GetAuditTrailUseCase {
  execute(ctx: TenantContext, query: ListAuditEventsQuery): Promise<Result<PaginatedResult<AuditEvent>>>;
}

export interface ExportAuditEvidenceUseCase {
  execute(ctx: TenantContext, from: Date, to: Date): Promise<Result<{ s3Key: string }>>;
}

export interface Dependencies {
  auditEventRepository: AuditEventRepository;
}

export class RecordAuditEventUseCaseImpl implements RecordAuditEventUseCase, AuditEventConsumer {
  constructor(private readonly deps: Dependencies) {}

  async execute(_envelope: AnyDomainEventEnvelope): Promise<Result<void>> {
    throw new NotImplementedError(
      "RecordAuditEventUseCase.execute — Phase 2, consumed from every BullMQ queue (ARCHITECTURE.md §8)"
    );
  }

  async handle(envelope: AnyDomainEventEnvelope): Promise<void> {
    const result = await this.execute(envelope);
    if (!result.isSuccess) throw result.error;
  }
}

export class GetAuditTrailUseCaseImpl implements GetAuditTrailUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _query: ListAuditEventsQuery
  ): Promise<Result<PaginatedResult<AuditEvent>>> {
    throw new NotImplementedError("GetAuditTrailUseCase.execute — Phase 2");
  }
}

export class ExportAuditEvidenceUseCaseImpl implements ExportAuditEvidenceUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _from: Date, _to: Date): Promise<Result<{ s3Key: string }>> {
    throw new NotImplementedError(
      "ExportAuditEvidenceUseCase.execute — Phase 6, S3 export per ARCHITECTURE.md §5.4"
    );
  }
}

export function createAuditModule(deps: Dependencies) {
  return {
    recordAuditEvent: new RecordAuditEventUseCaseImpl(deps),
    getAuditTrail: new GetAuditTrailUseCaseImpl(deps),
    exportAuditEvidence: new ExportAuditEvidenceUseCaseImpl(deps),
  };
}

export type AuditModule = ReturnType<typeof createAuditModule>;
