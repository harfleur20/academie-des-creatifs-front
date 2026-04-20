import { useEffect, useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { Banknote, CircleCheck, Clock4, ShoppingBag } from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";

const PAGE_SIZE = 8;

function orderStatusClass(status: string) {
  if (status === "paid") return "adm-badge adm-badge--green";
  if (status === "partially_paid") return "adm-badge adm-badge--blue";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "cancelled" || status === "failed") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

export default function AdminOrdersPage() {
  const { loading, loadingError, orders, payments, orderDrafts, orderStatuses, syncOrderDraft, savingOrderId, handleSaveOrder, orderFeedbackById } =
    useAdminDashboard();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => orders.filter((o) => includesSearchValue([o.reference, o.customer_name, o.formation_title, o.status], search)),
    [orders, search],
  );

  useEffect(() => { setPage(1); }, [search, orders.length]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => getPageItems(filtered, safePage, PAGE_SIZE), [filtered, safePage]);

  const paidCount = orders.filter((o) => o.status === "paid").length;
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const totalRevenue = payments.filter((p) => p.status === "confirmed").reduce((acc, p) => acc + p.amount, 0);
  const totalRevenueLabel = new Intl.NumberFormat("fr-FR", { style: "currency", currency: payments[0]?.currency ?? "XAF", maximumFractionDigits: 0 }).format(totalRevenue);

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Commerce</p>
          <h1 className="adm-page-title">Commandes</h1>
          <p className="adm-page-desc">Suivez et gérez toutes les transactions clients.</p>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--dark">
          <span className="adm-kpi-card__bg-icon"><Banknote strokeWidth={1.2} /></span>
          <span>Montant encaissé</span>
          <strong>{totalRevenueLabel}</strong>
          <small>commandes payées</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><CircleCheck strokeWidth={1.2} /></span>
          <span>Payées</span>
          <strong>{paidCount}</strong>
          <small>commandes réglées</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><Clock4 strokeWidth={1.2} /></span>
          <span>En attente</span>
          <strong>{pendingCount}</strong>
          <small>à traiter</small>
        </div>
        <div className="adm-kpi-card">
          <span className="adm-kpi-card__bg-icon"><ShoppingBag strokeWidth={1.2} /></span>
          <span>Total</span>
          <strong>{orders.length}</strong>
          <small>toutes commandes</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="adm-card">
          <div className="adm-card__header">
            <div>
              <h2 className="adm-card__title">Toutes les commandes</h2>
              <p className="adm-card__desc">Modifiez le statut d'une commande directement dans le tableau.</p>
            </div>
            <label className="adm-search">
              <FaSearch />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Référence, client, formation…" />
            </label>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Formation</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map((order) => {
                  const draft = orderDrafts[order.id];
                  const feedback = orderFeedbackById[order.id];
                  const isSaving = savingOrderId === order.id;
                  return (
                    <tr key={order.id}>
                      <td><code className="adm-code">{order.reference}</code></td>
                      <td><strong>{order.customer_name}</strong></td>
                      <td><div className="adm-td-title adm-td-muted"><span>{order.formation_title}</span></div></td>
                      <td><strong>{order.total_amount_label}</strong></td>
                      <td>
                        <span className={orderStatusClass(draft?.status ?? order.status)}>
                          {statusLabel(draft?.status ?? order.status)}
                        </span>
                      </td>
                      <td className="adm-td-muted">{new Date(order.created_at).toLocaleDateString("fr-FR")}</td>
                      <td>
                        <div className="adm-row-actions">
                          <select
                            className="adm-select adm-select--sm"
                            value={draft?.status ?? order.status}
                            onChange={(e) => syncOrderDraft(order.id, e.target.value as typeof order.status)}
                          >
                            {orderStatuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                          </select>
                          <button
                            className="adm-btn adm-btn--sm adm-btn--primary"
                            type="button"
                            disabled={!draft || isSaving}
                            onClick={() => handleSaveOrder(order)}
                          >
                            {isSaving ? "…" : "OK"}
                          </button>
                          {feedback && <span className={`adm-feedback adm-feedback--${feedback.type}`}>{feedback.message}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7}><div className="adm-empty">Aucune commande trouvée.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminTablePager page={safePage} totalPages={totalPages} totalItems={filtered.length} label="Commandes" onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
