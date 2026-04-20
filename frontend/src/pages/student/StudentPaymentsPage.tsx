import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  Download,
  FileText,
  Layers,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  checkoutGroupInstallment,
  fetchMyOrders,
  type GroupedInstallmentLine,
  type StudentOrderGroup,
  type StudentOrderSummary,
} from "../../lib/studentApi";
import type { PaymentProvider } from "../../lib/commerceApi";
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
function checkoutKey(line: GroupedInstallmentLine) {
  return line.checkout_key || (line.installment_number == null ? "single" : String(line.installment_number));
}
function paymentLineLabel(line: GroupedInstallmentLine) {
  return line.installment_number == null ? "Paiement unique" : `Versement ${line.installment_number}`;
}

/* ── Invoice PDF ── */
function generateGroupInvoice(group: StudentOrderGroup, studentName: string, studentCode: string) {
  const logoUrl = `${window.location.origin}/logo_academie_hd.png`;
  const confirmedTotal = group.grouped_payments
    .filter(p => p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);

  const formationRows = group.orders.map(o => `
    <tr>
      <td><strong>${o.formation_title}</strong></td>
      <td>${o.format_type}</td>
      <td>${o.total_amount_label}</td>
      <td style="color:${o.status === "paid" ? "#16a34a" : "#f59e0b"};font-weight:700">
        ${o.status === "paid" ? "✓ Soldé" : "◷ En cours"}
      </td>
    </tr>`).join("");

  const paymentRows = group.grouped_payments.map(p => `
    <tr>
      <td>${p.installment_number ? `Versement ${p.installment_number}` : "Paiement unique"}</td>
      <td>${p.due_date ? fmt(p.due_date) : "—"}</td>
      <td><strong>${p.amount_label}</strong></td>
      <td style="color:${p.status === "confirmed" ? "#16a34a" : "#f59e0b"};font-weight:700">
        ${p.status === "confirmed" ? "✓ Payé" : "◷ À régler"}
      </td>
    </tr>`).join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Facture ${group.group_reference}</title>
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
    h3{font-size:.88rem;font-weight:700;color:#1f2352;margin:20px 0 6px;text-transform:uppercase;letter-spacing:.04em}
    table{width:100%;border-collapse:collapse;font-size:.83rem;margin-top:8px}
    th{text-align:left;padding:9px 10px;background:#1f2352;color:#fff;font-weight:700}
    td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
    tr:last-child td{border-bottom:none}
    .tot{display:flex;justify-content:space-between;margin-top:14px;font-weight:700;font-size:1rem;padding:12px 16px;background:linear-gradient(135deg,#1f2352,#1c8480);color:#fff;border-radius:8px}
    .foot{margin-top:36px;font-size:.7rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;text-align:center}
  </style></head><body>
  <div class="hd">
    <img src="${logoUrl}" alt="L'Académie des Créatifs"/>
    <div class="hd-right"><strong>FACTURE / REÇU</strong>Réf. ${group.group_reference}<br>Émise le ${fmt(new Date().toISOString())}</div>
  </div>
  <hr/>
  <div class="stu">
    <div class="lbl">Étudiant</div>
    <strong>${studentName}</strong>
    ${studentCode ? `<div style="font-size:.78rem;color:#6b7280;margin-top:3px">Matricule : <strong style="color:#1f2352">${studentCode}</strong></div>` : ""}
  </div>
  <h3>Formations (${group.orders.length})</h3>
  <table>
    <thead><tr><th>Formation</th><th>Format</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${formationRows}</tbody>
  </table>
  <h3>Paiements</h3>
  <table>
    <thead><tr><th>Tranche</th><th>Échéance</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <div class="tot"><span>Total payé</span><span>${confirmedTotal.toLocaleString("fr-FR")} FCFA</span></div>
  <div class="foot">L'Académie des Créatifs · formations &amp; apprentissages · Ce document fait office de reçu officiel</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

/* ══════════════════════════════════════════════════
   INSTALLMENT STEPPER
   ══════════════════════════════════════════════════ */
function InstallmentStepper({
  payments,
  groupReference,
  onPay,
  payingKey,
}: {
  payments: GroupedInstallmentLine[];
  groupReference: string;
  onPay: (line: GroupedInstallmentLine) => void;
  payingKey: string | null;
}) {
  return (
    <div className="pay-stepper">
      {payments.map((p, i) => {
        const isDone = p.status === "confirmed";
        const key = `${groupReference}-${checkoutKey(p)}`;
        return (
          <div key={i} className="pay-stepper__item">
            {i > 0 && <div className={`pay-stepper__line${isDone ? " pay-stepper__line--done" : ""}`} />}
            <div className={`pay-stepper__dot ${isDone ? "pay-stepper__dot--done" : "pay-stepper__dot--pending"}`}>
              {isDone ? <CheckCircle size={14} /> : <span>{p.installment_number ?? "1x"}</span>}
            </div>
            <div className="pay-stepper__info">
              <span className="pay-stepper__label">{paymentLineLabel(p)}</span>
              <strong className="pay-stepper__amount">{p.amount_label}</strong>
              <span className="pay-stepper__date">
                {isDone ? "Payé" : `À régler : ${fmt(p.due_date)}`}
              </span>
              {p.can_pay && (
                <button
                  type="button"
                  className="pay-inline-btn"
                  disabled={payingKey === key}
                  onClick={() => onPay(p)}
                >
                  {payingKey === key ? "Préparation…" : "Payer cette tranche"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ORDER GROUP CARD
   ══════════════════════════════════════════════════ */
function OrderGroupCard({
  group,
  studentName,
  studentCode,
  onPay,
  payingKey,
}: {
  group: StudentOrderGroup;
  studentName: string;
  studentCode: string;
  onPay: (line: GroupedInstallmentLine, groupRef: string) => void;
  payingKey: string | null;
}) {
  const isInstallment = group.installment_plan !== "full";
  const isBundle = group.orders.length > 1;
  const paidCount = group.grouped_payments.filter(p => p.status === "confirmed").length;
  const totalCount = group.grouped_payments.length;
  const paidPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const statusColor = group.status === "paid" ? "green" : group.status === "partially_paid" ? "yellow" : "blue";
  const statusLabel = group.status === "paid" ? "Soldé" : group.status === "partially_paid" ? `${paidCount}/${totalCount} versements` : "À régler";

  const singlePayment = !isInstallment ? group.grouped_payments[0] : null;
  const canDownload = group.status === "paid" || (isInstallment && paidCount >= 1);

  return (
    <div className="pay-card">
      <div className="pay-card__head">
        {/* Col 1 — Info */}
        <div className="pay-card__head-left">
          <span className={`pay-type-badge ${isInstallment ? "pay-type-badge--3x" : "pay-type-badge--1x"}`}>
            {isBundle
              ? <><Layers size={11} /> {group.orders.length} formations groupées</>
              : isInstallment
                ? <><Layers size={11} /> {group.installment_plan} versements</>
                : <><Zap size={11} /> Paiement unique</>}
          </span>
          {isBundle ? (
            <div className="pay-card__bundle-list">
              {group.orders.map((o) => (
                <div key={o.reference} className="pay-card__bundle-item">
                  <span className="pay-card__bundle-title">{o.formation_title}</span>
                  <span className="pay-card__bundle-amount">{o.total_amount_label}</span>
                </div>
              ))}
            </div>
          ) : (
            <h3 className="pay-card__name">{group.orders[0]?.formation_title}</h3>
          )}
          <p className="pay-card__meta">
            Réf. <strong>{group.group_reference}</strong> · Commandé le {fmt(group.created_at)}
          </p>
        </div>

        {/* Col 2 — Prix + statut paiement */}
        <div className="pay-card__head-mid">
          <span className="pay-card__total">{group.total_amount_label}</span>
          {singlePayment && (
            <span className="pay-card__mid-sub">
              {singlePayment.status === "confirmed"
                ? <><CheckCircle size={14} /> Paiement confirmé · {fmt(singlePayment.due_date)}</>
                : <><Clock size={14} /> À régler · {fmt(singlePayment.due_date)}</>}
            </span>
          )}
          {isInstallment && (
            <span className="pay-card__mid-sub">{paidPct}% réglé · {paidCount}/{totalCount} versements</span>
          )}
          {singlePayment?.can_pay && (
            <button
              type="button"
              className="pay-inline-btn pay-inline-btn--right"
              disabled={payingKey === `${group.group_reference}-${checkoutKey(singlePayment)}`}
              onClick={() => onPay(singlePayment, group.group_reference)}
            >
              <Zap size={13} />
              {payingKey === `${group.group_reference}-${checkoutKey(singlePayment)}` ? "Préparation…" : "Payer maintenant"}
            </button>
          )}
        </div>

        {/* Col 3 — Statut + Facture */}
        <div className="pay-card__head-right">
          <span className={`pay-card__status pay-card__status--${statusColor}`}>{statusLabel}</span>
          {canDownload && (
            <button
              type="button"
              className="pay-card__dl-btn"
              onClick={() => generateGroupInvoice(group, studentName, studentCode)}
              title="Télécharger la facture"
            >
              <Download size={13} /> Facture
            </button>
          )}
        </div>
      </div>

      {/* Versements */}
      {isInstallment && (
        <div className="pay-card__body">
          <InstallmentStepper
            payments={group.grouped_payments}
            groupReference={group.group_reference}
            onPay={(line) => onPay(line, group.group_reference)}
            payingKey={payingKey}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   KPI SUMMARY
   ══════════════════════════════════════════════════ */
function KpiRow({ groups }: { groups: StudentOrderGroup[] }) {
  const allPayments = groups.flatMap(g => g.grouped_payments);
  const paid   = allPayments.filter(p => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const due    = allPayments.filter(p => p.status !== "confirmed").reduce((s, p) => s + p.amount, 0);
  const pendingCount = allPayments.filter(p => p.status !== "confirmed").length;
  const formations = groups.reduce((s, g) => s + g.orders.length, 0);
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
      <div className="pay-kpi pay-kpi--gray">
        <span className="pay-kpi__icon"><Clock size={17} /></span>
        <div><strong>{pendingCount}</strong><span>À régler</span></div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REMINDERS
   ══════════════════════════════════════════════════ */
function RemindersSection({ groups }: { groups: StudentOrderGroup[] }) {
  const upcoming = groups
    .flatMap(g => g.grouped_payments.map(p => ({ ...p, formations: g.orders.map(o => o.formation_title).join(" + ") })))
    .filter(p => p.status !== "confirmed")
    .sort((a, b) => new Date(a.due_date ?? "").getTime() - new Date(b.due_date ?? "").getTime())
    .slice(0, 4);

  if (upcoming.length === 0) return null;

  return (
    <div className="pay-reminders">
      <h2 className="pay-reminders__title"><Clock size={15} /> Rappels de paiement</h2>
      <div className="pay-reminders__list">
        {upcoming.map((p, i) => {
          return (
            <div key={i} className="pay-reminder-item">
              <div className="pay-reminder-item__icon">
                <Clock size={15} />
              </div>
              <div className="pay-reminder-item__body">
                <strong>{p.formations}</strong>
                <span>{paymentLineLabel(p)} · {fmtLong(p.due_date)}</span>
              </div>
              <div className="pay-reminder-item__right">
                <strong>{p.amount_label}</strong>
                <span className="pay-reminder-item__tag pay-reminder-item__tag--soon">
                  À régler
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
   TABS
   ══════════════════════════════════════════════════ */
type TabId = "all" | "versements" | "unique" | "pending";
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "all",        label: "Toutes",         icon: <Receipt size={13} /> },
  { id: "versements", label: "Versements",      icon: <Layers size={13} /> },
  { id: "unique",     label: "Paiement unique", icon: <Zap size={13} /> },
  { id: "pending",    label: "À régler",        icon: <Clock size={13} /> },
];

/* ══════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════ */
export default function StudentPaymentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState<StudentOrderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("all");
  const [studentCode, setStudentCode] = useState("");
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("stripe");

  const refreshGroups = () =>
    fetchMyOrders().then(setGroups);

  useEffect(() => {
    Promise.all([
      fetchMyOrders(),
      import("../../lib/commerceApi").then(m => m.fetchStudentDashboardSummary()),
    ]).then(([fetchedGroups, summary]) => {
      setGroups(fetchedGroups);
      setStudentCode(summary.student_code ?? "");
    }).finally(() => setIsLoading(false));
  }, []);

  const handlePay = async (line: GroupedInstallmentLine, groupRef: string) => {
    setPaymentMessage("");
    const key = `${groupRef}-${checkoutKey(line)}`;
    setPayingKey(key);
    try {
      const result = await checkoutGroupInstallment(
        groupRef,
        checkoutKey(line),
        paymentProvider,
      );
      setPaymentMessage(result.message);
      const externalUrl =
        result.external_redirect_url ??
        result.payment_links?.dikalo_link ??
        result.payment_links?.whatsapp_link ??
        result.payment_links?.telegram_link ??
        result.payment_links?.sms_link ??
        null;
      if (externalUrl) {
        window.location.assign(externalUrl);
        return;
      }
      await refreshGroups();
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : "Impossible de préparer ce paiement.");
    } finally {
      setPayingKey(null);
    }
  };

  const filtered = useMemo(() => {
    if (tab === "versements") return groups.filter(g => g.installment_plan !== "full");
    if (tab === "unique")     return groups.filter(g => g.installment_plan === "full");
    if (tab === "pending")    return groups.filter(g => g.grouped_payments.some(p => p.status !== "confirmed"));
    return groups;
  }, [groups, tab]);

  const counts: Record<TabId, number> = {
    all:        groups.length,
    versements: groups.filter(g => g.installment_plan !== "full").length,
    unique:     groups.filter(g => g.installment_plan === "full").length,
    pending:    groups.filter(g => g.grouped_payments.some(p => p.status !== "confirmed")).length,
  };

  const studentName = user?.full_name ?? "Étudiant";
  const taraReturn = searchParams.get("gateway") === "tara";

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  return (
    <div className="pay-page">
      <div className="pay-page__header">
        <div>
          <h1 className="pay-page__title">Mes paiements</h1>
          <p className="pay-page__sub">Suivi de vos commandes et factures</p>
        </div>
        {groups.length > 0 && (
          <div className="pay-header-actions">
            <div className="pay-provider-tabs" aria-label="Moyen de paiement">
              <button
                type="button"
                className={`pay-provider-tab${paymentProvider === "stripe" ? " is-active" : ""}`}
                onClick={() => setPaymentProvider("stripe")}
              >
                Carte bancaire
              </button>
              <button
                type="button"
                className={`pay-provider-tab${paymentProvider === "tara" ? " is-active" : ""}`}
                onClick={() => setPaymentProvider("tara")}
              >
                Tara Money
              </button>
            </div>
            <button
              type="button"
              className="pay-dl-all-btn"
              onClick={() => groups
                .filter(g => g.status === "paid" || (g.installment_plan !== "full" && g.grouped_payments.some(p => p.status === "confirmed")))
                .forEach(g => generateGroupInvoice(g, studentName, studentCode))}
            >
              <Download size={14} /> Tout télécharger
            </button>
          </div>
        )}
      </div>

      {taraReturn && (
        <div className="pay-alert pay-alert--info">
          <Clock size={15} />
          Paiement Tara Money initié. Votre commande apparaîtra ici dès confirmation.
        </div>
      )}
      {paymentMessage && (
        <div className="pay-alert pay-alert--info">
          <Clock size={15} />
          {paymentMessage}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="pay-empty">
          <FileText size={40} strokeWidth={1} />
          <p>Aucune commande pour le moment.</p>
        </div>
      ) : (
        <>
          <KpiRow groups={groups} />
          <RemindersSection groups={groups} />

          <div className="pay-tabs">
            {TABS.map(t => (
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

          {filtered.length === 0 ? (
            <div className="pay-empty">
              <FileText size={36} strokeWidth={1.2} />
              <p>Aucune commande dans cette catégorie.</p>
            </div>
          ) : (
            <div className="pay-list">
              {filtered.map(group => (
                <OrderGroupCard
                  key={group.group_reference}
                  group={group}
                  studentName={studentName}
                  studentCode={studentCode}
                  onPay={handlePay}
                  payingKey={payingKey}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
