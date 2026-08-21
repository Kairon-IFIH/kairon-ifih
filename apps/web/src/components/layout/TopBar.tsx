import { LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { NotificationBell } from "./NotificationBell";
import "./topbar.css";

export function TopBar({ title }: { title: string }) {
  const { logout } = useAuth();

  return (
    <header className="topbar">
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__actions">
        <NotificationBell />
        <button type="button" className="topbar__logout" onClick={logout} aria-label="Sign out">
          <LogOut size={17} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
