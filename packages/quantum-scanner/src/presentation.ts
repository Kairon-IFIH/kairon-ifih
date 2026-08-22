import { Router, type Request, type Response, type NextFunction } from "express";
import type { TenantContext } from "@kairon/shared-kernel";
import { runCryptoScanSchema, listScanResultsQuerySchema, apiSuccess, type PaginatedResult } from "@kairon/api-contracts";
import type { QuantumScannerModule } from "./application";
import type { ScanResult } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens the ScanResult aggregate — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toScanResultDTO(scan: ScanResult) {
  return {
    id: scan.id,
    assetId: scan.assetId,
    dataSensitivityTier: scan.dataSensitivityTier,
    scannedAt: scan.scannedAt.toISOString(),
    quantumVulnerable: scan.quantumVulnerable,
    weakestStrength: scan.weakestStrength,
    hndl: {
      actNow: scan.hndl.actNow,
      status: scan.hndl.status,
    },
    qars: {
      score: scan.qars.score,
      riskLevel: scan.qars.riskLevel,
      rubric: {
        weights: scan.qars.rubric.weights,
        ratios: scan.qars.rubric.ratios,
        penalties: scan.qars.rubric.penalties,
      },
    },
    findings: scan.findings.map((f) => ({
      assetType: f.finding.assetType,
      algorithm: f.finding.algorithm,
      category: f.finding.category,
      strength: f.finding.strength,
      keySizeBits: f.finding.keySizeBits,
      notes: f.finding.notes,
      quantumVulnerable: f.finding.quantumVulnerable,
    })),
  };
}

function toScanResultListDTO(page: PaginatedResult<ScanResult>) {
  return { ...page, items: page.items.map(toScanResultDTO) };
}

export function createQuantumScannerRouter(module: QuantumScannerModule): Router {
  const router = Router();

  router.post("/scanner/scans", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = runCryptoScanSchema.parse(req.body);
      const result = await module.runCryptoScan.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(toScanResultDTO(result.value), "Scan completed"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/scanner/scans", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listScanResultsQuerySchema.parse(req.query);
      const result = await module.listScanResults.execute(tenantContextOf(req), query);
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(toScanResultListDTO(result.value), "OK"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/scanner/telemetry", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await module.getScanTelemetry.execute(tenantContextOf(req));
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
