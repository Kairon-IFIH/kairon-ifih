import { AssetId, ControlId, FrameworkId, NotImplementedError, RegulationId, TenantContext } from "@kairon/shared-kernel";
import type {
  ComplianceMapping,
  ComplianceMappingRepository,
  Control,
  ControlRepository,
  Framework,
  FrameworkCode,
  FrameworkRepository,
  Regulation,
  RegulationRepository,
} from "./domain";

export class PrismaFrameworkRepository implements FrameworkRepository {
  constructor(private readonly prisma: unknown) {}

  async findByCode(_code: FrameworkCode): Promise<Framework | null> {
    throw new NotImplementedError("PrismaFrameworkRepository.findByCode — Phase 4");
  }

  async list(): Promise<Framework[]> {
    throw new NotImplementedError("PrismaFrameworkRepository.list — Phase 4");
  }
}

export class PrismaComplianceMappingRepository implements ComplianceMappingRepository {
  constructor(private readonly prisma: unknown) {}

  async list(_ctx: TenantContext): Promise<ComplianceMapping[]> {
    throw new NotImplementedError("PrismaComplianceMappingRepository.list — Phase 4");
  }

  async findByAsset(_ctx: TenantContext, _assetId: AssetId): Promise<ComplianceMapping[]> {
    throw new NotImplementedError("PrismaComplianceMappingRepository.findByAsset — Phase 4");
  }

  async save(_ctx: TenantContext, _mapping: ComplianceMapping): Promise<void> {
    throw new NotImplementedError("PrismaComplianceMappingRepository.save — Phase 4");
  }
}

/** In-memory implementation — reference data is platform-owned, not tenant-scoped (ARCHITECTURE.md §4.4). */
export class InMemoryFrameworkRepository implements FrameworkRepository {
  private readonly byId = new Map<string, Framework>();
  private readonly byCode = new Map<string, Framework>();

  async findByCode(code: FrameworkCode): Promise<Framework | null> {
    return this.byCode.get(code) ?? null;
  }

  async list(): Promise<Framework[]> {
    return [...this.byId.values()];
  }

  async save(framework: Framework): Promise<void> {
    this.byId.set(framework.id, framework);
    this.byCode.set(framework.code, framework);
  }
}

export class InMemoryRegulationRepository implements RegulationRepository {
  private readonly byId = new Map<string, Regulation>();
  private readonly byFramework = new Map<string, Regulation[]>();

  async findByFramework(frameworkId: FrameworkId): Promise<Regulation[]> {
    return this.byFramework.get(frameworkId) ?? [];
  }

  async save(frameworkId: FrameworkId, regulation: Regulation): Promise<void> {
    this.byId.set(regulation.id, regulation);
    const list = this.byFramework.get(frameworkId) ?? [];
    list.push(regulation);
    this.byFramework.set(frameworkId, list);
  }
}

export class InMemoryControlRepository implements ControlRepository {
  private readonly byId = new Map<string, Control>();
  private readonly byRegulation = new Map<string, Control[]>();

  async findById(controlId: ControlId): Promise<Control | null> {
    return this.byId.get(controlId) ?? null;
  }

  async findByRegulation(regulationId: RegulationId): Promise<Control[]> {
    return this.byRegulation.get(regulationId) ?? [];
  }

  async save(regulationId: RegulationId, control: Control): Promise<void> {
    this.byId.set(control.id, control);
    const list = this.byRegulation.get(regulationId) ?? [];
    list.push(control);
    this.byRegulation.set(regulationId, list);
  }
}

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryComplianceMappingRepository implements ComplianceMappingRepository {
  private readonly byTenant = new Map<string, Map<string, ComplianceMapping>>();

  private tenantStore(ctx: TenantContext): Map<string, ComplianceMapping> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async list(ctx: TenantContext): Promise<ComplianceMapping[]> {
    return [...this.tenantStore(ctx).values()];
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ComplianceMapping[]> {
    return [...this.tenantStore(ctx).values()].filter((m) => m.assetId === assetId);
  }

  async save(ctx: TenantContext, mapping: ComplianceMapping): Promise<void> {
    this.tenantStore(ctx).set(mapping.id, mapping);
  }
}
