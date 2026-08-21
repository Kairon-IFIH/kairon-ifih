import type { BriefingLine } from "../../lib/intelligence";
import "./intelligence-briefing.css";

/**
 * Today's Signals — a continuously derived intelligence briefing.
 *
 * Not a chatbot, not an assistant, no prompt box. Every line is generated
 * from data the platform actually holds, and `buildBriefing` refuses to emit
 * a statement it cannot back — so an empty institution gets a short briefing,
 * never filler dressed up as insight.
 */
export function IntelligenceBriefing({ lines, generatedAt }: { lines: BriefingLine[]; generatedAt: Date }) {
  return (
    <div className="briefing">
      <div className="briefing__meta">
        <span className="briefing__stamp num">
          {generatedAt.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
          {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="briefing__source">{lines.length} findings</span>
      </div>

      <ol className="briefing__lines">
        {lines.map((line, i) => (
          <li key={line.id} className="briefing__line" data-tone={line.tone}>
            <span className="briefing__index num">{String(i + 1).padStart(2, "0")}</span>
            <p>{line.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
