import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { SlidePanel } from "../components/SlidePanel";
import { SeverityBadge } from "../components/SeverityBadge";
import { listAssets, createAsset, importAssetsCsv } from "../lib/endpoints";
import type { Asset, CriticalityLevel, DataClassificationLevel } from "../types/api";
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
          placeholder="Network, Application, Data, Physical…"
          required
        />
      </label>
      <label className="form-field">
        <span className="eyebrow">Criticality</span>
        <select className="form-select" value={criticality} onChange={(e) => setCriticality(e.target.value as CriticalityLevel)}>
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
  const [error, setError] = useState<string | null>(null);
  const [criticalityFilter, setCriticalityFilter] = useState<CriticalityLevel | "ALL">("ALL");
  const [classificationFilter, setClassificationFilter] = useState<DataClassificationLevel | "ALL">("ALL");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);

  function reload() {
    listAssets(1, 100)
      .then((page) => setAssets(page.items))
      .catch(() => setError("Couldn't load assets — the API may not be reachable."));
  }

  useEffect(reload, []);

  const visible = (assets ?? []).filter(
    (a) =>
      (criticalityFilter === "ALL" || a.criticality === criticalityFilter) &&
      (classificationFilter === "ALL" || a.dataClassification === classificationFilter)
  );

  return (
    <div className="assets-page">
      <div className="assets-page__toolbar">
        <div className="assets-page__filters">
          <select className="form-select" value={criticalityFilter} onChange={(e) => setCriticalityFilter(e.target.value as CriticalityLevel | "ALL")}>
            <option value="ALL">All criticality</option>
            {CRITICALITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            className="form-select"
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
        </div>
        <div className="assets-page__actions">
          <button type="button" className="form-button form-button--ghost" onClick={() => setPanel("import")}>
            <Upload size={15} strokeWidth={1.75} /> Bulk import
          </button>
          <button type="button" className="form-button" onClick={() => setPanel("add")}>
            <Plus size={15} strokeWidth={1.75} /> Add asset
          </button>
        </div>
      </div>

      {error ? (
        <div className="data-table__empty">{error}</div>
      ) : assets === null ? (
        <div className="data-table__empty">Loading assets…</div>
      ) : visible.length === 0 ? (
        <div className="data-table__empty">
          {assets.length === 0 ? (
            <>
              No assets yet — <button onClick={() => setPanel("add")}>add one manually</button> or{" "}
              <button onClick={() => setPanel("import")}>import a CSV</button>.
            </>
          ) : (
            "No assets match the current filters."
          )}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Criticality</th>
              <th>Classification</th>
              <th>Regulatory scope</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((asset) => (
              <tr key={asset.id} data-clickable="true" onClick={() => navigate(`/assets/${asset.id}`)}>
                <td>{asset.name}</td>
                <td>{asset.assetType}</td>
                <td>
                  <SeverityBadge level={asset.criticality} />
                </td>
                <td>{asset.dataClassification}</td>
                <td>{asset.regulatoryScope.length > 0 ? asset.regulatoryScope.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SlidePanel title="Add asset" open={panel === "add"} onClose={() => setPanel(null)}>
        <AddAssetForm
          onCreated={(asset) => {
            setAssets((prev) => (prev ? [asset, ...prev] : [asset]));
            setPanel(null);
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
