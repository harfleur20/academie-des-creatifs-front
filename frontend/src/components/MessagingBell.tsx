import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import {
  createMessagingSocket,
  fetchMessagingSummary,
  type MessagingSocketEvent,
} from "../lib/messagingApi";

type Props = {
  to: string;
  className?: string;
};

export default function MessagingBell({ to, className = "dsh-topbar__icon-btn" }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let reconnectDelay = 3000;

    fetchMessagingSummary()
      .then((summary) => setUnreadCount(summary.unread_count))
      .catch(() => setUnreadCount(0));

    const connect = () => {
      if (closed) return;
      socket = createMessagingSocket();
      socket.onopen = () => {
        reconnectDelay = 3000;
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MessagingSocketEvent;
          if (data.type === "messages.summary") {
            setUnreadCount(data.unread_count);
          }
          if (data.type === "messages.message_created" || data.type === "messages.thread_created") {
            fetchMessagingSummary()
              .then((summary) => setUnreadCount(summary.unread_count))
              .catch(() => undefined);
          }
        } catch {
          // Ignore malformed socket frames.
        }
      };
      socket.onclose = () => {
        if (!closed) {
          const delay = reconnectDelay;
          reconnectDelay = Math.min(reconnectDelay * 2, 60000);
          window.setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, []);

  return (
    <Link to={to} className={`msg-bell ${className}`.trim()} aria-label="Messages">
      <MessageCircle size={17} strokeWidth={2} />
      {unreadCount > 0 && <span className="dsh-topbar__notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </Link>
  );
}
