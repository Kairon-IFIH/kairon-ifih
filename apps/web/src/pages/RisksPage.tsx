import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SeverityBadge } from "../components/SeverityBadge";
import { Panel, Legend, LegendItem, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { RiskTopography } from "../components/viz/RiskTopography";
import { listAssets, listRisks, calculateRisk } from "../lib/endpoints";
import { previewRiskForCriticality } from "../lib/risk-formula";
import { formatINR, formatCompactINR } from "../lib/format";
import { SEVERITY_VAR, RISK_LEVELS } from "../lib/intelligence";
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

  const list = risks ?? [];
  const totalResidual = list.reduce((s, r) => s + r.impactAmount * (r.residualScore / 100), 0);
  const totalInherent = list.reduce((s, r) => s + r.impactAmount * (r.inherentScore / 100), 0);
  const absorbed = totalInherent - totalResidual;
  const worst = [...list].sort(
    (a, b) => b.impactAmount * (b.residualScore / 100) - a.impactAmount * (a.residualScore / 100)
  )[0];
  const scoredAssetIds = new Set(list.map((r) => r.assetId));
  const unscored = assets.filter((a) => !scoredAssetIds.has(a.id));

  async function handleCalculate() {
    if (!selectedAssetId) return;
    setCalculating(true);
    setError(null);
    try {
      const risk = await calculateRisk(selectedAssetId);
      setRisks((prev) => [risk, ...(prev ?? [])]);
      setJustAddedId(risk.id);
      setTimeout(() => setJustAddedId(null), 1200);
    } catch {
      setError("Risk calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="risks">
      <ExecutiveStrip>
        <Readout
          lead
          label="Residual exposure"
          value={totalResidual > 0 ? formatCompactINR(totalResidual) : "—"}
          direction={
            list.length > 0
              ? {
                  tone: "up",
                  text: `across ${list.length} scored risk${list.length === 1 ? "" : "s"}`,
                }
              : { tone: "flat", text: "nothing scored yet" }
          }
          parts={[
            { label: "Inherent", value: totalInherent > 0 ? formatCompactINR(totalInherent) : "—" },
            { label: "Absorbed", value: absorbed > 0 ? formatCompactINR(absorbed) : "—" },
          ]}
        />
        <Readout
          label="Control effect"
          value={totalInherent > 0 ? `${Math.round((absorbed / totalInherent) * 100)}%` : "—"}
          unit="absorbed"
          direction={{
            tone: "down",
            text: "flat 30% baseline until per-control maturity lands",
          }}
        />
        <Readout
          label="Largest single peak"
          variant="text"
          value={worst ? assetNameById.get(worst.assetId) ?? "Unknown" : "—"}
          unit={worst ? formatCompactINR(worst.impactAmount * (worst.residualScore / 100)) : undefined}
          direction={worst ? { tone: "up", text: `${worst.level} · residual ${worst.residualScore}/100` } : undefined}
        />
        <Readout
          label="Coverage gap"
          value={String(unscored.length)}
          unit="unscored assets"
          direction={
            unscored.length > 0
              ? { tone: "up", text: "exposure unmeasured, not zero" }
              : { tone: "down", text: "full coverage" }
          }
          parts={unscored.slice(0, 3).map((a) => ({ label: a.name, value: a.criticality }))}
        />
      </ExecutiveStrip>

      <Panel
        eyebrow="Risk topography"
        title="Where exposure rises"
        caption="Every scored risk raises a peak — height is residual exposure in rupees, width is modelled impact, colour is the severity band. Overlapping peaks are correlated exposure sitting in the same part of the estate."
        bleed
        aside={
          <Legend>
            {RISK_LEVELS.map((l) => (
              <LegendItem key={l} color={SEVERITY_VAR[l]} label={l} />
            ))}
          </Legend>
        }
      >
        {risks === null ? (
          <EmptyState>Reading the register…</EmptyState>
        ) : list.length === 0 ? (
          <EmptyState>
            No terrain yet — nothing has been scored. Use the panel below to score an asset and the first peak appears
            here.
          </EmptyState>
        ) : (
          <RiskTopography risks={list} assetNames={assetNameById} />
        )}
      </Panel>

      <div className="risks__split">
        <Panel eyebrow="Register" title="Scored risks" bleed>
          {error && <p className="form-error risks__error">{error}</p>}
          {risks === null ? (
            <EmptyState>Loading…</EmptyState>
          ) : list.length === 0 ? (
            <EmptyState>Nothing scored yet.</EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Band</th>
                  <th className="num">Inherent</th>
                  <th className="num">Residual</th>
                  <th className="num">Residual exposure</th>
                </tr>
              </thead>
              <tbody>
                {list.map((risk) => (
                  <tr key={risk.id} className={risk.id === justAddedId ? "risks__row--new" : undefined}>
                    <td>{assetNameById.get(risk.assetId) ?? risk.assetId}</td>
                    <td>
                      <SeverityBadge level={risk.level} />
                    </td>
                    <td className="num">{risk.inherentScore}</td>
                    <td className="num">{risk.residualScore}</td>
                    <td className="num">{formatINR(risk.impactAmount * (risk.residualScore / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          eyebrow="Score"
          title="Run the engine"
          caption="The server derives likelihood and impact from the asset's own criticality — there is no free-text risk entry, so two analysts scoring the same asset always get the same number."
        >
          {assets.length === 0 ? (
            <EmptyState>
              No assets yet — <Link to="/assets">register one</Link> before scoring.
            </EmptyState>
          ) : (
            <>
              <label className="form-field">
                <span className="eyebrow">Asset</span>
                <select
                  className="form-select"
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.criticality})
                    </option>
                  ))}
                </select>
              </label>

              {preview && (
                <div className="risks__preview">
                  <span className="risks__preview-title">Formula preview</span>
                  <div className="risks__formula num">
                    likelihood {preview.likelihood.toFixed(2)} × impact {formatCompactINR(preview.impactAmount)}
                  </div>
                  <div className="risks__preview-bar">
                    <div
                      className="risks__preview-bar-inherent"
                      style={{ width: `${preview.inherentScore}%` }}
                      title="Inherent"
                    />
                    <div
                      className="risks__preview-bar-residual"
                      style={{
                        width: `${preview.residualScore}%`,
                        background: SEVERITY_VAR[preview.level],
                      }}
                      title="Residual"
                    />
                  </div>
                  <div className="risks__preview-rows">
                    <div>
                      <dt>Inherent</dt>
                      <dd className="num">{preview.inherentScore}/100</dd>
                    </div>
                    <div>
                      <dt>Controls absorb</dt>
                      <dd className="num">{Math.round(preview.controlEffectiveness * 100)}%</dd>
                    </div>
                    <div>
                      <dt>Residual</dt>
                      <dd>
                        <SeverityBadge level={preview.level} />
                      </dd>
                    </div>
                  </div>
                </div>
              )}

              <button type="button" className="form-button risks__run" onClick={handleCalculate} disabled={calculating}>
                {calculating ? "Scoring…" : "Score this asset"}
              </button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
