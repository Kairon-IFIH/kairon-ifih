import { apiRequest, apiTextRequest } from "./api-client";
import type {
  Asset,
  AuditEvent,
  AuthTokens,
  ComplianceMapping,
  CriticalityLevel,
  CurrencyCode,
  DataClassificationLevel,
  FinancialExposure,
  Notification,
  OptimizationJob,
  Paginated,
  QRisk,
  Risk,
  TraceabilityEntry,
} from "../types/api";

// ---- auth ----
export const login = (email: string, password: string) =>
  apiRequest<AuthTokens>("/auth/login", { method: "POST", body: { email, password } });

// ---- assets ----
export const listAssets = (page = 1, pageSize = 20) =>
  apiRequest<Paginated<Asset>>("/assets", { query: { page, pageSize } });

export const getAsset = (id: string) => apiRequest<Asset>(`/assets/${id}`);

export const createAsset = (input: {
  name: string;
  assetType: string;
  criticality: CriticalityLevel;
  dataClassification: DataClassificationLevel;
}) => apiRequest<Asset>("/assets", { method: "POST", body: input });

export const importAssetsCsv = (csvContent: string) =>
  apiTextRequest<{ imported: number }>("/assets/import", csvContent);

// ---- risks ----
export const listRisks = (page = 1, pageSize = 20) => apiRequest<Paginated<Risk>>("/risks", { query: { page, pageSize } });

export const calculateRisk = (assetId: string) =>
  apiRequest<Risk>("/risks/calculate", { method: "POST", body: { assetId } });

// ---- financial ----
export const quantifyExposure = (riskId: string) =>
  apiRequest<FinancialExposure>("/financial/exposures", { method: "POST", body: { riskId } });

export const getQRisk = () => apiRequest<QRisk>("/financial/q-risk");

// ---- optimization ----
export const createOptimizationJob = (input: {
  candidateActions: { actionId: string; cost: number; riskReduction: number }[];
  budget: number;
  currency: CurrencyCode;
  mandatoryActionIds: string[];
}) => apiRequest<{ jobId: string }>("/optimization-jobs", { method: "POST", body: input });

export const getOptimizationJob = (jobId: string) => apiRequest<OptimizationJob>(`/optimization-jobs/${jobId}`);

// ---- compliance ----
export const runGapAnalysis = (page = 1, pageSize = 20, gapStatus?: ComplianceMapping["gapStatus"]) =>
  apiRequest<Paginated<ComplianceMapping>>("/compliance/gaps", { query: { page, pageSize, gapStatus } });

export const mapAssetToControl = (input: { assetId: string; controlId: string }) =>
  apiRequest<ComplianceMapping>("/compliance/mappings", { method: "POST", body: input });

export const getAssetTraceability = (assetId: string) =>
  apiRequest<TraceabilityEntry[]>(`/compliance/assets/${assetId}/traceability`);

// ---- audit ----
export const listAuditEvents = (
  page = 1,
  pageSize = 20,
  filters?: { entityType?: string; from?: string; to?: string }
) => apiRequest<Paginated<AuditEvent>>("/audit", { query: { page, pageSize, ...filters } });

// ---- notifications ----
export const listNotifications = (unreadOnly = false, page = 1, pageSize = 20) =>
  apiRequest<Paginated<Notification>>("/notifications", { query: { unreadOnly, page, pageSize } });

export const markNotificationRead = (id: string) =>
  apiRequest<null>(`/notifications/${id}/read`, { method: "POST" });
