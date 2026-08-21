import "./risk-health-spectrum.css";

/**
 * Risk Health Spectrum — replaces the circular gauge.
 *
 * A gauge shows a number you already printed. This shows *position within a
 * defined institutional band*: where the score sits, which band it is in,
 * how far the next band is, and what the score is currently composed of.
 *
 * Bands are separated by a 2px surface gap rather than borders (mark spec),
 * and every band carries its written name — the band is never read from
 * colour alone.
 */

const BANDS = [
  { key: "WEAK", label: "Weak", from: 0, to: 40, color: "var(--sev-critical)" },
  { key: "STABLE", label: "Stable", from: 40, to: 65, color: "var(--sev-high)" },
  { key: "STRONG", label: "Strong", from: 65, to: 85, color: "var(--sev-medium)" },
  { key: "ELITE", label: "Elite", from: 85, to: 100, color: "var(--sev-low)" },
] as const;

export function bandFor(score: number) {
  return BANDS.find((b) => score >= b.from && score < b.to) ?? BANDS[BANDS.length - 1];
}

interface Props {
  score: number;
  /** What the score is currently made of — shown as a disclosure, not hidden. */
  composition?: { label: string; state: "live" | "pending" }[];
}

export function RiskHealthSpectrum({ score, composition }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = bandFor(clamped);
  const nextBand = BANDS[BANDS.findIndex((b) => b.key === band.key) + 1];
  const toNext = nextBand ? Math.max(0, nextBand.from - clamped) : null;

  return (
    <div className="spectrum">
      <div className="spectrum__readout">
        <span className="spectrum__score figure">{Math.round(clamped)}</span>
        <div className="spectrum__readout-meta">
          <span className="spectrum__band-name" style={{ color: band.color }}>
            {band.label}
          </span>
          <span className="spectrum__scale num">/ 100 Q-Risk</span>
        </div>
      </div>

      <div className="spectrum__track" role="img" aria-label={`Q-Risk ${Math.round(clamped)} of 100 — ${band.label} band`}>
        {BANDS.map((b) => (
          <div
            key={b.key}
            className="spectrum__band"
            data-active={b.key === band.key ? "true" : undefined}
            style={{
              flexGrow: b.to - b.from,
              background: b.color,
            }}
          />
        ))}

        <div className="spectrum__marker" style={{ left: `${clamped}%` }}>
          <div className="spectrum__marker-stem" />
          <div className="spectrum__marker-head" />
        </div>
      </div>

      <div className="spectrum__ticks">
        {BANDS.map((b) => (
          <span key={b.key} className="spectrum__tick" style={{ flexGrow: b.to - b.from }}>
            <span className="spectrum__tick-label" data-active={b.key === band.key ? "true" : undefined}>
              {b.label}
            </span>
            <span className="spectrum__tick-value num">{b.from}</span>
          </span>
        ))}
      </div>

      {toNext !== null && nextBand && (
        <p className="spectrum__delta">
          <span className="num">{toNext}</span> point{toNext === 1 ? "" : "s"} from{" "}
          <span style={{ color: nextBand.color, fontWeight: 500 }}>{nextBand.label}</span>
        </p>
      )}

      {composition && composition.length > 0 && (
        <div className="spectrum__composition">
          <span className="spectrum__composition-title">Composed from</span>
          <ul>
            {composition.map((c) => (
              <li key={c.label} data-state={c.state}>
                <span className="spectrum__composition-dot" />
                {c.label}
                {c.state === "pending" && <em>not yet wired</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
