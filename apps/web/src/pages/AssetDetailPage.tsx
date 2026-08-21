import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SeverityBadge } from "../components/SeverityBadge";
import { Panel, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { getAsset, getAssetTraceability, calculateRisk, listRisks } from "../lib/endpoints";
import { formatCompactINR, formatINR } from "../lib/format";
import { SEVERITY_VAR } from "../lib/intelligence";
import type { Asset, Risk, TraceabilityEntry } from "../types/api";
import "./asset-detail-page.css";

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [traceability, setTraceability] = useState<TraceabilityEntry[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAsset(id)
      .then(setAsset)
      .catch(() => setError("Couldn't load this asset."));
    getAssetTraceability(id)
      .then(setTraceability)
      .catch(() => undefined);
    listRisks(1, 100)
      .then((page) => setRisks(page.items.filter((r) => r.assetId === id)))
      .catch(() => undefined);
  }, [id]);

  async function handleCalculateRisk() {
    if (!id) return;
    setCalculating(true);
    try {
      const result = await calculateRisk(id);
      setRisks((prev) => [result, ...prev]);
    } catch {
      setError("Risk calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  if (error) {
    return (
      <Panel title="Not available" eyebrow="Asset">
        <EmptyState>{error}</EmptyState>
      </Panel>
    );
  }
  if (!asset) return <div className="detail__loading">Loading asset…</div>;

  const latest = risks[0] ?? null;
  const inherentExposure = latest ? latest.impactAmount * (latest.inherentScore / 100) : 0;
  const residualExposure = latest ? latest.impactAmount * (latest.residualScore / 100) : 0;

  return (
    <div className="detail">
      <Link to="/assets" className="detail__back">
        <ArrowLeft size={14} strokeWidth={1.75} /> Asset landscape
      </Link>

      <div className="detail__title-row">
        <h2 className="detail__title">{asset.name}</h2>
        <SeverityBadge level={asset.criticality} />
      </div>

      <ExecutiveStrip>
        <Readout label="Class" variant="text" value={asset.assetType} direction={{ tone: "flat", text: `${asset.dataClassification.toLowerCase()} data` }} />
        <Readout
          lead
          label="Residual exposure"
          value={latest ? formatCompactINR(residualExposure) : "Unmeasured"}
          variant={latest ? "figure" : "text"}
          direction={
            latest
              ? { tone: "up", text: `residual score ${latest.residualScore}/100` }
              : { tone: "up", text: "never scored — exposure is unknown, not zero" }
          }
          parts={
            latest
              ? [
                  { label: "Inherent", value: formatCompactINR(inherentExposure) },
                  { label: "Absorbed", value: formatCompactINR(inherentExposure - residualExposure) },
                ]
              : undefined
          }
        />
        <Readout
          label="Regulatory scope"
          value={String(traceability.length)}
          unit="chains"
          direction={
            traceability.length > 0
              ? { tone: "flat", text: "traceable to a specific clause" }
              : { tone: "up", text: "no control mapped — scope unproven" }
          }
        />
        <Readout
          label="Times scored"
          value={String(risks.length)}
          direction={{ tone: "flat", text: risks.length > 0 ? "each run is an audit event" : "no history yet" }}
        />
      </ExecutiveStrip>

      <div className="detail__split">
        <Panel
          eyebrow="Risk"
          title="Assessment history"
          caption="Every scoring run against this asset. Re-scoring never overwrites — each run is recorded, so the trend is auditable."
          bleed
        >
          {risks.length === 0 ? (
            <EmptyState>This asset has never been scored.</EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Band</th>
                  <th className="num">Inherent</th>
                  <th className="num">Residual</th>
                  <th className="num">Modelled impact</th>
                  <th className="num">Residual exposure</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <SeverityBadge level={r.level} />
                    </td>
                    <td className="num">{r.inherentScore}</td>
                    <td className="num">{r.residualScore}</td>
                    <td className="num">{formatINR(r.impactAmount)}</td>
                    <td className="num">{formatINR(r.impactAmount * (r.residualScore / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel eyebrow="Actions" title="Score this asset">
          <dl className="detail__fields">
            <div>
              <dt>Type</dt>
              <dd>{asset.assetType}</dd>
            </div>
            <div>
              <dt>Criticality</dt>
              <dd style={{ color: SEVERITY_VAR[asset.criticality] }}>{asset.criticality}</dd>
            </div>
            <div>
              <dt>Data classification</dt>
              <dd>{asset.dataClassification}</dd>
            </div>
            <div>
              <dt>Regulatory scope</dt>
              <dd>{asset.regulatoryScope.length > 0 ? asset.regulatoryScope.join(", ") : "None mapped"}</dd>
            </div>
          </dl>
          <button type="button" className="form-button detail__run" onClick={handleCalculateRisk} disabled={calculating}>
            {calculating ? "Scoring…" : "Run the risk engine"}
          </button>
        </Panel>
      </div>

      <Panel
        eyebrow="Traceability"
        title="Why this asset is in scope"
        caption="The chain an auditor asks for: which framework, which clause, which control."
      >
        {traceability.length === 0 ? (
          <EmptyState>
            No compliance mappings yet — map this asset to a control from the <Link to="/compliance">Compliance</Link>{" "}
            page and the chain appears here.
          </EmptyState>
        ) : (
          <ol className="detail__chains">
            {traceability.map((entry, i) => (
              <li key={i}>
                <span className="detail__chain-fw num">{entry.framework.code}</span>
                <span className="detail__chain-arrow">→</span>
                <span>{entry.regulation.name}</span>
                <span className="detail__chain-clause num">{entry.regulation.clauseReference}</span>
                <span className="detail__chain-arrow">→</span>
                <span className="detail__chain-control">{entry.control.name}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
