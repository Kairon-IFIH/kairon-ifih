import type { Signal } from "../../lib/intelligence";
import "./signal-feed.css";

/**
 * Signal Feed — the audit log read the way a trader reads the tape.
 *
 * Not an alert list. Each row is a movement: what moved, by how much, and in
 * which direction. Tone is carried by an explicit rail glyph and the wording
 * as well as colour, so direction survives without colour vision.
 */

const TONE_GLYPH: Record<Signal["tone"], string> = {
  elevation: "▲",
  reduction: "▼",
  governance: "◆",
  neutral: "·",
};

export function SignalFeed({ signals, limit }: { signals: Signal[]; limit?: number }) {
  const rows = limit ? signals.slice(0, limit) : signals;

  return (
    <ol className="feed">
      {rows.map((s) => (
        <li key={s.id} className="feed__row" data-tone={s.tone}>
          <span className="feed__rail" aria-hidden="true">
            {TONE_GLYPH[s.tone]}
          </span>
          <time className="feed__time num">{s.time}</time>
          <span className="feed__tag">{s.tag}</span>
          <span className="feed__body">
            <span className="feed__headline">{s.headline}</span>
            {s.detail && <span className="feed__detail">{s.detail}</span>}
          </span>
          {s.magnitude && <span className="feed__magnitude num">{s.magnitude}</span>}
        </li>
      ))}
    </ol>
  );
}
