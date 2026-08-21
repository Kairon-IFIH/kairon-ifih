import "./kpi-card.css";

interface KpiCardProps {
  label: string;
  value: string;
  accent: "data" | "risk" | "safe" | "warn";
  hint?: string;
}

export function KpiCard({ label, value, accent, hint }: KpiCardProps) {
  return (
    <div className="kpi-card" data-accent={accent}>
      <div className="kpi-card__tick" />
      <span className="eyebrow">{label}</span>
      <span className="kpi-card__value num">{value}</span>
      {hint && <span className="kpi-card__hint">{hint}</span>}
    </div>
  );
}
