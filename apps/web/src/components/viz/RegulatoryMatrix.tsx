import { useState } from "react";
import "./regulatory-matrix.css";

/**
 * Regulatory Heat Matrix — coverage confidence per framework × asset class.
 *
 * Colour is a SEQUENTIAL ramp (one hue, light→dark) because coverage is a
 * magnitude, not an identity. The number is printed in every cell as well,
 * so the matrix is readable without colour at all — the ramp only makes the
 * pattern jump out.
 *
 * Frameworks the platform has never loaded reference data for render as an
 * explicit "not loaded" row rather than as 0% coverage. Those are different
 * claims: one is "we checked and found nothing", the other is "we never
 * looked", and a compliance tool must not blur them.
 */

export interface MatrixRow {
  framework: string;
  loaded: boolean;
  cells: { column: string; covered: number; total: number }[];
}

export function RegulatoryMatrix({ rows, columns }: { rows: MatrixRow[]; columns: string[] }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  return (
    <div className="matrix">
      <table className="matrix__table">
        <thead>
          <tr>
            <th className="matrix__corner" />
            {columns.map((c) => (
              <th key={c} className="matrix__col-head">
                <span>{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.framework}>
              <th className="matrix__row-head" data-loaded={row.loaded ? "true" : undefined}>
                {row.framework}
                {!row.loaded && <em>not loaded</em>}
              </th>

              {row.loaded ? (
                row.cells.map((cell, ci) => {
                  const ratio = cell.total === 0 ? null : cell.covered / cell.total;
                  return (
                    <td
                      key={cell.column}
                      className="matrix__cell"
                      onMouseEnter={() => setHover({ r: ri, c: ci })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <div
                        className="matrix__swatch"
                        data-empty={ratio === null ? "true" : undefined}
                        data-focus={hover?.r === ri && hover?.c === ci ? "true" : undefined}
                        style={ratio === null ? undefined : { background: rampFor(ratio) }}
                      >
                        <span className="num" data-dark={ratio !== null && ratio > 0.55 ? "true" : undefined}>
                          {ratio === null ? "–" : `${Math.round(ratio * 100)}%`}
                        </span>
                      </div>
                      {hover?.r === ri && hover?.c === ci && ratio !== null && (
                        <div className="matrix__tip">
                          <b>{row.framework}</b> · {cell.column}
                          <span className="num">
                            {cell.covered} of {cell.total} assets mapped to a control
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })
              ) : (
                <td className="matrix__cell matrix__cell--absent" colSpan={columns.length}>
                  <span>reference data for this framework has not been loaded into the platform</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="matrix__scale">
        <span className="matrix__scale-label">Coverage</span>
        <span className="matrix__scale-end num">0%</span>
        <div className="matrix__scale-ramp">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((s) => (
            <span key={s} style={{ background: rampFor(s) }} />
          ))}
        </div>
        <span className="matrix__scale-end num">100%</span>
      </div>
    </div>
  );
}

/** The validated indigo ordinal ramp, light → dark. */
const RAMP = [
  "var(--indigo-100)",
  "var(--indigo-200)",
  "var(--indigo-300)",
  "var(--indigo-400)",
  "var(--indigo-500)",
  "var(--indigo-600)",
];

function rampFor(ratio: number): string {
  const i = Math.round(Math.max(0, Math.min(1, ratio)) * (RAMP.length - 1));
  return RAMP[i];
}
