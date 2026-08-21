/** Mirrors apps/api's response envelope (packages/api-contracts/src/response-envelope.ts). */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors: string[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---- auth ----
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ---- assets ----
export type CriticalityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DataClassificationLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface Asset {
  id: string;
  name: string;
  assetType: string;
  criticality: CriticalityLevel;
  criticalityWeight: number;
  dataClassification: DataClassificationLevel;
  regulatoryScope: string[];
}

// ---- risks ----
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CurrencyCode = "INR" | "USD";

export interface Risk {
  id: string;
  assetId: string;
  likelihood: number;
  impactAmount: number;
  impactCurrency: CurrencyCode;
  inherentScore: number;
  residualScore: number;
  level: RiskLevel;
}

// ---- financial ----
export interface FinancialExposure {
  id: string;
  assetId: string;
  riskId: string;
  expectedLossAmount: number;
  expectedLossCurrency: CurrencyCode;
  financialExposureAmount: number;
  financialExposureCurrency: CurrencyCode;
  residualRiskExposureAmount: number;
  residualRiskExposureCurrency: CurrencyCode;
}

export interface QRisk {
  qRisk: number;
}

// ---- quantum optimization ----
export type OptimizationJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface CandidateAction {
  actionId: string;
  costAmount: number;
  costCurrency: CurrencyCode;
  riskReduction: number;
}

export interface OptimizationResult {
  selectedActionIds: string[];
  totalCostAmount: number;
  totalCostCurrency: CurrencyCode;
  riskReductionPercent: number;
  residualRiskAmount: number;
  residualRiskCurrency: CurrencyCode;
  classicalBaselineComparison: {
    classicalRuntimeMs: number;
    quantumRuntimeMs: number;
    qualityDelta: number;
  };
}

export interface OptimizationJob {
  id: string;
  status: OptimizationJobStatus;
  candidateActions: CandidateAction[];
  mandatoryActionIds: string[];
  budget: { amount: number; currency: CurrencyCode };
  result: OptimizationResult | null;
}

// ---- compliance ----
export type FrameworkCode = "DPDP" | "GDPR" | "DORA" | "NIST" | "ISO27001";
export type GapStatusValue = "COMPLIANT" | "GAP" | "PARTIAL";

export interface ComplianceMapping {
  id: string;
  assetId: string;
  controlId: string;
  gapStatus: GapStatusValue;
  evidence: { id: string; description: string; documentRef: string }[];
}

export interface TraceabilityEntry {
  framework: { id: string; code: FrameworkCode; version: string };
  regulation: { id: string; name: string; clauseReference: string };
  control: { id: string; name: string; maturityLevel: number; effectiveness: number };
}

// ---- audit ----
export interface AuditEvent {
  id: string;
  tenantId: string;
  timestamp: string;
  actor: { userId: string; displayName: string };
  action: string;
  entityType: string;
  entityId: string;
  diff: { before: Record<string, unknown>; after: Record<string, unknown> };
}

// ---- notifications ----
export type NotificationType = "OPTIMIZATION_COMPLETE" | "REMEDIATION_PENDING_APPROVAL";

export interface Notification {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
