import { NotImplementedError, Result, TenantContext } from "@kairon/shared-kernel";
import type { CreateAssetRequest, ListAssetsQuery, PaginatedResult } from "@kairon/api-contracts";
import type { Asset, AssetRepository } from "./domain";

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
}

export class CreateAssetUseCaseImpl implements CreateAssetUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _request: CreateAssetRequest): Promise<Result<Asset>> {
    throw new NotImplementedError("CreateAssetUseCase.execute — Phase 2, ARCHITECTURE.md §6 Asset Service");
  }
}

export class ImportAssetsFromCsvUseCaseImpl implements ImportAssetsFromCsvUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(_ctx: TenantContext, _csvContent: string): Promise<Result<{ imported: number }>> {
    throw new NotImplementedError(
      "ImportAssetsFromCsvUseCase.execute — Phase 2, hackathon-cut ingestion path, ARCHITECTURE.md §1.13"
    );
  }
}

export class ListAssetsUseCaseImpl implements ListAssetsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    _ctx: TenantContext,
    _query: ListAssetsQuery
  ): Promise<Result<PaginatedResult<Asset>>> {
    throw new NotImplementedError("ListAssetsUseCase.execute — Phase 2");
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
