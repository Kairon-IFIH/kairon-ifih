import type {
  AssetId,
  ControlId,
  CryptoScanResultId,
  OptimizationJobId,
  RiskId,
  TenantId,
} from "@kairon/shared-kernel";

/** Section 3.3 / Section 8 of ARCHITECTURE.md — the full domain event catalog. */
export type DomainEventName =
  | "AssetDiscovered"
  | "AssetClassified"
  | "ComplianceMapped"
  | "RiskCalculated"
  | "FinancialExposureQuantified"
  | "RemediationGenerated"
  | "OptimizationExecuted"
  | "RemediationApproved"
  | "CryptoScanCompleted";

export interface AssetDiscoveredPayload {
  tenantId: TenantId;
  assetId: AssetId;
  assetType: string;
  criticality: string;
  timestamp: string;
}

export interface AssetClassifiedPayload {
  tenantId: TenantId;
  assetId: AssetId;
  dataClassification: string;
  regulatoryScope: string[];
  timestamp: string;
}

export interface ComplianceMappedPayload {
  tenantId: TenantId;
  assetId: AssetId;
  controlId: ControlId;
  gapStatus: "COMPLIANT" | "GAP" | "PARTIAL";
  timestamp: string;
}

export interface RiskCalculatedPayload {
  tenantId: TenantId;
  riskId: RiskId;
  assetId: AssetId;
  likelihood: number;
  impact: number;
  riskScore: number;
  residualRisk: number;
  timestamp: string;
}

export interface FinancialExposureQuantifiedPayload {
  tenantId: TenantId;
  assetId: AssetId;
  expectedLoss: number;
  financialExposure: number;
  currency: string;
  timestamp: string;
}

export interface RemediationCandidate {
  actionId: string;
  cost: number;
  riskReduction: number;
}

export interface RemediationGeneratedPayload {
  tenantId: TenantId;
  candidateActions: RemediationCandidate[];
  timestamp: string;
}

export interface OptimizationExecutedPayload {
  tenantId: TenantId;
  jobId: OptimizationJobId;
  selectedActions: string[];
  totalCost: number;
  riskReduction: number;
  residualRisk: number;
  timestamp: string;
}

export interface RemediationApprovedPayload {
  tenantId: TenantId;
  actionId: string;
  approvedBy: string;
  timestamp: string;
}

export interface CryptoScanCompletedPayload {
  tenantId: TenantId;
  scanResultId: CryptoScanResultId;
  assetId: AssetId;
  qarsScore: number;
  riskLevel: string;
  quantumVulnerable: boolean;
  hndlStatus: string;
  timestamp: string;
}

export interface DomainEventEnvelope<
  TName extends DomainEventName = DomainEventName,
  TPayload = unknown
> {
  eventId: string;
  eventName: TName;
  occurredAt: string;
  payload: TPayload;
}

export type AnyDomainEventEnvelope =
  | DomainEventEnvelope<"AssetDiscovered", AssetDiscoveredPayload>
  | DomainEventEnvelope<"AssetClassified", AssetClassifiedPayload>
  | DomainEventEnvelope<"ComplianceMapped", ComplianceMappedPayload>
  | DomainEventEnvelope<"RiskCalculated", RiskCalculatedPayload>
  | DomainEventEnvelope<"FinancialExposureQuantified", FinancialExposureQuantifiedPayload>
  | DomainEventEnvelope<"RemediationGenerated", RemediationGeneratedPayload>
  | DomainEventEnvelope<"OptimizationExecuted", OptimizationExecutedPayload>
  | DomainEventEnvelope<"RemediationApproved", RemediationApprovedPayload>
  | DomainEventEnvelope<"CryptoScanCompleted", CryptoScanCompletedPayload>;
