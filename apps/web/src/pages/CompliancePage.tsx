import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SlidePanel } from "../components/SlidePanel";
import { Panel, EmptyState, Legend, LegendItem } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { RegulatoryMatrix, type MatrixRow } from "../components/viz/RegulatoryMatrix";
import { CoverageAtlas, type AtlasChain } from "../components/viz/CoverageAtlas";
import { KNOWN_CONTROLS, findKnownControl } from "../lib/compliance-reference";
import { listAssets, runGapAnalysis, mapAssetToControl } from "../lib/endpoints";
import type { Asset, ComplianceMapping, GapStatusValue } from "../types/api";
import "./compliance-page.css";

/**
 * Frameworks KAIRON is designed to cover. Only the ones with seeded reference
 * data can be assessed; the rest are shown as explicitly not loaded rather
 * than as 0% coverage, because "we never looked" and "we looked and found
 * nothing" are different claims and a compliance screen must not blur them.
 */
const DESIGNED_FRAMEWORKS = ["DPDP", "ISO27001", "GDPR", "DORA", "NIST"] as const;
const LOADED_FRAMEWORKS = new Set(["DPDP", "ISO27001"]);

const STATUS_COLOR: Record<GapStatusValue, string> = {
  COMPLIANT: "var(--sev-low)",
  PARTIAL: "var(--sev-medium)",
  GAP: "var(--sev-critical)",
};

function MapControlForm({ assets, onMapped }: { assets: Asset[]; onMapped(): void }) {
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
      await mapAssetToControl({ assetId, controlId });
      onMapped();
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

  function reload() {
    Promise.all([runGapAnalysis(1, 100), listAssets(1, 100)])
      .then(([gaps, assetPage]) => {
        setMappings(gaps.items);
        setAssets(assetPage.items);
      })
      .catch(() => setError("Couldn't load compliance data — the API may not be reachable."));
  }

  useEffect(reload, []);

  const all = mappings ?? [];
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const visible = all.filter((m) => {
    const known = findKnownControl(m.controlId);
    if (frameworkFilter !== "ALL" && known?.frameworkCode !== frameworkFilter) return false;
    if (statusFilter !== "ALL" && m.gapStatus !== statusFilter) return false;
    return true;
  });

  const assetTypes = useMemo(() => [...new Set(assets.map((a) => a.assetType))].sort(), [assets]);

  /** Coverage = assets of this class carrying at least one mapped control of this framework. */
  const matrixRows = useMemo<MatrixRow[]>(
    () =>
      DESIGNED_FRAMEWORKS.map((fw) => {
        const loaded = LOADED_FRAMEWORKS.has(fw);
        return {
          framework: fw,
          loaded,
          cells: assetTypes.map((type) => {
            const inClass = assets.filter((a) => a.assetType === type);
            const covered = inClass.filter((a) =>
              all.some((m) => m.assetId === a.id && findKnownControl(m.controlId)?.frameworkCode === fw)
            ).length;
            return { column: type, covered, total: inClass.length };
          }),
        };
      }),
    [assets, assetTypes, all]
  );

  const chains = useMemo<AtlasChain[]>(
    () =>
      visible
        .map((m): AtlasChain | null => {
          const known = findKnownControl(m.controlId);
          const asset = assetById.get(m.assetId);
          if (!known || !asset) return null;
          return {
            framework: known.frameworkCode,
            regulation: known.regulationName,
            clause: known.clauseReference,
            control: known.controlName,
            assetId: asset.id,
            assetName: asset.name,
            status: m.gapStatus,
          };
        })
        .filter((c): c is AtlasChain => c !== null),
    [visible, assetById]
  );

  const compliant = all.filter((m) => m.gapStatus === "COMPLIANT").length;
  const partial = all.filter((m) => m.gapStatus === "PARTIAL").length;
  const gaps = all.filter((m) => m.gapStatus === "GAP").length;
  const mappedAssets = new Set(all.map((m) => m.assetId)).size;
  const unmapped = assets.length - mappedAssets;

  return (
    <div className="compliance">
      <ExecutiveStrip>
        <Readout
          lead
          label="Assets in proven scope"
          value={String(mappedAssets)}
          unit={`of ${assets.length}`}
          direction={
            unmapped > 0
              ? { tone: "up", text: `${unmapped} with no control mapped at all` }
              : { tone: "down", text: "every asset carries a mapping" }
          }
          parts={[{ label: "Total mappings", value: String(all.length) }]}
        />
        <Readout
          label="Control posture"
          value={all.length > 0 ? `${Math.round(((compliant + partial * 0.5) / all.length) * 100)}%` : "—"}
          unit="weighted"
          direction={
            gaps > 0
              ? { tone: "up", text: `${gaps} outright gap${gaps === 1 ? "" : "s"}` }
              : { tone: "down", text: "no outright gaps on mapped controls" }
          }
          parts={[
            { label: "Compliant", value: String(compliant) },
            { label: "Partial", value: String(partial) },
            { label: "Gap", value: String(gaps) },
          ]}
        />
        <Readout
          label="Frameworks loaded"
          value={`${LOADED_FRAMEWORKS.size}`}
          unit={`of ${DESIGNED_FRAMEWORKS.length} designed`}
          direction={{ tone: "flat", text: "DPDP and ISO 27001 reference data seeded" }}
          parts={DESIGNED_FRAMEWORKS.filter((f) => !LOADED_FRAMEWORKS.has(f)).map((f) => ({
            label: f,
            value: "not loaded",
          }))}
        />
        <Readout
          label="Traceable chains"
          value={String(chains.length)}
          unit="regulation → asset"
          direction={{ tone: "flat", text: "each defensible to a specific clause" }}
        />
      </ExecutiveStrip>

      <div className="filter-bar">
        <span className="filter-bar__label">Scope</span>
        <select value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value as typeof frameworkFilter)}>
          <option value="ALL">All frameworks</option>
          <option value="DPDP">DPDP</option>
          <option value="ISO27001">ISO 27001</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="PARTIAL">Partial</option>
          <option value="GAP">Gap</option>
        </select>
        <span className="filter-bar__spacer" />
        <button type="button" className="form-button" onClick={() => setPanelOpen(true)} disabled={assets.length === 0}>
          Map control
        </button>
      </div>

      <Panel
        eyebrow="Regulatory heat matrix"
        title="Coverage confidence by framework and asset class"
        caption="What proportion of each asset class carries at least one mapped control under each framework. Columns are the classes actually present in this estate, not a generic org chart."
      >
        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : mappings === null ? (
          <EmptyState>Reading control mappings…</EmptyState>
        ) : assetTypes.length === 0 ? (
          <EmptyState>No assets registered, so there is nothing to assess coverage against.</EmptyState>
        ) : (
          <RegulatoryMatrix rows={matrixRows} columns={assetTypes} />
        )}
      </Panel>

      <Panel
        eyebrow="Coverage atlas"
        title="Regulation → clause → control → asset"
        caption="Every ribbon is a mapping the platform can defend to an auditor. Hover any node to isolate the chains running through it."
        bleed
        aside={
          <Legend>
            <LegendItem shape="line" color="var(--sev-low)" label="Compliant" />
            <LegendItem shape="line" color="var(--sev-medium)" label="Partial" />
            <LegendItem shape="line" color="var(--sev-critical)" label="Gap" />
          </Legend>
        }
      >
        {chains.length === 0 ? (
          <EmptyState>
            No traceable chains under the current scope. Map an asset to a control and the full chain — framework,
            clause, control, asset — is drawn here.
          </EmptyState>
        ) : (
          <CoverageAtlas chains={chains} />
        )}
      </Panel>

      <Panel eyebrow="Register" title="Control mappings" bleed>
        {visible.length === 0 ? (
          <EmptyState>Nothing matches the current scope.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Framework</th>
                <th>Regulation</th>
                <th>Clause</th>
                <th>Control</th>
                <th>Asset</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const known = findKnownControl(m.controlId);
                const asset = assetById.get(m.assetId);
                return (
                  <tr key={m.id}>
                    <td className="num">{known?.frameworkCode ?? "—"}</td>
                    <td>{known?.regulationName ?? "—"}</td>
                    <td className="compliance__clause num">{known?.clauseReference ?? "—"}</td>
                    <td>{known?.controlName ?? m.controlId}</td>
                    <td>{asset?.name ?? m.assetId}</td>
                    <td>
                      <span className="compliance__status" style={{ color: STATUS_COLOR[m.gapStatus] }}>
                        <span className="compliance__status-dot" style={{ background: STATUS_COLOR[m.gapStatus] }} />
                        {m.gapStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <SlidePanel title="Map control" open={panelOpen} onClose={() => setPanelOpen(false)}>
        <MapControlForm
          assets={assets}
          onMapped={() => {
            setPanelOpen(false);
            reload();
          }}
        />
      </SlidePanel>
    </div>
  );
}
