import { useEffect, useState, type FormEvent } from "react";
import { SlidePanel } from "../components/SlidePanel";
import { KNOWN_CONTROLS, findKnownControl } from "../lib/compliance-reference";
import { listAssets, runGapAnalysis, mapAssetToControl, getAssetTraceability } from "../lib/endpoints";
import type { Asset, ComplianceMapping, GapStatusValue, TraceabilityEntry } from "../types/api";
import "./compliance-page.css";

const STATUS_VAR: Record<GapStatusValue, string> = {
  COMPLIANT: "--accent-safe",
  PARTIAL: "--accent-warn",
  GAP: "--accent-risk",
};

function MapControlForm({ assets, onMapped }: { assets: Asset[]; onMapped(m: ComplianceMapping): void }) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [controlId, setControlId] = useState(KNOWN_CONTROLS[0].controlId);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assetId) return;
    setSubmitting(true);
    setError(null);
    try {
      const mapping = await mapAssetToControl({ assetId, controlId });
      onMapped(mapping);
    } catch {
      setError("Couldn't create the mapping.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <label className="form-field">
        <span className="eyebrow">Asset</span>
        <select className="form-select" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span className="eyebrow">Control</span>
        <select className="form-select" value={controlId} onChange={(e) => setControlId(e.target.value)}>
          {KNOWN_CONTROLS.map((c) => (
            <option key={c.controlId} value={c.controlId}>
              {c.frameworkCode} · {c.controlName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="form-button" disabled={submitting || !assetId}>
        {submitting ? "Mapping…" : "Map control"}
      </button>
    </form>
  );
}

export function CompliancePage() {
  const [mappings, setMappings] = useState<ComplianceMapping[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statusFilter, setStatusFilter] = useState<GapStatusValue | "ALL">("ALL");
  const [frameworkFilter, setFrameworkFilter] = useState<"ALL" | "DPDP" | "ISO27001">("ALL");
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [traceAssetId, setTraceAssetId] = useState("");
  const [traceEntries, setTraceEntries] = useState<TraceabilityEntry[] | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  function reload() {
    runGapAnalysis(1, 100, statusFilter === "ALL" ? undefined : statusFilter)
      .then((page) => setMappings(page.items))
      .catch(() => setError("Couldn't load compliance gaps — the API may not be reachable."));
  }

  useEffect(reload, [statusFilter]);

  useEffect(() => {
    listAssets(1, 100)
      .then((page) => {
        setAssets(page.items);
        if (page.items.length > 0) setTraceAssetId(page.items[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function handleTrace() {
    if (!traceAssetId) return;
    setTraceLoading(true);
    try {
      const entries = await getAssetTraceability(traceAssetId);
      setTraceEntries(entries);
    } catch {
      setTraceEntries([]);
    } finally {
      setTraceLoading(false);
    }
  }

  const visible = (mappings ?? []).filter((m) => {
    if (frameworkFilter === "ALL") return true;
    return findKnownControl(m.controlId)?.frameworkCode === frameworkFilter;
  });

  return (
    <div className="compliance-page">
      <section className="compliance-page__gaps">
        <div className="compliance-page__toolbar">
          <div className="assets-page__filters">
            <select className="form-select" value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value as typeof frameworkFilter)}>
              <option value="ALL">All frameworks</option>
              <option value="DPDP">DPDP</option>
              <option value="ISO27001">ISO27001</option>
            </select>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All statuses</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PARTIAL">Partial</option>
              <option value="GAP">Gap</option>
            </select>
          </div>
          <button type="button" className="form-button" onClick={() => setPanelOpen(true)} disabled={assets.length === 0}>
            Map control
          </button>
        </div>

        {error ? (
          <div className="data-table__empty">{error}</div>
        ) : mappings === null ? (
          <div className="data-table__empty">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="data-table__empty">
            {mappings.length === 0
              ? "No controls mapped yet — map an asset to a control to start tracking compliance."
              : "No mappings match the current filters."}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Framework</th>
                <th>Regulation</th>
                <th>Control</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((mapping) => {
                const known = findKnownControl(mapping.controlId);
                return (
                  <tr key={mapping.id}>
                    <td className="num">{known?.frameworkCode ?? mapping.controlId}</td>
                    <td>{known?.regulationName ?? "—"}</td>
                    <td>{known?.controlName ?? mapping.controlId}</td>
                    <td>
                      <span className="compliance-page__status" style={{ color: `var(${STATUS_VAR[mapping.gapStatus]})` }}>
                        {mapping.gapStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="compliance-page__trace">
        <h2 className="risks-page__panel-title">Asset traceability</h2>
        {assets.length === 0 ? (
          <p className="asset-detail__hint">Add an asset first to trace it against regulations.</p>
        ) : (
          <>
            <div className="compliance-page__trace-form">
              <select className="form-select" value={traceAssetId} onChange={(e) => setTraceAssetId(e.target.value)}>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button type="button" className="form-button form-button--ghost" onClick={handleTrace} disabled={traceLoading}>
                {traceLoading ? "Tracing…" : "Trace"}
              </button>
            </div>
            {traceEntries !== null && (
              <ul className="asset-detail__trace-list compliance-page__trace-list">
                {traceEntries.length === 0 ? (
                  <li>No mappings found for this asset yet.</li>
                ) : (
                  traceEntries.map((entry, i) => (
                    <li key={i}>
                      <span className="num">{entry.framework.code}</span> → {entry.regulation.name} ({entry.regulation.clauseReference})
                      → {entry.control.name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </section>

      <SlidePanel title="Map control" open={panelOpen} onClose={() => setPanelOpen(false)}>
        <MapControlForm
          assets={assets}
          onMapped={(mapping) => {
            setMappings((prev) => (prev ? [mapping, ...prev] : [mapping]));
            setPanelOpen(false);
          }}
        />
      </SlidePanel>
    </div>
  );
}
