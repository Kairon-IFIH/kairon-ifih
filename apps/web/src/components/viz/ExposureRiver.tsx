import { useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { formatCompactINR } from "../../lib/format";
import type { RiverPoint } from "../../lib/intelligence";
import "./exposure-river.css";

/**
 * Exposure River — how the institution's modelled exposure accumulated, and
 * how much of it controls absorb, read straight off the event-sourced audit
 * log. Every vertex is a real event; nothing is interpolated between them.
 *
 * Two stacked bands, one axis (both are rupees — never a second y-scale):
 *   residual  — what survives existing controls
 *   absorbed  — inherent minus residual, the part controls remove
 *
 * A 2px surface gap separates the fills instead of a stroke border.
 */

const PAD = { top: 14, right: 16, bottom: 26, left: 60 };
const HEIGHT = 260;

export function ExposureRiver({ points }: { points: RiverPoint[] }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  if (points.length === 0 || width === 0) {
    return <div className="river" ref={ref} style={{ height: HEIGHT }} />;
  }

  const maxTotal = Math.max(1, ...points.map((p) => p.inherent));
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH * (1 - v / maxTotal);

  // Build the two stacked bands. `residual` sits on the baseline; `absorbed`
  // stacks above it up to `inherent`.
  const residualArea = areaPath(points.map((p, i) => [x(i), y(p.residual)]), y(0));
  const absorbedArea = bandPath(
    points.map((p, i) => [x(i), y(p.inherent)]),
    points.map((p, i) => [x(i), y(p.residual)])
  );
  const inherentLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.inherent)}`).join(" ");

  const ticks = niceTicks(maxTotal, 4);
  const active = hover !== null ? points[hover] : null;
  const sameInstant = points.length > 1 && points[0].label === points[points.length - 1].label;

  return (
    <div className="river" ref={ref}>
      <svg
        width={width}
        height={HEIGHT}
        className="river__svg"
        role="img"
        aria-label="Cumulative modelled exposure over the recorded event history"
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive solid hairline grid — never dashed */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="river__grid" />
            <text x={PAD.left - 10} y={y(t)} className="river__ytick num" textAnchor="end" dominantBaseline="middle">
              {formatCompactINR(t)}
            </text>
          </g>
        ))}

        <path d={residualArea} className="river__fill river__fill--residual" />
        {/* the 2px gap between stacked fills */}
        <path d={absorbedArea} className="river__fill river__fill--absorbed" />
        <path d={inherentLine} className="river__line" />

        {/* x labels: first and last only — a label on every vertex is chaos.
            When a burst of events lands inside the same second the two clock
            labels would read identically and say nothing, so the axis falls
            back to naming the span in events instead of inventing spread. */}
        <text x={PAD.left} y={HEIGHT - 8} className="river__xtick num" textAnchor="start">
          {sameInstant ? "event 1" : points[0].label}
        </text>
        {points.length > 1 && (
          <text x={width - PAD.right} y={HEIGHT - 8} className="river__xtick num" textAnchor="end">
            {sameInstant ? `event ${points.length}` : points[points.length - 1].label}
          </text>
        )}

        {active && hover !== null && (
          <g className="river__crosshair">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />
            <circle cx={x(hover)} cy={y(active.inherent)} r="4" className="river__dot" />
            <circle cx={x(hover)} cy={y(active.residual)} r="4" className="river__dot" />
          </g>
        )}

        {/* generous hit slabs — never require landing on the vertex itself */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (plotW / Math.max(1, points.length - 1)) / 2}
            y={PAD.top}
            width={Math.max(24, plotW / Math.max(1, points.length - 1))}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {active && hover !== null && (
        <div
          className="river__tooltip"
          style={{
            left: Math.min(Math.max(x(hover), 90), width - 90),
            top: PAD.top,
          }}
        >
          <div className="river__tooltip-time num">{active.label}</div>
          <div className="river__tooltip-row">
            <span className="river__swatch river__swatch--inherent" />
            Inherent
            <b className="num">{formatCompactINR(active.inherent)}</b>
          </div>
          <div className="river__tooltip-row">
            <span className="river__swatch river__swatch--residual" />
            Residual
            <b className="num">{formatCompactINR(active.residual)}</b>
          </div>
          <div className="river__tooltip-row">
            <span className="river__swatch river__swatch--absorbed" />
            Absorbed
            <b className="num">{formatCompactINR(active.inherent - active.residual)}</b>
          </div>
          {active.expectedLoss > 0 && (
            <div className="river__tooltip-row river__tooltip-row--muted">
              Expected annual loss
              <b className="num">{formatCompactINR(active.expectedLoss)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Area from a top edge down to a flat baseline. */
function areaPath(top: [number, number][], baseline: number): string {
  if (top.length === 0) return "";
  const forward = top.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const last = top[top.length - 1][0];
  const first = top[0][0];
  return `${forward} L${last},${baseline} L${first},${baseline} Z`;
}

/** Band between two edges (upper drawn forward, lower drawn back). */
function bandPath(upper: [number, number][], lower: [number, number][]): string {
  if (upper.length === 0) return "";
  const forward = upper.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const backward = [...lower].reverse().map(([px, py]) => `L${px},${py}`).join(" ");
  return `${forward} ${backward} Z`;
}

/** Round tick values so the axis reads in human numbers. */
function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = Math.ceil(raw / mag) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.001; v += step) out.push(v);
  return out;
}
