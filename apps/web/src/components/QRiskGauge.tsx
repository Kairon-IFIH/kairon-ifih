import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./q-risk-gauge.css";

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 270 / 360;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

function levelFor(score: number): { label: string; varName: string } {
  if (score >= 75) return { label: "Strong", varName: "--accent-safe" };
  if (score >= 50) return { label: "Adequate", varName: "--accent-warn" };
  return { label: "Attention needed", varName: "--accent-risk" };
}

export function QRiskGauge({ score }: { score: number }) {
  const progressRef = useRef<SVGCircleElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const clamped = Math.max(0, Math.min(100, score));
  const { label, varName } = levelFor(clamped);

  useEffect(() => {
    const progressEl = progressRef.current;
    const numberEl = numberRef.current;
    if (!progressEl || !numberEl) return;

    const targetLength = (clamped / 100) * ARC_LENGTH;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      progressEl.style.strokeDasharray = `${targetLength} ${CIRCUMFERENCE}`;
      numberEl.textContent = String(Math.round(clamped));
      return;
    }

    const state = { value: 0 };
    const tween = gsap.to(state, {
      value: clamped,
      duration: 1.4,
      ease: "power3.out",
      onUpdate: () => {
        const length = (state.value / 100) * ARC_LENGTH;
        progressEl.style.strokeDasharray = `${length} ${CIRCUMFERENCE}`;
        numberEl.textContent = String(Math.round(state.value));
      },
    });
    return () => {
      tween.kill();
    };
  }, [clamped]);

  return (
    <div className="q-gauge">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="q-gauge__svg" role="img" aria-label={`Q-Risk score ${Math.round(clamped)} out of 100, ${label}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--border-hairline)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}
        />
        <circle
          ref={progressRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`var(${varName})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`0 ${CIRCUMFERENCE}`}
          transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="q-gauge__readout">
        <span ref={numberRef} className="q-gauge__number num">
          0
        </span>
        <span className="eyebrow">Q-Risk score</span>
        <span className="q-gauge__level" style={{ color: `var(${varName})` }}>
          {label}
        </span>
      </div>
    </div>
  );
}
