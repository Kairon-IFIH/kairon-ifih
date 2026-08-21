import { useMemo, useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { SEVERITY_VAR } from "../../lib/intelligence";
import { formatCompactINR } from "../../lib/format";
import type { Risk } from "../../types/api";
import "./risk-topography.css";

/**
 * Risk Topography — the risk register drawn as terrain.
 *
 * Each scored risk raises a peak:
 *   HEIGHT = residual exposure in rupees — what survives current controls
 *   WIDTH  = modelled impact — how much of the institution it touches
 *   COLOUR = severity band
 *
 * Peaks are laid out by descending exposure, so the range reads left-to-right
 * like a skyline: the reader sees the shape of the institution's risk in one
 * glance instead of comparing rows in a table. Overlap is meaningful — broad
 * adjacent peaks are correlated exposure sitting in the same place.
 */

const HEIGHT = 300;
const PAD = { top: 18, right: 20, bottom: 34, left: 62 };

interface Peak {
  risk: Risk;
  label: string;
  cx: number;
  height: number;
  sigma: number;
  exposure: number;
}

export function RiskTopography({
  risks,
  assetNames,
}: {
  risks: Risk[];
  assetNames: Map<string, string>;
}) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const { peaks, maxExposure } = useMemo(() => {
    if (risks.length === 0 || plotW <= 0) return { peaks: [] as Peak[], maxExposure: 0 };

    const withExposure = risks
      .map((r) => ({ risk: r, exposure: r.impactAmount * (r.residualScore / 100) }))
      .sort((a, b) => b.exposure - a.exposure);

    const max = Math.max(1, ...withExposure.map((w) => w.exposure));
    const maxImpact = Math.max(1, ...withExposure.map((w) => w.risk.impactAmount));
    const slot = plotW / withExposure.length;

    return {
      maxExposure: max,
      peaks: withExposure.map(({ risk, exposure }, i): Peak => ({
        risk,
        exposure,
        label: assetNames.get(risk.assetId) ?? "Unknown asset",
        cx: PAD.left + slot * (i + 0.5),
        height: (exposure / max) * plotH,
        // wider peak = larger modelled impact; clamped so one huge risk can't
        // smear across the whole range and hide everything behind it
        sigma: Math.max(slot * 0.42, slot * 0.42 + (risk.impactAmount / maxImpact) * slot * 0.5),
      })),
    };
  }, [risks, plotW, plotH, assetNames]);

  if (risks.length === 0 || width === 0) {
    return <div className="topo" ref={ref} style={{ height: HEIGHT }} />;
  }

  const baseY = PAD.top + plotH;
  const ticks = niceTicks(maxExposure, 3);

  return (
    <div className="topo" ref={ref}>
      <svg width={width} height={HEIGHT} className="topo__svg" role="img" aria-label="Residual exposure terrain across scored risks">
        {ticks.map((t) => {
          const y = baseY - (t / maxExposure) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="topo__grid" />
              <text x={PAD.left - 10} y={y} className="topo__ytick num" textAnchor="end" dominantBaseline="middle">
                {formatCompactINR(t)}
              </text>
            </g>
          );
        })}

        {/* tallest first so shorter peaks sit in front — real depth ordering */}
        {peaks.map((p, i) => (
          <path
            key={p.risk.id}
            d={gaussianRidge(p.cx, p.sigma, p.height, baseY, PAD.left, width - PAD.right)}
            fill={SEVERITY_VAR[p.risk.level]}
            className="topo__peak"
            data-dim={hover !== null && hover !== i ? "true" : undefined}
            data-focus={hover === i ? "true" : undefined}
          />
        ))}

        <line x1={PAD.left} x2={width - PAD.right} y1={baseY} y2={baseY} className="topo__base" />

        {/* hit slabs — one per peak, full height, never the curve itself */}
        {peaks.map((p, i) => (
          <rect
            key={`hit-${p.risk.id}`}
            x={p.cx - plotW / peaks.length / 2}
            y={PAD.top}
            width={Math.max(24, plotW / peaks.length)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        <text x={PAD.left} y={HEIGHT - 10} className="topo__xtick">
          highest residual exposure
        </text>
        <text x={width - PAD.right} y={HEIGHT - 10} className="topo__xtick" textAnchor="end">
          lowest
        </text>
      </svg>

      {hover !== null && peaks[hover] && (
        <div
          className="topo__tip"
          style={{
            left: Math.min(Math.max(peaks[hover].cx, 108), Math.max(108, width - 108)),
            top: Math.max(4, baseY - peaks[hover].height - 84),
          }}
        >
          <div className="topo__tip-name">{peaks[hover].label}</div>
          <dl className="topo__tip-rows">
            <div>
              <dt>Residual exposure</dt>
              <dd className="num">{formatCompactINR(peaks[hover].exposure)}</dd>
            </div>
            <div>
              <dt>Modelled impact</dt>
              <dd className="num">{formatCompactINR(peaks[hover].risk.impactAmount)}</dd>
            </div>
            <div>
              <dt>Residual score</dt>
              <dd className="num">{peaks[hover].risk.residualScore}/100</dd>
            </div>
            <div>
              <dt>Band</dt>
              <dd style={{ color: SEVERITY_VAR[peaks[hover].risk.level] }}>{peaks[hover].risk.level}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

/** A gaussian hill sampled into a filled path, clipped to the plot area. */
function gaussianRidge(
  cx: number,
  sigma: number,
  height: number,
  baseY: number,
  left: number,
  right: number
): string {
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

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = Math.ceil(raw / mag) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.001; v += step) out.push(v);
  return out;
}
