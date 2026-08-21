import { useMemo, useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import "./coverage-atlas.css";

/**
 * Regulatory Coverage Atlas — the traceability chain drawn as a map.
 *
 * Four ordered columns: Framework → Regulation → Control → Asset. Every ribbon
 * is a real mapping the platform can defend; hovering any node isolates the
 * full chain it belongs to, which is precisely the question an auditor asks —
 * "show me why this asset is in scope, and under which clause".
 *
 * A chain that stops short (a control with no assets mapped) stays visible as
 * a stub. That absence is the finding.
 */

export interface AtlasChain {
  framework: string;
  regulation: string;
  clause: string;
  control: string;
  assetId: string;
  assetName: string;
  status: "COMPLIANT" | "PARTIAL" | "GAP";
}

const COLUMNS = ["Framework", "Regulation", "Control", "Asset"] as const;
const ROW_H = 34;
const PAD_TOP = 30;

const STATUS_COLOR: Record<AtlasChain["status"], string> = {
  COMPLIANT: "var(--sev-low)",
  PARTIAL: "var(--sev-medium)",
  GAP: "var(--sev-critical)",
};

export function CoverageAtlas({ chains }: { chains: AtlasChain[] }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (chains.length === 0 || width === 0) return null;

    const colX = COLUMNS.map((_, i) => (width / COLUMNS.length) * (i + 0.5));

    // one row per unique value in each column, in first-appearance order
    const buildNodes = (key: (c: AtlasChain) => string) => {
      const order: string[] = [];
      for (const c of chains) {
        const v = key(c);
        if (!order.includes(v)) order.push(v);
      }
      return order;
    };

    const cols = [
      buildNodes((c) => c.framework),
      buildNodes((c) => c.regulation),
      buildNodes((c) => c.control),
      buildNodes((c) => c.assetName),
    ];

    const height = PAD_TOP + Math.max(...cols.map((c) => c.length)) * ROW_H + 16;

    const yFor = (colIndex: number, value: string) => {
      const list = cols[colIndex];
      const i = list.indexOf(value);
      const colHeight = list.length * ROW_H;
      const top = PAD_TOP + (height - PAD_TOP - 16 - colHeight) / 2;
      return top + i * ROW_H + ROW_H / 2;
    };

    return { colX, cols, height, yFor };
  }, [chains, width]);

  if (!layout) return <div className="atlas" ref={ref} style={{ minHeight: 160 }} />;

  const { colX, cols, height, yFor } = layout;

  const isLit = (colIndex: number, value: string) => {
    if (!hover) return true;
    return chains.some((c) => {
      const values = [c.framework, c.regulation, c.control, c.assetName];
      if (!values.includes(hover)) return false;
      return values[colIndex] === value;
    });
  };

  return (
    <div className="atlas" ref={ref}>
      <svg width={width} height={height} className="atlas__svg">
        {COLUMNS.map((label, i) => (
          <text key={label} x={colX[i]} y={16} className="atlas__col-label" textAnchor="middle">
            {label}
          </text>
        ))}

        {/* ribbons, drawn under the nodes */}
        <g>
          {chains.map((c, i) => {
            const points: [number, number][] = [
              [colX[0], yFor(0, c.framework)],
              [colX[1], yFor(1, c.regulation)],
              [colX[2], yFor(2, c.control)],
              [colX[3], yFor(3, c.assetName)],
            ];
            const lit =
              !hover || [c.framework, c.regulation, c.control, c.assetName].includes(hover);
            return (
              <path
                key={i}
                d={ribbon(points)}
                className="atlas__ribbon"
                data-dim={lit ? undefined : "true"}
                stroke={STATUS_COLOR[c.status]}
              />
            );
          })}
        </g>

        {cols.map((list, ci) =>
          list.map((value) => {
            const y = yFor(ci, value);
            const lit = isLit(ci, value);
            const status =
              ci === 3
                ? chains.find((c) => c.assetName === value)?.status
                : undefined;
            return (
              <g
                key={`${ci}-${value}`}
                className="atlas__node"
                data-dim={lit ? undefined : "true"}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={colX[ci] - nodeWidth(width) / 2}
                  y={y - 12}
                  width={nodeWidth(width)}
                  height={24}
                  rx="3"
                  className="atlas__node-box"
                  data-status={status}
                />
                <text x={colX[ci]} y={y} className="atlas__node-label" textAnchor="middle" dominantBaseline="middle">
                  {truncate(value, Math.floor(nodeWidth(width) / 6.4))}
                </text>
              </g>
            );
          })
        )}
      </svg>

      {hover && (
        <div className="atlas__detail">
          {chains
            .filter((c) => [c.framework, c.regulation, c.control, c.assetName].includes(hover))
            .slice(0, 1)
            .map((c, i) => (
              <p key={i}>
                <span className="num">{c.framework}</span> → {c.regulation}{" "}
                <span className="atlas__clause">({c.clause})</span> → {c.control} →{" "}
                <b>{c.assetName}</b>{" "}
                <span className="atlas__status" style={{ color: STATUS_COLOR[c.status] }}>
                  {c.status}
                </span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function nodeWidth(width: number): number {
  return Math.min(168, Math.max(96, width / 4 - 26));
}

/** Smooth cubic ribbon through the four column anchors. */
function ribbon(points: [number, number][]): string {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const mx = (x1 + x2) / 2;
    d += ` C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  return d;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(1, max - 1)) + "…";
}
