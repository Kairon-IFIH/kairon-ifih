import { Router, type Request, type Response, type NextFunction } from "express";
import type { TenantContext } from "@kairon/shared-kernel";
import { quantifyExposureSchema, apiSuccess } from "@kairon/api-contracts";
import type { FinancialModule } from "./application";
import type { FinancialExposure } from "./domain";

function tenantContextOf(req: Request): TenantContext {
  return (req as Request & { tenantContext: TenantContext }).tenantContext;
}

/** Flattens the FinancialExposure aggregate — see asset/src/presentation.ts's toAssetDTO for why this exists. */
function toFinancialExposureDTO(exposure: FinancialExposure) {
  return {
    id: exposure.id,
    assetId: exposure.assetId,
    riskId: exposure.riskId,
    expectedLossAmount: exposure.expectedLoss.annualizedAmount.amount,
    expectedLossCurrency: exposure.expectedLoss.annualizedAmount.currency,
    financialExposureAmount: exposure.financialExposure.amount,
    financialExposureCurrency: exposure.financialExposure.currency,
    residualRiskExposureAmount: exposure.residualRisk.exposure.amount,
    residualRiskExposureCurrency: exposure.residualRisk.exposure.currency,
  };
}

export function createFinancialRouter(module: FinancialModule): Router {
  const router = Router();

  router.post("/financial/exposures", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = quantifyExposureSchema.parse(req.body);
      const result = await module.quantifyExposure.execute(tenantContextOf(req), body);
      if (!result.isSuccess) return next(result.error);
      res.status(201).json(apiSuccess(toFinancialExposureDTO(result.value), "Financial exposure quantified"));
    } catch (err) {
      next(err);
    }
  });

  router.get("/financial/q-risk", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await module.calculateQRisk.execute(tenantContextOf(req));
      if (!result.isSuccess) return next(result.error);
      res.status(200).json(apiSuccess(result.value, "OK"));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
