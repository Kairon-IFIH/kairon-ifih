import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { KpiCard } from "../components/KpiCard";
import { QRiskGauge } from "../components/QRiskGauge";
import { listAssets, listRisks, getQRisk, listAuditEvents, listNotifications } from "../lib/endpoints";
import { formatCompactINR } from "../lib/format";
import type { AuditEvent, RiskLevel } from "../types/api";
import "./dashboard-page.css";

const LEVEL_ORDER: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const LEVEL_COLOR: Record<RiskLevel, string> = {
  CRITICAL: "var(--severity-critical)",
  HIGH: "var(--severity-high)",
  MEDIUM: "var(--severity-medium)",
  LOW: "var(--severity-low)",
};

interface DashboardData {
  totalAssets: number;
  highRiskCount: number;
  modeledImpact: number;
  openAlerts: number;
  qRisk: number;
  riskDistribution: { level: RiskLevel; count: number }[];
  recentEvents: AuditEvent[];
}

function formatAction(action: string): string {
  return action.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kpiRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAssets(1, 1), listRisks(1, 100), getQRisk(), listAuditEvents(1, 5), listNotifications(true, 1, 1)])
      .then(([assets, risks, qRisk, audit, unread]) => {
        if (cancelled) return;
        const highRiskCount = risks.items.filter((r) => r.level === "HIGH" || r.level === "CRITICAL").length;
        const modeledImpact = risks.items.reduce((sum, r) => sum + r.impactAmount, 0);
        const distribution = LEVEL_ORDER.map((level) => ({
          level,
          count: risks.items.filter((r) => r.level === level).length,
        }));
        setData({
          totalAssets: assets.total,
          highRiskCount,
          modeledImpact,
          openAlerts: unread.total,
          qRisk: qRisk.qRisk,
          riskDistribution: distribution,
          recentEvents: audit.items,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the dashboard — the API may not be reachable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || !kpiRowRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = kpiRowRef.current.children;
    if (reduceMotion) return;
    gsap.set(cards, { willChange: "transform" });
    gsap.from(cards, {
      opacity: 0,
      y: 12,
      duration: 0.45,
      stagger: 0.1,
      ease: "power2.out",
      clearProps: "willChange",
    });
  }, [data]);

  if (error) {
    return (
      <div className="dashboard-empty">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="dashboard-empty">Loading dashboard…</div>;
  }

  const maxCount = Math.max(1, ...data.riskDistribution.map((d) => d.count));

  return (
    <div className="dashboard">
      <aside className="dashboard__gauge-panel">
        <QRiskGauge score={data.qRisk} />
        <p className="dashboard__gauge-note">
          Composed from asset coverage and residual risk health. Compliance and quantum-readiness factors join once
          those signals are wired in.
        </p>
      </aside>

      <div className="dashboard__main">
        <div className="dashboard__kpi-row" ref={kpiRowRef}>
          <KpiCard label="Total Assets" value={String(data.totalAssets)} accent="data" />
          <KpiCard
            label="High &amp; Critical Risks"
            value={String(data.highRiskCount)}
            accent={data.highRiskCount > 0 ? "risk" : "safe"}
          />
          <KpiCard label="Modeled Impact" value={formatCompactINR(data.modeledImpact)} accent="warn" hint="Sum of assessed risk impact" />
          <KpiCard
            label="Open Alerts"
            value={String(data.openAlerts)}
            accent={data.openAlerts > 0 ? "risk" : "safe"}
            hint="Unread notifications"
          />
        </div>

        <section className="dashboard__panel">
          <h2 className="dashboard__panel-title">Risk distribution</h2>
          {data.riskDistribution.every((d) => d.count === 0) ? (
            <p className="dashboard__empty-hint">
              No risks calculated yet — <Link to="/risks">calculate a risk</Link> for an asset to see it here.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.riskDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border-hairline)" vertical={false} />
                <XAxis
                  dataKey="level"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11, fontFamily: "var(--font-ui)" }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, maxCount]}
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={56}>
                  {data.riskDistribution.map((d) => (
                    <Cell key={d.level} fill={LEVEL_COLOR[d.level]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="dashboard__panel">
          <h2 className="dashboard__panel-title">Recent audit events</h2>
          {data.recentEvents.length === 0 ? (
            <p className="dashboard__empty-hint">
              No activity recorded yet — actions across the platform will appear here as they happen.
            </p>
          ) : (
            <ul className="dashboard__feed">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="dashboard__feed-item">
                  <span className="dashboard__feed-time num">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="dashboard__feed-action">{formatAction(event.action)}</span>
                  <span className="dashboard__feed-entity">{event.entityType}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
