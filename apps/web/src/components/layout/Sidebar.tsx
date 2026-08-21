import { NavLink } from "react-router-dom";
import { LayoutGrid, Boxes, ShieldAlert, IndianRupee, Atom, FileCheck2, ScrollText } from "lucide-react";
import "./sidebar.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/assets", label: "Assets", icon: Boxes },
  { to: "/risks", label: "Risks", icon: ShieldAlert },
  { to: "/financial", label: "Financial", icon: IndianRupee },
  { to: "/optimization", label: "Optimization", icon: Atom },
  { to: "/compliance", label: "Compliance", icon: FileCheck2 },
  { to: "/audit", label: "Audit", icon: ScrollText },
];

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <span className="sidebar__mark">K</span>
        <span className="sidebar__wordmark">KAIRON</span>
      </div>
      <ul className="sidebar__list">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
