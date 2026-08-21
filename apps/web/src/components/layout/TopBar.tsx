import { LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { NotificationBell } from "./NotificationBell";
import "./topbar.css";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__heading">
        <h1 className="topbar__title">{title}</h1>
        {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
      </div>

      <div className="topbar__actions">
        {/* The tenant the whole screen is scoped to — tenant context is the
            platform's core isolation guarantee, so it stays visible. */}
        <span className="topbar__tenant">
          <span className="topbar__tenant-label">Tenant</span>
          <span className="topbar__tenant-value num">demo-tenant</span>
        </span>
        <NotificationBell />
        <button type="button" className="topbar__logout" onClick={logout} aria-label="Sign out">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
