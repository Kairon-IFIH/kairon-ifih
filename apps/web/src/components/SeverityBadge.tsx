import { SEVERITY_VAR } from "../lib/intelligence";
import "./severity-badge.css";

/**
 * The swatch carries the severity colour; the text carries the severity name.
 * Both, always — colour alone never encodes severity in this product.
 */
export function SeverityBadge({ level }: { level: string }) {
  const color = SEVERITY_VAR[level] ?? "var(--ink-muted)";
  return (
    <span className="severity-badge">
      <span className="severity-badge__swatch" style={{ background: color }} aria-hidden="true" />
      {level}
    </span>
  );
}
