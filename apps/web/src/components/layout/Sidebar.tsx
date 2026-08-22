import { NavLink } from "react-router-dom";
import "./sidebar.css";

/**
 * The rail. Grouped by where each screen sits in the decision chain rather
 * than as one flat list of features — the navigation itself teaches the
 * workflow: what exists → what it's worth → what to do → prove it.
 */
const GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Command", index: "00" }],
  },
  {
    label: "Surface",
    items: [{ to: "/assets", label: "Assets", index: "01" }],
  },
  {
    label: "Analysis",
    items: [
      { to: "/risks", label: "Risk engine", index: "02" },
      { to: "/financial", label: "Quantification", index: "03" },
    ],
  },
  {
    label: "Decision",
    items: [{ to: "/optimization", label: "Optimizer", index: "04" }],
  },
  {
    label: "Assurance",
    items: [
      { to: "/compliance", label: "Regulatory", index: "05" },
      { to: "/audit", label: "Audit trail", index: "06" },
    ],
  },
];

export function Sidebar() {
  return (
    <nav className="rail" aria-label="Primary">
      <div className="rail__brand">
        <img src="/kairon-logo-light.png" alt="KAIRON" className="rail__mark" />
        <span className="rail__brand-text">
          <span className="rail__wordmark">KAIRON</span>
          <span className="rail__tagline">Risk Intelligence</span>
        </span>
      </div>

      <div className="rail__groups">
        {GROUPS.map((group) => (
          <div key={group.label} className="rail__group">
            <span className="rail__group-label">{group.label}</span>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => "rail__link" + (isActive ? " rail__link--active" : "")}
                  >
                    <span className="rail__index num">{item.index}</span>
                    <span className="rail__label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rail__foot">
        <span className="rail__foot-line">Classical solver active</span>
        <span className="rail__foot-note">QAOA in development</span>
      </div>
    </nav>
  );
}
