import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead } from "../../lib/endpoints";
import type { Notification } from "../../types/api";
import "./notification-bell.css";

const TYPE_LABEL: Record<Notification["type"], string> = {
  OPTIMIZATION_COMPLETE: "Optimization complete",
  REMEDIATION_PENDING_APPROVAL: "Remediation pending approval",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listNotifications(false, 1, 10)
      .then((page) => setNotifications(page.items))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className="notif__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && <span className="notif__badge num">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notif__panel" role="menu">
          <div className="notif__panel-header eyebrow">Notifications</div>
          {!loaded ? (
            <div className="notif__empty">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="notif__empty">No notifications yet — you'll see optimization runs and approvals here.</div>
          ) : (
            <ul className="notif__list">
              {notifications.map((n) => (
                <li key={n.id} className={"notif__item" + (n.read ? "" : " notif__item--unread")}>
                  <button type="button" onClick={() => handleRead(n.id)} disabled={n.read}>
                    <span className="notif__item-title">{TYPE_LABEL[n.type]}</span>
                    <span className="notif__item-time num">{new Date(n.createdAt).toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
