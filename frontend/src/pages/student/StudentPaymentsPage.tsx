import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Layers,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";
import { fetchMyOrders, type StudentOrder, type StudentPaymentLine } from "../../lib/studentApi";
import { fetchStudentDashboardSummary } from "../../lib/commerceApi";
import { useAuth } from "../../auth/AuthContext";

/* ── Helpers ── */
function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtLong(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ── Invoice PDF ── */
function generateInvoice(order: StudentOrder, studentName: string, studentCode: string) {
  const paidTotal = order.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const logoUrl = `${window.location.origin}/logo_academie_hd.png`;
  const rows = order.payments.map((p) => `
    <tr>
      <td>${p.installment_number ? `Versement ${p.installment_number}` : "Paiement unique"}</td>
      <td>${fmt(p.due_date)}</td>
      <td>${p.paid_at ? fmt(p.paid_at) : "—"}</td>
      <td><strong>${p.amount_label}</strong></td>
      <td style="color:${p.status === "confirmed" ? "#16a34a" : p.status === "late" ? "#ef4444" : "#f59e0b"}; font-weight:700">
        ${p.status === "confirmed" ? "✓ Payé" : p.status === "late" ? "⚠ En retard" : "◷ En attente"}
      </td>
    </tr>`).join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Facture ${order.reference}</title>
  <style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:760px;margin:auto}
    .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .hd img{height:54px;object-fit:contain}
    .hd-right{text-align:right;font-size:.78rem;color:#6b7280}
    .hd-right strong{display:block;font-size:1.05rem;color:#1f2352;font-weight:900}
    hr{border:none;border-top:2px solid #1c8480;margin:16px 0}
    .stu{background:#f1f5fb;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:.84rem}
    .lbl{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af}
    .stu strong{color:#1f2352;font-size:.95rem}
    .stu .mat{color:#6b7280;font-size:.78rem;margin-top:3px}
    .stu .mat strong{color:#1f2352}
    h3{font-size:.88rem;font-weight:700;color:#1f2352;margin:20px 0 6px;text-transform:uppercase;letter-spacing:.04em}
    .info{font-size:.82rem;color:#374151;margin-bottom:12px;line-height:1.6}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700}
    .badge-3x{background:#dbeafe;color:#1d4ed8}
    .badge-1x{background:#d1fae5;color:#065f46}
    table{width:100%;border-collapse:collapse;font-size:.83rem;margin-top:8px}
    th{text-align:left;padding:9px 10px;background:#1f2352;color:#fff;font-weight:700}
    td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
    tr:last-child td{border-bottom:none}
    .tot{display:flex;justify-content:space-between;margin-top:14px;font-weight:700;font-size:1rem;padding:12px 16px;background:linear-gradient(135deg,#1f2352,#1c8480);color:#fff;border-radius:8px}
    .foot{margin-top:36px;font-size:.7rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;text-align:center}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="hd">
    <img src="${logoUrl}" alt="L'Académie des Créatifs"/>
    <div class="hd-right"><strong>FACTURE / REÇU</strong>Réf. ${order.reference}<br>Émise le ${fmt(new Date().toISOString())}</div>
  </div>
  <hr/>
  <div class="stu">
    <div class="lbl">Étudiant</div>
    <strong>${studentName}</strong>
    ${studentCode ? `<div class="mat">Matricule : <strong>${studentCode}</strong></div>` : ""}
  </div>
  <h3>Formation</h3>
  <div class="info">
    <strong>${order.formation_title}</strong> — ${order.format_type}<br>
    Date de commande : ${fmt(order.created_at)}<br>
    Plan : <span class="${order.installment_plan === "3x" ? "badge badge-3x" : "badge badge-1x"}">${order.installment_plan === "3x" ? "Paiement en 3 fois" : "Paiement unique"}</span>
  </div>
  <h3>Détail des paiements</h3>
  <table>
    <thead><tr><th>Description</th><th>Échéance</th><th>Payé le</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot"><span>Total payé</span><span>${paidTotal.toLocaleString("fr-FR")} FCFA</span></div>
  <div class="foot">L'Académie des Créatifs · formations &amp; apprentissages · Ce document fait office de reçu officiel</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

/* ══════════════════════════════════════════════════
   INSTALLMENT STEPPER  (for 3x plans)
   ══════════════════════════════════════════════════ */
function InstallmentStepper({ payments }: { payments: StudentPaymentLine[] }) {
  return (
    <div className="pay-stepper">
      {payments.map((p, i) => {
        const isDone = p.status === "confirmed";
        const isLate = p.status === "late";
        const isPending = !isDone && !isLate;
        return (
          <div key={p.id} className="pay-stepper__item">
            {/* Connector line */}
            {i > 0 && <div className={`pay-stepper__line${isDone ? " pay-stepper__line--done" : ""}`} />}

            <div className={`pay-stepper__dot ${isDone ? "pay-stepper__dot--done" : isLate ? "pay-stepper__dot--late" : "pay-stepper__dot--pending"}`}>
              {isDone ? <CheckCircle size={14} /> : isLate ? <AlertTriangle size={12} /> : <span>{i + 1}</span>}
            </div>

            <div className="pay-stepper__info">
              <span className="pay-stepper__label">Versement {i + 1}</span>
              <strong className="pay-stepper__amount">{p.amount_label}</strong>
              <span className="pay-stepper__date">
                {isDone ? `Payé le ${fmt(p.paid_at)}` : `Échéance : ${fmt(p.due_date)}`}
              </span>
              {isLate && <span className="pay-stepper__tag pay-stepper__tag--late">En retard</span>}
              {isPending && p.due_label && (
                <span className={`pay-stepper__tag ${p.due_label.includes("proche") ? "pay-stepper__tag--warn" : "pay-stepper__tag--info"}`}>
                  {p.due_label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SINGLE PAYMENT VIEW
   ══════════════════════════════════════════════════ */
function SinglePaymentView({ payment }: { payment: StudentPaymentLine }) {
  const isDone = payment.status === "confirmed";
  const isLate = payment.status === "late";
  return (
    <div className={`pay-single ${isDone ? "pay-single--done" : isLate ? "pay-single--late" : "pay-single--pending"}`}>
      <span className="pay-single__icon">
        {isDone ? <CheckCircle size={20} /> : isLate ? <AlertTriangle size={20} /> : <Clock size={20} />}
      </span>
      <div className="pay-single__body">
        <strong>{payment.amount_label}</strong>
        <span>
          {isDone ? `Paiement confirmé · ${fmt(payment.paid_at)}` :
           isLate  ? `En retard · Échéance dépassée le ${fmt(payment.due_date)}` :
                     `En attente · Échéance le ${fmt(payment.due_date)}`}
        </span>
      </div>
      {!isDone && payment.due_label && (
        <span className={`pay-single__tag ${isLate ? "pay-single__tag--late" : "pay-single__tag--warn"}`}>
          {payment.due_label}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ORDER CARD
   ══════════════════════════════════════════════════ */
function OrderCard({ order, studentName, studentCode }: {
  order: StudentOrder;
  studentName: string;
  studentCode: string;
}) {
  const isInstallment = order.installment_plan === "3x" || order.installment_plan === "2x";
  const is3x = order.installment_plan === "3x";
  const paidCount = order.payments.filter((p) => p.status === "confirmed").length;
  const hasLate = order.payments.some((p) => p.status === "late");
  const paidPct = order.total_amount > 0
    ? Math.round((order.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0) / order.total_amount) * 100)
    : 0;

  const statusColor = order.status === "paid" ? "green" : order.status === "partially_paid" ? "yellow" : hasLate ? "red" : "blue";
  const statusLabel = order.status === "paid" ? "Soldé" : order.status === "partially_paid" ? `${paidCount}/${order.payments.length} versements` : hasLate ? "Retard" : "En attente";

  return (
    <div className={`pay-card ${hasLate ? "pay-card--late" : ""}`}>
      {/* ── Card header ── */}
      <div className="pay-card__head">
        <div className="pay-card__head-left">
          <span className={`pay-type-badge ${isInstallment ? "pay-type-badge--3x" : "pay-type-badge--1x"}`}>
            {is3x ? <><Layers size={11} /> 3 versements</> : isInstallment ? <><Layers size={11} /> 2 versements</> : <><Zap size={11} /> Paiement unique</>}
          </span>
          <h3 className="pay-card__name">{order.formation_title}</h3>
          <p className="pay-card__meta">
            {order.format_type} · Réf. <strong>{order.reference}</strong> · Commandé le {fmt(order.created_at)}
          </p>
        </div>
        <div className="pay-card__head-right">
          <span className="pay-card__total">{order.total_amount_label}</span>
          <span className={`pay-card__status pay-card__status--${statusColor}`}>{statusLabel}</span>
          <button
            type="button"
            className="pay-card__dl-btn"
            onClick={() => generateInvoice(order, studentName, studentCode)}
            title="Télécharger la facture"
          >
            <Download size={13} /> Facture
          </button>
        </div>
      </div>

      {/* ── Progress (3x only) ── */}
      {isInstallment && (
        <div className="pay-card__progress">
          <div className="pay-card__progress-bar" style={{ width: `${paidPct}%` }} />
          <span className="pay-card__progress-text">{paidPct}% réglé</span>
        </div>
      )}

      {/* ── Payments detail ── */}
      <div className="pay-card__body">
        {isInstallment
          ? <InstallmentStepper payments={order.payments} />
          : order.payments[0] && <SinglePaymentView payment={order.payments[0]} />
        }
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REMINDERS SECTION
   ══════════════════════════════════════════════════ */
function RemindersSection({ orders }: { orders: StudentOrder[] }) {
  const upcoming = orders
    .flatMap((o) => o.payments.map((p) => ({ ...p, formation: o.formation_title })))
    .filter((p) => p.status === "pending" || p.status === "late")
    .sort((a, b) => new Date(a.due_date ?? "").getTime() - new Date(b.due_date ?? "").getTime())
    .slice(0, 4);

  if (upcoming.length === 0) return null;

  return (
    <div className="pay-reminders">
      <h2 className="pay-reminders__title">
        <Clock size={15} /> Rappels de paiement
      </h2>
      <div className="pay-reminders__list">
        {upcoming.map((p) => {
          const isLate = p.status === "late";
          return (
            <div key={p.id} className={`pay-reminder-item ${isLate ? "pay-reminder-item--late" : ""}`}>
              <div className="pay-reminder-item__icon">
                {isLate ? <AlertTriangle size={15} /> : <Clock size={15} />}
              </div>
              <div className="pay-reminder-item__body">
                <strong>{p.formation}</strong>
                <span>{p.installment_number ? `Versement ${p.installment_number}` : "Paiement unique"} · {fmtLong(p.due_date)}</span>
              </div>
              <div className="pay-reminder-item__right">
                <strong>{p.amount_label}</strong>
                <span className={`pay-reminder-item__tag ${isLate ? "pay-reminder-item__tag--late" : "pay-reminder-item__tag--soon"}`}>
                  {isLate ? "En retard" : p.due_label ?? "À venir"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   KPI SUMMARY
   ══════════════════════════════════════════════════ */
function KpiRow({ orders }: { orders: StudentOrder[] }) {
  const allPayments = orders.flatMap((o) => o.payments);
  const paid   = allPayments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const due    = allPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const late   = allPayments.filter((p) => p.status === "late").length;
  const formations = orders.length;
  return (
    <div className="pay-kpi-row">
      <div className="pay-kpi pay-kpi--blue">
        <span className="pay-kpi__icon"><Receipt size={17} /></span>
        <div><strong>{formations}</strong><span>Formation{formations > 1 ? "s" : ""}</span></div>
      </div>
      <div className="pay-kpi pay-kpi--green">
        <span className="pay-kpi__icon"><CheckCircle size={17} /></span>
        <div><strong>{paid.toLocaleString("fr-FR")} F</strong><span>Total payé</span></div>
      </div>
      <div className="pay-kpi pay-kpi--yellow">
        <span className="pay-kpi__icon"><TrendingUp size={17} /></span>
        <div><strong>{due.toLocaleString("fr-FR")} F</strong><span>Restant dû</span></div>
      </div>
      <div className={`pay-kpi ${late > 0 ? "pay-kpi--red" : "pay-kpi--gray"}`}>
        <span className="pay-kpi__icon"><AlertTriangle size={17} /></span>
        <div><strong>{late}</strong><span>En retard</span></div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════ */
type TabId = "all" | "3x" | "1x" | "late";
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "all",  label: "Toutes",         icon: <Receipt size={13} /> },
  { id: "3x",   label: "Versements",      icon: <Layers size={13} /> },
  { id: "1x",   label: "Paiement unique", icon: <Zap size={13} /> },
  { id: "late", label: "En retard",      icon: <AlertTriangle size={13} /> },
];

/* ══════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════ */
export default function StudentPaymentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("all");
  const [studentCode, setStudentCode] = useState("");

  useEffect(() => {
    Promise.all([fetchMyOrders(), fetchStudentDashboardSummary()])
      .then(([fetchedOrders, summary]) => {
        setOrders(fetchedOrders);
        setStudentCode(summary.student_code ?? "");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === "3x")   return orders.filter((o) => o.installment_plan === "3x" || o.installment_plan === "2x");
    if (tab === "1x")   return orders.filter((o) => o.installment_plan === "full");
    if (tab === "late") return orders.filter((o) => o.payments.some((p) => p.status === "late"));
    return orders;
  }, [orders, tab]);

  const counts: Record<TabId, number> = {
    all:  orders.length,
    "3x": orders.filter((o) => o.installment_plan === "3x" || o.installment_plan === "2x").length,
    "1x": orders.filter((o) => o.installment_plan === "full").length,
    late: orders.filter((o) => o.payments.some((p) => p.status === "late")).length,
  };

  const studentName = user?.full_name ?? "Étudiant";
  const taraReturn = searchParams.get("gateway") === "tara";

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  return (
    <div className="pay-page">
      {/* Header */}
      <div className="pay-page__header">
        <div>
          <h1 className="pay-page__title">Mes paiements</h1>
          <p className="pay-page__sub">Suivi de vos commandes et factures</p>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            className="pay-dl-all-btn"
            onClick={() => orders.forEach((o) => generateInvoice(o, studentName, studentCode))}
          >
            <Download size={14} /> Tout télécharger
          </button>
        )}
      </div>

      {/* Alerts */}
      {taraReturn && (
        <div className="pay-alert pay-alert--info">
          <Clock size={15} />
          Paiement Tara Money initié. Votre commande apparaîtra ici dès confirmation.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="pay-empty">
          <FileText size={40} strokeWidth={1} />
          <p>Aucune commande pour le moment.</p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <KpiRow orders={orders} />

          {/* Rappels */}
          <RemindersSection orders={orders} />

          {/* Tabs */}
          <div className="pay-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pay-tab${tab === t.id ? " pay-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon} {t.label}
                {counts[t.id] > 0 && (
                  <span className={`pay-tab__count${tab === t.id ? " pay-tab__count--active" : ""}`}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="pay-empty">
              <FileText size={36} strokeWidth={1.2} />
              <p>Aucune commande dans cette catégorie.</p>
            </div>
          ) : (
            <div className="pay-list">
              {filtered.map((order) => (
                <OrderCard
                  key={order.reference}
                  order={order}
                  studentName={studentName}
                  studentCode={studentCode}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
