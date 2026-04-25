import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaGraduationCap,
  FaMapMarkedAlt,
  FaTrashAlt,
} from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import {
  fetchNotifications,
  type NotificationCategory,
  type NotificationItem,
  type NotificationTone,
} from "../lib/commerceApi";
import {
  dismissNotifications,
  getNotificationDismissedIds,
  getNotificationReadIds,
  getNotificationStateScope,
  markNotificationsRead,
  subscribeToNotificationState,
} from "../lib/notificationState";

function getToneIcon(tone: NotificationTone) {
  if (tone === "success") {
    return <FaCheckCircle />;
  }

  if (tone === "warning") {
    return <FaExclamationTriangle />;
  }

  return <FaBell />;
}

function getCategoryLabel(category: NotificationCategory) {
  if (category === "payment") {
    return "Paiement";
  }

  if (category === "enrollment") {
    return "Inscription";
  }

  if (category === "session") {
    return "Session";
  }

  if (category === "assignment") {
    return "Devoir";
  }

  if (category === "quiz") {
    return "Quiz";
  }

  if (category === "live") {
    return "Live";
  }

  if (category === "resource") {
    return "Ressource";
  }

  if (category === "result") {
    return "Resultat";
  }

  if (category === "admin") {
    return "Administration";
  }

  return "Systeme";
}

function getEmptyTitle(role: string | undefined) {
  if (role === "admin") {
    return "Aucune alerte admin pour le moment.";
  }

  if (role === "teacher") {
    return "Aucune notification enseignant pour le moment.";
  }

  return "Aucune notification etudiante pour le moment.";
}

function getHeroIcon(role: string | undefined) {
  if (role === "admin") {
    return <FaExclamationTriangle />;
  }

  if (role === "teacher") {
    return <FaMapMarkedAlt />;
  }

  return <FaGraduationCap />;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const notificationScope = getNotificationStateScope(user);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    getNotificationReadIds(notificationScope),
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    getNotificationDismissedIds(notificationScope),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setReadIds(getNotificationReadIds(notificationScope));
    setDismissedIds(getNotificationDismissedIds(notificationScope));
  }, [notificationScope]);

  useEffect(
    () =>
      subscribeToNotificationState(notificationScope, () => {
        setReadIds(getNotificationReadIds(notificationScope));
        setDismissedIds(getNotificationDismissedIds(notificationScope));
      }),
    [notificationScope],
  );

  useEffect(() => {
    fetchNotifications()
      .then((items) => {
        setNotifications(items);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger vos notifications.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedIds.has(notification.id)),
    [dismissedIds, notifications],
  );
  const unreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !readIds.has(notification.id)).length,
    [readIds, visibleNotifications],
  );

  const intro = useMemo(() => {
    if (user?.role === "admin") {
      return "Suivez ici les paiements en attente, les commandes a surveiller et les points d'attention de l'administration.";
    }

    if (user?.role === "teacher") {
      return "Retrouvez ici vos rappels de sessions, vos prochaines cohortes et les informations utiles a votre suivi pedagogique.";
    }

    return "Retrouvez ici vos paiements, vos acces de formation, vos rappels de session et les informations importantes liees a votre progression.";
  }, [user?.role]);

  function handleMarkAll() {
    if (visibleNotifications.length === 0) {
      return;
    }
    markNotificationsRead(
      notificationScope,
      visibleNotifications.map((notification) => notification.id),
    );
    setReadIds(getNotificationReadIds(notificationScope));
  }

  function handleClearAll() {
    if (visibleNotifications.length === 0) {
      return;
    }
    dismissNotifications(
      notificationScope,
      visibleNotifications.map((notification) => notification.id),
    );
    setReadIds(getNotificationReadIds(notificationScope));
    setDismissedIds(getNotificationDismissedIds(notificationScope));
  }

  if (isLoading) {
    return (
      <div className="page commerce-page commerce-page--narrower">
        <section className="auth-card auth-card--centered protected-placeholder-card">
          <p className="eyebrow">Notifications</p>
          <h1>Chargement de vos alertes...</h1>
        </section>
      </div>
    );
  }

  return (
    <div className="page commerce-page commerce-page--narrower">
      <section className="notifications-hero">
        <div className="notifications-hero__icon">{getHeroIcon(user?.role)}</div>
        <p className="eyebrow">Notifications</p>
        <h1>Vos rappels et alertes, sans bruit inutile.</h1>
        <p className="page-intro">{intro}</p>
        <div className="notifications-hero__actions">
          {unreadCount > 0 ? (
            <button type="button" className="button button--secondary" onClick={handleMarkAll}>
              <FaCheckCircle />
              Tout marquer lu
            </button>
          ) : null}
          {visibleNotifications.length > 0 ? (
            <button type="button" className="button button--ghost-danger" onClick={handleClearAll}>
              <FaTrashAlt />
              Vider
            </button>
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <div className="dashboard-notice dashboard-notice--error">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {visibleNotifications.length > 0 ? (
        <section className="notifications-list">
          {visibleNotifications.map((notification) => (
            <article
              className={`notification-card notification-card--${notification.tone}`}
              key={notification.id}
            >
              <div className="notification-card__icon">
                {getToneIcon(notification.tone)}
              </div>
              <div className="notification-card__body">
                <div className="notification-card__meta">
                  <span>{getCategoryLabel(notification.category)}</span>
                  <time dateTime={notification.created_at}>
                    <FaClock />
                    {formatNotificationDate(notification.created_at)}
                  </time>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
                {notification.action_label && notification.action_path ? (
                  <Link
                    className="notification-card__action"
                    to={notification.action_path}
                    onClick={() => {
                      markNotificationsRead(notificationScope, [notification.id]);
                      setReadIds(getNotificationReadIds(notificationScope));
                    }}
                  >
                    {notification.action_label}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="formation-detail-empty notifications-empty">
          <p className="formation-detail-empty__eyebrow">Rien a signaler</p>
          <h1>{getEmptyTitle(user?.role)}</h1>
          <p>
            Les prochaines confirmations de paiement, ouvertures de parcours ou
            rappels de session apparaitront automatiquement ici.
          </p>
          <Link className="button button--primary" to="/">
            Retour au site
          </Link>
        </section>
      )}
    </div>
  );
}
