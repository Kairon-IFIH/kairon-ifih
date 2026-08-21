import type { PrismaClient } from "@prisma/client";
import {
  asAssetId,
  asComplianceMappingId,
  asControlId,
  asEvidenceId,
  asFrameworkId,
  asRegulationId,
  asTenantId,
  AssetId,
  ControlId,
  FrameworkId,
  RegulationId,
  TenantContext,
} from "@kairon/shared-kernel";
import { ComplianceMapping, Control, Evidence, Framework, GapStatus, GapStatusValue, Regulation } from "./domain";
import type {
  ComplianceMappingRepository,
  ControlRepository,
  FrameworkCode,
  FrameworkRepository,
  RegulationRepository,
} from "./domain";

export class PrismaFrameworkRepository implements FrameworkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async toDomain(row: { id: string; code: string; version: string }): Promise<Framework> {
    const regulations = await this.prisma.regulation.findMany({ where: { frameworkId: row.id } });
    return Framework.create(asFrameworkId(row.id), {
      code: row.code as FrameworkCode,
      version: row.version,
      regulationIds: regulations.map((r) => asRegulationId(r.id)),
    });
  }

  async findByCode(code: FrameworkCode): Promise<Framework | null> {
    const row = await this.prisma.framework.findUnique({ where: { code } });
    return row ? this.toDomain(row) : null;
  }

  async list(): Promise<Framework[]> {
    const rows = await this.prisma.framework.findMany();
    return Promise.all(rows.map((r) => this.toDomain(r)));
  }
}

export class PrismaRegulationRepository implements RegulationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByFramework(frameworkId: FrameworkId): Promise<Regulation[]> {
    const rows = await this.prisma.regulation.findMany({ where: { frameworkId } });
    return Promise.all(
      rows.map(async (row) => {
        const controls = await this.prisma.control.findMany({ where: { regulationId: row.id } });
        return Regulation.create(asRegulationId(row.id), {
          name: row.name,
          clauseReference: row.clauseReference,
          controlIds: controls.map((c) => asControlId(c.id)),
        });
      })
    );
  }
}

export class PrismaControlRepository implements ControlRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: { id: string; name: string; maturityLevel: number }): Control {
    // Requirement is domain-modelled but has no Prisma table (not surfaced by
    // any current endpoint) — always reconstructed empty, never persisted.
    return Control.create(asControlId(row.id), { name: row.name, requirementIds: [], maturityLevel: row.maturityLevel });
  }

  async findById(controlId: ControlId): Promise<Control | null> {
    const row = await this.prisma.control.findUnique({ where: { id: controlId } });
    return row ? this.toDomain(row) : null;
  }

  async findByRegulation(regulationId: RegulationId): Promise<Control[]> {
    const rows = await this.prisma.control.findMany({ where: { regulationId } });
    return rows.map((r) => this.toDomain(r));
  }
}

export class PrismaComplianceMappingRepository implements ComplianceMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: {
    id: string;
    tenantId: string;
    assetId: string;
    controlId: string;
    gapStatus: string;
    evidence: unknown;
  }): ComplianceMapping {
    const evidence = (row.evidence as { id: string; description: string; documentRef: string }[]).map((e) =>
      Evidence.create(asEvidenceId(e.id), { description: e.description, documentRef: e.documentRef })
    );
    return ComplianceMapping.create(asComplianceMappingId(row.id), asTenantId(row.tenantId), {
      assetId: asAssetId(row.assetId),
      controlId: asControlId(row.controlId),
      gapStatus: GapStatus.create(row.gapStatus as GapStatusValue),
      evidence,
    });
  }

  async list(ctx: TenantContext): Promise<ComplianceMapping[]> {
    const rows = await this.prisma.complianceMapping.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ComplianceMapping[]> {
    const rows = await this.prisma.complianceMapping.findMany({
      where: { tenantId: ctx.tenantId, assetId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(ctx: TenantContext, mapping: ComplianceMapping): Promise<void> {
    const evidence = mapping.evidence.map((e) => ({ id: e.id, description: e.description, documentRef: e.documentRef }));
    await this.prisma.complianceMapping.upsert({
      where: { id: mapping.id },
      create: {
        id: mapping.id,
        tenantId: ctx.tenantId,
        assetId: mapping.assetId,
        controlId: mapping.controlId,
        gapStatus: mapping.gapStatus.value,
        evidence,
      },
      update: {
        gapStatus: mapping.gapStatus.value,
        evidence,
      },
    });
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
