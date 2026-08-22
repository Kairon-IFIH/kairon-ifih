import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

/**
 * Request/query validation shapes (Section 7/§"Validation Standards" of BACKEND.md).
 * These describe SHAPE and FORMAT only (types, required-ness, ranges) — they encode
 * no business rules (e.g. no cross-field risk/budget logic lives here).
 */

// ---- identity ----
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

// ---- asset ----
export const createAssetSchema = z.object({
  name: z.string().min(1),
  assetType: z.string().min(1),
  ownerId: z.string().uuid().optional(),
  businessServiceId: z.string().uuid().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dataClassification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]),
});
export type CreateAssetRequest = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.partial();
export type UpdateAssetRequest = z.infer<typeof updateAssetSchema>;

export const listAssetsQuerySchema = paginationQuerySchema.extend({
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;

// ---- compliance ----
export const createComplianceMappingSchema = z.object({
  assetId: z.string().uuid(),
  // Controls are platform-owned reference data with stable human-readable
  // codes (e.g. "dpdp-control-encryption"), not tenant-generated UUIDs —
  // see packages/compliance/src/seed.ts.
  controlId: z.string().min(1),
});
export type CreateComplianceMappingRequest = z.infer<typeof createComplianceMappingSchema>;

export const listComplianceGapsQuerySchema = paginationQuerySchema.extend({
  frameworkId: z.string().min(1).optional(),
  gapStatus: z.enum(["COMPLIANT", "GAP", "PARTIAL"]).optional(),
});
export type ListComplianceGapsQuery = z.infer<typeof listComplianceGapsQuerySchema>;

// ---- risk ----
export const calculateRiskSchema = z.object({
  assetId: z.string().uuid(),
});
export type CalculateRiskRequest = z.infer<typeof calculateRiskSchema>;

export const listRisksQuerySchema = paginationQuerySchema.extend({
  assetId: z.string().uuid().optional(),
  minRiskScore: z.coerce.number().min(0).max(100).optional(),
});
export type ListRisksQuery = z.infer<typeof listRisksQuerySchema>;

// ---- financial ----
export const quantifyExposureSchema = z.object({
  riskId: z.string().uuid(),
});
export type QuantifyExposureRequest = z.infer<typeof quantifyExposureSchema>;

// ---- quantum ----
// Shape matches apps/quantum-runner's documented contract (README.md) so the
// TS-side greedy fallback and the future Qiskit/PennyLane solver consume
// identical input — no adapter needed when the real sidecar comes online.
export const candidateActionSchema = z.object({
  actionId: z.string().uuid(),
  cost: z.number().positive(),
  riskReduction: z.number().min(0).max(1),
});
export type CandidateActionInput = z.infer<typeof candidateActionSchema>;

export const createOptimizationJobSchema = z.object({
  candidateActions: z.array(candidateActionSchema).min(1),
  budget: z.number().positive(),
  currency: z.enum(["INR", "USD"]),
  mandatoryActionIds: z.array(z.string().uuid()).default([]),
});
export type CreateOptimizationJobRequest = z.infer<typeof createOptimizationJobSchema>;

// ---- quantum scanner ----
export const runCryptoScanSchema = z.object({
  assetId: z.string().uuid(),
  dataSensitivityTier: z.enum(["TRANSACTION", "AUTHENTICATION", "STATIC"]).default("TRANSACTION"),
});
export type RunCryptoScanRequest = z.infer<typeof runCryptoScanSchema>;

export const listScanResultsQuerySchema = paginationQuerySchema.extend({
  assetId: z.string().uuid().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
export type ListScanResultsQuery = z.infer<typeof listScanResultsQuerySchema>;

// ---- audit ----
export const listAuditEventsQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

// ---- notification ----
export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
