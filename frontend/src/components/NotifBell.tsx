import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight, Info, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { dismissNotificationsRemote, fetchNotifications, type NotificationItem } from "../lib/commerceApi";
import {
  dismissNotifications,
  getNotificationDismissedIds,
  getNotificationReadIds,
  getNotificationStateScope,
  markNotificationsRead,
  subscribeToNotificationState,
} from "../lib/notificationState";

function toneIcon(tone: string) {
  if (tone === "success") return <Check size={13} />;
  if (tone === "warning") return <span style={{ fontSize: "0.7rem" }}>⚠</span>;
  return <Info size={13} />;
}
function toneColor(tone: string) {
  if (tone === "success") return "#16a34a";
  if (tone === "warning") return "#f59e0b";
  return "#1c8480";
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function NotifDropdown({
  allNotifPath,
  onClose,
  onUnreadCountChange,
}: {
  allNotifPath: string;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const notificationScope = getNotificationStateScope(user);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    getNotificationReadIds(notificationScope),
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    getNotificationDismissedIds(notificationScope),
  );
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const syncNotificationState = useCallback(() => {
    setReadIds(getNotificationReadIds(notificationScope));
    setDismissedIds(getNotificationDismissedIds(notificationScope));
  }, [notificationScope]);

  useEffect(() => {
    fetchNotifications().then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    syncNotificationState();
  }, [syncNotificationState]);

  useEffect(() => subscribeToNotificationState(notificationScope, syncNotificationState), [
    notificationScope,
    syncNotificationState,
  ]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const visibleItems = items.filter((n) => !dismissedIds.has(n.id));
  const unread = visibleItems.filter((n) => !readIds.has(n.id));

  useEffect(() => {
    if (!loading) onUnreadCountChange(unread.length);
  }, [loading, onUnreadCountChange, unread.length]);

  function markAll() {
    markNotificationsRead(notificationScope, visibleItems.map((item) => item.id));
    syncNotificationState();
  }
  function markOne(id: string) {
    markNotificationsRead(notificationScope, [id]);
    syncNotificationState();
  }
  function clearNotifications() {
    if (visibleItems.length === 0) return;

    const visibleIds = visibleItems.map((n) => n.id);
    dismissNotifications(notificationScope, visibleIds);
    syncNotificationState();
    onUnreadCountChange(0);
    dismissNotificationsRemote(visibleIds).catch(() => {});
  }

  return (
    <div className="notif-dropdown" ref={ref}>
      <div className="notif-dropdown__head">
        <span className="notif-dropdown__title">
          Notifications
          {unread.length > 0 && <span className="notif-dropdown__count">{unread.length}</span>}
        </span>
        <div className="notif-dropdown__actions">
          {unread.length > 0 && (
            <button type="button" className="notif-dropdown__mark-all" onClick={markAll}>
              <Check size={12} /> Tout marquer lu
            </button>
          )}
          {!loading && visibleItems.length > 0 && (
            <button
              type="button"
              className="notif-dropdown__clear"
              onClick={clearNotifications}
              aria-label="Vider les notifications"
              title="Vider les notifications"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="notif-dropdown__list">
        {loading && <p className="notif-dropdown__empty">Chargement…</p>}
        {!loading && visibleItems.length === 0 && (
          <p className="notif-dropdown__empty">Aucune notification.</p>
        )}
        {visibleItems.slice(0, 6).map((n) => {
          const isRead = readIds.has(n.id);
          return (
            <div
              key={n.id}
              className={`notif-item${isRead ? " notif-item--read" : ""}`}
              onClick={() => markOne(n.id)}
            >
              <span className="notif-item__dot" style={{ background: toneColor(n.tone) }}>
                {toneIcon(n.tone)}
              </span>
              <div className="notif-item__body">
                <strong className="notif-item__title">{n.title}</strong>
                <span className="notif-item__msg">{n.message}</span>
                <span className="notif-item__time">{timeAgo(n.created_at)}</span>
              </div>
              {n.action_path && (
                <button
                  type="button"
                  className="notif-item__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    markOne(n.id);
                    navigate(n.action_path!);
                    onClose();
                  }}
                >
                  {n.action_label ?? "Voir"} <ChevronRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="notif-dropdown__footer">
        <button
          type="button"
          className="notif-dropdown__see-all"
          onClick={() => { navigate(allNotifPath); onClose(); }}
        >
          Voir toutes les notifications
        </button>
      </div>
    </div>
  );
}

interface NotifBellProps {
  allNotifPath: string;
  className?: string;
}

export default function NotifBell({ allNotifPath, className = "dsh-topbar__icon-btn" }: NotifBellProps) {
  const { user } = useAuth();
  const notificationScope = getNotificationStateScope(user);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(() => {
    fetchNotifications()
      .then((items) => {
        const readIds = getNotificationReadIds(notificationScope);
        const dismissedIds = getNotificationDismissedIds(notificationScope);
        setUnreadCount(items.filter((n) => !readIds.has(n.id) && !dismissedIds.has(n.id)).length);
      })
      .catch(() => {});
  }, [notificationScope]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  useEffect(() => subscribeToNotificationState(notificationScope, refreshCount), [
    notificationScope,
    refreshCount,
  ]);

  function handleClose() {
    setOpen(false);
    refreshCount();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={className}
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="dsh-topbar__notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <NotifDropdown
          allNotifPath={allNotifPath}
          onClose={handleClose}
          onUnreadCountChange={setUnreadCount}
        />
      )}
    </div>
  );
}
