import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel, Legend, LegendItem, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { CryptoExposureTerrain } from "../components/viz/CryptoExposureTerrain";
import { CryptoInventoryMatrix } from "../components/viz/CryptoInventoryMatrix";
import { listAssets, listScanResults, runCryptoScan } from "../lib/endpoints";
import { buildCryptoInventory, QARS_LEVEL_VAR } from "../lib/intelligence";
import type { Asset, DataSensitivityTier, ScanResult } from "../types/api";
import "./scanner-page.css";

const TIER_LABEL: Record<DataSensitivityTier, string> = {
  TRANSACTION: "Transaction data (7yr shelf life)",
  AUTHENTICATION: "Authentication data (1yr shelf life)",
  STATIC: "Static / public data (0yr shelf life)",
};

export function ScannerPage() {
  const [scans, setScans] = useState<ScanResult[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [tier, setTier] = useState<DataSensitivityTier>("TRANSACTION");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [justScannedId, setJustScannedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listScanResults(1, 100), listAssets(1, 100)])
      .then(([scanPage, assetPage]) => {
        setScans(scanPage.items);
        setAssets(assetPage.items);
        if (assetPage.items.length > 0) setSelectedAssetId(assetPage.items[0].id);
      })
      .catch(() => setError("Couldn't load scan results — the API may not be reachable."));
  }, []);

  const assetNameById = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets]);
  const assetTypeById = useMemo(() => new Map(assets.map((a) => [a.id, a.assetType])), [assets]);

  // Latest scan per asset — a re-scanned asset counts once, by its freshest result.
  const latestByAsset = useMemo(() => {
    const map = new Map<string, ScanResult>();
    for (const scan of scans ?? []) {
      const existing = map.get(scan.assetId);
      if (!existing || new Date(scan.scannedAt) > new Date(existing.scannedAt)) map.set(scan.assetId, scan);
    }
    return map;
  }, [scans]);

  const latest = useMemo(() => [...latestByAsset.values()], [latestByAsset]);
  const scannedAssetIds = new Set(latestByAsset.keys());
  const unscanned = assets.filter((a) => !scannedAssetIds.has(a.id));

  const quantumVulnerable = latest.filter((s) => s.quantumVulnerable).length;
  const actNow = latest.filter((s) => s.hndl.actNow).length;
  const avgScore = latest.length > 0 ? Math.round((latest.reduce((sum, s) => sum + s.qars.score, 0) / latest.length) * 10) / 10 : 0;
  const worst = [...latest].sort((a, b) => a.qars.score - b.qars.score)[0];
  const inventory = useMemo(() => buildCryptoInventory(latest), [latest]);

  async function handleScan() {
    if (!selectedAssetId) return;
    setScanning(true);
    setError(null);
    try {
      const scan = await runCryptoScan(selectedAssetId, tier);
      setScans((prev) => [scan, ...(prev ?? [])]);
      setJustScannedId(scan.id);
      setTimeout(() => setJustScannedId(null), 1200);
    } catch {
      setError("Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="scanner">
      <ExecutiveStrip>
        <Readout
          lead
          label="Quantum readiness"
          value={latest.length > 0 ? `${avgScore}` : "—"}
          unit={latest.length > 0 ? "/ 100 avg QARS" : undefined}
          direction={
            latest.length > 0
              ? { tone: avgScore >= 65 ? "down" : "up", text: `across ${latest.length} scanned asset${latest.length === 1 ? "" : "s"}` }
              : { tone: "flat", text: "nothing scanned yet" }
          }
          parts={[
            { label: "Quantum-vulnerable", value: latest.length > 0 ? String(quantumVulnerable) : "—" },
            { label: "Act-now (HNDL)", value: latest.length > 0 ? String(actNow) : "—" },
          ]}
        />
        <Readout
          label="Coverage"
          value={String(latest.length)}
          unit={`of ${assets.length} assets scanned`}
          direction={
            unscanned.length > 0
              ? { tone: "up", text: `${unscanned.length} unscanned — exposure unmeasured, not zero` }
              : { tone: "down", text: "full coverage" }
          }
        />
        <Readout
          label="Most exposed asset"
          variant="text"
          value={worst ? assetNameById.get(worst.assetId) ?? "Unknown" : "—"}
          unit={worst ? `QARS ${worst.qars.score}` : undefined}
          direction={worst ? { tone: "up", text: `${worst.qars.riskLevel} · ${worst.hndl.actNow ? "act now" : "within horizon"}` } : undefined}
        />
        <Readout
          label="Harvest-Now-Decrypt-Later"
          value={String(actNow)}
          unit="assets need action now"
          direction={
            latest.length > 0
              ? { tone: actNow > 0 ? "up" : "down", text: "Mosca's Theorem: shelf life + migration time vs. CRQC horizon" }
              : { tone: "flat", text: "nothing scanned yet" }
          }
        />
      </ExecutiveStrip>

      <Panel
        eyebrow="Crypto exposure terrain"
        title="Where quantum risk concentrates"
        caption="Every scanned asset raises a peak — height is quantum risk (100 minus QARS score), width is how many crypto primitives were inventoried, colour is the QARS risk band. The tallest peaks on the left need PQC migration soonest."
        bleed
        aside={
          <Legend>
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((l) => (
              <LegendItem key={l} color={QARS_LEVEL_VAR[l]} label={l} />
            ))}
          </Legend>
        }
      >
        {scans === null ? (
          <EmptyState>Reading scan results…</EmptyState>
        ) : latest.length === 0 ? (
          <EmptyState>
            No terrain yet — nothing has been scanned. Use the panel below to scan an asset and the first peak appears here.
          </EmptyState>
        ) : (
          <CryptoExposureTerrain scans={latest} assetNames={assetNameById} />
        )}
      </Panel>

      <Panel
        eyebrow="Cryptographic bill of materials"
        title="Algorithm inventory by strength"
        caption="Every primitive discovered across every scan, grouped by what kind of algorithm it is and how it grades against NIST strength guidelines. Broken and weak cells are quantum-vulnerable today; quantum-safe cells are the only ones a CRQC can't touch."
      >
        {latest.length === 0 ? (
          <EmptyState>Nothing scanned yet — the inventory fills in as scans run.</EmptyState>
        ) : (
          <CryptoInventoryMatrix rows={inventory} />
        )}
      </Panel>

      <div className="scanner__split">
        <Panel eyebrow="Register" title="Scanned assets" bleed>
          {error && <p className="form-error scanner__error">{error}</p>}
          {scans === null ? (
            <EmptyState>Loading…</EmptyState>
          ) : latest.length === 0 ? (
            <EmptyState>Nothing scanned yet.</EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>QARS band</th>
                  <th className="num">Score</th>
                  <th>HNDL</th>
                  <th>Weakest primitive</th>
                </tr>
              </thead>
              <tbody>
                {[...latest]
                  .sort((a, b) => a.qars.score - b.qars.score)
                  .map((scan) => (
                    <tr key={scan.id} className={scan.id === justScannedId ? "scanner__row--new" : undefined}>
                      <td>{assetNameById.get(scan.assetId) ?? scan.assetId}</td>
                      <td>{assetTypeById.get(scan.assetId) ?? "—"}</td>
                      <td>
                        <span className="scanner__band" style={{ color: QARS_LEVEL_VAR[scan.qars.riskLevel] }}>
                          <span className="scanner__band-swatch" style={{ background: QARS_LEVEL_VAR[scan.qars.riskLevel] }} aria-hidden="true" />
                          {scan.qars.riskLevel}
                        </span>
                      </td>
                      <td className="num">{scan.qars.score}</td>
                      <td className="scanner__hndl" data-act-now={scan.hndl.actNow ? "true" : undefined}>
                        {scan.hndl.actNow ? "Act now" : "Within horizon"}
                      </td>
                      <td>{scan.weakestStrength}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          eyebrow="Scan"
          title="Run the scanner"
          caption="The scanner inventories each crypto primitive an asset relies on — TLS version, cipher suite, key exchange, certificate, signature hash — and grades every one against NIST strength guidelines. The QARS score and HNDL deadline are both derived, never entered by hand."
        >
          {assets.length === 0 ? (
            <EmptyState>
              No assets yet — <Link to="/assets">register one</Link> before scanning.
            </EmptyState>
          ) : (
            <>
              <label className="form-field">
                <span className="eyebrow">Asset</span>
                <select className="form-select" value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.assetType})
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="eyebrow">Data sensitivity</span>
                <select className="form-select" value={tier} onChange={(e) => setTier(e.target.value as DataSensitivityTier)}>
                  {(["TRANSACTION", "AUTHENTICATION", "STATIC"] as const).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              <p className="scanner__hint">
                Determines the Harvest-Now-Decrypt-Later shelf life used in Mosca's Theorem — how long data captured today
                must stay confidential.
              </p>

              <button type="button" className="form-button scanner__run" onClick={handleScan} disabled={scanning}>
                {scanning ? "Scanning…" : "Scan this asset"}
              </button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
