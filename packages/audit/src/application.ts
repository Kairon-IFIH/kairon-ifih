import { randomUUID } from "node:crypto";
import { asAuditEventId, asTenantId, NotImplementedError, ok, Result, TenantContext } from "@kairon/shared-kernel";
import type { ListAuditEventsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { AnyDomainEventEnvelope } from "@kairon/event-contracts";
import { ActorRef, AuditEvent, AuditEventConsumer, AuditEventRepository, BeforeAfterDiff } from "./domain";

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

/** Best-effort entityId extraction across differently-shaped event payloads. */
function entityIdFrom(payload: Record<string, unknown>): string {
  const candidate = payload.assetId ?? payload.riskId ?? payload.jobId ?? payload.actionId ?? payload.controlId;
  return typeof candidate === "string" ? candidate : "unknown";
}

const ENTITY_TYPE_BY_EVENT: Record<string, string> = {
  AssetDiscovered: "Asset",
  AssetClassified: "Asset",
  ComplianceMapped: "ComplianceMapping",
  RiskCalculated: "Risk",
  FinancialExposureQuantified: "FinancialExposure",
  RemediationGenerated: "RemediationAction",
  OptimizationExecuted: "OptimizationJob",
  RemediationApproved: "RemediationAction",
};

export class RecordAuditEventUseCaseImpl implements RecordAuditEventUseCase, AuditEventConsumer {
  constructor(private readonly deps: Dependencies) {}

  async execute(envelope: AnyDomainEventEnvelope): Promise<Result<void>> {
    const payload = envelope.payload as unknown as Record<string, unknown>;
    const tenantIdRaw = payload.tenantId;

    const auditEvent = AuditEvent.record(asAuditEventId(randomUUID()), {
      tenantId: asTenantId(typeof tenantIdRaw === "string" ? tenantIdRaw : "unknown-tenant"),
      timestamp: new Date(envelope.occurredAt),
      actor: ActorRef.system(),
      action: envelope.eventName,
      entityType: ENTITY_TYPE_BY_EVENT[envelope.eventName] ?? "Unknown",
      entityId: entityIdFrom(payload),
      diff: BeforeAfterDiff.create({}, payload),
    });

    await this.deps.auditEventRepository.append(auditEvent);
    return ok(undefined);
  }

  async handle(envelope: AnyDomainEventEnvelope): Promise<void> {
    const result = await this.execute(envelope);
    if (!result.isSuccess) throw result.error;
  }
}

export class GetAuditTrailUseCaseImpl implements GetAuditTrailUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListAuditEventsQuery): Promise<Result<PaginatedResult<AuditEvent>>> {
    const from = query.from ?? new Date(0);
    const to = query.to ?? new Date();
    let events = await this.deps.auditEventRepository.findByDateRange(ctx, from, to);

    if (query.entityType) {
      events = events.filter((e) => e.entityType === query.entityType);
    }
    if (query.entityId) {
      events = events.filter((e) => e.entityId === query.entityId);
    }

    const start = (query.page - 1) * query.pageSize;
    const items = events.slice(start, start + query.pageSize);
    return ok({ items, page: query.page, pageSize: query.pageSize, total: events.length });
  }
}

export class ExportAuditEvidenceUseCaseImpl implements ExportAuditEvidenceUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _from: Date, _to: Date): Promise<Result<{ s3Key: string }>> {
    throw new NotImplementedError(
      "ExportAuditEvidenceUseCase.execute — Phase 6, S3 export per ARCHITECTURE.md §5.4 (needs AWS S3, out of scope until deployed)"
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
