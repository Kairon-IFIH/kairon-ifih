import { useState } from "react";
import { strengthRampColor, type CryptoInventoryRow } from "../../lib/intelligence";
import "./crypto-inventory-matrix.css";

/**
 * Cryptographic Inventory Matrix — the estate's CBOM (Cryptographic Bill of
 * Materials), redrawn as a heat matrix: rows are the primitive TYPE (TLS
 * version, cipher suite, key exchange, certificate, hash), columns are the
 * NIST-guideline strength band a discovered algorithm fell into. A cell's
 * fill intensity and printed count both carry the same fact, so the matrix
 * reads with or without colour.
 *
 * This is the direct analogue of RegulatoryMatrix — same shape, different
 * axis: coverage-confidence there, strength-distribution here.
 */

const STRENGTH_LABEL: Record<string, string> = {
  BROKEN: "Broken",
  WEAK: "Weak",
  UNKNOWN: "Unknown",
  ACCEPTABLE: "Acceptable",
  STRONG: "Strong",
  QUANTUM_SAFE: "Quantum-safe",
};

export function CryptoInventoryMatrix({ rows }: { rows: CryptoInventoryRow[] }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  if (rows.length === 0) return null;

  const columns = rows[0].cellsByStrength.map((c) => c.strength);

  return (
    <div className="crypto-matrix">
      <table className="crypto-matrix__table">
        <thead>
          <tr>
            <th className="crypto-matrix__corner" />
            {columns.map((s) => (
              <th key={s} className="crypto-matrix__col-head">
                <span>{STRENGTH_LABEL[s]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.assetType}>
              <th className="crypto-matrix__row-head">
                {row.label}
                <em>{row.total} found</em>
              </th>
              {row.cellsByStrength.map((cell, ci) => (
                <td
                  key={cell.strength}
                  className="crypto-matrix__cell"
                  onMouseEnter={() => setHover({ r: ri, c: ci })}
                  onMouseLeave={() => setHover(null)}
                >
                  <div
                    className="crypto-matrix__swatch"
                    data-empty={cell.count === 0 ? "true" : undefined}
                    data-focus={hover?.r === ri && hover?.c === ci ? "true" : undefined}
                    style={cell.count === 0 ? undefined : { background: strengthRampColor(cell.strength) }}
                  >
                    <span
                      className="num"
                      data-dark={cell.count > 0 && (cell.strength === "BROKEN" || cell.strength === "WEAK" || cell.strength === "STRONG") ? "true" : undefined}
                    >
                      {cell.count === 0 ? "–" : cell.count}
                    </span>
                  </div>
                  {hover?.r === ri && hover?.c === ci && cell.count > 0 && (
                    <div className="crypto-matrix__tip">
                      <b>
                        {row.label} · {STRENGTH_LABEL[cell.strength]}
                      </b>
                      <span className="num">
                        {cell.count} finding{cell.count === 1 ? "" : "s"} across scanned assets
                      </span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
