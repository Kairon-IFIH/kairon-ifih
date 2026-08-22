import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { asAssetId, asCryptoAssetId, asCryptoScanResultId, asTenantId, AssetId, CryptoScanResultId, TenantContext } from "@kairon/shared-kernel";
import { CryptoAsset, CryptoFinding, DataSensitivityTier, HndlAssessment, QarsRubric, QarsScore, ScanResult } from "./domain";
import type { ScanResultRepository } from "./domain";

interface StoredFinding {
  hostname: string;
  assetType: string;
  algorithm: string;
  category: string;
  strength: string;
  keySizeBits?: number;
  notes?: string;
}

export class PrismaScanResultRepository implements ScanResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * QarsScore has no public constructor other than `calculate()` — but it's a
   * pure function of its inputs, so replaying the stored rubric's own inputs
   * (recoverable from the ratios it persisted) deterministically reproduces
   * the persisted score exactly, the same technique risk/infrastructure.ts's
   * toDomain() uses for RiskScore.
   */
  private toDomain(row: {
    id: string;
    tenantId: string;
    assetId: string;
    dataSensitivityTier: string;
    findings: unknown;
    hndlActNow: boolean;
    hndlSafeUntilYear: number | null;
    qarsScore: number;
    qarsRiskLevel: string;
    qarsRubric: unknown;
    scannedAt: Date;
  }): ScanResult {
    const storedFindings = row.findings as StoredFinding[];
    const findings = storedFindings.map((f) =>
      CryptoAsset.create(asCryptoAssetId(randomUUID()), {
        hostname: f.hostname,
        finding: CryptoFinding.create({
          assetType: f.assetType as CryptoFinding["assetType"],
          algorithm: f.algorithm,
          category: f.category as CryptoFinding["category"],
          strength: f.strength as CryptoFinding["strength"],
          keySizeBits: f.keySizeBits,
          notes: f.notes,
        }),
      })
    );

    const hndl = HndlAssessment.reconstitute({
      tier: row.dataSensitivityTier as DataSensitivityTier,
      actNow: row.hndlActNow,
      safeUntilYear: row.hndlSafeUntilYear ?? undefined,
    });

    const rubric = row.qarsRubric as { ratios: QarsRubric["ratios"]; penalties: QarsRubric["penalties"] };
    // QarsScore.calculate() is the only constructor — replay it against inputs
    // algebraically recovered from the persisted ratios (same technique as
    // RiskScore.calculate() replay above). Ratios are scale-invariant, so any
    // positive denominator reproduces the same score/level.
    const totalCryptoAssets = 100;
    const qars = QarsScore.calculate({
      totalCryptoAssets,
      quantumVulnerableAssets: Math.round(rubric.ratios.vulnerableAssetsRatio * totalCryptoAssets),
      weakOrBrokenAssets: Math.round(rubric.ratios.weakAssetsRatio * totalCryptoAssets),
      hndlActNow: rubric.penalties.hndlActNow > 0,
    });

    const scan = ScanResult.create(asCryptoScanResultId(row.id), asTenantId(row.tenantId), {
      assetId: asAssetId(row.assetId),
      dataSensitivityTier: row.dataSensitivityTier as DataSensitivityTier,
      findings,
      hndl,
      qars,
    });
    scan.pullDomainEvents(); // reconstitution must not re-raise CryptoScanCompleted
    return scan;
  }

  async list(ctx: TenantContext): Promise<ScanResult[]> {
    const rows = await this.prisma.cryptoScanResult.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { scannedAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult[]> {
    const rows = await this.prisma.cryptoScanResult.findMany({
      where: { tenantId: ctx.tenantId, assetId },
      orderBy: { scannedAt: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findLatestByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult | null> {
    const row = await this.prisma.cryptoScanResult.findFirst({
      where: { tenantId: ctx.tenantId, assetId },
      orderBy: { scannedAt: "desc" },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(ctx: TenantContext, scanResultId: CryptoScanResultId): Promise<ScanResult | null> {
    const row = await this.prisma.cryptoScanResult.findFirst({ where: { id: scanResultId, tenantId: ctx.tenantId } });
    return row ? this.toDomain(row) : null;
  }

  async save(ctx: TenantContext, scanResult: ScanResult): Promise<void> {
    const findings: StoredFinding[] = scanResult.findings.map((f) => ({
      hostname: f.hostname,
      assetType: f.finding.assetType,
      algorithm: f.finding.algorithm,
      category: f.finding.category,
      strength: f.finding.strength,
      keySizeBits: f.finding.keySizeBits,
      notes: f.finding.notes,
    }));

    await this.prisma.cryptoScanResult.upsert({
      where: { id: scanResult.id },
      create: {
        id: scanResult.id,
        tenantId: ctx.tenantId,
        assetId: scanResult.assetId,
        dataSensitivityTier: scanResult.dataSensitivityTier,
        findings: findings as object,
        hndlActNow: scanResult.hndl.actNow,
        hndlSafeUntilYear: scanResult.hndl.actNow ? null : Number(scanResult.hndl.status.replace(/\D/g, "")) || null,
        qarsScore: scanResult.qars.score,
        qarsRiskLevel: scanResult.qars.riskLevel,
        qarsRubric: {
          weights: scanResult.qars.rubric.weights,
          ratios: scanResult.qars.rubric.ratios,
          penalties: scanResult.qars.rubric.penalties,
        } as object,
        scannedAt: scanResult.scannedAt,
      },
      update: {},
    });
  }
}

/** In-memory implementation — the actual Phase-"right now" persistence, tenant-nested. */
export class InMemoryScanResultRepository implements ScanResultRepository {
  private readonly byTenant = new Map<string, Map<string, ScanResult>>();

  private tenantStore(ctx: TenantContext): Map<string, ScanResult> {
    let store = this.byTenant.get(ctx.tenantId);
    if (!store) {
      store = new Map();
      this.byTenant.set(ctx.tenantId, store);
    }
    return store;
  }

  async list(ctx: TenantContext): Promise<ScanResult[]> {
    return [...this.tenantStore(ctx).values()];
  }

  async findByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult[]> {
    return [...this.tenantStore(ctx).values()].filter((s) => s.assetId === assetId);
  }

  async findLatestByAsset(ctx: TenantContext, assetId: AssetId): Promise<ScanResult | null> {
    const matches = [...this.tenantStore(ctx).values()]
      .filter((s) => s.assetId === assetId)
      .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
    return matches[0] ?? null;
  }

  async findById(ctx: TenantContext, scanResultId: CryptoScanResultId): Promise<ScanResult | null> {
    return this.tenantStore(ctx).get(scanResultId) ?? null;
  }

  async save(ctx: TenantContext, scanResult: ScanResult): Promise<void> {
    this.tenantStore(ctx).set(scanResult.id, scanResult);
  }
}
