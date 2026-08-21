import { useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import type { AuditEvent } from "../../types/api";
import "./event-ribbon.css";

/**
 * Event Ribbon — the audit log as a strip of activity through time.
 *
 * One tick per recorded event, positioned by its real timestamp, stacked when
 * events collide. Bursts are visible as dense bands: a long quiet stretch
 * followed by a wall of ticks is exactly the shape of "someone ran a bulk
 * import", and that pattern is invisible in a paginated table.
 */

const HEIGHT = 92;
const PAD = { top: 12, right: 12, bottom: 22, left: 12 };

const ACTION_COLOR: Record<string, string> = {
  AssetDiscovered: "var(--indigo-400)",
  AssetClassified: "var(--indigo-300)",
  RiskCalculated: "var(--sev-high)",
  FinancialExposureQuantified: "var(--sev-medium)",
  ComplianceMapped: "var(--indigo-600)",
  OptimizationExecuted: "var(--sev-low)",
  RemediationApproved: "var(--sev-low)",
};

export function EventRibbon({ events }: { events: AuditEvent[] }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<number | null>(null);

  if (events.length === 0 || width === 0) {
    return <div className="ribbon" ref={ref} style={{ height: HEIGHT }} />;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const t0 = new Date(sorted[0].timestamp).getTime();
  const t1 = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const span = Math.max(1, t1 - t0);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // stack collisions so a burst reads as height rather than overprinting
  const columnCounts = new Map<number, number>();
  const ticks = sorted.map((e, i) => {
    const t = new Date(e.timestamp).getTime();
    const x = PAD.left + ((t - t0) / span) * plotW;
    const col = Math.round(x / 5);
    const depth = columnCounts.get(col) ?? 0;
    columnCounts.set(col, depth + 1);
    return { event: e, index: i, x, depth };
  });

  const maxDepth = Math.max(1, ...[...columnCounts.values()]);
  const tickH = Math.min(11, plotH / maxDepth - 1.5);

  return (
    <div className="ribbon" ref={ref}>
      <svg width={width} height={HEIGHT} className="ribbon__svg" role="img" aria-label="Audit events over time">
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          className="ribbon__base"
        />

        {ticks.map((tick) => (
          <rect
            key={tick.event.id}
            x={tick.x - 1.5}
            y={PAD.top + plotH - (tick.depth + 1) * (tickH + 1.5)}
            width={3}
            height={tickH}
            rx="1.5"
            fill={ACTION_COLOR[tick.event.action] ?? "var(--ink-faint)"}
            className="ribbon__tick"
            data-dim={hover !== null && hover !== tick.index ? "true" : undefined}
          />
        ))}

        {ticks.map((tick) => (
          <rect
            key={`hit-${tick.event.id}`}
            x={tick.x - 6}
            y={PAD.top}
            width={12}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(tick.index)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        <text x={PAD.left} y={HEIGHT - 6} className="ribbon__tick-label num">
          {new Date(t0).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </text>
        <text x={width - PAD.right} y={HEIGHT - 6} className="ribbon__tick-label num" textAnchor="end">
          {new Date(t1).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </text>
      </svg>

      {hover !== null && ticks[hover] && (
        <div
          className="ribbon__tip"
          style={{ left: Math.min(Math.max(ticks[hover].x, 100), Math.max(100, width - 100)) }}
        >
          <b>{ticks[hover].event.action.replace(/([a-z])([A-Z])/g, "$1 $2")}</b>
          <span className="num">
            {new Date(ticks[hover].event.timestamp).toLocaleTimeString([], { hour12: false })}
          </span>
        </div>
      )}
    </div>
  );
}

export { ACTION_COLOR };
