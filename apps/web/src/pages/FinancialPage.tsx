import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRiskGauge } from "../components/QRiskGauge";
import { listRisks, quantifyExposure, getQRisk } from "../lib/endpoints";
import { formatINR } from "../lib/format";
import type { FinancialExposure, Risk } from "../types/api";
import "./financial-page.css";

export function FinancialPage() {
  const [qRisk, setQRisk] = useState<number | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [exposures, setExposures] = useState<FinancialExposure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getQRisk(), listRisks(1, 100)])
      .then(([q, riskPage]) => {
        setQRisk(q.qRisk);
        setRisks(riskPage.items);
        if (riskPage.items.length > 0) setSelectedRiskId(riskPage.items[0].id);
      })
      .catch(() => setError("Couldn't load financial data — the API may not be reachable."));
  }, []);

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
    <div className="financial-page">
      <aside className="financial-page__gauge-panel">
        {qRisk !== null && <QRiskGauge score={qRisk} />}
        <p className="financial-page__note">
          Composed today from asset coverage and residual risk health only. Compliance coverage, weighted financial
          exposure, operational resilience and quantum readiness are disclosed as pending inputs, not silently
          assumed — they join the score once those signals are wired in.
        </p>
      </aside>

      <section className="financial-page__calculator">
        <h2 className="risks-page__panel-title">Quantify exposure</h2>
        {error && <p className="form-error">{error}</p>}
        {risks.length === 0 ? (
          <p className="asset-detail__hint">
            No calculated risks yet — calculate one on the <Link to="/risks">Risk Engine</Link> page first.
          </p>
        ) : (
          <div className="financial-page__form">
            <label className="form-field">
              <span className="eyebrow">Risk</span>
              <select className="form-select" value={selectedRiskId} onChange={(e) => setSelectedRiskId(e.target.value)}>
                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>
                    {risk.level} · residual {risk.residualScore}/100 · {formatINR(risk.impactAmount)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="form-button" onClick={handleQuantify} disabled={submitting}>
              {submitting ? "Quantifying…" : "Quantify exposure"}
            </button>
          </div>
        )}

        <h3 className="financial-page__list-title eyebrow">This session's exposures</h3>
        {exposures.length === 0 ? (
          <p className="asset-detail__hint">Nothing quantified yet this session.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Expected annual loss</th>
                <th>Financial exposure</th>
                <th>Residual risk exposure</th>
              </tr>
            </thead>
            <tbody>
              {exposures.map((exposure) => (
                <tr key={exposure.id}>
                  <td className="num">{formatINR(exposure.expectedLossAmount)}</td>
                  <td className="num">{formatINR(exposure.financialExposureAmount)}</td>
                  <td className="num">{formatINR(exposure.residualRiskExposureAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
