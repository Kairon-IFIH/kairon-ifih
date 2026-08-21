import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./lattice-hero.css";

/**
 * Signature visual: a lattice of nodes and edges — a direct reference to
 * lattice-based post-quantum cryptography (Kyber/Dilithium), not a decorative
 * gradient mesh. Edges draw in on load; nodes pulse gently and drift on a
 * slow loop. The one place on the page with continuous ambient motion.
 */
const COLS = 7;
const ROWS = 5;
const SPACING = 90;
const WIDTH = (COLS - 1) * SPACING;
const HEIGHT = (ROWS - 1) * SPACING;

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface Node {
  id: string;
  x: number;
  y: number;
  r: number;
}

interface Edge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const nodes: Node[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const seed = row * COLS + col;
    const jitterX = (seededRandom(seed) - 0.5) * 26;
    const jitterY = (seededRandom(seed + 100) - 0.5) * 26;
    nodes.push({
      id: `${row}-${col}`,
      x: col * SPACING + jitterX,
      y: row * SPACING + jitterY,
      r: 2.5 + seededRandom(seed + 200) * 2.5,
    });
  }
}

const edges: Edge[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const a = nodes[row * COLS + col];
    if (col < COLS - 1) {
      const b = nodes[row * COLS + col + 1];
      if (seededRandom(row * COLS + col + 300) > 0.25) {
        edges.push({ id: `h-${a.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    if (row < ROWS - 1) {
      const b = nodes[(row + 1) * COLS + col];
      if (seededRandom(row * COLS + col + 400) > 0.25) {
        edges.push({ id: `v-${a.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    if (row < ROWS - 1 && col < COLS - 1 && seededRandom(row * COLS + col + 500) > 0.62) {
      const b = nodes[(row + 1) * COLS + col + 1];
      edges.push({ id: `d-${a.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
}

export function LatticeHero() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const edgeEls = svg.querySelectorAll<SVGLineElement>(".lattice-hero__edge");
    const nodeEls = svg.querySelectorAll<SVGCircleElement>(".lattice-hero__node");

    if (reduceMotion) {
      edgeEls.forEach((el) => el.setAttribute("stroke-dashoffset", "0"));
      return;
    }

    gsap.set([edgeEls, nodeEls], { willChange: "transform, opacity, stroke-dashoffset" });

    const tl = gsap.timeline({ delay: 0.2 });
    tl.to(edgeEls, {
      strokeDashoffset: 0,
      duration: 1.6,
      stagger: { each: 0.012, from: "start" },
      ease: "power2.out",
    }).to(
      nodeEls,
      {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        stagger: { each: 0.008, from: "random" },
        ease: "back.out(2)",
        clearProps: "willChange",
      },
      "-=1.2"
    );

    // Ambient drift — slow, continuous, the one looping motion on the page.
    const drift = gsap.to(nodeEls, {
      y: "+=6",
      duration: 4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.15, from: "random" },
    });

    return () => {
      tl.kill();
      drift.kill();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="lattice-hero"
      viewBox={`-30 -30 ${WIDTH + 60} ${HEIGHT + 60}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Animated lattice representing lattice-based post-quantum cryptography"
    >
      <defs>
        <linearGradient id="lattice-edge-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-data)" />
          <stop offset="100%" stopColor="var(--accent-data-2)" />
        </linearGradient>
      </defs>
      {edges.map((edge) => {
        const length = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
        return (
          <line
            key={edge.id}
            className="lattice-hero__edge"
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="url(#lattice-edge-gradient)"
            strokeWidth={1}
            strokeDasharray={length}
            strokeDashoffset={length}
          />
        );
      })}
      {nodes.map((node) => (
        <circle key={node.id} className="lattice-hero__node" cx={node.x} cy={node.y} r={node.r} fill="var(--accent-data)" />
      ))}
    </svg>
  );
}
