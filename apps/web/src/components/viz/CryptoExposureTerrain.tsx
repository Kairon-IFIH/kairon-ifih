import { useMemo, useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { QARS_LEVEL_VAR } from "../../lib/intelligence";
import type { ScanResult } from "../../types/api";
import "./crypto-exposure-terrain.css";

/**
 * Crypto Exposure Terrain — the scan register drawn as terrain, the same
 * language RiskTopography uses for financial exposure:
 *
 *   HEIGHT = quantum risk — (100 - QARS score), so the most exposed scan
 *            raises the tallest peak, the same "danger reads as height"
 *            convention as the financial terrain
 *   WIDTH  = finding count — how much of the asset's crypto surface was
 *            actually inventoried
 *   COLOUR = QARS risk band (LOW/MEDIUM/HIGH/CRITICAL — the same 4-band
 *            severity vocabulary as every other panel in the product)
 *
 * Peaks are ordered worst-first left to right, so the skyline itself reads
 * as a priority queue: the tallest peak on the left is the asset that needs
 * PQC migration soonest.
 */

const HEIGHT = 300;
const PAD = { top: 18, right: 20, bottom: 34, left: 44 };

interface Peak {
  scan: ScanResult;
  label: string;
  cx: number;
  height: number;
  sigma: number;
  danger: number;
}

export function CryptoExposureTerrain({ scans, assetNames }: { scans: ScanResult[]; assetNames: Map<string, string> }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const { peaks } = useMemo(() => {
    if (scans.length === 0 || plotW <= 0) return { peaks: [] as Peak[] };

    const withDanger = [...scans]
      .map((scan) => ({ scan, danger: 100 - scan.qars.score }))
      .sort((a, b) => b.danger - a.danger);

    const max = Math.max(1, ...withDanger.map((w) => w.danger));
    const maxFindings = Math.max(1, ...withDanger.map((w) => w.scan.findings.length));
    const slot = plotW / withDanger.length;

    return {
      peaks: withDanger.map(({ scan, danger }, i): Peak => ({
        scan,
        danger,
        label: assetNames.get(scan.assetId) ?? "Unknown asset",
        cx: PAD.left + slot * (i + 0.5),
        height: (danger / max) * plotH,
        sigma: Math.max(slot * 0.42, slot * 0.42 + (scan.findings.length / maxFindings) * slot * 0.5),
      })),
    };
  }, [scans, plotW, plotH, assetNames]);

  if (scans.length === 0 || width === 0) {
    return <div className="crypto-terrain" ref={ref} style={{ height: HEIGHT }} />;
  }

  const baseY = PAD.top + plotH;

  return (
    <div className="crypto-terrain" ref={ref}>
      <svg width={width} height={HEIGHT} className="crypto-terrain__svg" role="img" aria-label="Quantum risk terrain across scanned assets">
        {[0, 25, 50, 75, 100].map((t) => {
          const y = baseY - (t / 100) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="crypto-terrain__grid" />
            </g>
          );
        })}

        {peaks.map((p, i) => (
          <path
            key={p.scan.id}
            d={gaussianRidge(p.cx, p.sigma, p.height, baseY, PAD.left, width - PAD.right)}
            fill={QARS_LEVEL_VAR[p.scan.qars.riskLevel]}
            className="crypto-terrain__peak"
            data-dim={hover !== null && hover !== i ? "true" : undefined}
            data-focus={hover === i ? "true" : undefined}
          />
        ))}

        <line x1={PAD.left} x2={width - PAD.right} y1={baseY} y2={baseY} className="crypto-terrain__base" />

        {peaks.map((p, i) => (
          <rect
            key={`hit-${p.scan.id}`}
            x={p.cx - plotW / peaks.length / 2}
            y={PAD.top}
            width={Math.max(24, plotW / peaks.length)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        <text x={PAD.left} y={HEIGHT - 10} className="crypto-terrain__xtick">
          most exposed
        </text>
        <text x={width - PAD.right} y={HEIGHT - 10} className="crypto-terrain__xtick" textAnchor="end">
          least exposed
        </text>
      </svg>

      {hover !== null && peaks[hover] && (
        <div
          className="crypto-terrain__tip"
          style={{
            left: Math.min(Math.max(peaks[hover].cx, 108), Math.max(108, width - 108)),
            top: Math.max(4, baseY - peaks[hover].height - 96),
          }}
        >
          <div className="crypto-terrain__tip-name">{peaks[hover].label}</div>
          <dl className="crypto-terrain__tip-rows">
            <div>
              <dt>QARS score</dt>
              <dd className="num">{peaks[hover].scan.qars.score}/100</dd>
            </div>
            <div>
              <dt>Band</dt>
              <dd style={{ color: QARS_LEVEL_VAR[peaks[hover].scan.qars.riskLevel] }}>{peaks[hover].scan.qars.riskLevel}</dd>
            </div>
            <div>
              <dt>HNDL</dt>
              <dd>{peaks[hover].scan.hndl.actNow ? "Act now" : "Within horizon"}</dd>
            </div>
            <div>
              <dt>Weakest primitive</dt>
              <dd>{peaks[hover].scan.weakestStrength}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function gaussianRidge(cx: number, sigma: number, height: number, baseY: number, left: number, right: number): string {
  const from = Math.max(left, cx - sigma * 3);
  const to = Math.min(right, cx + sigma * 3);
  const steps = 48;
  const pts: string[] = [`M${from.toFixed(1)},${baseY.toFixed(1)}`];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const y = baseY - height * Math.exp(-((x - cx) ** 2) / (2 * sigma * sigma));
    pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push(`L${to.toFixed(1)},${baseY.toFixed(1)} Z`);
  return pts.join(" ");
}
