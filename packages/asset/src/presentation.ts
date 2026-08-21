import { Router, type Request, type Response, type NextFunction } from "express";
import type { AssetId, TenantContext } from "@kairon/shared-kernel";
import { createAssetSchema, listAssetsQuerySchema, apiSuccess, type PaginatedResult } from "@kairon/api-contracts";
import type { AssetModule } from "./application";
import type { Asset } from "./domain";

/**
 * `req.tenantContext` is populated by the tenant-context middleware in apps/api
 * (ARCHITECTURE.md §4.3) before any route in this router runs.
 */
function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/**
 * Flattens the Asset aggregate into wire-safe JSON. Without this, res.json()
 * on the raw entity serializes its private fields as-is (id, tenantId, props,
 * domainEvents, nested value-object .props) — an accident of how JS class
 * instances stringify, not a contract. Every route below returns this shape.
 */
function toAssetDTO(asset: Asset) {
  return {
    id: asset.id,
    name: asset.name,
    assetType: asset.assetType,
    criticality: asset.criticality.level,
    criticalityWeight: asset.criticality.weight,
    dataClassification: asset.dataClassification.level,
    regulatoryScope: asset.regulatoryScope.frameworkCodes,
  };
}

function toAssetListDTO(page: PaginatedResult<Asset>) {
  return { ...page, items: page.items.map(toAssetDTO) };
}

export function createAssetRouter(module: AssetModule): Router {
  const router = Router();

  router.post("/assets", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createAssetSchema.parse(req.body);
      const result = await module.createAsset.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(toAssetDTO(result.value), "Asset created"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/assets", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listAssetsQuerySchema.parse(req.query);
      const result = await module.listAssets.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toAssetListDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/assets/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await module.getAssetById.execute(tenantContextOf(req), req.params.id as AssetId);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toAssetDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.post("/assets/import", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csvContent = typeof req.body === "string" ? req.body : "";
      const result = await module.importAssetsFromCsv.execute(tenantContextOf(req), csvContent);
      if (!result.isSuccess) return next(result.error);
      res.status(202).json(apiSuccess(result.value, "Import accepted"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
