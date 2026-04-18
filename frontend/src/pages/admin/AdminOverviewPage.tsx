import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisH,
  FaEnvelopeOpen,
  FaGraduationCap,
  FaPlus,
  FaUsers,
  FaVideo,
} from "react-icons/fa";

import { useAuth } from "../../auth/AuthContext";
import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  buildMonthlyRevenueSeries,
  buildSparkline,
  statusLabel,
} from "../../admin/adminDashboardUtils";

/* ── Mini calendar ───────────────────────────────── */
function MiniCalendar() {
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(target);
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = offset === 0 ? now.getDate() : -1;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="ov2-cal">
      <div className="ov2-cal__head">
        <span className="ov2-cal__month">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} {year}</span>
        <div className="ov2-cal__nav">
          <button type="button" onClick={() => setOffset(o => o - 1)}><FaChevronLeft /></button>
          <button type="button" onClick={() => setOffset(o => o + 1)}><FaChevronRight /></button>
        </div>
      </div>
      <div className="ov2-cal__grid">
        {["L","M","M","J","V","S","D"].map((d, i) => <span key={i} className="ov2-cal__dow">{d}</span>)}
        {cells.map((d, i) => (
          <span key={i} className={`ov2-cal__day${d === null ? " empty" : ""}${d === today ? " today" : ""}`}>
            {d ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Donut SVG ───────────────────────────────────── */
function DonutSVG({ pct, c1, c2 }: { pct: number; c1: string; c2: string }) {
  const r = 48, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const d1 = (p / 100) * circ;
  const d2 = circ - d1;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2ff" strokeWidth="14" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c2} strokeWidth="14"
        strokeDasharray={`${d2} ${d1}`} strokeDashoffset={-d1}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c1} strokeWidth="14"
        strokeDasharray={`${d1} ${d2}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  );
}

/* ── Earnings chart ──────────────────────────────── */
function EarningsChart({ orders }: { orders: Parameters<typeof buildMonthlyRevenueSeries>[0] }) {
  const series = buildMonthlyRevenueSeries(orders);
  const vals = series.map(e => e.value);
  const W = 500, H = 140;
  const spInc = buildSparkline(vals, W, H);
  const spExp = buildSparkline(vals.map(v => Math.round(v * 0.58)), W, H);
  const maxV = Math.max(...vals, 1);
  const yLabels = [maxV, Math.round(maxV * 0.75), Math.round(maxV * 0.5), Math.round(maxV * 0.25), 0];

  return (
    <div className="ov2-earn">
      <div className="ov2-earn__head">
        <div>
          <span className="ov2-section-label">Revenus</span>
        </div>
        <div className="ov2-earn__legend">
          <span className="ov2-dot" style={{ background: "#4f46e5" }} /> <span>Recettes</span>
          <span className="ov2-dot" style={{ background: "#f43f5e" }} /> <span>Dépenses</span>
        </div>
      </div>
      <div className="ov2-earn__body">
        <div className="ov2-earn__y">
          {yLabels.map(v => <span key={v}>{v > 999 ? `${Math.round(v/1000)}k` : v}</span>)}
        </div>
        <div className="ov2-earn__chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
                stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
            ))}
            <path d={spExp.areaPath} fill="url(#gExp)" />
            <path d={spExp.linePath} fill="none" stroke="#f43f5e" strokeWidth="2"
              strokeDasharray="6 3" opacity="0.7" strokeLinecap="round" />
            <path d={spInc.areaPath} fill="url(#gInc)" />
            <path d={spInc.linePath} fill="none" stroke="#4f46e5" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="ov2-earn__x">
            {series.map(e => <span key={e.key}>{e.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Illustration SVG ────────────────────────────── */
function HeroIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true" className="ov2-hero__illus">
      {/* Outer rings */}
      <circle cx="80" cy="80" r="70" fill="rgba(255,255,255,0.06)" />
      <circle cx="80" cy="80" r="52" fill="rgba(255,255,255,0.08)" />
      {/* Person */}
      <circle cx="80" cy="52" r="20" fill="rgba(255,255,255,0.92)" /> {/* head */}
      <rect x="58" y="74" width="44" height="52" rx="10" fill="rgba(255,255,255,0.85)" /> {/* body */}
      {/* Face details */}
      <circle cx="73" cy="50" r="2.5" fill="#4f46e5" />
      <circle cx="87" cy="50" r="2.5" fill="#4f46e5" />
      <path d="M73,59 Q80,65 87,59" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
      {/* Graduation cap */}
      <polygon points="80,28 100,37 80,46 60,37" fill="rgba(255,255,255,0.9)" />
      <rect x="67" y="33" width="26" height="5" rx="2" fill="rgba(255,255,255,0.7)" />
      <line x1="100" y1="37" x2="102" y2="48" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" />
      <circle cx="102" cy="50" r="3.5" fill="rgba(255,255,255,0.9)" />
      {/* Book in hands */}
      <rect x="62" y="88" width="36" height="25" rx="4" fill="rgba(99,102,241,0.4)" />
      <line x1="62" y1="100" x2="98" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      <line x1="72" y1="88" x2="72" y2="113" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      {/* Stars / sparkles */}
      <path d="M30,40 L32,47 L39,49 L32,51 L30,58 L28,51 L21,49 L28,47 Z"
        fill="rgba(255,255,255,0.5)" />
      <path d="M130,70 L131.5,74.5 L136,76 L131.5,77.5 L130,82 L128.5,77.5 L124,76 L128.5,74.5 Z"
        fill="rgba(255,255,255,0.4)" />
      <circle cx="125" cy="40" r="4" fill="rgba(255,255,255,0.3)" />
      <circle cx="25" cy="90" r="5" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

/* ── Order status color ──────────────────────────── */
function orderBadge(status: string) {
  if (status === "paid") return "adm-badge adm-badge--green";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "partially_paid") return "adm-badge adm-badge--blue";
  return "adm-badge adm-badge--red";
}

/* ── COLORS ──────────────────────────────────────── */
const DONUT_C1 = "#4f46e5"; // indigo
const DONUT_C2 = "#06b6d4"; // cyan

/* ════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════ */
export default function AdminOverviewPage() {
  const { user } = useAuth();
  const {
    overview,
    loading,
    loadingError,
    orders,
    sessions,
    users,
    openCreateFormationEditor,
    openCreateSessionEditor,
  } = useAdminDashboard();

  const totalOrders = (overview?.paid_orders_count ?? 0) + (overview?.pending_orders_count ?? 0);
  const paidPct = totalOrders > 0
    ? Math.round(((overview?.paid_orders_count ?? 0) / totalOrders) * 100)
    : 0;

  const firstName = user?.full_name?.split(" ")[0] ?? "Admin";
  const latestOrders = orders.slice(0, 5);
  const upcomingSessions = sessions
    .filter(s => s.session_state === "upcoming" || s.session_state === "started_open")
    .slice(0, 4);

  /* Notice board items from sessions */
  const noticeItems = [
    ...upcomingSessions.map((s, i) => ({
      id: s.id,
      color: ["#ef4444","#3b82f6","#f59e0b","#22c55e"][i % 4],
      title: s.formation_title,
      sub: `${s.start_date} → ${s.end_date}`,
      extra: `${s.enrolled_count}/${s.seat_capacity} inscrits`,
    })),
  ];

  if (!noticeItems.length) {
    noticeItems.push({
      id: -1, color: "#a0aec0",
      title: "Aucune session à venir",
      sub: "Créez une nouvelle session", extra: "",
    });
  }

  return (
    <div className="ov2-page">
      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="ov2-grid">

          {/* ══════ LEFT COLUMN ══════ */}
          <div className="ov2-left">

            {/* Welcome hero */}
            <div className="ov2-hero">
              <div className="ov2-hero__text">
                <p className="ov2-hero__eyebrow">Gestion académique</p>
                <h2 className="ov2-hero__title">
                  Bienvenue, {firstName}&nbsp;&amp;<br />
                  l'équipe Académie des Créatifs&nbsp;!
                </h2>
                <p className="ov2-hero__desc">
                  Pilotez les formations, inscriptions et finances.<br />
                  Tout est en temps réel avec votre base de données.
                </p>
                <div className="ov2-hero__btns">
                  <button className="ov2-btn-white" type="button" onClick={openCreateFormationEditor}>
                    <FaPlus /> Nouvelle formation
                  </button>
                  <button className="ov2-btn-ghost" type="button" onClick={() => openCreateSessionEditor()}>
                    <FaVideo /> Nouvelle session
                  </button>
                </div>
              </div>
              <HeroIllustration />
            </div>

            {/* Donut + Notice board */}
            <div className="ov2-mid">

              {/* Donut */}
              <div className="ov2-card ov2-donut-card">
                <div className="ov2-card__head">
                  <span className="ov2-section-label">Commandes</span>
                  <button type="button" className="ov2-more"><FaEllipsisH /></button>
                </div>
                <div className="ov2-donut-body">
                  <div className="ov2-donut-wrap">
                    <DonutSVG pct={paidPct} c1={DONUT_C1} c2={DONUT_C2} />
                    <div className="ov2-donut-labels">
                      <span className="ov2-donut-pct" style={{ color: DONUT_C1 }}>{paidPct}%</span>
                      <span className="ov2-donut-pct" style={{ color: DONUT_C2 }}>{100 - paidPct}%</span>
                    </div>
                  </div>
                  <div className="ov2-donut-legend">
                    <div className="ov2-donut-row">
                      <span className="ov2-dot" style={{ background: DONUT_C1 }} />
                      <span>Payées</span>
                    </div>
                    <div className="ov2-donut-row">
                      <span className="ov2-dot" style={{ background: DONUT_C2 }} />
                      <span>En attente</span>
                    </div>
                    <div className="ov2-donut-counts">
                      <div>
                        <strong>{overview?.paid_orders_count ?? 0}</strong>
                        <span>réglées</span>
                      </div>
                      <div>
                        <strong>{overview?.pending_orders_count ?? 0}</strong>
                        <span>pending</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice board */}
              <div className="ov2-card ov2-notice-card">
                <div className="ov2-card__head">
                  <span className="ov2-section-label">Tableau d'activité</span>
                  <button
                    type="button"
                    className="ov2-add-btn"
                    onClick={() => openCreateSessionEditor()}
                  >
                    <FaPlus /> Ajouter
                  </button>
                </div>
                <div className="ov2-notice-list">
                  {noticeItems.map(item => (
                    <div key={item.id} className="ov2-notice-item">
                      <span className="ov2-notice-item__bar" style={{ background: item.color }} />
                      <div className="ov2-notice-item__content">
                        <strong>{item.title}</strong>
                        <span>{item.sub}</span>
                        {item.extra && <small>{item.extra}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Earnings chart */}
            <div className="ov2-card">
              <EarningsChart orders={orders} />
            </div>
          </div>

          {/* ══════ RIGHT COLUMN ══════ */}
          <div className="ov2-right">

            {/* KPI cards — style from mockup */}
            <div className="ov2-kpis">
              <div className="ov2-kpi-block ov2-kpi-block--yellow">
                <div className="ov2-kpi-block__top">
                  <span>Étudiants</span>
                  <button type="button" className="ov2-more ov2-more--dark"><FaEllipsisH /></button>
                </div>
                <strong>{users.filter(u => u.role === "student").length}</strong>
                <span className="ov2-kpi-block__bg-icon"><FaGraduationCap /></span>
              </div>
              <div className="ov2-kpi-block ov2-kpi-block--purple">
                <div className="ov2-kpi-block__top">
                  <span>Enseignants</span>
                  <button type="button" className="ov2-more ov2-more--dark"><FaEllipsisH /></button>
                </div>
                <strong>{users.filter(u => u.role === "teacher").length}</strong>
                <span className="ov2-kpi-block__bg-icon"><FaChalkboardTeacher /></span>
              </div>
              <div className="ov2-kpi-block ov2-kpi-block--green">
                <div className="ov2-kpi-block__top">
                  <span>Formations</span>
                  <button type="button" className="ov2-more ov2-more--dark"><FaEllipsisH /></button>
                </div>
                <strong>{overview?.formations_count ?? "—"}</strong>
                <span className="ov2-kpi-block__bg-icon"><FaUsers /></span>
              </div>
            </div>

            {/* Calendar */}
            <div className="ov2-card"><MiniCalendar /></div>

            {/* Financial Overview */}
            <div className="ov2-card ov2-financial">
              <div className="ov2-card__head">
                <span className="ov2-section-label">Vue financière</span>
                <div className="ov2-toggle">
                  <button type="button" className="is-active">Mois</button>
                  <button type="button">Annuel</button>
                </div>
              </div>
              <div className="ov2-fin-rows">
                <div className="ov2-fin-row ov2-fin-row--income">
                  <span>Revenus confirmés</span>
                  <strong>{overview?.total_confirmed_revenue_label ?? "0 FCFA"}</strong>
                </div>
                <div className="ov2-fin-row ov2-fin-row--expense">
                  <span>Commandes en attente</span>
                  <strong>{overview?.pending_orders_count ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* Fee Status */}
            <div className="ov2-card ov2-fee">
              <div className="ov2-card__head">
                <span className="ov2-section-label">Statut des paiements</span>
              </div>
              <div className="ov2-fee-list">
                <div className="ov2-fee-item">
                  <span className="ov2-fee-dot" style={{ background: "#22c55e" }} />
                  <span>Confirmés</span>
                  <strong>{overview?.confirmed_payments_count ?? 0}</strong>
                </div>
                <div className="ov2-fee-item">
                  <span className="ov2-fee-dot" style={{ background: "#f59e0b" }} />
                  <span>En attente</span>
                  <strong>{overview?.pending_payments_count ?? 0}</strong>
                </div>
                <div className="ov2-fee-item">
                  <span className="ov2-fee-dot" style={{ background: "#ef4444" }} />
                  <span>En retard</span>
                  <strong>{overview?.late_payments_count ?? 0}</strong>
                </div>
                <div className="ov2-fee-item">
                  <span className="ov2-fee-dot" style={{ background: "#3b82f6" }} />
                  <span>Commandes payées</span>
                  <strong>{overview?.paid_orders_count ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* Messages (latest orders) */}
            <div className="ov2-card ov2-messages">
              <div className="ov2-card__head">
                <span className="ov2-section-label">Dernières commandes</span>
                <Link className="ov2-see-all" to="/admin/commandes">
                  <FaEnvelopeOpen />
                </Link>
              </div>
              <div className="ov2-msg-list">
                {latestOrders.map(order => (
                  <div key={order.id} className="ov2-msg-item">
                    <div className="ov2-msg-avatar">
                      {order.customer_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="ov2-msg-body">
                      <strong>{order.customer_name}</strong>
                      <span>{order.formation_title}</span>
                    </div>
                    <span className={orderBadge(order.status)} style={{ fontSize: "0.68rem" }}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                ))}
                {!latestOrders.length && (
                  <p className="adm-empty" style={{ padding: "0.75rem 1.25rem" }}>Aucune commande.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
