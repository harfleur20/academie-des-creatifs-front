import { Link } from "react-router-dom";
import { FaMapMarkerAlt, FaPlus, FaUsers, FaVideo } from "react-icons/fa";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  buildMonthlyRevenueSeries,
  buildSparkline,
  formatTypeLabel,
  sessionStateClassName,
  sessionStateLabel,
  statusLabel,
} from "../../admin/adminDashboardUtils";

export default function AdminOverviewPage() {
  const {
    overview,
    loading,
    loadingError,
    orders,
    sessions,
    featuredFormationsCount,
    openCreateFormationEditor,
    openCreateSessionEditor,
  } = useAdminDashboard();

  const revenueSeries = buildMonthlyRevenueSeries(orders);
  const sparkline = buildSparkline(revenueSeries.map((entry) => entry.value));
  const recentSessions = sessions.slice(0, 4);
  const latestOrders = orders.slice(0, 5);

  return (
    <div className="admin-workspace">
      <section className="admin-page-hero">
        <div className="admin-page-hero__copy">
          <p className="admin-section__eyebrow">Vue d'ensemble</p>
          <h1>Un cockpit plus net pour piloter ventes, cohortes et catalogue.</h1>
          <p>
            Chaque ecran garde maintenant un seul objectif. Ici tu regardes la sante
            globale du business, sans te battre contre des formulaires partout.
          </p>
          <div className="admin-page-hero__actions">
            <button className="admin-action-button" type="button" onClick={openCreateFormationEditor}>
              <FaPlus />
              Nouvelle formation
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => openCreateSessionEditor()}>
              <FaVideo />
              Nouvelle session
            </button>
          </div>
        </div>

        <div className="admin-page-hero__rail">
          <article className="admin-highlight-card admin-highlight-card--navy">
            <span>Revenus confirmes</span>
            <strong>{overview?.total_confirmed_revenue_label ?? "..."}</strong>
            <small>Commandes reglees et valides</small>
          </article>
          <article className="admin-highlight-card">
            <span>Produits vedettes</span>
            <strong>{featuredFormationsCount}</strong>
            <small>Formations visibles sur la vitrine</small>
          </article>
          <article className="admin-highlight-card">
            <span>Sessions actives</span>
            <strong>{sessions.length}</strong>
            <small>Live et presentiel confondus</small>
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
          <section className="admin-metric-strip">
            <article className="admin-stat-card">
              <span>Live</span>
              <strong>{overview.live_formations_count}</strong>
              <small>cohortes synchrones</small>
            </article>
            <article className="admin-stat-card">
              <span>Ligne</span>
              <strong>{overview.ligne_formations_count}</strong>
              <small>acces classique</small>
            </article>
            <article className="admin-stat-card">
              <span>Presentiel</span>
              <strong>{overview.presentiel_formations_count}</strong>
              <small>suivi academique</small>
            </article>
            <article className="admin-stat-card">
              <span>Commandes payees</span>
              <strong>{overview.paid_orders_count}</strong>
              <small>tunnel converti</small>
            </article>
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-surface-card admin-surface-card--chart">
              <div className="admin-surface-card__header">
                <div>
                  <p className="admin-section__eyebrow">Finance</p>
                  <h2>Traction des revenus sur les 6 derniers mois</h2>
                </div>
                <div className="admin-chip-row">
                  <span className="admin-chip admin-chip--soft">Catalogue</span>
                  <span className="admin-chip admin-chip--soft">Paiements</span>
                </div>
              </div>

              <div className="admin-line-chart">
                <svg viewBox={`0 0 ${sparkline.width} ${sparkline.height}`} aria-hidden="true">
                  <defs>
                    <linearGradient id="adminOverviewFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(32, 163, 157, 0.26)" />
                      <stop offset="100%" stopColor="rgba(32, 163, 157, 0.03)" />
                    </linearGradient>
                  </defs>
                  <path d={sparkline.areaPath} fill="url(#adminOverviewFill)" />
                  <path d={sparkline.linePath} className="admin-line-chart__line" />
                </svg>
                <div className="admin-line-chart__legend">
                  {revenueSeries.map((entry) => (
                    <div key={entry.key}>
                      <span>{entry.label}</span>
                      <strong>{entry.value > 0 ? `${Math.round(entry.value / 1000)}k` : "0"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="admin-surface-card">
              <div className="admin-surface-card__header">
                <div>
                  <p className="admin-section__eyebrow">Sessions</p>
                  <h2>Fenetre d'inscription</h2>
                </div>
                <Link className="admin-inline-link" to="/admin/sessions">
                  Voir tout
                </Link>
              </div>
              <div className="admin-session-summary-list">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <div className="admin-session-summary" key={session.id}>
                      <div>
                        <strong>{session.formation_title}</strong>
                        <span>
                          {formatTypeLabel(session.format_type)} · {session.start_date} → {session.end_date}
                        </span>
                      </div>
                      <span className={sessionStateClassName(session.session_state)}>
                        {sessionStateLabel(session.session_state)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="admin-empty-table">Aucune session en cours de suivi.</div>
                )}
              </div>
            </article>

            <article className="admin-surface-card">
              <div className="admin-surface-card__header">
                <div>
                  <p className="admin-section__eyebrow">Commandes</p>
                  <h2>Derniers mouvements</h2>
                </div>
                <Link className="admin-inline-link" to="/admin/orders">
                  Voir tout
                </Link>
              </div>
              <div className="admin-compact-list">
                {latestOrders.length ? (
                  latestOrders.map((order) => (
                    <div className="admin-compact-list__item" key={order.id}>
                      <div>
                        <strong>{order.reference}</strong>
                        <span>{order.customer_name}</span>
                      </div>
                      <div>
                        <strong>{order.total_amount_label}</strong>
                        <span>{statusLabel(order.status)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="admin-empty-table">Aucune commande recente.</div>
                )}
              </div>
            </article>

            <article className="admin-surface-card">
              <div className="admin-surface-card__header">
                <div>
                  <p className="admin-section__eyebrow">Audience</p>
                  <h2>Repartition des comptes</h2>
                </div>
              </div>
              <div className="admin-mini-metrics">
                <div className="admin-mini-metrics__item">
                  <span className="admin-mini-metrics__icon admin-mini-metrics__icon--students">
                    <FaUsers />
                  </span>
                  <div>
                    <strong>{overview.users_count}</strong>
                    <span>Comptes total</span>
                  </div>
                </div>
                <div className="admin-mini-metrics__item">
                  <span className="admin-mini-metrics__icon admin-mini-metrics__icon--live">
                    <FaVideo />
                  </span>
                  <div>
                    <strong>{overview.live_formations_count}</strong>
                    <span>Offres live</span>
                  </div>
                </div>
                <div className="admin-mini-metrics__item">
                  <span className="admin-mini-metrics__icon admin-mini-metrics__icon--onsite">
                    <FaMapMarkerAlt />
                  </span>
                  <div>
                    <strong>{overview.presentiel_sessions_count}</strong>
                    <span>Sessions presentiel</span>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
