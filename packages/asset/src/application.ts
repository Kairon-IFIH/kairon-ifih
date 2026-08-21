import { randomUUID } from "node:crypto";
import {
  asAssetId,
  asAssetOwnerId,
  asBusinessServiceId,
  fail,
  ok,
  Result,
  TenantContext,
  ValidationError,
} from "@kairon/shared-kernel";
import type { CreateAssetRequest, ListAssetsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import {
  Asset,
  AssetRepository,
  Criticality,
  CriticalityLevel,
  DataClassification,
  DataClassificationLevel,
  RegulatoryScope,
  AssetClassifiedEvent,
  AssetDiscoveredEvent,
} from "./domain";

export interface CreateAssetUseCase {
  execute(ctx: TenantContext, request: CreateAssetRequest): Promise<Result<Asset>>;
}

export interface ImportAssetsFromCsvUseCase {
  execute(ctx: TenantContext, csvContent: string): Promise<Result<{ imported: number }>>;
}

export interface ListAssetsUseCase {
  execute(ctx: TenantContext, query: ListAssetsQuery): Promise<Result<PaginatedResult<Asset>>>;
}

export interface Dependencies {
  assetRepository: AssetRepository;
  eventPublisher: EventPublisher;
}

async function publishDomainEvents(eventPublisher: EventPublisher, asset: Asset): Promise<void> {
  for (const event of asset.pullDomainEvents()) {
    if (event instanceof AssetDiscoveredEvent) {
      await eventPublisher.publish({
        eventId: randomUUID(),
        eventName: "AssetDiscovered",
        occurredAt: event.occurredAt.toISOString(),
        payload: {
          tenantId: event.tenantId,
          assetId: event.assetId,
          assetType: event.assetType,
          criticality: event.criticality,
          timestamp: event.occurredAt.toISOString(),
        },
      });
    } else if (event instanceof AssetClassifiedEvent) {
      await eventPublisher.publish({
        eventId: randomUUID(),
        eventName: "AssetClassified",
        occurredAt: event.occurredAt.toISOString(),
        payload: {
          tenantId: event.tenantId,
          assetId: event.assetId,
          dataClassification: event.dataClassification,
          regulatoryScope: [...event.regulatoryScope],
          timestamp: event.occurredAt.toISOString(),
        },
      });
    }
  }
}

export class CreateAssetUseCaseImpl implements CreateAssetUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, request: CreateAssetRequest): Promise<Result<Asset>> {
    const asset = Asset.create(asAssetId(randomUUID()), ctx.tenantId, {
      name: request.name,
      assetType: request.assetType,
      ownerId: request.ownerId ? asAssetOwnerId(request.ownerId) : undefined,
      businessServiceId: request.businessServiceId ? asBusinessServiceId(request.businessServiceId) : undefined,
      criticality: Criticality.create(request.criticality),
      dataClassification: DataClassification.create(request.dataClassification),
      regulatoryScope: RegulatoryScope.create(),
    });
    await this.deps.assetRepository.save(ctx, asset);
    await publishDomainEvents(this.deps.eventPublisher, asset);
    return ok(asset);
  }
}

export class ImportAssetsFromCsvUseCaseImpl implements ImportAssetsFromCsvUseCase {
  constructor(private readonly deps: Dependencies) {}

  /**
   * Hackathon-cut ingestion path (ARCHITECTURE.md §1.13) — no live discovery
   * connectors. Expects a header row: name,assetType,criticality,dataClassification
   */
  async execute(ctx: TenantContext, csvContent: string): Promise<Result<{ imported: number }>> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return fail(new ValidationError(["CSV must contain a header row and at least one data row"]));
    }

    const header = lines[0].split(",").map((h) => h.trim());
    const required = ["name", "assetType", "criticality", "dataClassification"];
    if (!required.every((col) => header.includes(col))) {
      return fail(new ValidationError([`CSV header must include: ${required.join(", ")}`]));
    }

    let imported = 0;
    for (const line of lines.slice(1)) {
      const cells = line.split(",").map((c) => c.trim());
      const row = Object.fromEntries(header.map((col, i) => [col, cells[i]]));

      const asset = Asset.create(asAssetId(randomUUID()), ctx.tenantId, {
        name: row.name,
        assetType: row.assetType,
        criticality: Criticality.create(row.criticality as CriticalityLevel),
        dataClassification: DataClassification.create(row.dataClassification as DataClassificationLevel),
        regulatoryScope: RegulatoryScope.create(),
      });
      await this.deps.assetRepository.save(ctx, asset);
      await publishDomainEvents(this.deps.eventPublisher, asset);
      imported += 1;
    }

    return ok({ imported });
  }
}

export class ListAssetsUseCaseImpl implements ListAssetsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListAssetsQuery): Promise<Result<PaginatedResult<Asset>>> {
    const all = await this.deps.assetRepository.list(ctx);
    const filtered = query.criticality
      ? all.filter((a) => a.criticality.level === query.criticality)
      : all;

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);

    return ok({ items, page: query.page, pageSize: query.pageSize, total: filtered.length });
  }
}

export function createAssetModule(deps: Dependencies) {
  return {
    createAsset: new CreateAssetUseCaseImpl(deps),
    importAssetsFromCsv: new ImportAssetsFromCsvUseCaseImpl(deps),
    listAssets: new ListAssetsUseCaseImpl(deps),
  };
}

export type AssetModule = ReturnType<typeof createAssetModule>;
