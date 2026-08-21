import { useEffect, useMemo, useState } from "react";
import { Panel, EmptyState, Legend, LegendItem } from "../components/Panel";
import { ExecutiveStrip, Readout } from "../components/ExecutiveStrip";
import { EventRibbon, ACTION_COLOR } from "../components/viz/EventRibbon";
import { SignalFeed } from "../components/viz/SignalFeed";
import { listAuditEvents, listAssets } from "../lib/endpoints";
import { buildSignalFeed } from "../lib/intelligence";
import type { AuditEvent } from "../types/api";
import "./audit-page.css";

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [assetNames, setAssetNames] = useState<Map<string, string>>(new Map());
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reload() {
    Promise.all([
      listAuditEvents(1, 100, {
        entityType: entityType || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
      listAssets(1, 100),
    ])
      .then(([page, assets]) => {
        setEvents(page.items);
        setAssetNames(new Map(assets.items.map((a) => [a.id, a.name])));
      })
      .catch(() => setError("Couldn't load the audit trail — the API may not be reachable."));
  }

  useEffect(reload, [entityType, from, to]);

  const list = events ?? [];
  const signals = useMemo(() => buildSignalFeed(list, assetNames), [list, assetNames]);

  const entityTypes = useMemo(() => [...new Set(list.map((e) => e.entityType))].sort(), [list]);
  const actionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.action, (m.get(e.action) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const actors = useMemo(() => new Set(list.map((e) => e.actor.displayName)), [list]);
  const span = useMemo(() => {
    if (list.length < 2) return null;
    const times = list.map((e) => new Date(e.timestamp).getTime());
    const ms = Math.max(...times) - Math.min(...times);
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    return `${Math.round(ms / 3_600_000)}h`;
  }, [list]);

  return (
    <div className="audit">
      <ExecutiveStrip>
        <Readout
          lead
          label="Recorded events"
          value={String(list.length)}
          direction={{ tone: "flat", text: "append-only — nothing here can be edited" }}
          parts={actionCounts.slice(0, 3).map(([action, count]) => ({
            label: action.replace(/([a-z])([A-Z])/g, "$1 $2"),
            value: String(count),
          }))}
        />
        <Readout
          label="Entity types touched"
          value={String(entityTypes.length)}
          parts={entityTypes.slice(0, 4).map((t) => ({
            label: t,
            value: String(list.filter((e) => e.entityType === t).length),
          }))}
        />
        <Readout label="Distinct actors" value={String(actors.size)} unit="principals" parts={[...actors].slice(0, 3).map((a) => ({ label: a, value: "" }))} />
        <Readout
          label="Window covered"
          value={span ?? "—"}
          direction={{ tone: "flat", text: "from first to last recorded event" }}
        />
      </ExecutiveStrip>

      <div className="filter-bar">
        <span className="filter-bar__label">Scope</span>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input className="form-input num audit__date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input className="form-input num audit__date" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <span className="filter-bar__spacer" />
        <button
          type="button"
          className="form-button form-button--ghost"
          onClick={() => {
            setEntityType("");
            setFrom("");
            setTo("");
          }}
        >
          Reset
        </button>
      </div>

      <Panel
        eyebrow="Activity"
        title="Event ribbon"
        caption="One tick per recorded event, placed by its real timestamp and stacked where events collide. Bursts read as dense bands — a shape a paginated table cannot show."
        aside={
          <Legend>
            {Object.entries(ACTION_COLOR)
              .filter(([action]) => list.some((e) => e.action === action))
              .map(([action, color]) => (
                <LegendItem key={action} color={color} label={action.replace(/([a-z])([A-Z])/g, "$1 $2")} />
              ))}
          </Legend>
        }
      >
        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : events === null ? (
          <EmptyState>Reading the trail…</EmptyState>
        ) : list.length === 0 ? (
          <EmptyState>No events in this window.</EmptyState>
        ) : (
          <EventRibbon events={list} />
        )}
      </Panel>

      <Panel eyebrow="Ledger" title="Event stream" bleed>
        {list.length === 0 ? (
          <EmptyState>
            Nothing recorded in this window. Every state change across the platform lands here as it happens.
          </EmptyState>
        ) : (
          <SignalFeed signals={signals} />
        )}
      </Panel>
    </div>
  );
}
