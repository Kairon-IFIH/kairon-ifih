/**
 * Branded identifier types. Prevents passing an AssetId where a RiskId is expected,
 * even though both are strings underneath (uuid).
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

export type TenantId = Brand<string, "TenantId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type DepartmentId = Brand<string, "DepartmentId">;
export type UserId = Brand<string, "UserId">;
export type RoleId = Brand<string, "RoleId">;

export type AssetId = Brand<string, "AssetId">;
export type AssetOwnerId = Brand<string, "AssetOwnerId">;
export type BusinessServiceId = Brand<string, "BusinessServiceId">;

export type FrameworkId = Brand<string, "FrameworkId">;
export type RegulationId = Brand<string, "RegulationId">;
export type ControlId = Brand<string, "ControlId">;
export type RequirementId = Brand<string, "RequirementId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type ComplianceMappingId = Brand<string, "ComplianceMappingId">;

export type RiskId = Brand<string, "RiskId">;
export type RiskFactorId = Brand<string, "RiskFactorId">;

export type FinancialExposureId = Brand<string, "FinancialExposureId">;

export type OptimizationJobId = Brand<string, "OptimizationJobId">;
export type OptimizationResultId = Brand<string, "OptimizationResultId">;

export type AuditEventId = Brand<string, "AuditEventId">;
export type NotificationId = Brand<string, "NotificationId">;

export type CryptoScanResultId = Brand<string, "CryptoScanResultId">;
export type CryptoAssetId = Brand<string, "CryptoAssetId">;

const brand =
  <T extends string>() =>
  (id: string): Brand<string, T> =>
    id as Brand<string, T>;

export const asTenantId = brand<"TenantId">();
export const asOrganizationId = brand<"OrganizationId">();
export const asDepartmentId = brand<"DepartmentId">();
export const asUserId = brand<"UserId">();
export const asRoleId = brand<"RoleId">();

export const asAssetId = brand<"AssetId">();
export const asAssetOwnerId = brand<"AssetOwnerId">();
export const asBusinessServiceId = brand<"BusinessServiceId">();

export const asFrameworkId = brand<"FrameworkId">();
export const asRegulationId = brand<"RegulationId">();
export const asControlId = brand<"ControlId">();
export const asRequirementId = brand<"RequirementId">();
export const asEvidenceId = brand<"EvidenceId">();
export const asComplianceMappingId = brand<"ComplianceMappingId">();

export const asRiskId = brand<"RiskId">();
export const asRiskFactorId = brand<"RiskFactorId">();

export const asFinancialExposureId = brand<"FinancialExposureId">();

export const asOptimizationJobId = brand<"OptimizationJobId">();
export const asOptimizationResultId = brand<"OptimizationResultId">();

export const asAuditEventId = brand<"AuditEventId">();
export const asNotificationId = brand<"NotificationId">();

export const asCryptoScanResultId = brand<"CryptoScanResultId">();
export const asCryptoAssetId = brand<"CryptoAssetId">();
