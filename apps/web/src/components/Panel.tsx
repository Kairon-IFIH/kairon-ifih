import type { ReactNode } from "react";
import "./panel.css";

interface PanelProps {
  /** Short, lowercase-tone title. The eyebrow above it carries the domain. */
  title: string;
  /** Domain tag rendered above the title — "EXPOSURE", "REGULATORY"… */
  eyebrow?: string;
  /** One line explaining what the reader is looking at and why it matters. */
  caption?: string;
  /** Right-aligned controls (legend, toggle, filter). */
  aside?: ReactNode;
  /** Removes body padding — for visualisations that bleed to the panel edge. */
  bleed?: boolean;
  span?: "full" | "half";
  children: ReactNode;
}

/**
 * The one container in the product. Deliberately not a "card": no shadow, no
 * rounded-rectangle float — a hairline-ruled region of the working surface,
 * the way a terminal divides a screen into panes.
 */
export function Panel({ title, eyebrow, caption, aside, bleed, span = "full", children }: PanelProps) {
  return (
    <section className="panel" data-span={span}>
      <header className="panel__head">
        <div className="panel__heading">
          {eyebrow && <span className="panel__eyebrow">{eyebrow}</span>}
          <h2 className="panel__title">{title}</h2>
          {caption && <p className="panel__caption">{caption}</p>}
        </div>
        {aside && <div className="panel__aside">{aside}</div>}
      </header>
      <div className={"panel__body" + (bleed ? " panel__body--bleed" : "")}>{children}</div>
    </section>
  );
}

/**
 * Inline legend swatch + label. The swatch mirrors the mark's actual SHAPE as
 * well as its colour, so a legend still works without colour vision.
 */
export function LegendItem({
  color,
  label,
  shape = "square",
}: {
  color?: string;
  label: string;
  shape?: "square" | "line" | "dot" | "diamond" | "ring";
}) {
  return (
    <span className="legend-item">
      <span
        className={`legend-item__mark legend-item__mark--${shape}`}
        style={shape === "ring" ? undefined : { background: color }}
      />
      {label}
    </span>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="legend">{children}</div>;
}

/** The honest empty state — says what is missing and what to do about it. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="panel__empty">{children}</div>;
}
