import { useEffect, useMemo, useState } from "react";
import { FaBell, FaSearch } from "react-icons/fa";
import { AlertTriangle, BadgeCheck, CreditCard, Hourglass } from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";
import type { PaymentStatus } from "../../lib/catalogApi";

const PAGE_SIZE = 8;

function paymentStatusClass(status: PaymentStatus) {
  if (status === "confirmed") return "adm-badge adm-badge--green";
  if (status === "late") return "adm-badge adm-badge--red";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "cancelled") return "adm-badge adm-badge--gray";
  return "adm-badge adm-badge--purple";
}

function orderStatusClass(status: string | null) {
  if (status === "paid") return "adm-badge adm-badge--green";
  if (status === "partially_paid") return "adm-badge adm-badge--blue";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "failed" || status === "cancelled") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(parsed);
}

export default function AdminPaymentsPage() {
  const {
    loading,
    loadingError,
    payments,
    paymentDrafts,
    paymentStatuses,
    syncPaymentDraft,
    savingPaymentId,
    remindingPaymentId,
    handleSavePayment,
    handleSendPaymentReminder,
    paymentFeedbackById,
  } = useAdminDashboard();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");

  const filtered = useMemo(
    () =>
      payments.filter((payment) => {
        const matchesSearch = includesSearchValue(
          [
            payment.order_reference,
            payment.payer_name,
            payment.provider_code,
            payment.status,
            payment.order_status ?? "",
            payment.installment_plan ?? "",
            payment.installment_number ?? "",
            payment.due_date ?? "",
          ],
          search,
        );
        const matchesStatus = statusFilter === "all" ? true : payment.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [payments, search, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [payments.length, search, statusFilter]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => getPageItems(filtered, safePage, PAGE_SIZE), [filtered, safePage]);

  const confirmedCount = payments.filter((payment) => payment.status === "confirmed").length;
  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const lateCount = payments.filter((payment) => payment.status === "late").length;
  const totalConfirmed = payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((acc, payment) => acc + payment.amount, 0);

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Finance</p>
          <h1 className="adm-page-title">Paiements</h1>
          <p className="adm-page-desc">
            Pilotez les tranches, les retards et les relances manuelles.
          </p>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--dark">
          <span className="adm-kpi-card__bg-icon"><CreditCard strokeWidth={1.2} /></span>
          <span>Montant confirmé</span>
          <strong>{confirmedCount > 0 ? `${Math.round(totalConfirmed / 1000)}k` : "0"}</strong>
          <small>FCFA encaissés</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><BadgeCheck strokeWidth={1.2} /></span>
          <span>Confirmés</span>
          <strong>{confirmedCount}</strong>
          <small>échéances validées</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><Hourglass strokeWidth={1.2} /></span>
          <span>En attente</span>
          <strong>{pendingCount}</strong>
          <small>avant échéance</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--red">
          <span className="adm-kpi-card__bg-icon"><AlertTriangle strokeWidth={1.2} /></span>
          <span>En retard</span>
          <strong>{lateCount}</strong>
          <small>à relancer</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="adm-card">
          <div className="adm-card__header">
            <div>
              <h2 className="adm-card__title">Toutes les échéances</h2>
              <p className="adm-card__desc">
                Modifiez le statut d’une tranche et envoyez une relance si nécessaire.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label className="adm-search">
                <FaSearch />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Référence, payeur, prestataire…"
                />
              </label>
              <select
                className="adm-select adm-select--sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | PaymentStatus)}
              >
                <option value="all">Tous statuts</option>
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Échéance</th>
                  <th>Payeur</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Relances</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map((payment) => {
                  const draft = paymentDrafts[payment.id];
                  const feedback = paymentFeedbackById[payment.id];
                  const isSaving = savingPaymentId === payment.id;
                  const isReminding = remindingPaymentId === payment.id;

                  return (
                    <tr key={payment.id}>
                      <td>
                        <code className="adm-code">{payment.order_reference}</code>
                        <div style={{ marginTop: 8 }}>
                          <span className={orderStatusClass(payment.order_status)}>
                            {statusLabel(payment.order_status ?? "inconnue")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.875rem" }}>
                          {payment.installment_plan === "3x" || payment.installment_plan === "2x"
                            ? `Versement ${payment.installment_number ?? "?"}/${payment.installment_plan === "3x" ? "3" : "2"}`
                            : "Paiement unique"}
                        </strong>
                        <span className="adm-td-muted">{formatDate(payment.due_date)}</span>
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.875rem" }}>{payment.payer_name}</strong>
                        <span className="adm-td-muted">{payment.provider_code}</span>
                      </td>
                      <td>
                        <strong>{payment.amount_label}</strong>
                        <div className="adm-td-muted">
                          {payment.paid_at ? `Réglé le ${formatDateTime(payment.paid_at)}` : "Non encaissé"}
                        </div>
                      </td>
                      <td>
                        <span className={paymentStatusClass(draft?.status ?? payment.status)}>
                          {statusLabel(draft?.status ?? payment.status)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.875rem" }}>{payment.reminder_count}</strong>
                        <span className="adm-td-muted">
                          {payment.last_reminded_at
                            ? `Dernière: ${formatDateTime(payment.last_reminded_at)}`
                            : "Jamais relancé"}
                        </span>
                      </td>
                      <td>
                        <div className="adm-row-actions">
                          <input
                            className="adm-input adm-input--sm"
                            value={draft?.providerCode ?? payment.provider_code}
                            onChange={(event) =>
                              syncPaymentDraft(payment.id, "providerCode", event.target.value)
                            }
                            placeholder="Prestataire"
                          />
                          <select
                            className="adm-select adm-select--sm"
                            value={draft?.status ?? payment.status}
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
                          <button
                            className="adm-btn adm-btn--sm adm-btn--primary"
                            type="button"
                            disabled={!draft || isSaving || isReminding}
                            onClick={() => void handleSavePayment(payment)}
                          >
                            {isSaving ? "…" : "OK"}
                          </button>
                          <button
                            className="adm-btn adm-btn--sm"
                            type="button"
                            disabled={!payment.can_send_reminder || isSaving || isReminding}
                            onClick={() => void handleSendPaymentReminder(payment)}
                          >
                            {isReminding ? "…" : <FaBell />}
                          </button>
                          {feedback && (
                            <span className={`adm-feedback adm-feedback--${feedback.type}`}>
                              {feedback.message}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="adm-empty">Aucun paiement trouvé.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminTablePager
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            label="Paiements"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
