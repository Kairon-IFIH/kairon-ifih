import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SeverityBadge } from "../components/SeverityBadge";
import { getAsset, getAssetTraceability, calculateRisk } from "../lib/endpoints";
import { formatINR } from "../lib/format";
import type { Asset, Risk, TraceabilityEntry } from "../types/api";
import "./asset-detail-page.css";

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [traceability, setTraceability] = useState<TraceabilityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAsset(id)
      .then(setAsset)
      .catch(() => setError("Couldn't load this asset."));
    getAssetTraceability(id)
      .then(setTraceability)
      .catch(() => undefined);
  }, [id]);

  async function handleCalculateRisk() {
    if (!id) return;
    setCalculating(true);
    try {
      const result = await calculateRisk(id);
      setRisk(result);
    } catch {
      setError("Risk calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  if (error) return <div className="data-table__empty">{error}</div>;
  if (!asset) return <div className="data-table__empty">Loading…</div>;

  return (
    <div className="asset-detail">
      <Link to="/assets" className="asset-detail__back">
        <ArrowLeft size={15} strokeWidth={1.75} /> Back to assets
      </Link>

      <div className="asset-detail__header">
        <h2>{asset.name}</h2>
        <SeverityBadge level={asset.criticality} />
      </div>

      <dl className="asset-detail__fields">
        <div>
          <dt className="eyebrow">Type</dt>
          <dd>{asset.assetType}</dd>
        </div>
        <div>
          <dt className="eyebrow">Data classification</dt>
          <dd>{asset.dataClassification}</dd>
        </div>
        <div>
          <dt className="eyebrow">Regulatory scope</dt>
          <dd>{asset.regulatoryScope.length > 0 ? asset.regulatoryScope.join(", ") : "None mapped yet"}</dd>
        </div>
      </dl>

      <section className="asset-detail__section">
        <h3>Risk assessment</h3>
        {risk ? (
          <div className="asset-detail__risk-result">
            <SeverityBadge level={risk.level} />
            <span className="num">Residual score {risk.residualScore}/100</span>
            <span className="num">Modeled impact {formatINR(risk.impactAmount)}</span>
          </div>
        ) : (
          <p className="asset-detail__hint">No risk calculated for this asset yet.</p>
        )}
        <button type="button" className="form-button" onClick={handleCalculateRisk} disabled={calculating}>
          {calculating ? "Calculating…" : "Calculate risk"}
        </button>
      </section>

      <section className="asset-detail__section">
        <h3>Regulatory traceability</h3>
        {traceability.length === 0 ? (
          <p className="asset-detail__hint">
            No compliance mappings yet — map this asset to a control from the{" "}
            <Link to="/compliance">Compliance</Link> page to see its traceability chain here.
          </p>
        ) : (
          <ul className="asset-detail__trace-list">
            {traceability.map((entry, i) => (
              <li key={i}>
                <span className="num">{entry.framework.code}</span> → {entry.regulation.name} (
                {entry.regulation.clauseReference}) → {entry.control.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
