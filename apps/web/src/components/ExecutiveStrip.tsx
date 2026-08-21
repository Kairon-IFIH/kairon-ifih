import type { ReactNode } from "react";
import "./executive-strip.css";

/**
 * The Executive Intelligence Strip.
 *
 * Deliberately NOT a row of KPI cards. It is one continuous instrument band
 * divided by hairlines — the readout row of a terminal. Each cell answers
 * "what is this, where is it heading, and what is it made of", so the reader
 * gets direction and composition, never a bare number floating in a box.
 */

export function ExecutiveStrip({ children }: { children: ReactNode }) {
  return <div className="strip">{children}</div>;
}

interface ReadoutProps {
  label: string;
  /** The figure itself, already formatted. */
  value: string;
  /** Small unit/suffix set beside the figure in muted ink. */
  unit?: string;
  /** Directional reading — carries an arrow glyph AND a word, never colour alone. */
  direction?: { tone: "up" | "down" | "flat"; text: string };
  /** Composition breakdown — the "what is it made of" line. */
  parts?: { label: string; value: string }[];
  /** Optional inline visual (sparkline, micro-bar). */
  visual?: ReactNode;
  /** Marks the primary readout — slightly larger figure. */
  lead?: boolean;
  /** `text` for word values (a class name, a state) — figures only for numbers. */
  variant?: "figure" | "text";
}

const ARROW: Record<string, string> = { up: "▲", down: "▼", flat: "▬" };

export function Readout({ label, value, unit, direction, parts, visual, lead, variant = "figure" }: ReadoutProps) {
  return (
    <div className="strip__cell" data-lead={lead ? "true" : undefined}>
      <div className="strip__label">{label}</div>

      <div className="strip__value-row">
        <span className={variant === "figure" ? "strip__value figure" : "strip__value strip__value--text"}>{value}</span>
        {unit && <span className="strip__unit">{unit}</span>}
      </div>

      {direction && (
        <div className="strip__direction" data-tone={direction.tone}>
          <span aria-hidden="true">{ARROW[direction.tone]}</span>
          <span>{direction.text}</span>
        </div>
      )}

      {visual && <div className="strip__visual">{visual}</div>}

      {parts && parts.length > 0 && (
        <dl className="strip__parts">
          {parts.map((p) => (
            <div key={p.label} className="strip__part">
              <dt>{p.label}</dt>
              {p.value !== "" && (
                <>
                  <span className="strip__leader" aria-hidden="true" />
                  <dd className="num">{p.value}</dd>
                </>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * A bare sparkline — 2px stroke, no axes, no dots except the endpoint.
 * Reads as texture at this size; the figure beside it carries the value.
 */
export function Sparkline({
  values,
  width = 92,
  height = 26,
  color = "var(--accent)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return <div className="sparkline sparkline--flat" style={{ width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.75" fill={color} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
