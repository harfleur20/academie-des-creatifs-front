import { useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaEye, FaSearch } from "react-icons/fa";
import { BadgeCheck, CalendarDays, CreditCard, Users } from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  dashboardTypeLabel,
  formatTypeLabel,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";
import type { EnrollmentStatus, FormationFormat } from "../../lib/catalogApi";

const PAGE_SIZE = 10;

function enrollmentStatusClass(status: EnrollmentStatus) {
  if (status === "active") return "adm-badge adm-badge--green";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "completed") return "adm-badge adm-badge--blue";
  if (status === "cancelled") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--purple";
}

function userStatusClass(status: string) {
  return status === "active" ? "adm-badge adm-badge--green" : "adm-badge adm-badge--red";
}

function orderStatusClass(status: string | null) {
  if (status === "paid") return "adm-badge adm-badge--green";
  if (status === "pending" || status === "partially_paid") return "adm-badge adm-badge--yellow";
  if (status === "failed" || status === "cancelled") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

function paymentSummaryClass(
  pendingCount: number,
  lateCount: number,
  issueCount: number,
  confirmedCount: number,
) {
  if (lateCount > 0 || issueCount > 0) return "adm-badge adm-badge--red";
  if (pendingCount > 0) return "adm-badge adm-badge--yellow";
  if (confirmedCount > 0) return "adm-badge adm-badge--green";
  return "adm-badge adm-badge--gray";
}

function paymentSummaryLabel(
  paymentsCount: number,
  confirmedCount: number,
  pendingCount: number,
  lateCount: number,
  issueCount: number,
) {
  if (paymentsCount === 0) {
    return "Aucun paiement";
  }

  const parts: string[] = [];
  if (confirmedCount > 0) parts.push(`${confirmedCount} confirme${confirmedCount > 1 ? "s" : ""}`);
  if (pendingCount > 0) parts.push(`${pendingCount} en attente`);
  if (lateCount > 0) parts.push(`${lateCount} en retard`);
  if (issueCount > 0) parts.push(`${issueCount} a regulariser`);
  return parts.join(" / ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("fr-FR");
}

export default function AdminEnrollmentsPage() {
  const {
    loading,
    loadingError,
    enrollments,
    enrollmentDrafts,
    enrollmentStatuses,
    syncEnrollmentDraft,
    savingEnrollmentId,
    handleSaveEnrollment,
  } = useAdminDashboard();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | EnrollmentStatus>("all");
  const [formatFilter, setFormatFilter] = useState<"all" | FormationFormat>("all");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      enrollments.filter((enrollment) => {
        const matchesSearch = includesSearchValue(
          [
            enrollment.student_name,
            enrollment.student_email,
            enrollment.student_phone ?? "",
            enrollment.student_code ?? "",
            enrollment.formation_title,
            enrollment.format_type,
            enrollment.dashboard_type,
            enrollment.order_reference,
            enrollment.order_status ?? "",
            enrollment.session_label ?? "",
            enrollment.teacher_name ?? "",
            enrollment.campus_label ?? "",
          ],
          search,
        );

        const matchesStatus =
          statusFilter === "all" ? true : enrollment.status === statusFilter;
        const matchesFormat =
          formatFilter === "all" ? true : enrollment.format_type === formatFilter;

        return matchesSearch && matchesStatus && matchesFormat;
      }),
    [enrollments, formatFilter, search, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, formatFilter]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedEnrollmentId(null);
      return;
    }

    if (!filtered.some((item) => item.id === selectedEnrollmentId)) {
      setSelectedEnrollmentId(filtered[0].id);
    }
  }, [filtered, selectedEnrollmentId]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => getPageItems(filtered, safePage, PAGE_SIZE),
    [filtered, safePage],
  );

  const selectedEnrollment = useMemo(
    () =>
      filtered.find((item) => item.id === selectedEnrollmentId) ??
      paginated[0] ??
      null,
    [filtered, paginated, selectedEnrollmentId],
  );

  const activeCount = enrollments.filter((item) => item.status === "active").length;
  const guidedCount = enrollments.filter((item) => item.dashboard_type === "guided").length;
  const linkedSessionsCount = enrollments.filter((item) => item.session_id !== null).length;

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Suivi</p>
          <h1 className="adm-page-title">Inscriptions</h1>
          <p className="adm-page-desc">
            Supervisez les apprenants, leurs cohortes et le rattachement commerce.
          </p>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><BadgeCheck strokeWidth={1.2} /></span>
          <span>Total inscriptions</span>
          <strong>{enrollments.length}</strong>
          <small>tous statuts</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><Users strokeWidth={1.2} /></span>
          <span>Actives</span>
          <strong>{activeCount}</strong>
          <small>apprenants actuellement ouverts</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--purple">
          <span className="adm-kpi-card__bg-icon"><CalendarDays strokeWidth={1.2} /></span>
          <span>Guidées</span>
          <strong>{guidedCount}</strong>
          <small>live + présentiel</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><CreditCard strokeWidth={1.2} /></span>
          <span>Rattachées à une session</span>
          <strong>{linkedSessionsCount}</strong>
          <small>cohortes déjà identifiées</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && selectedEnrollment && (
        <div className="adm-card" style={{ marginBottom: 24 }}>
          <div className="adm-card__header">
            <div>
              <h2 className="adm-card__title">Fiche inscription sélectionnée</h2>
              <p className="adm-card__desc">
                Détail apprenant, cohorte et rattachement commande / paiements.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              padding: 20,
            }}
          >
            <div>
              <p className="adm-eyebrow" style={{ marginBottom: 10 }}>Apprenant</p>
              <strong style={{ display: "block", marginBottom: 6 }}>{selectedEnrollment.student_name}</strong>
              <div className="adm-td-muted">{selectedEnrollment.student_email}</div>
              <div className="adm-td-muted">{selectedEnrollment.student_phone || "Téléphone non renseigné"}</div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={userStatusClass(selectedEnrollment.user_status)}>
                  Compte {statusLabel(selectedEnrollment.user_status)}
                </span>
                {selectedEnrollment.student_code ? (
                  <span className="adm-badge adm-badge--gray">{selectedEnrollment.student_code}</span>
                ) : null}
              </div>
            </div>

            <div>
              <p className="adm-eyebrow" style={{ marginBottom: 10 }}>Parcours</p>
              <strong style={{ display: "block", marginBottom: 6 }}>{selectedEnrollment.formation_title}</strong>
              <div className="adm-td-muted">
                {formatTypeLabel(selectedEnrollment.format_type)} · {dashboardTypeLabel(selectedEnrollment.format_type)}
              </div>
              <div className="adm-td-muted" style={{ marginTop: 6 }}>
                Créée le {formatDate(selectedEnrollment.created_at)}
              </div>
              <div style={{ marginTop: 12 }}>
                <span className={enrollmentStatusClass(selectedEnrollment.status)}>
                  {statusLabel(selectedEnrollment.status)}
                </span>
              </div>
            </div>

            <div>
              <p className="adm-eyebrow" style={{ marginBottom: 10 }}>Session</p>
              <strong style={{ display: "block", marginBottom: 6 }}>
                {selectedEnrollment.session_label || "Non rattachée"}
              </strong>
              <div className="adm-td-muted">
                {selectedEnrollment.session_start_date || selectedEnrollment.session_end_date
                  ? `${formatDate(selectedEnrollment.session_start_date)} → ${formatDate(selectedEnrollment.session_end_date)}`
                  : "Aucune cohorte liée"}
              </div>
              <div className="adm-td-muted">{selectedEnrollment.campus_label || "Campus non défini"}</div>
              <div className="adm-td-muted">{selectedEnrollment.teacher_name || "Enseignant non défini"}</div>
            </div>

            <div>
              <p className="adm-eyebrow" style={{ marginBottom: 10 }}>Commerce</p>
              <code className="adm-code">{selectedEnrollment.order_reference}</code>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={orderStatusClass(selectedEnrollment.order_status)}>
                  Commande {statusLabel(selectedEnrollment.order_status ?? "inconnue")}
                </span>
                <span
                  className={paymentSummaryClass(
                    selectedEnrollment.pending_payments_count,
                    selectedEnrollment.late_payments_count,
                    selectedEnrollment.failed_payments_count + selectedEnrollment.cancelled_payments_count,
                    selectedEnrollment.confirmed_payments_count,
                  )}
                >
                  {paymentSummaryLabel(
                    selectedEnrollment.payments_count,
                    selectedEnrollment.confirmed_payments_count,
                    selectedEnrollment.pending_payments_count,
                    selectedEnrollment.late_payments_count,
                    selectedEnrollment.failed_payments_count + selectedEnrollment.cancelled_payments_count,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !loadingError && (
        <div className="adm-card">
          <div className="adm-card__header">
            <div>
              <h2 className="adm-card__title">Toutes les inscriptions</h2>
              <p className="adm-card__desc">
                Filtrez les cohortes et ajustez le statut administratif d’une inscription.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label className="adm-search">
                <FaSearch />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Étudiant, formation, commande, session…"
                />
              </label>
              <select
                className="adm-select adm-select--sm"
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as "all" | FormationFormat)}
              >
                <option value="all">Tous formats</option>
                <option value="live">Live</option>
                <option value="ligne">Ligne</option>
                <option value="presentiel">Présentiel</option>
              </select>
              <select
                className="adm-select adm-select--sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | EnrollmentStatus)}
              >
                <option value="all">Tous statuts</option>
                {enrollmentStatuses.map((status) => (
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
                  <th>Apprenant</th>
                  <th>Formation</th>
                  <th>Session</th>
                  <th>Commande</th>
                  <th>Paiements</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map((enrollment) => {
                  const draft = enrollmentDrafts[enrollment.id];
                  const isSaving = savingEnrollmentId === enrollment.id;
                  const isSelected = selectedEnrollment?.id === enrollment.id;

                  return (
                    <tr
                      key={enrollment.id}
                      style={isSelected ? { background: "#f8fbff" } : undefined}
                    >
                      <td>
                        <div>
                          <strong style={{ display: "block", fontSize: "0.875rem" }}>
                            {enrollment.student_name}
                          </strong>
                          <span className="adm-td-muted">{enrollment.student_email}</span>
                          {enrollment.student_code ? (
                            <div className="adm-td-muted">{enrollment.student_code}</div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.875rem" }}>
                          {enrollment.formation_title}
                        </strong>
                        <span className="adm-td-muted">
                          {formatTypeLabel(enrollment.format_type)} · {dashboardTypeLabel(enrollment.format_type)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.875rem" }}>
                          {enrollment.session_label || "Non rattachée"}
                        </strong>
                        <span className="adm-td-muted">
                          {enrollment.teacher_name || enrollment.campus_label || "—"}
                        </span>
                      </td>
                      <td>
                        <code className="adm-code">{enrollment.order_reference}</code>
                        <div style={{ marginTop: 8 }}>
                          <span className={orderStatusClass(enrollment.order_status)}>
                            {statusLabel(enrollment.order_status ?? "inconnue")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={paymentSummaryClass(
                            enrollment.pending_payments_count,
                            enrollment.late_payments_count,
                            enrollment.failed_payments_count + enrollment.cancelled_payments_count,
                            enrollment.confirmed_payments_count,
                          )}
                        >
                          {paymentSummaryLabel(
                            enrollment.payments_count,
                            enrollment.confirmed_payments_count,
                            enrollment.pending_payments_count,
                            enrollment.late_payments_count,
                            enrollment.failed_payments_count + enrollment.cancelled_payments_count,
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={enrollmentStatusClass(draft?.status ?? enrollment.status)}>
                          {statusLabel(draft?.status ?? enrollment.status)}
                        </span>
                      </td>
                      <td>
                        <div className="adm-row-actions">
                          <button
                            className="adm-btn adm-btn--sm"
                            type="button"
                            onClick={() => setSelectedEnrollmentId(enrollment.id)}
                          >
                            <FaEye />
                            Voir
                          </button>
                          <select
                            className="adm-select adm-select--sm"
                            value={draft?.status ?? enrollment.status}
                            onChange={(e) =>
                              syncEnrollmentDraft(enrollment.id, e.target.value as EnrollmentStatus)
                            }
                          >
                            {enrollmentStatuses.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="adm-btn adm-btn--sm adm-btn--primary"
                            type="button"
                            disabled={!draft || isSaving}
                            onClick={() => void handleSaveEnrollment(enrollment)}
                          >
                            {isSaving ? "…" : <FaCheckCircle />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="adm-empty">Aucune inscription trouvée.</div>
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
            label="Inscriptions"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
