import { useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { formatCompactINR } from "../../lib/format";
import "./optimization-frontier.css";

/**
 * Optimization Frontier — the decision surface the solver actually walks.
 *
 * x = cumulative spend, y = cumulative risk reduction, and the path is the
 * actions taken in descending efficiency order — which is exactly the order
 * the server's greedy solver considers them. So this is not a decorative
 * curve fitted to the answer: it *is* the search, drawn.
 *
 * The flattening of the curve is the executive insight — the point past
 * which each additional rupee buys less risk reduction than the one before.
 */

const HEIGHT = 320;
const PAD = { top: 20, right: 28, bottom: 42, left: 62 };

export interface FrontierNode {
  actionId: string;
  label: string;
  cumulativeCost: number;
  cumulativeReduction: number;
  cost: number;
  reduction: number;
  selected: boolean;
  affordable: boolean;
}

export function OptimizationFrontier({
  nodes,
  budget,
  currency,
}: {
  nodes: FrontierNode[];
  budget: number;
  currency: string;
}) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  if (nodes.length === 0 || width === 0) {
    return <div className="frontier" ref={ref} style={{ height: HEIGHT }} />;
  }

  const maxCost = Math.max(budget * 1.12, ...nodes.map((n) => n.cumulativeCost)) || 1;
  const maxReduction = Math.max(100, ...nodes.map((n) => n.cumulativeReduction));

  const x = (cost: number) => PAD.left + (cost / maxCost) * plotW;
  const y = (r: number) => PAD.top + plotH * (1 - r / maxReduction);

  const path = [
    `M${x(0)},${y(0)}`,
    ...nodes.map((n) => `L${x(n.cumulativeCost)},${y(n.cumulativeReduction)}`),
  ].join(" ");

  const areaPath = `${path} L${x(nodes[nodes.length - 1].cumulativeCost)},${y(0)} L${x(0)},${y(0)} Z`;

  const budgetX = x(budget);
  const chosen = nodes.filter((n) => n.selected);
  const chosenEnd = chosen.length > 0 ? chosen[chosen.length - 1] : null;

  const costTicks = niceTicks(maxCost, 4);
  const rTicks = [0, 25, 50, 75, 100].filter((t) => t <= maxReduction);

  return (
    <div className="frontier" ref={ref}>
      <svg width={width} height={HEIGHT} className="frontier__svg" role="img" aria-label="Cumulative risk reduction against cumulative spend">
        {rTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="frontier__grid" />
            <text x={PAD.left - 10} y={y(t)} className="frontier__tick num" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
          </g>
        ))}

        {costTicks.map((t) => (
          <text key={t} x={x(t)} y={HEIGHT - 22} className="frontier__tick num" textAnchor="middle">
            {formatCompactINR(t)}
          </text>
        ))}

        <path d={areaPath} className="frontier__area" />
        <path d={path} className="frontier__line" />

        {/* Budget wall — everything to its right is unaffordable this cycle. */}
        {budgetX < width - PAD.right && (
          <>
            <rect
              x={budgetX}
              y={PAD.top}
              width={Math.max(0, width - PAD.right - budgetX)}
              height={plotH}
              className="frontier__over-budget"
            />
            <line x1={budgetX} x2={budgetX} y1={PAD.top} y2={PAD.top + plotH} className="frontier__budget-line" />
            <text x={budgetX - 6} y={PAD.top + 11} className="frontier__budget-label" textAnchor="end">
              budget {formatCompactINR(budget)}
            </text>
          </>
        )}

        {nodes.map((n, i) => (
          <circle
            key={n.actionId}
            cx={x(n.cumulativeCost)}
            cy={y(n.cumulativeReduction)}
            r={n.selected ? 6 : 4.5}
            className="frontier__dot"
            data-selected={n.selected ? "true" : undefined}
            data-focus={hover === i ? "true" : undefined}
          />
        ))}

        {chosenEnd && (
          <g className="frontier__marker">
            <line
              x1={x(chosenEnd.cumulativeCost)}
              x2={x(chosenEnd.cumulativeCost)}
              y1={y(chosenEnd.cumulativeReduction)}
              y2={y(0)}
              className="frontier__marker-drop"
            />
            <text
              x={x(chosenEnd.cumulativeCost) + 8}
              y={y(chosenEnd.cumulativeReduction) - 8}
              className="frontier__marker-label"
            >
              chosen portfolio · {Math.round(chosenEnd.cumulativeReduction)}%
            </text>
          </g>
        )}

        {/* one generous hit slab per node */}
        {nodes.map((n, i) => {
          const slab = plotW / nodes.length;
          return (
            <rect
              key={`hit-${n.actionId}`}
              x={x(n.cumulativeCost) - slab / 2}
              y={PAD.top}
              width={Math.max(24, slab)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        <text x={PAD.left} y={HEIGHT - 6} className="frontier__axis-title">
          cumulative spend ({currency}) →
        </text>
      </svg>

      {hover !== null && nodes[hover] && (
        <div
          className="frontier__tip"
          style={{
            left: Math.min(Math.max(x(nodes[hover].cumulativeCost), 116), Math.max(116, width - 116)),
            top: Math.max(4, y(nodes[hover].cumulativeReduction) - 96),
          }}
        >
          <div className="frontier__tip-name">{nodes[hover].label}</div>
          <div className="frontier__tip-state" data-selected={nodes[hover].selected ? "true" : undefined}>
            {nodes[hover].selected ? "in the chosen portfolio" : nodes[hover].affordable ? "considered, not chosen" : "beyond budget"}
          </div>
          <dl className="frontier__tip-rows">
            <div>
              <dt>This action</dt>
              <dd className="num">
                {formatCompactINR(nodes[hover].cost)} · {Math.round(nodes[hover].reduction)}%
              </dd>
            </div>
            <div>
              <dt>Running total</dt>
              <dd className="num">
                {formatCompactINR(nodes[hover].cumulativeCost)} · {Math.round(nodes[hover].cumulativeReduction)}%
              </dd>
            </div>
            <div>
              <dt>Efficiency</dt>
              <dd className="num">
                {(nodes[hover].reduction / (nodes[hover].cost / 100000)).toFixed(2)}% per ₹1L
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
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
