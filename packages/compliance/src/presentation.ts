import { Router, type Request, type Response, type NextFunction } from "express";
import type { AssetId, TenantContext } from "@kairon/shared-kernel";
import {
  createComplianceMappingSchema,
  listComplianceGapsQuerySchema,
  apiSuccess,
  type PaginatedResult,
} from "@kairon/api-contracts";
import type { ComplianceModule } from "./application";
import type { ComplianceMapping, TraceabilityEntry } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens ComplianceMapping — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toComplianceMappingDTO(mapping: ComplianceMapping) {
  return {
    id: mapping.id,
    assetId: mapping.assetId,
    controlId: mapping.controlId,
    gapStatus: mapping.gapStatus.value,
    evidence: mapping.evidence.map((e) => ({ id: e.id, description: e.description, documentRef: e.documentRef })),
  };
}

function toComplianceGapsDTO(page: PaginatedResult<ComplianceMapping>) {
  return { ...page, items: page.items.map(toComplianceMappingDTO) };
}

function toTraceabilityDTO(entries: TraceabilityEntry[]) {
  return entries.map((entry) => ({
    framework: { id: entry.framework.id, code: entry.framework.code, version: entry.framework.version },
    regulation: {
      id: entry.regulation.id,
      name: entry.regulation.name,
      clauseReference: entry.regulation.clauseReference,
    },
    control: {
      id: entry.control.id,
      name: entry.control.name,
      maturityLevel: entry.control.maturityLevel,
      effectiveness: entry.control.effectiveness,
    },
  }));
}

export function createComplianceRouter(module: ComplianceModule): Router {
  const router = Router();

  router.post("/compliance/mappings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createComplianceMappingSchema.parse(req.body);
      const result = await module.mapAssetToControl.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(toComplianceMappingDTO(result.value), "Compliance mapping created"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/compliance/gaps", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listComplianceGapsQuerySchema.parse(req.query);
      const result = await module.runGapAnalysis.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toComplianceGapsDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/compliance/assets/:assetId/traceability",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await module.getTraceability.execute(
          tenantContextOf(req),
          req.params.assetId as AssetId
        );
        if (!result.isSuccess) return next(result.error);
        res.status(200).json(apiSuccess(toTraceabilityDTO(result.value), "OK"));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
