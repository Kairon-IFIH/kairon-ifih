import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { SlidePanel } from "../components/SlidePanel";
import { SeverityBadge } from "../components/SeverityBadge";
import { Panel, Legend, LegendItem, EmptyState } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { AssetLandscape } from "../components/viz/AssetLandscape";
import { listAssets, createAsset, importAssetsCsv, listRisks } from "../lib/endpoints";
import { buildAssetSurface, SEVERITY_VAR } from "../lib/intelligence";
import type { Asset, CriticalityLevel, DataClassificationLevel, Risk } from "../types/api";
import "./assets-page.css";

const CRITICALITY_LEVELS: CriticalityLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CLASSIFICATION_LEVELS: DataClassificationLevel[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

function AddAssetForm({ onCreated }: { onCreated(asset: Asset): void }) {
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("");
  const [criticality, setCriticality] = useState<CriticalityLevel>("MEDIUM");
  const [dataClassification, setDataClassification] = useState<DataClassificationLevel>("INTERNAL");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const asset = await createAsset({ name, assetType, criticality, dataClassification });
      onCreated(asset);
      setName("");
      setAssetType("");
    } catch {
      setError("Couldn't create the asset. Check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <label className="form-field">
        <span className="eyebrow">Name</span>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="form-field">
        <span className="eyebrow">Type</span>
        <input
          className="form-input"
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          placeholder="Network, Application, Database, API…"
          required
        />
      </label>
      <label className="form-field">
        <span className="eyebrow">Criticality</span>
        <select
          className="form-select"
          value={criticality}
          onChange={(e) => setCriticality(e.target.value as CriticalityLevel)}
        >
          {CRITICALITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span className="eyebrow">Data classification</span>
        <select
          className="form-select"
          value={dataClassification}
          onChange={(e) => setDataClassification(e.target.value as DataClassificationLevel)}
        >
          {CLASSIFICATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="form-button" disabled={submitting}>
        {submitting ? "Adding…" : "Add asset"}
      </button>
    </form>
  );
}

function ImportCsvForm({ onImported }: { onImported(count: number): void }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const result = await importAssetsCsv(text);
      onImported(result.imported);
    } catch {
      setError("Import failed. Confirm the header row is name,assetType,criticality,dataClassification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="form-error">{error}</p>}
      <div
        className={"csv-drop" + (dragOver ? " csv-drop--active" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <Upload size={22} strokeWidth={1.5} />
        <p>Drag a CSV here, or</p>
        <label className="csv-drop__browse">
          browse
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
        <p className="csv-drop__hint num">name,assetType,criticality,dataClassification</p>
        {busy && <p className="csv-drop__hint">Importing…</p>}
      </div>
    </div>
  );
}

export function AssetsPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [criticalityFilter, setCriticalityFilter] = useState<CriticalityLevel | "ALL">("ALL");
  const [classificationFilter, setClassificationFilter] = useState<DataClassificationLevel | "ALL">("ALL");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);

  function reload() {
    Promise.all([listAssets(1, 100), listRisks(1, 100)])
      .then(([a, r]) => {
        setAssets(a.items);
        setRisks(r.items);
      })
      .catch(() => setError("Couldn't load assets — the API may not be reachable."));
  }

  useEffect(reload, []);

  const visible = useMemo(
    () =>
      (assets ?? []).filter(
        (a) =>
          (criticalityFilter === "ALL" || a.criticality === criticalityFilter) &&
          (classificationFilter === "ALL" || a.dataClassification === classificationFilter)
      ),
    [assets, criticalityFilter, classificationFilter]
  );

  const surface = useMemo(() => buildAssetSurface(assets ?? []), [assets]);
  const scoredIds = useMemo(() => new Set(risks.map((r) => r.assetId)), [risks]);
  const unscored = (assets ?? []).filter((a) => !scoredIds.has(a.id)).length;
  const restricted = (assets ?? []).filter((a) => a.dataClassification === "RESTRICTED").length;
  const topType = surface.byType[0];

  return (
    <div className="assets">
      <ExecutiveStrip>
        <Readout
          lead
          label="Asset surface"
          value={String(surface.total)}
          unit="tracked"
          direction={
            unscored > 0
              ? { tone: "up", text: `${unscored} carrying unmeasured exposure` }
              : { tone: "down", text: "every asset scored" }
          }
          parts={surface.byType.slice(0, 3).map((t) => ({ label: t.type, value: String(t.count) }))}
        />
        <Readout
          label="Concentration"
          value={String(surface.highValue)}
          unit="high / critical"
          direction={{
            tone: surface.highValue > surface.total / 2 ? "up" : "flat",
            text:
              surface.total > 0
                ? `${Math.round((surface.highValue / surface.total) * 100)}% of the surface`
                : "nothing tracked yet",
          }}
          parts={surface.byCriticality
            .filter((c) => c.count > 0)
            .map((c) => ({ label: c.level, value: String(c.count) }))}
        />
        <Readout
          label="Restricted data"
          value={String(restricted)}
          unit="assets"
          direction={{
            tone: restricted > 0 ? "up" : "flat",
            text: restricted > 0 ? "in regulatory scope by classification" : "none classified restricted",
          }}
          parts={[{ label: "No regulatory scope mapped", value: String(surface.unscoped) }]}
        />
        <Readout
          label="Largest class"
          variant="text"
          value={topType ? topType.type : "—"}
          unit={topType ? `${topType.count} assets` : undefined}
          direction={
            topType
              ? { tone: "flat", text: `mean criticality ${topType.criticalityMean.toFixed(1)} of 4` }
              : undefined
          }
        />
      </ExecutiveStrip>

      <div className="filter-bar">
        <span className="filter-bar__label">Scope</span>
        <select
          value={criticalityFilter}
          onChange={(e) => setCriticalityFilter(e.target.value as CriticalityLevel | "ALL")}
        >
          <option value="ALL">All criticality</option>
          {CRITICALITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value as DataClassificationLevel | "ALL")}
        >
          <option value="ALL">All classifications</option>
          {CLASSIFICATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <span className="filter-bar__spacer" />
        <button type="button" className="form-button form-button--ghost" onClick={() => setPanel("import")}>
          <Upload size={14} strokeWidth={1.75} /> Bulk import
        </button>
        <button type="button" className="form-button" onClick={() => setPanel("add")}>
          <Plus size={14} strokeWidth={1.75} /> Register asset
        </button>
      </div>

      <Panel
        eyebrow="Asset landscape"
        title="Exposure surface by class"
        caption="Area is criticality weight — how much surface an asset represents. Fill is the severity actually scored against it. An outlined cell has never been scored: it is a hole in the measurement, not a safe asset."
        bleed
        aside={
          <Legend>
            {CRITICALITY_LEVELS.map((l) => (
              <LegendItem key={l} color={SEVERITY_VAR[l]} label={l} />
            ))}
            <LegendItem shape="ring" label="Unscored" />
          </Legend>
        }
      >
        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : assets === null ? (
          <EmptyState>Mapping the surface…</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>
            {assets.length === 0 ? (
              <>
                Nothing tracked yet — <button onClick={() => setPanel("add")}>register an asset</button> or{" "}
                <button onClick={() => setPanel("import")}>import a CSV</button> to draw the landscape.
              </>
            ) : (
              "No assets match the current scope."
            )}
          </EmptyState>
        ) : (
          <AssetLandscape assets={visible} risks={risks} onSelect={(a) => navigate(`/assets/${a.id}`)} />
        )}
      </Panel>

      <Panel
        eyebrow="Register"
        title="Full inventory"
        caption="The same assets as records. The landscape above is for finding where exposure sits; this is for looking one up."
        bleed
      >
        {visible.length === 0 ? (
          <EmptyState>Nothing to list under the current scope.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Class</th>
                <th>Criticality</th>
                <th>Data</th>
                <th>Risk scored</th>
                <th>Regulatory scope</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((asset) => {
                const risk = risks.find((r) => r.assetId === asset.id);
                return (
                  <tr key={asset.id} data-clickable="true" onClick={() => navigate(`/assets/${asset.id}`)}>
                    <td>{asset.name}</td>
                    <td>{asset.assetType}</td>
                    <td>
                      <SeverityBadge level={asset.criticality} />
                    </td>
                    <td>{asset.dataClassification}</td>
                    <td>
                      {risk ? (
                        <SeverityBadge level={risk.level} />
                      ) : (
                        <span className="assets__unscored">not scored</span>
                      )}
                    </td>
                    <td>{asset.regulatoryScope.length > 0 ? asset.regulatoryScope.join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <SlidePanel title="Register asset" open={panel === "add"} onClose={() => setPanel(null)}>
        <AddAssetForm
          onCreated={() => {
            setPanel(null);
            reload();
          }}
        />
      </SlidePanel>

      <SlidePanel title="Bulk import" open={panel === "import"} onClose={() => setPanel(null)}>
        <ImportCsvForm
          onImported={() => {
            setPanel(null);
            reload();
          }}
        />
      </SlidePanel>
    </div>
  );
}
