import { randomUUID } from "node:crypto";
import {
  asAssetId,
  asCryptoAssetId,
  asCryptoScanResultId,
  AssetId,
  NotFoundError,
  ok,
  Result,
  TenantContext,
} from "@kairon/shared-kernel";
import type { ListScanResultsQuery, RunCryptoScanRequest } from "@kairon/api-contracts";
import type { PaginatedResult } from "@kairon/api-contracts";
import type { EventPublisher } from "@kairon/event-contracts";
import type { AssetRepository } from "@kairon/asset";
import { createLogger } from "@kairon/logger";
import {
  CryptoAsset,
  CryptoFinding,
  CryptoScanCompletedEvent,
  CryptoScannerService,
  DataSensitivityTier,
  HndlAssessment,
  QarsScore,
  ScanResult,
  ScanResultRepository,
} from "./domain";

const log = createLogger("quantum-scanner");

export interface RunCryptoScanUseCase {
  execute(ctx: TenantContext, request: RunCryptoScanRequest): Promise<Result<ScanResult>>;
}

export interface ListScanResultsUseCase {
  execute(ctx: TenantContext, query: ListScanResultsQuery): Promise<Result<PaginatedResult<ScanResult>>>;
}

export interface GetScanTelemetryUseCase {
  execute(ctx: TenantContext): Promise<Result<ScanTelemetry>>;
}

export interface ScanTelemetry {
  totalScans: number;
  scannedAssets: number;
  unscannedAssets: number;
  quantumVulnerableAssets: number;
  averageQarsScore: number;
  riskLevelCounts: Record<string, number>;
  actNowCount: number;
  algorithmCategoryCounts: Record<string, number>;
  strengthCounts: Record<string, number>;
}

export interface Dependencies {
  scanResultRepository: ScanResultRepository;
  assetRepository: AssetRepository;
  cryptoScannerService: CryptoScannerService;
  eventPublisher: EventPublisher;
}

/**
 * Deterministic simulated discovery (see domain.ts's CryptoScannerService doc
 * comment for why this replaces live TLS probing). The finding set for a given
 * asset is derived from its own attributes, not randomness, so re-scanning the
 * same asset is reproducible — the same property a demo run needs.
 *
 * Reference mapping (cbom_generator.py's classification tables, ported):
 *  - CRITICAL/HIGH-criticality assets skew toward legacy TLS 1.2 + RSA-2048,
 *    the exact profile the reference tool flags as quantum-vulnerable-but-not-
 *    yet-broken — the most common real-world finding, and the whole reason a
 *    QARS score is more useful than a binary pass/fail.
 *  - RESTRICTED-classification assets are treated as carrying TRANSACTION-tier
 *    data (7yr shelf life) unless the caller overrides it — HNDL risk is worst
 *    where confidentiality matters longest.
 *  - A fixed fraction of Application/Network assets are seeded with one
 *    hybrid-PQC finding (X25519MLKEM768) to make the "quantum-safe" band of
 *    every visualisation reachable in the demo, exactly as the reference
 *    tool's own HYBRID_FULL_NAMES table would detect on a modern endpoint.
 */
export class SimulatedCryptoScannerService implements CryptoScannerService {
  async scanAsset(
    ctx: TenantContext,
    input: { assetId: AssetId; assetType: string; criticality: string; dataClassification: string; hostname: string }
  ): Promise<{ findings: CryptoAsset[]; dataSensitivityTier: DataSensitivityTier }> {
    const findings: CryptoAsset[] = [];
    const seed = hashSeed(input.assetId);
    const isHighExposure = input.criticality === "CRITICAL" || input.criticality === "HIGH";
    const isHybridReady = seed % 5 === 0 && (input.assetType === "Application" || input.assetType === "Network");
    const newFinding = bindHostname(input.hostname);

    // TLS version — legacy TLS 1.2 dominates high-exposure legacy estates; a
    // minority of endpoints run modern TLS 1.3, mirroring real fleet surveys.
    const tlsVersion = seed % 3 === 0 ? "TLS 1.3" : "TLS 1.2";
    findings.push(
      newFinding("TLS_VERSION", tlsVersion, tlsVersion === "TLS 1.3" ? "CLASSICAL" : "CLASSICAL", tlsVersion === "TLS 1.3" ? "STRONG" : "ACCEPTABLE")
    );

    // Cipher suite.
    if (tlsVersion === "TLS 1.3") {
      findings.push(newFinding("CIPHER_SUITE", "TLS_AES_256_GCM_SHA384", "CLASSICAL", "STRONG"));
    } else if (isHighExposure && seed % 4 === 0) {
      findings.push(newFinding("CIPHER_SUITE", "TLS_RSA_WITH_3DES_EDE_CBC_SHA", "CLASSICAL", "WEAK"));
    } else {
      findings.push(newFinding("CIPHER_SUITE", "ECDHE-RSA-AES256-GCM-SHA384", "CLASSICAL", "STRONG"));
    }

    // Key exchange — the primitive an HNDL attacker actually targets. This is
    // where a hybrid-PQC endpoint earns QUANTUM_SAFE.
    if (isHybridReady) {
      findings.push(newFinding("KEY_EXCHANGE", "X25519MLKEM768", "HYBRID_PQC", "QUANTUM_SAFE", { notes: "Hybrid mode with classical X25519 component" }));
    } else if (tlsVersion === "TLS 1.3") {
      findings.push(newFinding("KEY_EXCHANGE", "X25519", "CLASSICAL", "STRONG"));
    } else {
      findings.push(newFinding("KEY_EXCHANGE", "ECDHE (P-256)", "CLASSICAL", "STRONG"));
    }

    // Certificate public key — RSA-2048 is the field's most common finding and
    // is exactly the "strong today, vulnerable to Shor's algorithm" case QARS
    // exists to surface; RSA-1024 (rare, legacy) is WEAK outright.
    if (isHighExposure && seed % 7 === 0) {
      findings.push(newFinding("CERTIFICATE", "RSA-1024", "CLASSICAL", "WEAK", { keySizeBits: 1024 }));
    } else if (seed % 2 === 0) {
      findings.push(newFinding("CERTIFICATE", "RSA-2048", "CLASSICAL", "STRONG", { keySizeBits: 2048 }));
    } else {
      findings.push(newFinding("CERTIFICATE", "ECDSA P-256", "CLASSICAL", "STRONG", { keySizeBits: 256 }));
    }

    // Certificate signature hash.
    if (isHighExposure && seed % 9 === 0) {
      findings.push(newFinding("HASH_ALGORITHM", "SHA-1", "CLASSICAL", "BROKEN"));
    } else {
      findings.push(newFinding("HASH_ALGORITHM", "SHA-256", "CLASSICAL", "STRONG"));
    }

    const dataSensitivityTier: DataSensitivityTier =
      input.dataClassification === "RESTRICTED"
        ? "TRANSACTION"
        : input.dataClassification === "CONFIDENTIAL"
          ? "AUTHENTICATION"
          : "STATIC";

    return { findings, dataSensitivityTier };
  }
}

function hashSeed(assetId: string): number {
  let h = 0;
  for (let i = 0; i < assetId.length; i++) {
    h = (h * 31 + assetId.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Binds the scanned asset's own name as the finding's hostname — every
 * finding in one scan describes the same asset, so this is fixed per call. */
function bindHostname(hostname: string) {
  return (
    assetType: import("./domain").CryptoAssetType,
    algorithm: string,
    category: import("./domain").AlgorithmCategory,
    strength: import("./domain").CryptoStrength,
    extra?: { keySizeBits?: number; notes?: string }
  ): CryptoAsset =>
    CryptoAsset.create(asCryptoAssetId(randomUUID()), {
      hostname,
      finding: CryptoFinding.create({ assetType, algorithm, category, strength, ...extra }),
    });
}

export class RunCryptoScanUseCaseImpl implements RunCryptoScanUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, request: RunCryptoScanRequest): Promise<Result<ScanResult>> {
    const assetId = asAssetId(request.assetId);
    const asset = await this.deps.assetRepository.findById(ctx, assetId);
    if (!asset) {
      throw new NotFoundError("Asset", assetId);
    }

    const { findings } = await this.deps.cryptoScannerService.scanAsset(ctx, {
      assetId,
      assetType: asset.assetType,
      criticality: asset.criticality.level,
      dataClassification: asset.dataClassification.level,
      hostname: asset.name,
    });

    const tier = request.dataSensitivityTier;
    const hndl = HndlAssessment.calculate(tier, new Date().getFullYear());

    const quantumVulnerableCount = findings.filter((f) => f.finding.quantumVulnerable).length;
    const weakOrBrokenCount = findings.filter(
      (f) => f.finding.strength === "WEAK" || f.finding.strength === "BROKEN"
    ).length;

    const qars = QarsScore.calculate({
      totalCryptoAssets: findings.length,
      quantumVulnerableAssets: quantumVulnerableCount,
      weakOrBrokenAssets: weakOrBrokenCount,
      hndlActNow: hndl.actNow,
    });

    const scanResult = ScanResult.create(asCryptoScanResultId(randomUUID()), ctx.tenantId, {
      assetId,
      dataSensitivityTier: tier,
      findings,
      hndl,
      qars,
    });

    await this.deps.scanResultRepository.save(ctx, scanResult);
    log.info("crypto scan completed", {
      tenantId: ctx.tenantId,
      assetId,
      scanResultId: scanResult.id,
      qarsScore: qars.score,
      riskLevel: qars.riskLevel,
      quantumVulnerable: scanResult.quantumVulnerable,
      hndlStatus: hndl.status,
    });

    for (const event of scanResult.pullDomainEvents()) {
      if (event instanceof CryptoScanCompletedEvent) {
        await this.deps.eventPublisher.publish({
          eventId: randomUUID(),
          eventName: "CryptoScanCompleted",
          occurredAt: event.occurredAt.toISOString(),
          payload: {
            tenantId: event.tenantId,
            scanResultId: event.scanResultId,
            assetId: event.assetId,
            qarsScore: event.qarsScore,
            riskLevel: event.riskLevel,
            quantumVulnerable: event.quantumVulnerable,
            hndlStatus: event.hndlStatus,
            timestamp: event.occurredAt.toISOString(),
          },
        });
      }
    }

    return ok(scanResult);
  }
}

export class ListScanResultsUseCaseImpl implements ListScanResultsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext, query: ListScanResultsQuery): Promise<Result<PaginatedResult<ScanResult>>> {
    const all = query.assetId
      ? await this.deps.scanResultRepository.findByAsset(ctx, asAssetId(query.assetId))
      : await this.deps.scanResultRepository.list(ctx);

    const sorted = [...all].sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
    const filtered = query.riskLevel ? sorted.filter((s) => s.qars.riskLevel === query.riskLevel) : sorted;

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);
    return ok({ items, page: query.page, pageSize: query.pageSize, total: filtered.length });
  }
}

export class GetScanTelemetryUseCaseImpl implements GetScanTelemetryUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(ctx: TenantContext): Promise<Result<ScanTelemetry>> {
    const [scans, assets] = await Promise.all([
      this.deps.scanResultRepository.list(ctx),
      this.deps.assetRepository.list(ctx),
    ]);

    // Latest scan per asset — a re-scanned asset should count once, by its
    // freshest result, the same way the dashboard's other panels only ever
    // show current state rather than a duplicate-counted history.
    const latestByAsset = new Map<string, ScanResult>();
    for (const scan of scans) {
      const existing = latestByAsset.get(scan.assetId);
      if (!existing || scan.scannedAt.getTime() > existing.scannedAt.getTime()) {
        latestByAsset.set(scan.assetId, scan);
      }
    }
    const latest = [...latestByAsset.values()];

    const riskLevelCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const algorithmCategoryCounts: Record<string, number> = { CLASSICAL: 0, HYBRID_PQC: 0, PQC: 0, UNKNOWN: 0 };
    const strengthCounts: Record<string, number> = {
      BROKEN: 0,
      WEAK: 0,
      ACCEPTABLE: 0,
      STRONG: 0,
      QUANTUM_SAFE: 0,
      UNKNOWN: 0,
    };

    let quantumVulnerableAssets = 0;
    let actNowCount = 0;
    let scoreSum = 0;

    for (const scan of latest) {
      riskLevelCounts[scan.qars.riskLevel] = (riskLevelCounts[scan.qars.riskLevel] ?? 0) + 1;
      if (scan.quantumVulnerable) quantumVulnerableAssets += 1;
      if (scan.hndl.actNow) actNowCount += 1;
      scoreSum += scan.qars.score;
      for (const finding of scan.findings) {
        algorithmCategoryCounts[finding.finding.category] = (algorithmCategoryCounts[finding.finding.category] ?? 0) + 1;
        strengthCounts[finding.finding.strength] = (strengthCounts[finding.finding.strength] ?? 0) + 1;
      }
    }

    return ok({
      totalScans: scans.length,
      scannedAssets: latest.length,
      unscannedAssets: Math.max(0, assets.length - latest.length),
      quantumVulnerableAssets,
      averageQarsScore: latest.length > 0 ? Math.round((scoreSum / latest.length) * 10) / 10 : 0,
      riskLevelCounts,
      actNowCount,
      algorithmCategoryCounts,
      strengthCounts,
    });
  }
}

export function createQuantumScannerModule(deps: Dependencies) {
  return {
    runCryptoScan: new RunCryptoScanUseCaseImpl(deps),
    listScanResults: new ListScanResultsUseCaseImpl(deps),
    getScanTelemetry: new GetScanTelemetryUseCaseImpl(deps),
  };
}

export type QuantumScannerModule = ReturnType<typeof createQuantumScannerModule>;
