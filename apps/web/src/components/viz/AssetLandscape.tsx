import { useMemo, useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { SEVERITY_VAR } from "../../lib/intelligence";
import type { Asset, Risk } from "../../types/api";
import "./asset-landscape.css";

/**
 * Asset Landscape — a squarified treemap of the institution's surface.
 *
 * Two independent variables, so neither channel is wasted:
 *   AREA  = criticality weight — how much exposure surface the asset is
 *   FILL  = the severity of the risk actually scored against it
 *
 * An asset nobody has scored gets no fill at all, just a hairline outline.
 * That is the point of the chart: unmeasured assets are visually holes in
 * the landscape rather than quietly averaging in as if they were safe.
 */

const HEIGHT = 460;

interface Cell {
  asset: Asset;
  risk: Risk | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Group {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cells: Cell[];
}

export function AssetLandscape({
  assets,
  risks,
  onSelect,
}: {
  assets: Asset[];
  risks: Risk[];
  onSelect?(asset: Asset): void;
}) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<string | null>(null);

  const riskByAsset = useMemo(() => {
    const m = new Map<string, Risk>();
    // keep the most severe risk per asset — that is the one that matters
    for (const r of risks) {
      const existing = m.get(r.assetId);
      if (!existing || r.residualScore > existing.residualScore) m.set(r.assetId, r);
    }
    return m;
  }, [risks]);

  const groups = useMemo(() => {
    if (width === 0 || assets.length === 0) return [];

    const byType = new Map<string, Asset[]>();
    for (const a of assets) {
      const list = byType.get(a.assetType) ?? [];
      list.push(a);
      byType.set(a.assetType, list);
    }

    const typed = [...byType.entries()]
      .map(([type, list]) => ({
        type,
        list: [...list].sort((a, b) => b.criticalityWeight - a.criticalityWeight),
        value: list.reduce((s, a) => s + a.criticalityWeight, 0),
      }))
      .sort((a, b) => b.value - a.value);

    const outer = squarify(
      typed.map((t) => t.value),
      { x: 0, y: 0, w: width, h: HEIGHT }
    );

    return typed.map((t, i): Group => {
      const box = outer[i];
      const LABEL_BAND = 22;
      const inner = {
        x: box.x + 1,
        y: box.y + LABEL_BAND,
        w: Math.max(0, box.w - 2),
        h: Math.max(0, box.h - LABEL_BAND - 1),
      };
      const rects = squarify(
        t.list.map((a) => a.criticalityWeight),
        inner
      );
      return {
        type: t.type,
        ...box,
        cells: t.list.map((asset, j) => ({
          asset,
          risk: riskByAsset.get(asset.id),
          ...rects[j],
        })),
      };
    });
  }, [assets, width, riskByAsset]);

  const hovered = groups.flatMap((g) => g.cells).find((c) => c.asset.id === hover) ?? null;

  return (
    <div className="landscape" ref={ref}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="landscape__svg">
          {groups.map((g) => (
            <g key={g.type}>
              <text x={g.x + 4} y={g.y + 13} className="landscape__group-label">
                {g.type}
                <tspan className="landscape__group-count" dx="6">
                  {g.cells.length}
                </tspan>
              </text>

              {g.cells.map((c) => {
                const scored = c.risk !== undefined;
                return (
                  <g
                    key={c.asset.id}
                    className="landscape__cell"
                    data-dim={hover !== null && hover !== c.asset.id ? "true" : undefined}
                    onMouseEnter={() => setHover(c.asset.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect?.(c.asset)}
                  >
                    <rect
                      x={c.x + 1}
                      y={c.y + 1}
                      width={Math.max(0, c.w - 2)}
                      height={Math.max(0, c.h - 2)}
                      rx="2"
                      fill={scored ? SEVERITY_VAR[c.risk!.level] : "transparent"}
                      stroke={scored ? "transparent" : "var(--rule-strong)"}
                      strokeWidth="1"
                      strokeDasharray={scored ? undefined : "3 3"}
                    />
                    {c.w > 64 && c.h > 30 && (
                      <text
                        x={c.x + 8}
                        y={c.y + 19}
                        className="landscape__cell-label"
                        data-on-fill={scored ? "true" : undefined}
                      >
                        {truncate(c.asset.name, Math.floor((c.w - 16) / 6.2))}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      )}

      {hovered && (
        <div
          className="landscape__tip"
          style={{
            left: Math.min(Math.max(hovered.x + hovered.w / 2, 110), Math.max(110, width - 110)),
            top: Math.min(hovered.y + hovered.h + 6, HEIGHT - 110),
          }}
        >
          <div className="landscape__tip-name">{hovered.asset.name}</div>
          <div className="landscape__tip-meta">
            {hovered.asset.assetType} · {hovered.asset.dataClassification}
          </div>
          <dl className="landscape__tip-rows">
            <div>
              <dt>Criticality</dt>
              <dd style={{ color: SEVERITY_VAR[hovered.asset.criticality] }}>{hovered.asset.criticality}</dd>
            </div>
            {hovered.risk ? (
              <>
                <div>
                  <dt>Residual</dt>
                  <dd className="num">{hovered.risk.residualScore}/100</dd>
                </div>
                <div>
                  <dt>Risk level</dt>
                  <dd style={{ color: SEVERITY_VAR[hovered.risk.level] }}>{hovered.risk.level}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Risk</dt>
                <dd className="landscape__tip-unscored">never scored</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (max < 4) return "";
  return text.length <= max ? text : text.slice(0, Math.max(1, max - 1)) + "…";
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk). Produces cells close to
 * square, which are far easier to compare by area than the long slivers a
 * naive slice-and-dice layout gives you.
 */
function squarify(values: number[], box: Box): Box[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0 || values.length === 0) return values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));

  const scaled = values.map((v) => (v / total) * box.w * box.h);
  const out: Box[] = new Array(values.length);
  let rest = { ...box };
  let i = 0;

  while (i < scaled.length) {
    const short = Math.min(rest.w, rest.h);
    let row: number[] = [];
    let rowIndices: number[] = [];
    let best = Infinity;

    let j = i;
    while (j < scaled.length) {
      const candidate = [...row, scaled[j]];
      const ratio = worstRatio(candidate, short);
      if (row.length > 0 && ratio > best) break;
      best = ratio;
      row = candidate;
      rowIndices = [...rowIndices, j];
      j++;
    }

    const rowSum = row.reduce((a, b) => a + b, 0);
    const thickness = short === 0 ? 0 : rowSum / short;

    if (rest.w >= rest.h) {
      let y = rest.y;
      rowIndices.forEach((idx, k) => {
        const cellH = rowSum === 0 ? 0 : (row[k] / rowSum) * rest.h;
        out[idx] = { x: rest.x, y, w: thickness, h: cellH };
        y += cellH;
      });
      rest = { x: rest.x + thickness, y: rest.y, w: Math.max(0, rest.w - thickness), h: rest.h };
    } else {
      let x = rest.x;
      rowIndices.forEach((idx, k) => {
        const cellW = rowSum === 0 ? 0 : (row[k] / rowSum) * rest.w;
        out[idx] = { x, y: rest.y, w: cellW, h: thickness };
        x += cellW;
      });
      rest = { x: rest.x, y: rest.y + thickness, w: rest.w, h: Math.max(0, rest.h - thickness) };
    }

    i = j;
  }

  return out.map((b) => b ?? { x: box.x, y: box.y, w: 0, h: 0 });
}

function worstRatio(row: number[], short: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  if (sum === 0 || short === 0) return Infinity;
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((short * short * max) / (sum * sum), (sum * sum) / (short * short * min));
}
