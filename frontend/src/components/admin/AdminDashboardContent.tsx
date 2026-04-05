import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaCrown,
  FaEdit,
  FaEye,
  FaFire,
  FaLaptop,
  FaMapMarkerAlt,
  FaPlus,
  FaSave,
  FaSearch,
  FaTag,
  FaVideo,
} from "react-icons/fa";

import type {
  AdminFormation,
  AdminOnsiteSession,
  AdminOrder,
  AdminOverview,
  AdminPayment,
  AdminUser,
  FormationFormat,
  OrderStatus,
  PaymentStatus,
  SessionState,
  UserRole,
  UserStatus,
} from "../../lib/catalogApi";

type Feedback = {
  type: "success" | "error";
  message: string;
};

type UserDraft = {
  role: UserRole;
  status: UserStatus;
};

type OrderDraft = {
  status: OrderStatus;
};

type PaymentDraft = {
  providerCode: string;
  status: PaymentStatus;
};

type CatalogDisplayFilter = "all" | "featured";

type Props = {
  overview: AdminOverview | null;
  loading: boolean;
  loadingError: string;
  filteredFormations: AdminFormation[];
  featuredFormationsCount: number;
  sessionCapableFormations: AdminFormation[];
  catalogSearch: string;
  catalogDisplayFilter: CatalogDisplayFilter;
  setCatalogSearch: (value: string) => void;
  setCatalogDisplayFilter: (value: CatalogDisplayFilter) => void;
  openCreateFormationEditor: () => void;
  openEditFormationEditor: (slug: string) => void;
  eligibleSessionFormationIds: Set<number>;
  openCreateSessionEditor: (formationId?: number) => void;
  sessions: AdminOnsiteSession[];
  availableSessionCreateFormations: AdminFormation[];
  openEditSessionEditor: (sessionId: number) => void;
  users: AdminUser[];
  userDrafts: Record<number, UserDraft>;
  userRoles: UserRole[];
  userStatuses: UserStatus[];
  syncUserDraft: (userId: number, field: keyof UserDraft, value: UserRole | UserStatus) => void;
  savingUserId: number | null;
  handleSaveUser: (user: AdminUser) => void;
  userFeedbackById: Record<number, Feedback>;
  orders: AdminOrder[];
  orderDrafts: Record<number, OrderDraft>;
  orderStatuses: OrderStatus[];
  syncOrderDraft: (orderId: number, status: OrderStatus) => void;
  savingOrderId: number | null;
  handleSaveOrder: (order: AdminOrder) => void;
  orderFeedbackById: Record<number, Feedback>;
  payments: AdminPayment[];
  paymentDrafts: Record<number, PaymentDraft>;
  paymentStatuses: PaymentStatus[];
  syncPaymentDraft: (
    paymentId: number,
    field: keyof PaymentDraft,
    value: string | PaymentStatus,
  ) => void;
  savingPaymentId: number | null;
  handleSavePayment: (payment: AdminPayment) => void;
  paymentFeedbackById: Record<number, Feedback>;
};

const FORMATIONS_PAGE_SIZE = 6;
const SESSIONS_PAGE_SIZE = 5;
const USERS_PAGE_SIZE = 6;
const ORDERS_PAGE_SIZE = 6;
const PAYMENTS_PAGE_SIZE = 6;

function formatTypeLabel(formatType: FormationFormat) {
  if (formatType === "ligne") return "Ligne";
  if (formatType === "presentiel") return "Presentiel";
  return "Live";
}

function dashboardTypeLabel(formatType: FormationFormat) {
  return formatType === "ligne" ? "Classique" : "Guide";
}

function statusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function badgeLabel(badge: string) {
  if (badge === "premium") return "Premium";
  if (badge === "populaire") return "Populaire";
  return "Promo";
}

function badgeIcon(badge: string) {
  if (badge === "premium") return <FaCrown />;
  if (badge === "populaire") return <FaFire />;
  return <FaTag />;
}

function sessionStateLabel(state: SessionState) {
  switch (state) {
    case "unscheduled":
      return "Aucune session";
    case "upcoming":
      return "A venir";
    case "started_open":
      return "En cours / ouverte";
    case "started_closed":
      return "En cours / fermee";
    case "ended":
      return "Terminee";
    case "not_applicable":
      return "Sans session";
    default:
      return "A venir";
  }
}

function sessionStateClassName(state: SessionState) {
  return `admin-status admin-status--session admin-status--session-${state}`;
}

function metricIcon(formatType: FormationFormat) {
  if (formatType === "live") return <FaVideo />;
  if (formatType === "presentiel") return <FaMapMarkerAlt />;
  return <FaLaptop />;
}

function getTotalPages(length: number, pageSize: number) {
  return Math.max(1, Math.ceil(length / pageSize));
}

function getPageItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = getTotalPages(items.length, pageSize);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

function includesSearchValue(values: Array<string | number | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

function buildMonthlyRevenueSeries(orders: AdminOrder[]) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatter.format(date).replace(".", ""),
      value: 0,
    };
  });
  const monthIndex = new Map(months.map((entry, index) => [entry.key, index]));

  orders.forEach((order) => {
    if (order.status !== "paid" && order.status !== "partially_paid") {
      return;
    }
    const parsedDate = new Date(order.created_at);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }
    const key = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
    const index = monthIndex.get(key);
    if (index !== undefined) {
      months[index].value += order.total_amount;
    }
  });

  return months;
}

function buildSparkline(values: number[], width = 420, height = 160) {
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const paddingX = 16;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const points = safeValues.map((value, index) => {
    const x =
      safeValues.length === 1
        ? width / 2
        : paddingX + (index / (safeValues.length - 1)) * innerWidth;
    const y = paddingY + ((max - value) / range) * innerHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${points[0]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`;

  return { width, height, linePath, areaPath };
}

function TablePager({
  page,
  totalPages,
  totalItems,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="admin-table-footer">
      <p>
        {label} · <strong>{totalItems}</strong>
      </p>
      <div className="admin-pagination">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Page precedente">
          <FaChevronLeft />
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Page suivante">
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboardContent({
  overview,
  loading,
  loadingError,
  filteredFormations,
  featuredFormationsCount,
  sessionCapableFormations,
  catalogSearch,
  catalogDisplayFilter,
  setCatalogSearch,
  setCatalogDisplayFilter,
  openCreateFormationEditor,
  openEditFormationEditor,
  eligibleSessionFormationIds,
  openCreateSessionEditor,
  sessions,
  availableSessionCreateFormations,
  openEditSessionEditor,
  users,
  userDrafts,
  userRoles,
  userStatuses,
  syncUserDraft,
  savingUserId,
  handleSaveUser,
  userFeedbackById,
  orders,
  orderDrafts,
  orderStatuses,
  syncOrderDraft,
  savingOrderId,
  handleSaveOrder,
  orderFeedbackById,
  payments,
  paymentDrafts,
  paymentStatuses,
  syncPaymentDraft,
  savingPaymentId,
  handleSavePayment,
  paymentFeedbackById,
}: Props) {
  const [formationPage, setFormationPage] = useState(1);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);

  useEffect(() => {
    setFormationPage(1);
  }, [catalogSearch, catalogDisplayFilter, filteredFormations.length]);

  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch, sessions.length]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, users.length]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orders.length]);

  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearch, payments.length]);

  const formationTotalPages = getTotalPages(filteredFormations.length, FORMATIONS_PAGE_SIZE);
  const visibleFormationPage = Math.min(formationPage, formationTotalPages);
  const paginatedFormations = useMemo(
    () => getPageItems(filteredFormations, visibleFormationPage, FORMATIONS_PAGE_SIZE),
    [filteredFormations, visibleFormationPage],
  );

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) =>
        includesSearchValue(
          [
            session.formation_title,
            session.label,
            session.campus_label,
            session.teacher_name,
            session.status,
          ],
          sessionSearch,
        ),
      ),
    [sessionSearch, sessions],
  );
  const sessionTotalPages = getTotalPages(filteredSessions.length, SESSIONS_PAGE_SIZE);
  const visibleSessionPage = Math.min(sessionPage, sessionTotalPages);
  const paginatedSessions = useMemo(
    () => getPageItems(filteredSessions, visibleSessionPage, SESSIONS_PAGE_SIZE),
    [filteredSessions, visibleSessionPage],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        includesSearchValue([user.full_name, user.email, user.role, user.status], userSearch),
      ),
    [userSearch, users],
  );
  const userTotalPages = getTotalPages(filteredUsers.length, USERS_PAGE_SIZE);
  const visibleUserPage = Math.min(userPage, userTotalPages);
  const paginatedUsers = useMemo(
    () => getPageItems(filteredUsers, visibleUserPage, USERS_PAGE_SIZE),
    [filteredUsers, visibleUserPage],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        includesSearchValue(
          [order.reference, order.customer_name, order.formation_title, order.status],
          orderSearch,
        ),
      ),
    [orderSearch, orders],
  );
  const orderTotalPages = getTotalPages(filteredOrders.length, ORDERS_PAGE_SIZE);
  const visibleOrderPage = Math.min(orderPage, orderTotalPages);
  const paginatedOrders = useMemo(
    () => getPageItems(filteredOrders, visibleOrderPage, ORDERS_PAGE_SIZE),
    [filteredOrders, visibleOrderPage],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) =>
        includesSearchValue(
          [payment.order_reference, payment.payer_name, payment.provider_code, payment.status],
          paymentSearch,
        ),
      ),
    [paymentSearch, payments],
  );
  const paymentTotalPages = getTotalPages(filteredPayments.length, PAYMENTS_PAGE_SIZE);
  const visiblePaymentPage = Math.min(paymentPage, paymentTotalPages);
  const paginatedPayments = useMemo(
    () => getPageItems(filteredPayments, visiblePaymentPage, PAYMENTS_PAGE_SIZE),
    [filteredPayments, visiblePaymentPage],
  );

  const revenueSeries = useMemo(() => buildMonthlyRevenueSeries(orders), [orders]);
  const sparkline = useMemo(
    () => buildSparkline(revenueSeries.map((entry) => entry.value)),
    [revenueSeries],
  );
  const orderStatusCounts = useMemo(
    () => ({
      paid: orders.filter((order) => order.status === "paid").length,
      pending: orders.filter((order) => order.status === "pending").length,
      partial: orders.filter((order) => order.status === "partially_paid").length,
      failed: orders.filter((order) => order.status === "failed").length,
    }),
    [orders],
  );
  const formatDistribution = useMemo(
    () => [
      { key: "live", label: "Live", count: overview?.live_formations_count ?? 0, icon: <FaVideo /> },
      { key: "ligne", label: "Ligne", count: overview?.ligne_formations_count ?? 0, icon: <FaLaptop /> },
      {
        key: "presentiel",
        label: "Presentiel",
        count: overview?.presentiel_formations_count ?? 0,
        icon: <FaMapMarkerAlt />,
      },
    ],
    [overview],
  );
  const maxFormatCount = Math.max(...formatDistribution.map((item) => item.count), 1);

  return (
    <div className="admin-dashboard-page admin-dashboard-page--modern">
      <section className="admin-hero-card" id="admin-overview">
        <div className="admin-hero-card__content">
          <p className="admin-hero-card__eyebrow">Admin dashboard</p>
          <h1>Un back-office plus net pour piloter catalogue, sessions et revenus.</h1>
          <p>
            L’interface met maintenant l’accent sur la lecture rapide, les listes productives
            et un panneau d’edition lateral pour garder l’ecran principal propre.
          </p>
          <div className="admin-hero-card__pills">
            <span className="admin-feature-pill">Vue analytique legere</span>
            <span className="admin-feature-pill">Tables paginees</span>
            <span className="admin-feature-pill">Edition en drawer</span>
          </div>
        </div>
        <div className="admin-hero-card__aside">
          <article className="admin-hero-metric admin-hero-metric--accent">
            <span>CA confirme</span>
            <strong>{overview?.total_confirmed_revenue_label ?? "..."}</strong>
            <small>Encaissements valides sur les ventes en cours</small>
          </article>
          <article className="admin-hero-metric">
            <span>Vedettes accueil</span>
            <strong>{featuredFormationsCount}</strong>
            <small>Produits mis en avant sur la vitrine</small>
          </article>
          <article className="admin-hero-metric">
            <span>Sessions suivies</span>
            <strong>{overview?.presentiel_sessions_count ?? sessions.length}</strong>
            <small>Live et presentiel uniquement</small>
          </article>
        </div>
      </section>

      {loading ? (
        <div className="admin-state-card">
          <p>Chargement du dashboard admin...</p>
        </div>
      ) : null}

      {loadingError ? (
        <div className="admin-state-card admin-state-card--error">
          <p>{loadingError}</p>
        </div>
      ) : null}

      {!loading && !loadingError && overview ? (
        <>
          <section className="admin-kpi-grid">
            <article className="admin-kpi-card">
              <span>Live</span>
              <strong>{overview.live_formations_count}</strong>
              <small>Sessions planifiables</small>
            </article>
            <article className="admin-kpi-card">
              <span>Ligne</span>
              <strong>{overview.ligne_formations_count}</strong>
              <small>Acces classique</small>
            </article>
            <article className="admin-kpi-card">
              <span>Presentiel</span>
              <strong>{overview.presentiel_formations_count}</strong>
              <small>Suivi academique</small>
            </article>
            <article className="admin-kpi-card">
              <span>Commandes payees</span>
              <strong>{overview.paid_orders_count}</strong>
              <small>Transactions finalisees</small>
            </article>
            <article className="admin-kpi-card">
              <span>Paiements en attente</span>
              <strong>{overview.pending_payments_count}</strong>
              <small>Mobile money, carte ou tranche</small>
            </article>
            <article className="admin-kpi-card">
              <span>Utilisateurs</span>
              <strong>{overview.users_count}</strong>
              <small>Admins, enseignants et etudiants</small>
            </article>
          </section>

          <section className="admin-analytics-grid">
            <article className="admin-chart-card admin-chart-card--wide">
              <div className="admin-chart-card__header">
                <div>
                  <p className="admin-section__eyebrow">Revenus</p>
                  <h3>Traction des ventes sur les 6 derniers mois</h3>
                </div>
                <div className="admin-chart-card__meta">
                  <strong>{overview.total_confirmed_revenue_label}</strong>
                  <span>cumul des commandes payees</span>
                </div>
              </div>
              <div className="admin-sparkline">
                <svg
                  className="admin-sparkline__canvas"
                  viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="adminRevenueFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(32, 163, 157, 0.32)" />
                      <stop offset="100%" stopColor="rgba(32, 163, 157, 0.02)" />
                    </linearGradient>
                  </defs>
                  <path
                    className="admin-sparkline__fill"
                    d={sparkline.areaPath}
                    fill="url(#adminRevenueFill)"
                  />
                  <path className="admin-sparkline__line" d={sparkline.linePath} />
                </svg>
                <div className="admin-month-list">
                  {revenueSeries.map((entry) => (
                    <div className="admin-month-list__item" key={entry.key}>
                      <span>{entry.label}</span>
                      <strong>{entry.value > 0 ? `${Math.round(entry.value / 1000)}k` : "0"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="admin-chart-card">
              <div className="admin-chart-card__header">
                <div>
                  <p className="admin-section__eyebrow">Catalogue</p>
                  <h3>Repartition par format</h3>
                </div>
              </div>
              <div className="admin-distribution-list">
                {formatDistribution.map((item) => (
                  <div className="admin-distribution-row" key={item.key}>
                    <div className="admin-distribution-row__label">
                      <span className={`admin-format-pill admin-format-pill--${item.key}`}>
                        {item.icon}
                        {item.label}
                      </span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="admin-distribution-bar">
                      <span
                        className={`admin-distribution-bar__fill admin-distribution-bar__fill--${item.key}`}
                        style={{ width: `${(item.count / maxFormatCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-chart-card">
              <div className="admin-chart-card__header">
                <div>
                  <p className="admin-section__eyebrow">Commandes</p>
                  <h3>Pipeline de traitement</h3>
                </div>
              </div>
              <div className="admin-status-grid">
                <div className="admin-status-metric admin-status-metric--paid">
                  <span>Payees</span>
                  <strong>{orderStatusCounts.paid}</strong>
                </div>
                <div className="admin-status-metric admin-status-metric--pending">
                  <span>En attente</span>
                  <strong>{orderStatusCounts.pending + orderStatusCounts.partial}</strong>
                </div>
                <div className="admin-status-metric admin-status-metric--failed">
                  <span>En echec</span>
                  <strong>{orderStatusCounts.failed}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="admin-section" id="admin-catalogue">
            <div className="admin-section__heading admin-section__heading--modern">
              <div>
                <p className="admin-section__eyebrow">Catalogue</p>
                <h2>Formations</h2>
                <p>Une liste compacte, des actions rapides, et un drawer d'edition.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="Rechercher une formation"
                  />
                </label>
                <div className="admin-filter-toggle" aria-label="Filtrer le catalogue">
                  <button
                    className={catalogDisplayFilter === "all" ? "is-active" : ""}
                    type="button"
                    onClick={() => setCatalogDisplayFilter("all")}
                  >
                    Toutes<strong>{overview?.formations_count ?? filteredFormations.length}</strong>
                  </button>
                  <button
                    className={catalogDisplayFilter === "featured" ? "is-active" : ""}
                    type="button"
                    onClick={() => setCatalogDisplayFilter("featured")}
                  >
                    Vedettes accueil<strong>{featuredFormationsCount}</strong>
                  </button>
                </div>
                <button className="admin-action-button" type="button" onClick={openCreateFormationEditor}>
                  <FaPlus />
                  Nouvelle formation
                </button>
              </div>
            </div>

            <div className="admin-table-card">
              <div className="admin-table-card__header">
                <div>
                  <h3>Catalogue public</h3>
                  <p>La home et le catalogue lisent la meme source.</p>
                </div>
                <span>{filteredFormations.length} resultat(s)</span>
              </div>
              <div className="admin-table-scroll">
                <table className="admin-resource-table">
                  <thead>
                    <tr>
                      <th>Formation</th>
                      <th>Format</th>
                      <th>Tarif</th>
                      <th>Session</th>
                      <th>Vitrine</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFormations.length ? (
                      paginatedFormations.map((formation) => (
                        <tr key={formation.slug}>
                          <td>
                            <div className="admin-resource-table__identity">
                              <img className="admin-resource-table__thumb" src={formation.image} alt={formation.title} />
                              <div>
                                <strong>{formation.title}</strong>
                                <span>{formation.category} · {formation.level}</span>
                                <div className="admin-table-badges">
                                  {formation.badges.map((badge) => (
                                    <span
                                      className={`admin-market-badge admin-market-badge--${badge}`}
                                      key={`${formation.slug}-${badge}`}
                                    >
                                      {badgeIcon(badge)}
                                      {badgeLabel(badge)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="admin-inline-stack">
                              <span className={`admin-format-pill admin-format-pill--${formation.format_type}`}>
                                {metricIcon(formation.format_type)}
                                {formatTypeLabel(formation.format_type)}
                              </span>
                              <small>{dashboardTypeLabel(formation.format_type)}</small>
                            </div>
                          </td>
                          <td>
                            <div className="admin-inline-stack">
                              <strong>{formation.current_price_label}</strong>
                              {formation.original_price_label ? <small>{formation.original_price_label}</small> : null}
                            </div>
                          </td>
                          <td>
                            <div className="admin-inline-stack">
                              <span className={sessionStateClassName(formation.session_state)}>
                                {sessionStateLabel(formation.session_state)}
                              </span>
                              <small>{formation.session_label ?? "Aucune session planifiee"}</small>
                            </div>
                          </td>
                          <td>
                            {formation.is_featured_home ? (
                              <span className="admin-feature-pill">Accueil · #{formation.home_feature_rank}</span>
                            ) : (
                              <span className="admin-feature-pill admin-feature-pill--muted">Catalogue seul</span>
                            )}
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              <Link
                                aria-label={`Voir ${formation.title}`}
                                className="admin-icon-button admin-icon-button--ghost"
                                to={`/formations/${formation.slug}`}
                              >
                                <FaEye />
                              </Link>
                              <button
                                aria-label={`Editer ${formation.title}`}
                                className="admin-icon-button admin-icon-button--accent"
                                type="button"
                                onClick={() => openEditFormationEditor(formation.slug)}
                              >
                                <FaEdit />
                              </button>
                              <button
                                aria-label={`Planifier une session pour ${formation.title}`}
                                className="admin-icon-button admin-icon-button--ghost"
                                type="button"
                                disabled={!eligibleSessionFormationIds.has(formation.id)}
                                onClick={() => openCreateSessionEditor(formation.id)}
                              >
                                <FaCalendarAlt />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="admin-empty-table">Aucune formation ne correspond aux filtres actuels.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={visibleFormationPage}
                totalPages={formationTotalPages}
                totalItems={filteredFormations.length}
                label="Catalogue"
                onPageChange={setFormationPage}
              />
            </div>
          </section>

          <section className="admin-section" id="admin-sessions">
            <div className="admin-section__heading admin-section__heading--modern">
              <div>
                <p className="admin-section__eyebrow">Sessions</p>
                <h2>Planning live et presentiel</h2>
                <p>{sessionCapableFormations.length} formation(s) peuvent utiliser des sessions.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder="Rechercher une session"
                  />
                </label>
                <button className="admin-action-button" type="button" onClick={() => openCreateSessionEditor()}>
                  <FaPlus />
                  Nouvelle session
                </button>
              </div>
            </div>

            <div className="admin-session-layout">
              <article className="admin-panel">
                <div className="admin-panel__heading">
                  <div>
                    <h3>Formations eligibles</h3>
                    <p>Seulement celles sans session ou avec session terminee.</p>
                  </div>
                  <span>{availableSessionCreateFormations.length}</span>
                </div>
                {availableSessionCreateFormations.length ? (
                  <div className="admin-session-eligibility-list">
                    {availableSessionCreateFormations.map((formation) => (
                      <button className="admin-session-eligibility" key={formation.id} type="button" onClick={() => openCreateSessionEditor(formation.id)}>
                        <div className="admin-session-eligibility__content">
                          <div className="admin-session-eligibility__topline">
                            <strong>{formation.title}</strong>
                            <span className={`admin-format-pill admin-format-pill--${formation.format_type}`}>
                              {metricIcon(formation.format_type)}
                              {formatTypeLabel(formation.format_type)}
                            </span>
                          </div>
                          <span>{formation.session_label ?? "Aucune session programmee"}</span>
                        </div>
                        <FaChevronRight />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty-table">
                    <p>Aucune formation live ou presentiel n'est actuellement eligible.</p>
                  </div>
                )}
              </article>
              <article className="admin-panel admin-panel--table">
                <div className="admin-panel__heading">
                  <div>
                    <h3>Sessions planifiees</h3>
                    <p>Suivi des cohortes et de leur fenetre d'inscription.</p>
                  </div>
                  <span>{filteredSessions.length}</span>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-resource-table">
                    <thead>
                      <tr>
                        <th>Formation</th>
                        <th>Periode</th>
                        <th>Inscrits</th>
                        <th>Etat</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSessions.length ? (
                        paginatedSessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              <div className="admin-inline-stack">
                                <strong>{session.formation_title}</strong>
                                <small>{session.label}</small>
                                <small>
                                  {session.campus_label || "Lieu a preciser"} ·{" "}
                                  {session.teacher_name || "Enseignant a attribuer"}
                                </small>
                              </div>
                            </td>
                            <td>
                              <div className="admin-inline-stack">
                                <strong>
                                  {session.start_date} → {session.end_date}
                                </strong>
                                <small>{session.session_label ?? "Fenetre publique en cours de calcul"}</small>
                              </div>
                            </td>
                            <td>
                              <div className="admin-inline-stack">
                                <strong>
                                  {session.enrolled_count}/{session.seat_capacity}
                                </strong>
                                <small>{session.can_purchase ? "Inscriptions ouvertes" : "Inscriptions fermees"}</small>
                              </div>
                            </td>
                            <td>
                              <div className="admin-inline-stack">
                                <span className={sessionStateClassName(session.session_state)}>
                                  {sessionStateLabel(session.session_state)}
                                </span>
                                <span className={`admin-status admin-status--${session.status}`}>
                                  {statusLabel(session.status)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                <button
                                  aria-label={`Editer ${session.label}`}
                                  className="admin-icon-button admin-icon-button--accent"
                                  type="button"
                                  onClick={() => openEditSessionEditor(session.id)}
                                >
                                  <FaEdit />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5}>
                            <div className="admin-empty-table">Aucune session ne correspond a cette recherche.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  page={visibleSessionPage}
                  totalPages={sessionTotalPages}
                  totalItems={filteredSessions.length}
                  label="Sessions"
                  onPageChange={setSessionPage}
                />
              </article>
            </div>
          </section>

          <section className="admin-section" id="admin-users">
            <div className="admin-section__heading admin-section__heading--modern">
              <div>
                <p className="admin-section__eyebrow">Utilisateurs</p>
                <h2>Rôles et statuts des comptes</h2>
                <p>Recherche rapide et modification inline sans sortir de la liste.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Rechercher un utilisateur"
                  />
                </label>
              </div>
            </div>
            <div className="admin-table-card">
              <div className="admin-table-scroll">
                <table className="admin-resource-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Role</th>
                      <th>Statut</th>
                      <th>Creation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length ? (
                      paginatedUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-inline-stack">
                              <strong>{user.full_name}</strong>
                              <small>{user.email}</small>
                            </div>
                          </td>
                          <td>
                            <select
                              value={userDrafts[user.id]?.role ?? user.role}
                              onChange={(event) =>
                                syncUserDraft(user.id, "role", event.target.value as UserRole)
                              }
                            >
                              {userRoles.map((role) => (
                                <option key={role} value={role}>
                                  {statusLabel(role)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={userDrafts[user.id]?.status ?? user.status}
                              onChange={(event) =>
                                syncUserDraft(user.id, "status", event.target.value as UserStatus)
                              }
                            >
                              {userStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{user.created_at}</td>
                          <td>
                            <div className="admin-actions-stack">
                              <button
                                aria-label={`Sauvegarder ${user.full_name}`}
                                className="admin-icon-button admin-icon-button--accent"
                                type="button"
                                disabled={savingUserId === user.id}
                                onClick={() => {
                                  void handleSaveUser(user);
                                }}
                              >
                                <FaSave />
                              </button>
                              {userFeedbackById[user.id] ? (
                                <p className={`admin-feedback admin-feedback--${userFeedbackById[user.id].type}`}>
                                  {userFeedbackById[user.id].message}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <div className="admin-empty-table">Aucun utilisateur ne correspond a cette recherche.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={visibleUserPage}
                totalPages={userTotalPages}
                totalItems={filteredUsers.length}
                label="Utilisateurs"
                onPageChange={setUserPage}
              />
            </div>
          </section>

          <section className="admin-section" id="admin-orders">
            <div className="admin-section__heading admin-section__heading--modern">
              <div>
                <p className="admin-section__eyebrow">Commandes</p>
                <h2>Suivi du tunnel d'achat</h2>
                <p>References, client, produit, statut et correction rapide.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Rechercher une commande"
                  />
                </label>
              </div>
            </div>
            <div className="admin-table-card">
              <div className="admin-table-scroll">
                <table className="admin-resource-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Client</th>
                      <th>Formation</th>
                      <th>Montant</th>
                      <th>Statut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length ? (
                      paginatedOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div className="admin-inline-stack">
                              <strong>{order.reference}</strong>
                              <small>{order.created_at}</small>
                            </div>
                          </td>
                          <td>{order.customer_name}</td>
                          <td>{order.formation_title}</td>
                          <td>{order.total_amount_label}</td>
                          <td>
                            <select
                              value={orderDrafts[order.id]?.status ?? order.status}
                              onChange={(event) =>
                                syncOrderDraft(order.id, event.target.value as OrderStatus)
                              }
                            >
                              {orderStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="admin-actions-stack">
                              <button
                                aria-label={`Sauvegarder ${order.reference}`}
                                className="admin-icon-button admin-icon-button--accent"
                                type="button"
                                disabled={savingOrderId === order.id}
                                onClick={() => {
                                  void handleSaveOrder(order);
                                }}
                              >
                                <FaSave />
                              </button>
                              {orderFeedbackById[order.id] ? (
                                <p className={`admin-feedback admin-feedback--${orderFeedbackById[order.id].type}`}>
                                  {orderFeedbackById[order.id].message}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="admin-empty-table">Aucune commande ne correspond a cette recherche.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={visibleOrderPage}
                totalPages={orderTotalPages}
                totalItems={filteredOrders.length}
                label="Commandes"
                onPageChange={setOrderPage}
              />
            </div>
          </section>

          <section className="admin-section" id="admin-payments">
            <div className="admin-section__heading admin-section__heading--modern">
              <div>
                <p className="admin-section__eyebrow">Paiements</p>
                <h2>Validation des flux de paiement</h2>
                <p>Prestataire, statut et confirmation rapide des paiements.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={paymentSearch}
                    onChange={(event) => setPaymentSearch(event.target.value)}
                    placeholder="Rechercher un paiement"
                  />
                </label>
              </div>
            </div>
            <div className="admin-table-card">
              <div className="admin-table-scroll">
                <table className="admin-resource-table">
                  <thead>
                    <tr>
                      <th>Commande</th>
                      <th>Payeur</th>
                      <th>Montant</th>
                      <th>Prestataire</th>
                      <th>Statut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length ? (
                      paginatedPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <div className="admin-inline-stack">
                              <strong>{payment.order_reference}</strong>
                              <small>{payment.paid_at ? `Regle le ${payment.paid_at}` : payment.created_at}</small>
                            </div>
                          </td>
                          <td>{payment.payer_name}</td>
                          <td>{payment.amount_label}</td>
                          <td>
                            <input
                              type="text"
                              value={paymentDrafts[payment.id]?.providerCode ?? payment.provider_code}
                              onChange={(event) =>
                                syncPaymentDraft(payment.id, "providerCode", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={paymentDrafts[payment.id]?.status ?? payment.status}
                              onChange={(event) =>
                                syncPaymentDraft(payment.id, "status", event.target.value as PaymentStatus)
                              }
                            >
                              {paymentStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="admin-actions-stack">
                              <button
                                aria-label={`Sauvegarder ${payment.order_reference}`}
                                className="admin-icon-button admin-icon-button--accent"
                                type="button"
                                disabled={savingPaymentId === payment.id}
                                onClick={() => {
                                  void handleSavePayment(payment);
                                }}
                              >
                                <FaSave />
                              </button>
                              {paymentFeedbackById[payment.id] ? (
                                <p className={`admin-feedback admin-feedback--${paymentFeedbackById[payment.id].type}`}>
                                  {paymentFeedbackById[payment.id].message}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="admin-empty-table">Aucun paiement ne correspond a cette recherche.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={visiblePaymentPage}
                totalPages={paymentTotalPages}
                totalItems={filteredPayments.length}
                label="Paiements"
                onPageChange={setPaymentPage}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
