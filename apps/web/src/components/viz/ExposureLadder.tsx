import { useState } from "react";
import { formatCompactINR } from "../../lib/format";
import { SEVERITY_VAR } from "../../lib/intelligence";
import "./exposure-ladder.css";

/**
 * Exposure Ladder — one row per scored asset, ranked by residual exposure.
 *
 * Each row is a bullet: the pale track is INHERENT exposure, the filled bar is
 * what SURVIVES controls, and the notch is the quantified expected annual loss
 * where one has been priced. The visible gap between track and bar is the
 * control effect — the thing a CRO is actually buying — shown per asset
 * instead of averaged into a single headline percentage.
 */

export interface LadderRow {
  id: string;
  label: string;
  level: string;
  inherent: number;
  residual: number;
  expectedLoss: number | null;
}

export function ExposureLadder({ rows }: { rows: LadderRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  if (rows.length === 0) return null;

  const max = Math.max(1, ...rows.map((r) => r.inherent));

  return (
    <div className="ladder">
      <div className="ladder__head">
        <span>Asset</span>
        <span>Inherent → residual exposure</span>
        <span className="ladder__head-value">Residual</span>
      </div>

      {rows.map((r) => {
        const inherentPct = (r.inherent / max) * 100;
        const residualPct = (r.residual / max) * 100;
        const ealPct = r.expectedLoss !== null ? (r.expectedLoss / max) * 100 : null;
        return (
          <div
            key={r.id}
            className="ladder__row"
            data-dim={hover !== null && hover !== r.id ? "true" : undefined}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="ladder__label" title={r.label}>
              {r.label}
            </span>

            <div className="ladder__track">
              <div className="ladder__inherent" style={{ width: `${inherentPct}%` }} />
              <div
                className="ladder__residual"
                style={{ width: `${residualPct}%`, background: SEVERITY_VAR[r.level] }}
              />
              {ealPct !== null && (
                <div className="ladder__eal" style={{ left: `${ealPct}%` }} title="Expected annual loss" />
              )}

              {hover === r.id && (
                <div className="ladder__tip">
                  <div>
                    <span>Inherent</span>
                    <b className="num">{formatCompactINR(r.inherent)}</b>
                  </div>
                  <div>
                    <span>Residual</span>
                    <b className="num">{formatCompactINR(r.residual)}</b>
                  </div>
                  <div>
                    <span>Controls absorb</span>
                    <b className="num">{formatCompactINR(r.inherent - r.residual)}</b>
                  </div>
                  <div>
                    <span>Expected annual loss</span>
                    <b className="num">{r.expectedLoss !== null ? formatCompactINR(r.expectedLoss) : "not priced"}</b>
                  </div>
                </div>
              )}
            </div>

            <span className="ladder__value num">{formatCompactINR(r.residual)}</span>
          </div>
        );
      })}

      <div className="ladder__legend">
        <span className="ladder__legend-item">
          <span className="ladder__legend-mark ladder__legend-mark--inherent" /> Inherent
        </span>
        <span className="ladder__legend-item">
          <span className="ladder__legend-mark ladder__legend-mark--residual">
            <i style={{ background: "var(--sev-low)" }} />
            <i style={{ background: "var(--sev-medium)" }} />
            <i style={{ background: "var(--sev-high)" }} />
            <i style={{ background: "var(--sev-critical)" }} />
          </span>
          Residual, coloured by severity band
        </span>
        <span className="ladder__legend-item">
          <span className="ladder__legend-mark ladder__legend-mark--eal" /> Expected annual loss
        </span>
      </div>
    </div>
  );
}
