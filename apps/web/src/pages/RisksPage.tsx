import { useEffect, useMemo, useState } from "react";
import { SeverityBadge } from "../components/SeverityBadge";
import { listAssets, listRisks, calculateRisk } from "../lib/endpoints";
import { previewRiskForCriticality } from "../lib/risk-formula";
import { formatINR } from "../lib/format";
import type { Asset, Risk } from "../types/api";
import "./risks-page.css";

export function RisksPage() {
  const [risks, setRisks] = useState<Risk[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRisks(1, 100), listAssets(1, 100)])
      .then(([riskPage, assetPage]) => {
        setRisks(riskPage.items);
        setAssets(assetPage.items);
        if (assetPage.items.length > 0) setSelectedAssetId(assetPage.items[0].id);
      })
      .catch(() => setError("Couldn't load risks — the API may not be reachable."));
  }, []);

  const assetNameById = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets]);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const preview = selectedAsset ? previewRiskForCriticality(selectedAsset.criticality) : null;

  async function handleCalculate() {
    if (!selectedAssetId) return;
    setCalculating(true);
    setError(null);
    try {
      const risk = await calculateRisk(selectedAssetId);
      setRisks((prev) => [risk, ...(prev ?? [])]);
      setJustAddedId(risk.id);
      setTimeout(() => setJustAddedId(null), 900);
    } catch {
      setError("Risk calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="risks-page">
      <section className="risks-page__list">
        <h2 className="risks-page__panel-title">Calculated risks</h2>
        {error && <p className="form-error">{error}</p>}
        {risks === null ? (
          <div className="data-table__empty">Loading…</div>
        ) : risks.length === 0 ? (
          <div className="data-table__empty">No risks calculated yet — use the panel to calculate one.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Level</th>
                <th>Residual score</th>
                <th>Modeled impact</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id} className={risk.id === justAddedId ? "risks-page__row--new" : undefined}>
                  <td>{assetNameById.get(risk.assetId) ?? risk.assetId}</td>
                  <td>
                    <SeverityBadge level={risk.level} />
                  </td>
                  <td className="num">{risk.residualScore}/100</td>
                  <td className="num">{formatINR(risk.impactAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <aside className="risks-page__panel">
        <h2 className="risks-page__panel-title">Calculate risk</h2>
        {assets.length === 0 ? (
          <p className="asset-detail__hint">No assets yet — add one on the Assets page first.</p>
        ) : (
          <>
            <label className="form-field">
              <span className="eyebrow">Asset</span>
              <select className="form-select" value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.criticality})
                  </option>
                ))}
              </select>
            </label>

            {preview && (
              <div className="risks-page__preview">
                <span className="eyebrow">Formula preview</span>
                <div className="risks-page__preview-row">
                  <span>Likelihood</span>
                  <span className="num">{preview.likelihood.toFixed(2)}</span>
                </div>
                <div className="risks-page__preview-row">
                  <span>Impact</span>
                  <span className="num">{formatINR(preview.impactAmount)}</span>
                </div>
                <div className="risks-page__preview-row">
                  <span>Control effectiveness</span>
                  <span className="num">{Math.round(preview.controlEffectiveness * 100)}%</span>
                </div>
                <div className="risks-page__preview-row risks-page__preview-row--result">
                  <span>Residual score</span>
                  <span className="num">
                    {preview.residualScore}/100 · <SeverityBadge level={preview.level} />
                  </span>
                </div>
                <p className="risks-page__preview-note">
                  Likelihood and impact are derived automatically from this asset's criticality; control
                  effectiveness uses a fixed 30% baseline until per-control effectiveness is wired in.
                </p>
              </div>
            )}

            <button type="button" className="form-button" onClick={handleCalculate} disabled={calculating}>
              {calculating ? "Calculating…" : "Calculate risk"}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
