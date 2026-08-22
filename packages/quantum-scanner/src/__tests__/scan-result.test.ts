import { asAssetId, asCryptoAssetId, asCryptoScanResultId, asTenantId } from "@kairon/shared-kernel";
import { CryptoAsset, CryptoFinding, HndlAssessment, QarsScore, ScanResult } from "../domain";

function finding(overrides: Partial<Parameters<typeof CryptoFinding.create>[0]> = {}) {
  return CryptoFinding.create({
    assetType: "KEY_EXCHANGE",
    algorithm: "ECDHE (P-256)",
    category: "CLASSICAL",
    strength: "STRONG",
    ...overrides,
  });
}

describe("CryptoFinding.quantumVulnerable", () => {
  it("is vulnerable for classical algorithms regardless of classical strength", () => {
    expect(finding({ category: "CLASSICAL", strength: "STRONG" }).quantumVulnerable).toBe(true);
    expect(finding({ category: "CLASSICAL", strength: "BROKEN" }).quantumVulnerable).toBe(true);
  });

  it("is safe only for PQC or hybrid-PQC categories", () => {
    expect(finding({ category: "PQC", strength: "QUANTUM_SAFE" }).quantumVulnerable).toBe(false);
    expect(finding({ category: "HYBRID_PQC", strength: "QUANTUM_SAFE" }).quantumVulnerable).toBe(false);
  });
});

describe("ScanResult", () => {
  const tenantId = asTenantId("tenant-1");
  const assetId = asAssetId("11111111-1111-1111-1111-111111111111");

  function makeScan(findings: CryptoAsset[]): ScanResult {
    const qars = QarsScore.calculate({
      totalCryptoAssets: findings.length,
      quantumVulnerableAssets: findings.filter((f) => f.finding.quantumVulnerable).length,
      weakOrBrokenAssets: findings.filter((f) => f.finding.strength === "WEAK" || f.finding.strength === "BROKEN").length,
      hndlActNow: true,
    });
    return ScanResult.create(asCryptoScanResultId("22222222-2222-2222-2222-222222222222"), tenantId, {
      assetId,
      dataSensitivityTier: "TRANSACTION",
      findings,
      hndl: HndlAssessment.calculate("TRANSACTION", 2026),
      qars,
    });
  }

  it("rejects a scan with zero findings", () => {
    expect(() =>
      ScanResult.create(asCryptoScanResultId("id"), tenantId, {
        assetId,
        dataSensitivityTier: "TRANSACTION",
        findings: [],
        hndl: HndlAssessment.calculate("TRANSACTION", 2026),
        qars: QarsScore.calculate({ totalCryptoAssets: 0, quantumVulnerableAssets: 0, weakOrBrokenAssets: 0, hndlActNow: false }),
      })
    ).toThrow();
  });

  it("is quantumVulnerable if any finding is classical", () => {
    const scan = makeScan([
      CryptoAsset.create(asCryptoAssetId("a"), { hostname: "host", finding: finding({ category: "HYBRID_PQC", strength: "QUANTUM_SAFE" }) }),
      CryptoAsset.create(asCryptoAssetId("b"), { hostname: "host", finding: finding({ category: "CLASSICAL", strength: "STRONG" }) }),
    ]);
    expect(scan.quantumVulnerable).toBe(true);
  });

  it("is not quantumVulnerable when every finding is PQC or hybrid-PQC", () => {
    const scan = makeScan([
      CryptoAsset.create(asCryptoAssetId("a"), { hostname: "host", finding: finding({ category: "HYBRID_PQC", strength: "QUANTUM_SAFE" }) }),
      CryptoAsset.create(asCryptoAssetId("b"), { hostname: "host", finding: finding({ category: "PQC", strength: "QUANTUM_SAFE" }) }),
    ]);
    expect(scan.quantumVulnerable).toBe(false);
  });

  it("weakestStrength reports the single worst finding across the scan", () => {
    const scan = makeScan([
      CryptoAsset.create(asCryptoAssetId("a"), { hostname: "host", finding: finding({ strength: "STRONG" }) }),
      CryptoAsset.create(asCryptoAssetId("b"), { hostname: "host", finding: finding({ strength: "BROKEN" }) }),
      CryptoAsset.create(asCryptoAssetId("c"), { hostname: "host", finding: finding({ strength: "WEAK" }) }),
    ]);
    expect(scan.weakestStrength).toBe("BROKEN");
  });

  it("raises a CryptoScanCompleted domain event on create", () => {
    const scan = makeScan([CryptoAsset.create(asCryptoAssetId("a"), { hostname: "host", finding: finding() })]);
    const events = scan.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("CryptoScanCompleted");
  });
});
