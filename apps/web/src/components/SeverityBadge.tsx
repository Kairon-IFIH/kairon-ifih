import "./severity-badge.css";

const VAR_NAME: Record<string, string> = {
  CRITICAL: "--severity-critical",
  HIGH: "--severity-high",
  MEDIUM: "--severity-medium",
  LOW: "--severity-low",
};

export function SeverityBadge({ level }: { level: string }) {
  const varName = VAR_NAME[level] ?? "--text-tertiary";
  return (
    <span className="severity-badge" style={{ color: `var(${varName})`, borderColor: `var(${varName})` }}>
      {level}
    </span>
  );
}
