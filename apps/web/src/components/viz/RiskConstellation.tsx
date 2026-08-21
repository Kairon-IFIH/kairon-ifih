import { useMemo, useState } from "react";
import { useElementWidth } from "../../lib/use-element-width";
import { buildConstellation, SEVERITY_VAR } from "../../lib/intelligence";
import type { GraphNode } from "../../lib/intelligence";
import type { Asset, ComplianceMapping, Risk } from "../../types/api";
import "./risk-constellation.css";

/**
 * Risk Constellation — the institution's exposure graph.
 *
 * Assets, the risks scored against them and the controls mapped to them, laid
 * out by a deterministic force simulation. What a table cannot show and this
 * can: concentration. A tight cluster of critical nodes around one control is
 * a single point of failure; an isolated node is an asset nothing is watching.
 *
 * Node KIND is encoded by SHAPE (circle / diamond / ring) as well as colour,
 * so the three kinds are distinguishable without colour vision. Node SEVERITY
 * is the colour, and every hover states it in words.
 */

const HEIGHT = 420;

interface Props {
  assets: Asset[];
  risks: Risk[];
  mappings: ComplianceMapping[];
}

export function RiskConstellation({ assets, risks, mappings }: Props) {
  const [ref, width] = useElementWidth();
  const [hovered, setHovered] = useState<string | null>(null);

  const graph = useMemo(
    () => (width > 0 ? buildConstellation(assets, risks, mappings, width, HEIGHT) : { nodes: [], links: [] }),
    [assets, risks, mappings, width]
  );

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  // Neighbourhood of the hovered node — the "reveal dependencies" interaction.
  const connected = useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>([hovered]);
    for (const l of graph.links) {
      if (l.source === hovered) set.add(l.target);
      if (l.target === hovered) set.add(l.source);
    }
    return set;
  }, [hovered, graph.links]);

  const hoveredNode = hovered ? byId.get(hovered) ?? null : null;

  return (
    <div className="constellation" ref={ref}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="constellation__svg" role="img" aria-label="Graph of assets, risks and controls and the dependencies between them">
          <g className="constellation__links">
            {graph.links.map((l, i) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const dim = connected !== null && !(connected.has(l.source) && connected.has(l.target));
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="constellation__link"
                  data-dim={dim ? "true" : undefined}
                />
              );
            })}
          </g>

          <g className="constellation__nodes">
            {graph.nodes.map((n) => (
              <NodeMark
                key={n.id}
                node={n}
                dim={connected !== null && !connected.has(n.id)}
                focused={hovered === n.id}
                onEnter={() => setHovered(n.id)}
                onLeave={() => setHovered(null)}
              />
            ))}
          </g>
        </svg>
      )}

      {hoveredNode && (
        <div
          className="constellation__inspector"
          style={{
            left: Math.min(Math.max(hoveredNode.x, 120), Math.max(120, width - 120)),
            top: Math.min(hoveredNode.y + 22, HEIGHT - 96),
          }}
        >
          <div className="constellation__inspector-kind">{KIND_LABEL[hoveredNode.kind]}</div>
          <div className="constellation__inspector-label">{hoveredNode.label}</div>
          {hoveredNode.severity && (
            <div className="constellation__inspector-sev" style={{ color: SEVERITY_VAR[hoveredNode.severity] }}>
              {hoveredNode.severity}
            </div>
          )}
          <div className="constellation__inspector-links num">
            {countLinks(graph.links, hoveredNode.id)} connection
            {countLinks(graph.links, hoveredNode.id) === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<GraphNode["kind"], string> = {
  asset: "Asset",
  risk: "Scored risk",
  control: "Control",
};

function countLinks(links: { source: string; target: string }[], id: string): number {
  return links.filter((l) => l.source === id || l.target === id).length;
}

function NodeMark({
  node,
  dim,
  focused,
  onEnter,
  onLeave,
}: {
  node: GraphNode;
  dim: boolean;
  focused: boolean;
  onEnter(): void;
  onLeave(): void;
}) {
  const r = 5 + node.weight * 9;
  const fill = node.severity ? SEVERITY_VAR[node.severity] : "var(--ink-faint)";

  const shape =
    node.kind === "asset" ? (
      <circle cx={node.x} cy={node.y} r={r} fill={fill} />
    ) : node.kind === "risk" ? (
      <rect
        x={node.x - r}
        y={node.y - r}
        width={r * 2}
        height={r * 2}
        fill={fill}
        transform={`rotate(45 ${node.x} ${node.y})`}
        rx="1.5"
      />
    ) : (
      <circle cx={node.x} cy={node.y} r={r} fill="var(--surface)" stroke="var(--ink-muted)" strokeWidth="2" />
    );

  return (
    <g
      className="constellation__node"
      data-dim={dim ? "true" : undefined}
      data-focused={focused ? "true" : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* 2px surface ring so overlapping nodes stay separable */}
      <g className="constellation__node-ring">{shape}</g>
      {/* hit target is always ≥24px across, never the mark itself */}
      <circle cx={node.x} cy={node.y} r={Math.max(14, r + 6)} fill="transparent" />
    </g>
  );
}
