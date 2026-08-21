import { randomUUID } from "node:crypto";
import { asComplianceMappingId, asControlId, AssetId, fail, NotFoundError, ok, Result, TenantContext } from "@kairon/shared-kernel";
import type { CreateComplianceMappingRequest, ListComplianceGapsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import { createLogger } from "@kairon/logger";
import {
  ComplianceMapping,
  ComplianceMappedEvent,
  ComplianceMappingRepository,
  ControlRepository,
  Evidence,
  FrameworkRepository,
  GapStatus,
  RegulationRepository,
  RegulatoryTraceabilityService,
  TraceabilityEntry,
} from "./domain";

export interface MapAssetToControlUseCase {
  execute(ctx: TenantContext, request: CreateComplianceMappingRequest): Promise<Result<ComplianceMapping>>;
}

export interface RunGapAnalysisUseCase {
  execute(ctx: TenantContext, query: ListComplianceGapsQuery): Promise<Result<PaginatedResult<ComplianceMapping>>>;
}

export interface GetTraceabilityUseCase {
  execute(ctx: TenantContext, assetId: AssetId): Promise<Result<TraceabilityEntry[]>>;
}

export interface Dependencies {
  frameworkRepository: FrameworkRepository;
  regulationRepository: RegulationRepository;
  controlRepository: ControlRepository;
  complianceMappingRepository: ComplianceMappingRepository;
  traceabilityService: RegulatoryTraceabilityService;
  eventPublisher: EventPublisher;
}

const log = createLogger("compliance");

/** Walks Framework -> Regulation -> Control -> ComplianceMapping (ARCHITECTURE.md §3.5). */
export class RegulatoryTraceabilityServiceImpl implements RegulatoryTraceabilityService {
  constructor(
    private readonly deps: Pick<
      Dependencies,
      "frameworkRepository" | "regulationRepository" | "controlRepository" | "complianceMappingRepository"
    >
  ) {}

  async traceAssetToRegulation(ctx: TenantContext, assetId: AssetId): Promise<TraceabilityEntry[]> {
    const mappings = await this.deps.complianceMappingRepository.findByAsset(ctx, assetId);
    const mappedControlIds = new Set(mappings.map((m) => m.controlId));
    if (mappedControlIds.size === 0) {
      return [];
    }

    const frameworks = await this.deps.frameworkRepository.list();
    const entries: TraceabilityEntry[] = [];

    for (const framework of frameworks) {
      const regulations = await this.deps.regulationRepository.findByFramework(framework.id);
      for (const regulation of regulations) {
        const controls = await this.deps.controlRepository.findByRegulation(regulation.id);
        for (const control of controls) {
          if (mappedControlIds.has(control.id)) {
            entries.push({ framework, regulation, control });
          }
        }
      }
    }

    return entries;
  }
}

export class MapAssetToControlUseCaseImpl implements MapAssetToControlUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, request: CreateComplianceMappingRequest): Promise<Result<ComplianceMapping>> {
    const controlId = asControlId(request.controlId);
    const control = await this.deps.controlRepository.findById(controlId);
    if (!control) {
      return fail(new NotFoundError("Control", request.controlId));
    }

    const mapping = ComplianceMapping.create(asComplianceMappingId(randomUUID()), ctx.tenantId, {
      assetId: request.assetId as AssetId,
      controlId,
      gapStatus: GapStatus.fromControlMaturity(control.maturityLevel),
      evidence: [] as Evidence[],
    });

    await this.deps.complianceMappingRepository.save(ctx, mapping);
    log.info("compliance mapping created", {
      tenantId: ctx.tenantId,
      assetId: request.assetId,
      controlId: request.controlId,
      gapStatus: mapping.gapStatus.value,
    });

    for (const event of mapping.pullDomainEvents()) {
      if (event instanceof ComplianceMappedEvent) {
        await this.deps.eventPublisher.publish({
          eventId: randomUUID(),
          eventName: "ComplianceMapped",
          occurredAt: event.occurredAt.toISOString(),
          payload: {
            tenantId: event.tenantId,
            assetId: event.assetId,
            controlId: event.controlId,
            gapStatus: event.gapStatus,
            timestamp: event.occurredAt.toISOString(),
          },
        });
      }
    }

    return ok(mapping);
  }
}

export class RunGapAnalysisUseCaseImpl implements RunGapAnalysisUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListComplianceGapsQuery): Promise<Result<PaginatedResult<ComplianceMapping>>> {
    const all = await this.deps.complianceMappingRepository.list(ctx);
    const filtered = query.gapStatus ? all.filter((m) => m.gapStatus.value === query.gapStatus) : all;

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);
    return ok({ items, page: query.page, pageSize: query.pageSize, total: filtered.length });
  }
}

export class GetTraceabilityUseCaseImpl implements GetTraceabilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, assetId: AssetId): Promise<Result<TraceabilityEntry[]>> {
    const entries = await this.deps.traceabilityService.traceAssetToRegulation(ctx, assetId);
    return ok(entries);
  }
}

export function createComplianceModule(deps: Dependencies) {
  return {
    mapAssetToControl: new MapAssetToControlUseCaseImpl(deps),
    runGapAnalysis: new RunGapAnalysisUseCaseImpl(deps),
    getTraceability: new GetTraceabilityUseCaseImpl(deps),
  };
}

export type ComplianceModule = ReturnType<typeof createComplianceModule>;
