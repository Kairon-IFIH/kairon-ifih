import type { CriticalityLevel, RiskLevel } from "../types/api";

/**
 * Mirrors the server-side formula exactly (packages/risk/src/application.ts's
 * RiskScoringServiceImpl + packages/asset/src/domain.ts's Criticality weights)
 * so the Risk Engine page can show a live preview before the user submits —
 * POST /risks/calculate takes only { assetId }; the server derives likelihood,
 * impact and control effectiveness from the asset's criticality itself, there
 * is no client-supplied likelihood/impact/control-effectiveness input today.
 * If those constants ever change server-side, update them here too.
 */
const CRITICALITY_WEIGHTS: Record<CriticalityLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const IMPACT_PER_CRITICALITY_POINT_INR = 25_00_000;
const MAX_REFERENCE_IMPACT_INR = 100_00_000;
const BASELINE_CONTROL_EFFECTIVENESS = 0.3;

function levelFor(residualScore: number): RiskLevel {
  if (residualScore < 25) return "LOW";
  if (residualScore < 50) return "MEDIUM";
  if (residualScore < 75) return "HIGH";
  return "CRITICAL";
}

export function previewRiskForCriticality(criticality: CriticalityLevel) {
  const weight = CRITICALITY_WEIGHTS[criticality];
  const likelihood = weight / 4;
  const impactAmount = weight * IMPACT_PER_CRITICALITY_POINT_INR;
  const normalizedImpact = Math.min(impactAmount / MAX_REFERENCE_IMPACT_INR, 1) * 100;
  const inherentScore = Math.round(likelihood * normalizedImpact);
  const residualScore = Math.round(inherentScore * (1 - BASELINE_CONTROL_EFFECTIVENESS));
  return {
    likelihood,
    impactAmount,
    controlEffectiveness: BASELINE_CONTROL_EFFECTIVENESS,
    inherentScore,
    residualScore,
    level: levelFor(residualScore),
  };
}
