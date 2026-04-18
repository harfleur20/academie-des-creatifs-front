import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight, Info } from "lucide-react";
import { fetchNotifications, type NotificationItem } from "../lib/commerceApi";

const STORAGE_KEY = "notif_read_ids";

function getReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

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

function NotifDropdown({ allNotifPath, onClose }: { allNotifPath: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications().then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function markAll() {
    const next = new Set([...readIds, ...items.map((n) => n.id)]);
    setReadIds(next); saveReadIds(next);
  }
  function markOne(id: string) {
    const next = new Set(readIds); next.add(id);
    setReadIds(next); saveReadIds(next);
  }

  const unread = items.filter((n) => !readIds.has(n.id));

  return (
    <div className="notif-dropdown" ref={ref}>
      <div className="notif-dropdown__head">
        <span className="notif-dropdown__title">
          Notifications
          {unread.length > 0 && <span className="notif-dropdown__count">{unread.length}</span>}
        </span>
        {unread.length > 0 && (
          <button type="button" className="notif-dropdown__mark-all" onClick={markAll}>
            <Check size={12} /> Tout marquer lu
          </button>
        )}
      </div>

      <div className="notif-dropdown__list">
        {loading && <p className="notif-dropdown__empty">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="notif-dropdown__empty">Aucune notification.</p>
        )}
        {items.slice(0, 6).map((n) => {
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
                  {n.action_label ?? "Consulter"} <ChevronRight size={12} />
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
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(() => {
    fetchNotifications()
      .then((items) => {
        const readIds = getReadIds();
        setUnreadCount(items.filter((n) => !readIds.has(n.id)).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);

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
      {open && <NotifDropdown allNotifPath={allNotifPath} onClose={handleClose} />}
    </div>
  );
}
