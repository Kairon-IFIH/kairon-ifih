/**
 * The derivation layer: turns raw API responses into the signals the
 * workstation actually renders.
 *
 * HONESTY RULE FOR THIS FILE — every number that reaches a chart is derived
 * from something the API really returned. Nothing here invents history,
 * back-fills a trend, or seeds a demo series. Where the platform genuinely
 * has no data yet (no assets, no risks, a framework that was never seeded)
 * the derivation returns an empty result and the component renders an honest
 * empty state instead of a plausible-looking fake one.
 *
 * The time dimension is real: KAIRON is event-sourced, so the audit trail
 * (`GET /audit`) is a genuine chronological log — every AssetDiscovered,
 * RiskCalculated, FinancialExposureQuantified and OptimizationExecuted event
 * carries a timestamp and its own numeric payload. That log, not a random
 * walk, is what the Exposure River and the Signal Feed read from.
 */

import type {
  AlgorithmCategory,
  Asset,
  AuditEvent,
  ComplianceMapping,
  CriticalityLevel,
  CryptoAssetType,
  CryptoStrength,
  QarsRiskLevel,
  Risk,
  RiskLevel,
  ScanResult,
} from "../types/api";

/* ------------------------------------------------------------------ *
 * shared scales
 * ------------------------------------------------------------------ */

export const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const CRITICALITY_LEVELS: CriticalityLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const SEVERITY_VAR: Record<string, string> = {
  LOW: "var(--sev-low)",
  MEDIUM: "var(--sev-medium)",
  HIGH: "var(--sev-high)",
  CRITICAL: "var(--sev-critical)",
};

export const SEVERITY_WASH: Record<string, string> = {
  LOW: "var(--sev-low-wash)",
  MEDIUM: "var(--sev-medium-wash)",
  HIGH: "var(--sev-high-wash)",
  CRITICAL: "var(--sev-critical-wash)",
};

/** Indigo ordinal ramp, light→dark. Index 0 is nearest the surface. */
export const INDIGO_RAMP = [
  "var(--indigo-100)",
  "var(--indigo-200)",
  "var(--indigo-300)",
  "var(--indigo-400)",
  "var(--indigo-500)",
  "var(--indigo-600)",
  "var(--indigo-700)",
];

/** Maps a 0..1 intensity onto the validated ordinal ramp. */
export function rampStep(intensity: number, steps = INDIGO_RAMP): string {
  if (!Number.isFinite(intensity)) return steps[0];
  const i = Math.round(Math.max(0, Math.min(1, intensity)) * (steps.length - 1));
  return steps[i];
}

/* ------------------------------------------------------------------ *
 * audit-event payload readers
 * ------------------------------------------------------------------ */

function payloadOf(event: AuditEvent): Record<string, unknown> {
  return (event.diff?.after ?? {}) as Record<string, unknown>;
}

function num(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

/* ------------------------------------------------------------------ *
 * exposure river — cumulative exposure through the real event log
 * ------------------------------------------------------------------ */

export interface RiverPoint {
  t: number;
  label: string;
  /** Cumulative modelled impact from every RiskCalculated event so far. */
  inherent: number;
  /** Cumulative residual after control effectiveness, same events. */
  residual: number;
  /** Cumulative expected annual loss from FinancialExposureQuantified events. */
  expectedLoss: number;
  /** Cumulative risk value removed by completed optimization runs. */
  mitigated: number;
  eventCount: number;
}

/**
 * Walks the audit log oldest→newest, accumulating each event's own payload.
 * The result is the institution's exposure as it actually built up over the
 * session — not a smoothed or interpolated series.
 */
export function buildExposureRiver(events: AuditEvent[]): RiverPoint[] {
  const chronological = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  if (chronological.length === 0) return [];

  let inherent = 0;
  let residual = 0;
  let expectedLoss = 0;
  let mitigated = 0;
  const points: RiverPoint[] = [];

  chronological.forEach((event, index) => {
    const p = payloadOf(event);

    if (event.action === "RiskCalculated") {
      const impact = num(p, "impact") ?? 0;
      const riskScore = num(p, "riskScore") ?? 0;
      const residualScore = num(p, "residualRisk") ?? 0;
      inherent += impact * (riskScore / 100);
      residual += impact * (residualScore / 100);
    }

    if (event.action === "FinancialExposureQuantified") {
      expectedLoss += num(p, "expectedLoss") ?? 0;
    }

    if (event.action === "OptimizationExecuted") {
      const reduction = num(p, "riskReduction") ?? 0;
      const residualAfter = num(p, "residualRisk") ?? 0;
      // riskReduction is a percentage of the candidate portfolio's value;
      // residualRisk is what the solver left on the table.
      mitigated += residualAfter * (reduction / 100);
    }

    points.push({
      t: new Date(event.timestamp).getTime(),
      // seconds included: a session's events often land inside one minute,
      // and an axis reading "12:52 → 12:52" tells the reader nothing
      label: new Date(event.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
      inherent,
      residual,
      expectedLoss,
      mitigated,
      eventCount: index + 1,
    });
  });

  return points;
}

/* ------------------------------------------------------------------ *
 * signal feed — the audit log read as market movements
 * ------------------------------------------------------------------ */

export type SignalTone = "elevation" | "reduction" | "neutral" | "governance";

export interface Signal {
  id: string;
  t: number;
  time: string;
  /** Short all-caps tag, terminal style. */
  tag: string;
  headline: string;
  detail: string | null;
  /** Signed magnitude where the event carries one; null when it doesn't. */
  magnitude: string | null;
  tone: SignalTone;
}

const ACTION_TAG: Record<string, string> = {
  AssetDiscovered: "SURFACE",
  AssetClassified: "SURFACE",
  RiskCalculated: "EXPOSURE",
  FinancialExposureQuantified: "VALUATION",
  ComplianceMapped: "REGULATORY",
  OptimizationExecuted: "OPTIMIZER",
  RemediationApproved: "GOVERNANCE",
  RemediationGenerated: "OPTIMIZER",
};

export function buildSignalFeed(events: AuditEvent[], assetNames: Map<string, string>): Signal[] {
  return [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((event) => {
      const p = payloadOf(event);
      const date = new Date(event.timestamp);
      const base = {
        id: event.id,
        t: date.getTime(),
        // 24-hour: terminal convention, and it fits the column without wrapping
        time: date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
        tag: ACTION_TAG[event.action] ?? "EVENT",
      };

      switch (event.action) {
        case "AssetDiscovered": {
          const assetId = str(p, "assetId") ?? event.entityId;
          const criticality = str(p, "criticality") ?? "";
          return {
            ...base,
            headline: `${assetNames.get(assetId) ?? "Asset"} entered the surface`,
            detail: `${str(p, "assetType") ?? "unclassified"} · ${criticality.toLowerCase()} criticality`,
            magnitude: null,
            tone: (criticality === "CRITICAL" || criticality === "HIGH"
              ? "elevation"
              : "neutral") as SignalTone,
          };
        }
        case "RiskCalculated": {
          const assetId = str(p, "assetId") ?? "";
          const residual = num(p, "residualRisk");
          const inherentScore = num(p, "riskScore");
          const delta =
            inherentScore !== null && residual !== null ? inherentScore - residual : null;
          return {
            ...base,
            headline: `Exposure scored on ${assetNames.get(assetId) ?? "an asset"}`,
            detail:
              inherentScore !== null && residual !== null
                ? `inherent ${inherentScore} → residual ${residual}`
                : null,
            magnitude: delta !== null ? `−${delta} pts by controls` : null,
            tone: (residual !== null && residual >= 50 ? "elevation" : "neutral") as SignalTone,
          };
        }
        case "FinancialExposureQuantified": {
          const loss = num(p, "expectedLoss");
          const assetId = str(p, "assetId") ?? "";
          return {
            ...base,
            headline: `${assetNames.get(assetId) ?? "Asset"} valued in currency terms`,
            detail: "expected annual loss modelled",
            magnitude: loss !== null ? formatCompact(loss) : null,
            tone: "elevation" as SignalTone,
          };
        }
        case "OptimizationExecuted": {
          const reduction = num(p, "riskReduction");
          const cost = num(p, "totalCost");
          const selected = Array.isArray(p.selectedActions) ? p.selectedActions.length : null;
          return {
            ...base,
            headline: "Optimizer resolved a remediation portfolio",
            detail:
              selected !== null && cost !== null
                ? `${selected} action${selected === 1 ? "" : "s"} · ${formatCompact(cost)} committed`
                : null,
            magnitude: reduction !== null ? `−${Math.round(reduction)}% risk` : null,
            tone: "reduction" as SignalTone,
          };
        }
        case "ComplianceMapped": {
          const status = str(p, "gapStatus") ?? "";
          return {
            ...base,
            headline: "Control mapped to an asset",
            detail: str(p, "controlId"),
            magnitude: status || null,
            tone: (status === "GAP" ? "elevation" : "governance") as SignalTone,
          };
        }
        default:
          return {
            ...base,
            headline: event.action.replace(/([a-z])([A-Z])/g, "$1 $2"),
            detail: event.entityType,
            magnitude: null,
            tone: "neutral" as SignalTone,
          };
      }
    });
}

function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(amount) >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ *
 * attention index — replaces a bare "open alerts" count
 * ------------------------------------------------------------------ */

export interface AttentionIndex {
  total: number;
  executive: number;
  operational: number;
  informational: number;
}

export function buildAttentionIndex(risks: Risk[], mappings: ComplianceMapping[], unread: number): AttentionIndex {
  const executive = risks.filter((r) => r.level === "CRITICAL").length + mappings.filter((m) => m.gapStatus === "GAP").length;
  const operational = risks.filter((r) => r.level === "HIGH").length + mappings.filter((m) => m.gapStatus === "PARTIAL").length;
  const informational = unread;
  return {
    total: executive + operational + informational,
    executive,
    operational,
    informational,
  };
}

/* ------------------------------------------------------------------ *
 * asset surface — composition rather than a bare count
 * ------------------------------------------------------------------ */

export interface AssetSurface {
  total: number;
  byCriticality: { level: CriticalityLevel; count: number }[];
  byType: { type: string; count: number; criticalityMean: number }[];
  unscoped: number;
  highValue: number;
}

export function buildAssetSurface(assets: Asset[]): AssetSurface {
  const byType = new Map<string, { count: number; weightSum: number }>();
  for (const a of assets) {
    const entry = byType.get(a.assetType) ?? { count: 0, weightSum: 0 };
    entry.count += 1;
    entry.weightSum += a.criticalityWeight;
    byType.set(a.assetType, entry);
  }

  return {
    total: assets.length,
    byCriticality: CRITICALITY_LEVELS.map((level) => ({
      level,
      count: assets.filter((a) => a.criticality === level).length,
    })),
    byType: [...byType.entries()]
      .map(([type, { count, weightSum }]) => ({
        type,
        count,
        criticalityMean: count > 0 ? weightSum / count : 0,
      }))
      .sort((a, b) => b.count - a.count),
    unscoped: assets.filter((a) => a.regulatoryScope.length === 0).length,
    highValue: assets.filter((a) => a.criticality === "HIGH" || a.criticality === "CRITICAL").length,
  };
}

/* ------------------------------------------------------------------ *
 * constellation graph — assets ↔ risks ↔ controls
 * ------------------------------------------------------------------ */

export type NodeKind = "asset" | "risk" | "control";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** 0..1 — drives radius. */
  weight: number;
  /** Severity key where the node has one; null for controls. */
  severity: string | null;
  x: number;
  y: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface ConstellationGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * A tiny deterministic force layout — repulsion between every pair, springs
 * along links, gentle centring. Deterministic (seeded by node index, no
 * Math.random) so the same institution always renders the same constellation
 * rather than reshuffling on every re-render.
 */
export function buildConstellation(
  assets: Asset[],
  risks: Risk[],
  mappings: ComplianceMapping[],
  width: number,
  height: number
): ConstellationGraph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const maxImpact = Math.max(1, ...risks.map((r) => r.impactAmount));

  assets.forEach((a) => {
    nodes.push({
      id: `a:${a.id}`,
      kind: "asset",
      label: a.name,
      weight: a.criticalityWeight / 4,
      severity: a.criticality,
      x: 0,
      y: 0,
    });
  });

  risks.forEach((r) => {
    nodes.push({
      id: `r:${r.id}`,
      kind: "risk",
      label: `${r.level} · residual ${r.residualScore}`,
      weight: r.impactAmount / maxImpact,
      severity: r.level,
      x: 0,
      y: 0,
    });
    if (assets.some((a) => a.id === r.assetId)) {
      links.push({ source: `a:${r.assetId}`, target: `r:${r.id}` });
    }
  });

  const seenControls = new Set<string>();
  mappings.forEach((m) => {
    const controlNodeId = `c:${m.controlId}`;
    if (!seenControls.has(m.controlId)) {
      seenControls.add(m.controlId);
      nodes.push({
        id: controlNodeId,
        kind: "control",
        label: m.controlId,
        weight: 0.5,
        severity: null,
        x: 0,
        y: 0,
      });
    }
    if (assets.some((a) => a.id === m.assetId)) {
      links.push({ source: `a:${m.assetId}`, target: controlNodeId });
    }
  });

  if (nodes.length === 0) return { nodes, links };

  // Seed on a phyllotaxis spiral scaled to the canvas aspect — even,
  // deterministic, no clumping, and already using the full width.
  const cx = width / 2;
  const cy = height / 2;
  nodes.forEach((n, i) => {
    const angle = i * 2.399963; // golden angle
    const t = Math.sqrt((i + 0.5) / nodes.length);
    n.x = cx + t * (width * 0.46) * Math.cos(angle);
    n.y = cy + t * (height * 0.46) * Math.sin(angle);
  });

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const ITERATIONS = 220;
  // Repulsion scales with the canvas area per node, so the same simulation
  // fills a wide panel and a narrow one alike instead of always collapsing
  // into a tight ball in the middle.
  const areaPerNode = (width * height) / nodes.length;
  const repulsion = areaPerNode * 0.55;
  const restLength = Math.sqrt(areaPerNode) * 0.62;

  for (let step = 0; step < ITERATIONS; step++) {
    const cooling = 1 - step / ITERATIONS;

    // pairwise repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = (i % 3) - 1 || 0.5;
          dy = (j % 3) - 1 || 0.5;
          dist = Math.hypot(dx, dy);
        }
        const force = (repulsion * cooling) / (dist * dist);
        const ux = (dx / dist) * force;
        const uy = (dy / dist) * force;
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
      }
    }

    // spring along links
    for (const link of links) {
      const ai = index.get(link.source);
      const bi = index.get(link.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nodes[ai];
      const b = nodes[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const pull = ((dist - restLength) / dist) * 0.055 * cooling;
      const ux = dx * pull;
      const uy = dy * pull;
      a.x += ux;
      a.y += uy;
      b.x -= ux;
      b.y -= uy;
    }

    // very gentle centring — enough to stop drift, not enough to clump
    for (const n of nodes) {
      n.x += (cx - n.x) * 0.004 * cooling;
      n.y += (cy - n.y) * 0.004 * cooling;
    }
  }

  // Fit the settled layout to the canvas. Scaling the *result* (rather than
  // tuning forces until it happens to fill) makes the graph use the whole
  // panel at any size, which is what stops it reading as a tiny blob.
  const margin = 34;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  // one uniform scale for both axes — anisotropic scaling would distort the
  // distances the layout just solved for
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  for (const n of nodes) {
    n.x = offsetX + (n.x - minX) * scale;
    n.y = offsetY + (n.y - minY) * scale;
  }

  return { nodes, links };
}

/* ------------------------------------------------------------------ *
 * intelligence briefing — the analyst report
 * ------------------------------------------------------------------ */

export interface BriefingLine {
  id: string;
  tone: SignalTone;
  text: string;
}

/**
 * Writes only statements it can back with data that is actually present.
 * An institution with nothing loaded gets an empty briefing, not filler.
 */
export function buildBriefing(input: {
  assets: Asset[];
  risks: Risk[];
  mappings: ComplianceMapping[];
  river: RiverPoint[];
  qRisk: number;
}): BriefingLine[] {
  const { assets, risks, mappings, river, qRisk } = input;
  const lines: BriefingLine[] = [];

  if (assets.length === 0) return lines;

  const surface = buildAssetSurface(assets);
  if (surface.highValue > 0) {
    lines.push({
      id: "high-value",
      tone: "elevation",
      text: `${surface.highValue} of ${surface.total} tracked asset${surface.total === 1 ? "" : "s"} sit at high or critical criticality — they carry the institution's concentrated exposure.`,
    });
  }

  const unscored = assets.filter((a) => !risks.some((r) => r.assetId === a.id));
  if (unscored.length > 0) {
    lines.push({
      id: "unscored",
      tone: "neutral",
      text: `${unscored.length} asset${unscored.length === 1 ? " has" : "s have"} never been scored. Until they are, they contribute nothing to Q-Risk and their exposure is unmeasured, not zero.`,
    });
  }

  const latest = river[river.length - 1];
  if (latest && latest.inherent > 0) {
    const controlsRemoved = latest.inherent - latest.residual;
    const pct = Math.round((controlsRemoved / latest.inherent) * 100);
    lines.push({
      id: "control-effect",
      tone: "reduction",
      text: `Existing controls absorb ${pct}% of modelled inherent exposure, leaving ${formatCompact(latest.residual)} residual across scored assets.`,
    });
  }

  if (latest && latest.expectedLoss > 0) {
    lines.push({
      id: "eal",
      tone: "elevation",
      text: `Expected annual loss quantified at ${formatCompact(latest.expectedLoss)} across the risks priced so far this session.`,
    });
  }

  const gaps = mappings.filter((m) => m.gapStatus === "GAP").length;
  const partial = mappings.filter((m) => m.gapStatus === "PARTIAL").length;
  if (mappings.length > 0) {
    lines.push({
      id: "regulatory",
      tone: gaps > 0 ? "elevation" : "governance",
      text:
        gaps > 0
          ? `${gaps} mapped control${gaps === 1 ? " is" : "s are"} in an outright gap state and ${partial} partially satisfied — each one is a traceable regulatory finding.`
          : `${mappings.length} control mapping${mappings.length === 1 ? "" : "s"} in place, ${partial} partially satisfied. No outright gaps on mapped controls.`,
    });
  } else {
    lines.push({
      id: "regulatory-none",
      tone: "neutral",
      text: "No controls mapped yet — regulatory coverage is currently unproven for every asset on the surface.",
    });
  }

  lines.push({
    id: "qrisk",
    tone: qRisk >= 75 ? "reduction" : qRisk >= 50 ? "neutral" : "elevation",
    text: `Q-Risk stands at ${Math.round(qRisk)}/100, composed today from asset coverage and residual risk health only — compliance and quantum-readiness inputs are disclosed as pending, not silently assumed.`,
  });

  return lines;
}

/* ------------------------------------------------------------------ *
 * pareto frontier — the optimizer's decision surface
 * ------------------------------------------------------------------ */

export interface FrontierPoint {
  cost: number;
  reduction: number;
  label: string;
  onFrontier: boolean;
  selected: boolean;
}

/**
 * Given candidate actions, enumerates the achievable (cost, reduction) space
 * greedily by efficiency and marks the non-dominated set. This is the same
 * ordering the server's greedy solver uses, so the frontier drawn here is the
 * decision surface the optimizer actually walked — not a decorative curve.
 */
export function buildFrontier(
  actions: { actionId: string; label: string; cost: number; riskReductionPercent: number }[],
  selectedIds: Set<string>
): FrontierPoint[] {
  if (actions.length === 0) return [];

  const byEfficiency = [...actions].sort(
    (a, b) => b.riskReductionPercent / b.cost - a.riskReductionPercent / a.cost
  );

  const points: FrontierPoint[] = [];
  let cost = 0;
  let reduction = 0;
  points.push({ cost: 0, reduction: 0, label: "No action", onFrontier: true, selected: false });

  for (const action of byEfficiency) {
    cost += action.cost;
    reduction = Math.min(100, reduction + action.riskReductionPercent);
    points.push({
      cost,
      reduction,
      label: action.label,
      onFrontier: true,
      selected: selectedIds.has(action.actionId),
    });
  }

  return points;
}

/* ------------------------------------------------------------------ *
 * quantum scanner — crypto exposure telemetry
 * ------------------------------------------------------------------ */

export const QARS_RISK_LEVELS: QarsRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** QARS shares KAIRON's one 4-band severity vocabulary (LOW/MEDIUM/HIGH/CRITICAL) end to end. */
export const QARS_LEVEL_VAR = SEVERITY_VAR;

export const STRENGTH_ORDER: CryptoStrength[] = ["BROKEN", "WEAK", "UNKNOWN", "ACCEPTABLE", "STRONG", "QUANTUM_SAFE"];

/** A crypto STRENGTH band is its own severity scale, reusing the sequential
 * indigo ramp for "distance from quantum-safe" rather than the categorical
 * severity colours — strength is an ordinal magnitude, not an identity. */
export function strengthRampColor(strength: CryptoStrength): string {
  const i = STRENGTH_ORDER.indexOf(strength);
  if (i < 0) return INDIGO_RAMP[0];
  // BROKEN/WEAK read as danger (severity red/orange); ACCEPTABLE and up read
  // on the indigo ramp — the two ends of the QARS story are different colours
  // for a reason: "broken now" is a severity fact, "how quantum-ready" is a
  // magnitude fact.
  if (strength === "BROKEN") return "var(--sev-critical)";
  if (strength === "WEAK") return "var(--sev-high)";
  if (strength === "UNKNOWN") return "var(--ink-faint)";
  if (strength === "ACCEPTABLE") return INDIGO_RAMP[2];
  if (strength === "STRONG") return INDIGO_RAMP[4];
  return "var(--sev-low)"; // QUANTUM_SAFE
}

export const CRYPTO_ASSET_TYPE_LABEL: Record<CryptoAssetType, string> = {
  TLS_VERSION: "TLS version",
  CIPHER_SUITE: "Cipher suite",
  KEY_EXCHANGE: "Key exchange",
  CERTIFICATE: "Certificate",
  SIGNATURE: "Signature",
  HASH_ALGORITHM: "Hash algorithm",
};

export const ALGORITHM_CATEGORY_LABEL: Record<AlgorithmCategory, string> = {
  CLASSICAL: "Classical",
  HYBRID_PQC: "Hybrid PQC",
  PQC: "Post-quantum",
  UNKNOWN: "Unknown",
};

export interface CryptoInventoryRow {
  assetType: CryptoAssetType;
  label: string;
  cellsByStrength: { strength: CryptoStrength; count: number }[];
  total: number;
}

/**
 * Cryptographic Bill of Materials, aggregated as asset-type x strength-band —
 * the same shape the reference scanner's CBOM report table takes, redrawn as
 * a heat matrix. Every count comes from findings inside real ScanResults;
 * an asset type with zero findings across the whole estate is simply absent
 * from the matrix rather than padded in as a zero row.
 */
export function buildCryptoInventory(scans: ScanResult[]): CryptoInventoryRow[] {
  const byType = new Map<CryptoAssetType, Map<CryptoStrength, number>>();

  for (const scan of scans) {
    for (const finding of scan.findings) {
      const strengths = byType.get(finding.assetType) ?? new Map<CryptoStrength, number>();
      strengths.set(finding.strength, (strengths.get(finding.strength) ?? 0) + 1);
      byType.set(finding.assetType, strengths);
    }
  }

  const rows: CryptoInventoryRow[] = [];
  for (const [assetType, strengths] of byType) {
    const cellsByStrength = STRENGTH_ORDER.map((strength) => ({ strength, count: strengths.get(strength) ?? 0 }));
    rows.push({
      assetType,
      label: CRYPTO_ASSET_TYPE_LABEL[assetType],
      cellsByStrength,
      total: cellsByStrength.reduce((sum, c) => sum + c.count, 0),
    });
  }

  // Fixed display order (protocol -> primitive), not insertion order.
  const order: CryptoAssetType[] = ["TLS_VERSION", "CIPHER_SUITE", "KEY_EXCHANGE", "CERTIFICATE", "SIGNATURE", "HASH_ALGORITHM"];
  return rows.sort((a, b) => order.indexOf(a.assetType) - order.indexOf(b.assetType));
}

export interface ExposurePeak {
  scan: ScanResult;
  assetName: string;
}

/**
 * Orders scan results worst-QARS-first for the exposure terrain — the same
 * "sorted by what matters most, read left to right" convention RiskTopography
 * uses, just walking the QARS score (low = dangerous) instead of ₹ exposure.
 */
export function buildScanExposureOrder(scans: ScanResult[], assetNames: Map<string, string>): ExposurePeak[] {
  return [...scans]
    .sort((a, b) => a.qars.score - b.qars.score)
    .map((scan) => ({ scan, assetName: assetNames.get(scan.assetId) ?? "Unknown asset" }));
}
