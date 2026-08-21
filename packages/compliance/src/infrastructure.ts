import { AssetId, NotImplementedError, TenantContext } from "@kairon/shared-kernel";
import type {
  ComplianceMapping,
  ComplianceMappingRepository,
  Framework,
  FrameworkProps,
  FrameworkRepository,
} from "./domain";

export class PrismaFrameworkRepository implements FrameworkRepository {
  constructor(private readonly prisma: unknown) {}

  async findByCode(_code: FrameworkProps["code"]): Promise<Framework | null> {
    throw new NotImplementedError("PrismaFrameworkRepository.findByCode — Phase 4");
  }

  async list(): Promise<Framework[]> {
    throw new NotImplementedError("PrismaFrameworkRepository.list — Phase 4");
  }
}

export class PrismaComplianceMappingRepository implements ComplianceMappingRepository {
  constructor(private readonly prisma: unknown) {}

  async findByAsset(_ctx: TenantContext, _assetId: AssetId): Promise<ComplianceMapping[]> {
    throw new NotImplementedError("PrismaComplianceMappingRepository.findByAsset — Phase 4");
  }

  async save(_ctx: TenantContext, _mapping: ComplianceMapping): Promise<void> {
    throw new NotImplementedError("PrismaComplianceMappingRepository.save — Phase 4");
  }
}
