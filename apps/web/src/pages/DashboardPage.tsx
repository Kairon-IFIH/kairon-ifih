import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExecutiveStrip, Readout, Sparkline } from "../components/ExecutiveStrip";
import { Panel, Legend, LegendItem, EmptyState } from "../components/Panel";
import { RiskHealthSpectrum } from "../components/viz/RiskHealthSpectrum";
import { ExposureRiver } from "../components/viz/ExposureRiver";
import { RiskConstellation } from "../components/viz/RiskConstellation";
import { SignalFeed } from "../components/viz/SignalFeed";
import { IntelligenceBriefing } from "../components/viz/IntelligenceBriefing";
import {
  listAssets,
  listRisks,
  getQRisk,
  listAuditEvents,
  listNotifications,
  runGapAnalysis,
  getAiOverview,
} from "../lib/endpoints";
import { formatCompactINR } from "../lib/format";
import {
  buildAttentionIndex,
  buildAssetSurface,
  buildBriefing,
  buildExposureRiver,
  buildSignalFeed,
} from "../lib/intelligence";
import type { Asset, AuditEvent, ComplianceMapping, Risk } from "../types/api";
import "./dashboard-page.css";

interface Loaded {
  assets: Asset[];
  risks: Risk[];
  qRisk: number;
  events: AuditEvent[];
  unread: number;
  mappings: ComplianceMapping[];
}

export function DashboardPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAssets(1, 100),
      listRisks(1, 100),
      getQRisk(),
      listAuditEvents(1, 100),
      listNotifications(true, 1, 1),
      runGapAnalysis(1, 100),
    ])
      .then(([assets, risks, qRisk, audit, unread, gaps]) => {
        if (cancelled) return;
        setData({
          assets: assets.items,
          risks: risks.items,
          qRisk: qRisk.qRisk,
          events: audit.items,
          unread: unread.total,
          mappings: gaps.items,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the API. Confirm the backend is running on port 3000.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const river = buildExposureRiver(data.events);
    const assetNames = new Map(data.assets.map((a) => [a.id, a.name]));
    const surface = buildAssetSurface(data.assets);
    const attention = buildAttentionIndex(data.risks, data.mappings, data.unread);
    const latest = river[river.length - 1];

    const residualPool = data.risks.reduce((sum, r) => sum + r.impactAmount * (r.residualScore / 100), 0);
    const inherentPool = data.risks.reduce((sum, r) => sum + r.impactAmount * (r.inherentScore / 100), 0);
    const absorbed = inherentPool - residualPool;

    const compliant = data.mappings.filter((m) => m.gapStatus === "COMPLIANT").length;
    const partial = data.mappings.filter((m) => m.gapStatus === "PARTIAL").length;
    const gaps = data.mappings.filter((m) => m.gapStatus === "GAP").length;
    const regulatoryHealth =
      data.mappings.length === 0 ? null : Math.round(((compliant + partial * 0.5) / data.mappings.length) * 100);

    return {
      river,
      assetNames,
      surface,
      attention,
      latest,
      residualPool,
      inherentPool,
      absorbed,
      compliant,
      partial,
      gaps,
      regulatoryHealth,
      signals: buildSignalFeed(data.events, assetNames),
      briefing: buildBriefing({
        assets: data.assets,
        risks: data.risks,
        mappings: data.mappings,
        river,
        qRisk: data.qRisk,
      }),
    };
  }, [data]);

  if (error) {
    return (
      <Panel title="Connection lost" eyebrow="System">
        <EmptyState>{error}</EmptyState>
      </Panel>
    );
  }

  if (!data || !derived) {
    return <div className="dash__loading">Reading institutional state…</div>;
  }

  const scoredAssetIds = new Set(data.risks.map((r) => r.assetId));
  const unscored = data.assets.filter((a) => !scoredAssetIds.has(a.id)).length;
  const riverTrend = derived.river.map((p) => p.residual);
  const exposureRising = riverTrend.length > 1 && riverTrend[riverTrend.length - 1] > riverTrend[0];

  return (
    <div className="dash">
      {/* ── Current state ─────────────────────────────────────────────── */}
      <ExecutiveStrip>
        <Readout
          lead
          label="Q-Risk"
          value={String(Math.round(data.qRisk))}
          unit="/ 100"
          direction={{
            tone: data.qRisk >= 75 ? "down" : data.qRisk >= 50 ? "flat" : "up",
            text:
              data.qRisk >= 75
                ? "healthy band"
                : data.qRisk >= 50
                  ? "adequate, watch residuals"
                  : "attention required",
          }}
          parts={[
            { label: "Assets covered", value: String(derived.surface.total) },
            { label: "Never scored", value: String(unscored) },
          ]}
        />

        <Readout
          label="Residual exposure"
          value={derived.residualPool > 0 ? formatCompactINR(derived.residualPool) : "—"}
          direction={
            derived.river.length > 1
              ? {
                  tone: exposureRising ? "up" : "down",
                  text: exposureRising ? "accumulating this session" : "reduced this session",
                }
              : undefined
          }
          visual={riverTrend.length > 1 ? <Sparkline values={riverTrend} color="var(--indigo-600)" /> : undefined}
          parts={[
            { label: "Inherent modelled", value: derived.inherentPool > 0 ? formatCompactINR(derived.inherentPool) : "—" },
            { label: "Absorbed by controls", value: derived.absorbed > 0 ? formatCompactINR(derived.absorbed) : "—" },
          ]}
        />

        <Readout
          label="Regulatory health"
          value={derived.regulatoryHealth !== null ? `${derived.regulatoryHealth}%` : "Unproven"}
          direction={
            derived.regulatoryHealth === null
              ? { tone: "flat", text: "no controls mapped yet" }
              : derived.gaps > 0
                ? { tone: "up", text: `${derived.gaps} open gap${derived.gaps === 1 ? "" : "s"}` }
                : { tone: "down", text: "no outright gaps" }
          }
          parts={[
            { label: "Compliant", value: String(derived.compliant) },
            { label: "Partial", value: String(derived.partial) },
            { label: "Gap", value: String(derived.gaps) },
          ]}
        />

        <Readout
          label="Attention index"
          value={String(derived.attention.total)}
          unit="signals"
          direction={
            derived.attention.executive > 0
              ? { tone: "up", text: `${derived.attention.executive} need executive review` }
              : { tone: "flat", text: "nothing at executive level" }
          }
          parts={[
            { label: "Executive", value: String(derived.attention.executive) },
            { label: "Operational", value: String(derived.attention.operational) },
            { label: "Informational", value: String(derived.attention.informational) },
          ]}
        />
      </ExecutiveStrip>

      {/* ── The landscape: relationships, not counts ──────────────────── */}
      <Panel
        eyebrow="Institution risk landscape"
        title="Risk constellation"
        caption="Every tracked asset, the risks scored against it and the controls mapped to it. Concentration is the signal: a dense cluster is where exposure pools, an isolated node is something nothing is watching."
        bleed
        aside={
          <Legend>
            <LegendItem shape="dot" color="var(--ink-muted)" label="Asset" />
            <LegendItem shape="diamond" color="var(--ink-muted)" label="Scored risk" />
            <LegendItem shape="ring" label="Control" />
          </Legend>
        }
      >
        {data.assets.length === 0 ? (
          <EmptyState>
            The surface is empty. <Link to="/assets">Register an asset</Link> and the constellation forms around it —
            risks and controls attach as you score and map them.
          </EmptyState>
        ) : (
          <RiskConstellation assets={data.assets} risks={data.risks} mappings={data.mappings} />
        )}
      </Panel>

      {/* ── Why it happened ───────────────────────────────────────────── */}
      <div className="dash__split">
        <Panel
          eyebrow="Exposure"
          title="Exposure river"
          caption="Cumulative modelled exposure across the recorded event history. Every vertex is a real audit event — nothing between them is interpolated."
          aside={
            <Legend>
              <LegendItem color="var(--indigo-600)" label="Residual" />
              <LegendItem color="var(--indigo-200)" label="Absorbed by controls" />
            </Legend>
          }
        >
          {derived.river.length < 2 ? (
            <EmptyState>
              Not enough recorded history to draw a river yet. Score a risk or quantify an exposure and the log starts
              building a real series — this chart never back-fills one.
            </EmptyState>
          ) : (
            <ExposureRiver points={derived.river} />
          )}
        </Panel>

        <Panel
          eyebrow="Board metric"
          title="Risk health spectrum"
          caption="Where the institution sits within the defined bands, and what the score is currently made of."
        >
          <RiskHealthSpectrum
            score={data.qRisk}
            composition={[
              { label: "Asset coverage", state: "live" },
              { label: "Residual risk health", state: "live" },
              { label: "Compliance coverage", state: "pending" },
              { label: "Operational resilience", state: "pending" },
              { label: "Quantum readiness", state: "pending" },
            ]}
          />
        </Panel>
      </div>

      {/* ── What to do next ───────────────────────────────────────────── */}
      <div className="dash__split dash__split--wide-left">
        <Panel
          eyebrow="Today's signals"
          title="Intelligence briefing"
          caption="Generated from current platform state. Statements the data cannot support are not written."
        >
          {derived.briefing.length === 0 ? (
            <EmptyState>
              Nothing to brief on yet — the briefing writes only what the data supports, so it stays silent until there
              is an institution to describe.
            </EmptyState>
          ) : (
            <IntelligenceBriefing lines={derived.briefing} generatedAt={new Date()} />
          )}
        </Panel>

        <Panel eyebrow="Live tape" title="Signal feed" bleed>
          {derived.signals.length === 0 ? (
            <EmptyState>No movements recorded. Every state change across the platform prints here as it happens.</EmptyState>
          ) : (
            <div className="dash__tape">
              <SignalFeed signals={derived.signals} limit={40} />
            </div>
          )}
        </Panel>
      </div>

      <Panel
        eyebrow="AI overview"
        title="What to do next"
        caption="Generated on demand by Gemini from the metrics currently on this screen."
      >
        {aiText ? (
          <div className="dash__ai-text">
            {aiText.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <EmptyState>
            {aiError ?? "No overview generated yet — click below to have Gemini summarize the current risk posture."}
          </EmptyState>
        )}
        <button
          type="button"
          className="form-button dash__ai-button"
          disabled={aiLoading}
          onClick={async () => {
            setAiLoading(true);
            setAiError(null);
            try {
              const { text } = await getAiOverview({
                qRisk: data.qRisk,
                residualExposure: derived.residualPool,
                inherentExposure: derived.inherentPool,
                regulatoryHealthPercent: derived.regulatoryHealth,
                attentionIndex: derived.attention,
                assetsTotal: data.assets.length,
                risksScored: data.risks.length,
                complianceGaps: derived.gaps,
                compliancePartial: derived.partial,
              });
              setAiText(text);
            } catch {
              setAiError("Couldn't generate an overview right now.");
            } finally {
              setAiLoading(false);
            }
          }}
        >
          {aiLoading ? "Generating…" : aiText ? "Regenerate" : "Generate overview"}
        </button>
      </Panel>
    </div>
  );
}
