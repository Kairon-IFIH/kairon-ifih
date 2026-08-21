import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { RiskHealthSpectrum } from "../components/viz/RiskHealthSpectrum";
import { ExposureLadder, type LadderRow } from "../components/viz/ExposureLadder";
import { listRisks, listAssets, quantifyExposure, getQRisk } from "../lib/endpoints";
import { formatCompactINR, formatINR } from "../lib/format";
import type { Asset, FinancialExposure, Risk } from "../types/api";
import "./financial-page.css";

export function FinancialPage() {
  const [qRisk, setQRisk] = useState<number | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [exposures, setExposures] = useState<FinancialExposure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getQRisk(), listRisks(1, 100), listAssets(1, 100)])
      .then(([q, riskPage, assetPage]) => {
        setQRisk(q.qRisk);
        setRisks(riskPage.items);
        setAssets(assetPage.items);
        if (riskPage.items.length > 0) setSelectedRiskId(riskPage.items[0].id);
      })
      .catch(() => setError("Couldn't load financial data — the API may not be reachable."));
  }, []);

  const assetNameById = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets]);

  /** Priced exposures are keyed by risk so the ladder can show a real EAL notch. */
  const ealByRisk = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of exposures) m.set(e.riskId, e.expectedLossAmount);
    return m;
  }, [exposures]);

  const ladder = useMemo<LadderRow[]>(
    () =>
      risks
        .map((r) => ({
          id: r.id,
          label: assetNameById.get(r.assetId) ?? "Unknown asset",
          level: r.level,
          inherent: r.impactAmount * (r.inherentScore / 100),
          residual: r.impactAmount * (r.residualScore / 100),
          expectedLoss: ealByRisk.get(r.id) ?? null,
        }))
        .sort((a, b) => b.residual - a.residual),
    [risks, assetNameById, ealByRisk]
  );

  const totalResidual = ladder.reduce((s, r) => s + r.residual, 0);
  const totalInherent = ladder.reduce((s, r) => s + r.inherent, 0);
  const absorbed = totalInherent - totalResidual;
  const totalEal = exposures.reduce((s, e) => s + e.expectedLossAmount, 0);
  const pricedRiskIds = new Set(exposures.map((e) => e.riskId));
  const unpriced = risks.filter((r) => !pricedRiskIds.has(r.id)).length;

  async function handleQuantify() {
    if (!selectedRiskId) return;
    setSubmitting(true);
    setError(null);
    try {
      const exposure = await quantifyExposure(selectedRiskId);
      setExposures((prev) => [exposure, ...prev]);
    } catch {
      setError("Couldn't quantify exposure for this risk.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fin">
      <ExecutiveStrip>
        <Readout
          lead
          label="Residual exposure"
          value={totalResidual > 0 ? formatCompactINR(totalResidual) : "—"}
          direction={
            totalInherent > 0
              ? { tone: "up", text: `${Math.round((totalResidual / totalInherent) * 100)}% of inherent survives controls` }
              : { tone: "flat", text: "nothing scored to quantify" }
          }
          parts={[
            { label: "Inherent modelled", value: totalInherent > 0 ? formatCompactINR(totalInherent) : "—" },
            { label: "Absorbed", value: absorbed > 0 ? formatCompactINR(absorbed) : "—" },
          ]}
        />
        <Readout
          label="Expected annual loss"
          value={totalEal > 0 ? formatCompactINR(totalEal) : "—"}
          unit="priced this session"
          direction={
            unpriced > 0
              ? { tone: "up", text: `${unpriced} scored risk${unpriced === 1 ? "" : "s"} still unpriced` }
              : { tone: "down", text: "every scored risk priced" }
          }
          parts={[{ label: "Exposures quantified", value: String(exposures.length) }]}
        />
        <Readout
          label="Concentration"
          variant="text"
          value={ladder[0]?.label ?? "—"}
          unit={ladder[0] ? formatCompactINR(ladder[0].residual) : undefined}
          direction={
            ladder[0] && totalResidual > 0
              ? {
                  tone: "up",
                  text: `${Math.round((ladder[0].residual / totalResidual) * 100)}% of all residual exposure`,
                }
              : undefined
          }
        />
        <Readout
          label="Q-Risk"
          value={qRisk !== null ? String(Math.round(qRisk)) : "—"}
          unit="/ 100"
          direction={{ tone: "flat", text: "two of five inputs live" }}
        />
      </ExecutiveStrip>

      <Panel
        eyebrow="Exposure ladder"
        title="What controls actually buy, per asset"
        caption="The pale track is inherent exposure; the coloured bar is what survives controls. The gap between them is the control effect — shown per asset rather than averaged into one headline number. The notch marks a quantified expected annual loss."
      >
        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : ladder.length === 0 ? (
          <EmptyState>
            Nothing scored yet — run the <Link to="/risks">Risk Engine</Link> against an asset first, then price it
            here.
          </EmptyState>
        ) : (
          <ExposureLadder rows={ladder} />
        )}
      </Panel>

      <div className="fin__split">
        <Panel
          eyebrow="Board metric"
          title="Risk health spectrum"
          caption="What the single board-level number is made of, and what is still missing from it."
        >
          {qRisk !== null && (
            <RiskHealthSpectrum
              score={qRisk}
              composition={[
                { label: "Asset coverage", state: "live" },
                { label: "Residual risk health", state: "live" },
                { label: "Compliance coverage", state: "pending" },
                { label: "Operational resilience", state: "pending" },
                { label: "Quantum readiness", state: "pending" },
              ]}
            />
          )}
        </Panel>

        <Panel
          eyebrow="Quantify"
          title="Price a scored risk"
          caption="Turns a residual score into currency using the disclosed loss model. Nothing here is an actuarial estimate — the model is a documented placeholder until a named methodology is adopted."
        >
          {risks.length === 0 ? (
            <EmptyState>
              No calculated risks yet — score one on the <Link to="/risks">Risk Engine</Link> page first.
            </EmptyState>
          ) : (
            <>
              <label className="form-field">
                <span className="eyebrow">Risk</span>
                <select
                  className="form-select"
                  value={selectedRiskId}
                  onChange={(e) => setSelectedRiskId(e.target.value)}
                >
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {assetNameById.get(risk.assetId) ?? risk.assetId} · {risk.level} · residual{" "}
                      {risk.residualScore}/100
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="form-button fin__run" onClick={handleQuantify} disabled={submitting}>
                {submitting ? "Pricing…" : "Quantify exposure"}
              </button>

              {exposures.length > 0 && (
                <table className="data-table fin__table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th className="num">Expected annual loss</th>
                      <th className="num">Exposure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exposures.map((e) => (
                      <tr key={e.id}>
                        <td>{assetNameById.get(e.assetId) ?? e.assetId}</td>
                        <td className="num">{formatINR(e.expectedLossAmount)}</td>
                        <td className="num">{formatINR(e.financialExposureAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
