import { useEffect, useState } from "react";
import { listAuditEvents } from "../lib/endpoints";
import type { AuditEvent } from "../types/api";
import "./audit-page.css";

function formatAction(action: string): string {
  return action.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listAuditEvents(1, 100, {
      entityType: entityType || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    })
      .then((page) => setEvents(page.items))
      .catch(() => setError("Couldn't load the audit trail — the API may not be reachable."));
  }

  useEffect(reload, []);

  const entityTypes = Array.from(new Set((events ?? []).map((e) => e.entityType)));

  return (
    <div className="audit-page">
      <form
        className="audit-page__filters"
        onSubmit={(e) => {
          e.preventDefault();
          reload();
        }}
      >
        <label className="form-field">
          <span className="eyebrow">Entity type</span>
          <select className="form-select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span className="eyebrow">From</span>
          <input className="form-input num" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="form-field">
          <span className="eyebrow">To</span>
          <input className="form-input num" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="form-button form-button--ghost">
          Apply
        </button>
      </form>

      {error ? (
        <div className="data-table__empty">{error}</div>
      ) : events === null ? (
        <div className="data-table__empty">Loading…</div>
      ) : events.length === 0 ? (
        <div className="data-table__empty">No events recorded yet — actions across the platform appear here as they happen.</div>
      ) : (
        <ol className="audit-timeline">
          {events.map((event) => (
            <li key={event.id} className="audit-timeline__item">
              <div className="audit-timeline__time num">{new Date(event.timestamp).toLocaleString()}</div>
              <div className="audit-timeline__body">
                <div className="audit-timeline__headline">
                  <span className="audit-timeline__action">{formatAction(event.action)}</span>
                  <span className="audit-timeline__entity">{event.entityType}</span>
                </div>
                <div className="audit-timeline__meta">
                  {event.actor.displayName} · <span className="num">{event.entityId}</span> ·{" "}
                  <span className="num">{event.tenantId}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
