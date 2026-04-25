import { useEffect, useMemo, useState } from "react";
import { FaEdit, FaGraduationCap, FaIdBadge, FaSearch, FaTimes } from "react-icons/fa";
import { BadgeCheck, BookOpen, UserMinus } from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";
import type {
  AdminEnrollment,
  AdminOnsiteSession,
  AdminOrder,
  AdminPayment,
  AdminUser,
} from "../../lib/catalogApi";

const PAGE_SIZE = 10;

const AVATAR_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
];

type StudentKindFilter = "all" | "student" | "guest";
type StudentAccessFilter = "all" | "with_access" | "without_access";
type StudentStatusFilter = "all" | "active" | "suspended";

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function toneBadge(status: string) {
  if (["active", "completed", "confirmed", "paid", "open"].includes(status)) {
    return "adm-badge adm-badge--green";
  }
  if (["pending", "partially_paid", "planned"].includes(status)) {
    return "adm-badge adm-badge--yellow";
  }
  if (["suspended", "failed", "cancelled", "late"].includes(status)) {
    return "adm-badge adm-badge--red";
  }
  return "adm-badge adm-badge--gray";
}

function UserAvatar({ user }: { user: AdminUser }) {
  const initials = user.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="usr-avatar" style={{ background: avatarColor(user.id) }}>
      {initials}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRole(role: AdminUser["role"]) {
  return role === "guest" ? "Prospect" : "Étudiant";
}

function formatProvider(code: string) {
  if (code === "stripe") return "Stripe";
  if (code === "tara") return "Tara";
  if (code === "mock") return "Mock";
  return code;
}

function formatEnrollmentFormat(enrollment: AdminEnrollment) {
  const formatMap: Record<AdminEnrollment["format_type"], string> = {
    live: "Live",
    ligne: "En ligne",
    presentiel: "Présentiel",
  };
  return `${formatMap[enrollment.format_type]} · ${enrollment.dashboard_type === "guided" ? "Guidé" : "Classique"}`;
}

function formatEnrollmentPeriod(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate) return "—";
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function StudentDetailModal({
  user,
  enrollments,
  sessions,
  orders,
  payments,
  draftStatus,
  enrollmentDrafts,
  enrollmentStatuses,
  savingUserId,
  savingEnrollmentId,
  userFeedback,
  enrollmentFeedbackById,
  onClose,
  onSyncUserStatus,
  onSaveUser,
  onSyncEnrollmentStatus,
  onSyncEnrollmentSession,
  onSaveEnrollment,
}: {
  user: AdminUser;
  enrollments: AdminEnrollment[];
  sessions: AdminOnsiteSession[];
  orders: AdminOrder[];
  payments: AdminPayment[];
  draftStatus: AdminUser["status"];
  enrollmentDrafts: Record<number, { status: AdminEnrollment["status"]; sessionId: number | null }>;
  enrollmentStatuses: AdminEnrollment["status"][];
  savingUserId: number | null;
  savingEnrollmentId: number | null;
  userFeedback?: { type: "success" | "error"; message: string };
  enrollmentFeedbackById: Record<number, { type: "success" | "error"; message: string } | undefined>;
  onClose: () => void;
  onSyncUserStatus: (status: AdminUser["status"]) => void;
  onSaveUser: () => void;
  onSyncEnrollmentStatus: (enrollmentId: number, status: AdminEnrollment["status"]) => void;
  onSyncEnrollmentSession: (enrollmentId: number, sessionId: number | null) => void;
  onSaveEnrollment: (enrollment: AdminEnrollment) => void;
}) {
  const activeEnrollments = enrollments.filter((enrollment) =>
    enrollment.status === "active" || enrollment.status === "completed",
  );
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
  const pendingPayments = payments.filter((payment) => payment.status === "pending" || payment.status === "late");
  const latestEnrollment = enrollments[0] ?? null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
      <button
        aria-label="Fermer la fiche étudiant"
        className="admin-modal__backdrop"
        type="button"
        onClick={onClose}
      />
      <div className="admin-modal__panel admin-modal__panel--teacher">
        <div className="admin-modal__header">
          <div>
            <p className="admin-modal__eyebrow">Fiche étudiant</p>
            <h3 id="student-detail-title">{user.full_name}</h3>
            <p>
              {user.email} · {formatRole(user.role)} · Créé le {formatDate(user.created_at)}
            </p>
          </div>
          <button
            aria-label="Fermer la fiche étudiant"
            className="admin-icon-button admin-icon-button--close"
            type="button"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="admin-modal__body">
          <section className="adm-student-detail__summary">
            <div>
              <strong>{enrollments.length}</strong>
              <span>Inscription(s)</span>
            </div>
            <div>
              <strong>{activeEnrollments.length}</strong>
              <span>Accès actif(s)</span>
            </div>
            <div>
              <strong>{payments.length}</strong>
              <span>Paiement(s)</span>
            </div>
            <div>
              <strong>{confirmedPayments.length}</strong>
              <span>Paiement(s) confirmé(s)</span>
            </div>
            <div>
              <strong>{pendingPayments.length}</strong>
              <span>Paiement(s) à suivre</span>
            </div>
            <div>
              <strong>{latestEnrollment ? formatDate(latestEnrollment.created_at) : "—"}</strong>
              <span>Dernière inscription</span>
            </div>
          </section>

          <div className="adm-student-detail__sections">
            <section className="adm-card adm-student-detail-card">
              <div className="adm-section-title-row">
                <div>
                  <h4>Compte</h4>
                  <p>Statut global du compte, coordonnées et code étudiant.</p>
                </div>
              </div>

              <div className="adm-student-detail__meta">
                <span>
                  <strong>Email</strong>
                  {user.email}
                </span>
                <span>
                  <strong>Téléphone</strong>
                  {user.phone || "—"}
                </span>
                <span>
                  <strong>Rôle</strong>
                  {formatRole(user.role)}
                </span>
                <span>
                  <strong>Code étudiant</strong>
                  {user.student_code || "Non attribué"}
                </span>
              </div>

              <div className="adm-student-detail__actions">
                <div className="adm-row-actions">
                  <span className={toneBadge(draftStatus)}>{statusLabel(draftStatus)}</span>
                  {user.role === "guest" && <span className="adm-badge adm-badge--gray">Prospect</span>}
                </div>
                <div className="adm-student-detail__inline">
                  <select
                    className="adm-select"
                    value={draftStatus}
                    onChange={(event) => onSyncUserStatus(event.target.value as AdminUser["status"])}
                  >
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                  <button
                    className="adm-btn adm-btn--primary"
                    type="button"
                    disabled={savingUserId === user.id}
                    onClick={onSaveUser}
                  >
                    {savingUserId === user.id ? "Enregistrement…" : "Enregistrer le compte"}
                  </button>
                </div>
              </div>

            </section>

            <section className="adm-card adm-student-detail-card">
              <div className="adm-section-title-row">
                <div>
                  <h4>Inscriptions & sessions</h4>
                  <p>Accès pédagogiques, enseignants rattachés, sessions et statut d’inscription.</p>
                </div>
              </div>

              {enrollments.length ? (
                <div className="adm-student-enrollment-list">
                  {enrollments.map((enrollment) => {
                    const draft = enrollmentDrafts[enrollment.id] ?? {
                      status: enrollment.status,
                      sessionId: enrollment.session_id ?? null,
                    };
                    const feedback = enrollmentFeedbackById[enrollment.id];
                    const matchingSessions = sessions.filter(
                      (session) => session.formation_id === enrollment.formation_id,
                    );
                    const selectedSession =
                      matchingSessions.find((session) => session.id === draft.sessionId) ?? null;
                    const currentSessionMissing =
                      draft.sessionId !== null && !matchingSessions.some((session) => session.id === draft.sessionId);
                    const sessionPlaceholder =
                      enrollment.format_type === "ligne"
                        ? "Accès immédiat (sans session)"
                        : "Aucune session affectée";
                    const sessionChanged = draft.sessionId !== (enrollment.session_id ?? null);
                    const displaySessionLabel = selectedSession?.session_label
                      ?? selectedSession?.label
                      ?? (sessionChanged ? sessionPlaceholder : enrollment.session_label || sessionPlaceholder);
                    const displayTeacher = selectedSession?.teacher_name
                      ?? (sessionChanged ? "Non assigné" : enrollment.teacher_name || "Non assigné");
                    const displayPeriod = selectedSession
                      ? formatEnrollmentPeriod(selectedSession.start_date, selectedSession.end_date)
                      : sessionChanged
                        ? "—"
                        : formatEnrollmentPeriod(enrollment.session_start_date, enrollment.session_end_date);

                    return (
                      <article key={enrollment.id} className="adm-student-enrollment-card">
                        <div className="adm-student-enrollment-card__main">
                          <div>
                            <span className={toneBadge(enrollment.status)}>{statusLabel(enrollment.status)}</span>
                            {sessionChanged && <span className="adm-badge adm-badge--yellow">Brouillon non enregistré</span>}
                            <strong>{enrollment.formation_title}</strong>
                            <p>{formatEnrollmentFormat(enrollment)}</p>
                          </div>
                          <div className="adm-student-enrollment-card__meta">
                            <span>
                              <strong>Session</strong>
                              {displaySessionLabel}
                            </span>
                            <span>
                              <strong>Enseignant</strong>
                              {displayTeacher}
                            </span>
                            <span>
                              <strong>Période</strong>
                              {displayPeriod}
                            </span>
                            <span>
                              <strong>Commande</strong>
                              {enrollment.order_reference}
                            </span>
                            <span>
                              <strong>Paiements</strong>
                              {enrollment.confirmed_payments_count}/{enrollment.payments_count} confirmés
                            </span>
                          </div>
                        </div>

                        <div className="adm-student-enrollment-card__footer">
                          <div className="adm-student-enrollment-card__controls">
                            <label className="adm-field">
                              <span>Statut d’accès</span>
                              <select
                                className="adm-select"
                                value={draft.status}
                                onChange={(event) =>
                                  onSyncEnrollmentStatus(
                                    enrollment.id,
                                    event.target.value as AdminEnrollment["status"],
                                  )
                                }
                              >
                                {enrollmentStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {statusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="adm-field adm-field--wide">
                              <span>Session rattachée</span>
                              <select
                                className="adm-select"
                                value={draft.sessionId === null ? "" : String(draft.sessionId)}
                                onChange={(event) =>
                                  onSyncEnrollmentSession(
                                    enrollment.id,
                                    event.target.value ? Number(event.target.value) : null,
                                  )
                                }
                                disabled={matchingSessions.length === 0 && enrollment.format_type !== "ligne"}
                              >
                                <option value="">{sessionPlaceholder}</option>
                                {currentSessionMissing && draft.sessionId !== null ? (
                                  <option value={String(draft.sessionId)}>
                                    {enrollment.session_label || `Session #${draft.sessionId}`}
                                  </option>
                                ) : null}
                                {matchingSessions.map((session) => (
                                  <option key={session.id} value={session.id}>
                                    {session.session_label || session.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="button"
                              disabled={savingEnrollmentId === enrollment.id}
                              onClick={() => onSaveEnrollment(enrollment)}
                            >
                              {savingEnrollmentId === enrollment.id ? "Enregistrement…" : "Enregistrer l’inscription"}
                            </button>
                          </div>
                          {matchingSessions.length === 0 && enrollment.format_type !== "ligne" ? (
                            <span className="adm-student-enrollment-card__hint">
                              Aucune autre session n’est disponible pour cette formation.
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="adm-empty adm-empty--compact">Aucune inscription pour ce profil.</div>
              )}
            </section>

            <section className="adm-card adm-student-detail-card">
              <div className="adm-section-title-row">
                <div>
                  <h4>Paiements liés</h4>
                  <p>Versements, échéances et passerelles utilisées par ce profil.</p>
                </div>
              </div>

              {payments.length ? (
                <div className="adm-student-payment-list">
                  {payments.map((payment) => (
                    <article key={payment.id} className="adm-student-payment-card">
                      <div className="adm-student-payment-card__main">
                        <div>
                          <span className={toneBadge(payment.status)}>{statusLabel(payment.status)}</span>
                          <strong>{payment.amount_label}</strong>
                          <p>
                            {formatProvider(payment.provider_code)}
                            {payment.installment_number ? ` · tranche ${payment.installment_number}` : ""}
                          </p>
                        </div>
                        <div className="adm-student-payment-card__meta">
                          <span>
                            <strong>Commande</strong>
                            {payment.order_reference}
                          </span>
                          <span>
                            <strong>Échéance</strong>
                            {formatDate(payment.due_date)}
                          </span>
                          <span>
                            <strong>Payé le</strong>
                            {formatDateTime(payment.paid_at)}
                          </span>
                          <span>
                            <strong>Relances</strong>
                            {payment.reminder_count}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="adm-empty adm-empty--compact">Aucun paiement trouvé pour ce profil.</div>
              )}
            </section>

            <section className="adm-card adm-student-detail-card">
              <div className="adm-section-title-row">
                <div>
                  <h4>Commandes liées</h4>
                  <p>Références de commande utilisées pour les inscriptions de ce profil.</p>
                </div>
              </div>

              {orders.length ? (
                <div className="adm-student-order-list">
                  {orders.map((order) => (
                    <article key={order.id} className="adm-student-order-card">
                      <div>
                        <span className={toneBadge(order.status)}>{statusLabel(order.status)}</span>
                        <strong>{order.reference}</strong>
                        <p>{order.formation_title}</p>
                      </div>
                      <div className="adm-student-order-card__meta">
                        <span>
                          <strong>Total</strong>
                          {order.total_amount_label}
                        </span>
                        <span>
                          <strong>Date</strong>
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="adm-empty adm-empty--compact">Aucune commande liée à ce profil.</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentsPage() {
  const {
    loading,
    loadingError,
    users,
    enrollments,
    sessions,
    orders,
    payments,
    userDrafts,
    userStatuses,
    syncUserDraft,
    savingUserId,
    handleSaveUser,
    userFeedbackById,
    enrollmentDrafts,
    enrollmentStatuses,
    syncEnrollmentDraft,
    syncEnrollmentSessionDraft,
    savingEnrollmentId,
    handleSaveEnrollment,
    enrollmentFeedbackById,
  } = useAdminDashboard();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<StudentKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("all");
  const [accessFilter, setAccessFilter] = useState<StudentAccessFilter>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const students = useMemo(
    () => users.filter((user) => user.role === "student" || user.role === "guest"),
    [users],
  );
  const studentsOnlyCount = students.filter((user) => user.role === "student").length;
  const prospectsCount = students.filter((user) => user.role === "guest").length;
  const activeStudents = students.filter((user) => user.status === "active").length;
  const suspendedStudents = students.filter((user) => user.status !== "active").length;
  const studentsWithAccess = useMemo(
    () =>
      new Set(
        enrollments
          .filter((enrollment) => enrollment.status === "active" || enrollment.status === "completed")
          .map((enrollment) => enrollment.user_id),
      ),
    [enrollments],
  );
  const studentsWithAccessCount = students.filter((user) => studentsWithAccess.has(user.id)).length;
  const studentsWithoutAccessCount = students.length - studentsWithAccessCount;

  const filtered = useMemo(
    () =>
      students.filter((user) => {
        const matchesSearch = includesSearchValue(
          [user.full_name, user.email, user.phone ?? "", user.student_code ?? "", user.status],
          search,
        );
        if (!matchesSearch) return false;
        if (kindFilter !== "all" && user.role !== kindFilter) return false;
        if (statusFilter !== "all" && user.status !== statusFilter) return false;
        if (accessFilter === "with_access" && !studentsWithAccess.has(user.id)) return false;
        if (accessFilter === "without_access" && studentsWithAccess.has(user.id)) return false;
        return true;
      }),
    [students, search, kindFilter, statusFilter, accessFilter, studentsWithAccess],
  );

  useEffect(() => {
    setPage(1);
  }, [search, kindFilter, statusFilter, accessFilter]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => getPageItems(filtered, safePage, PAGE_SIZE),
    [filtered, safePage],
  );

  const selectedStudent = useMemo(
    () => students.find((user) => user.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );
  const selectedStudentEnrollments = useMemo(
    () =>
      selectedStudent
        ? enrollments
            .filter((enrollment) => enrollment.user_id === selectedStudent.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [],
    [enrollments, selectedStudent],
  );
  const selectedStudentOrderReferences = useMemo(
    () => new Set(selectedStudentEnrollments.map((enrollment) => enrollment.order_reference)),
    [selectedStudentEnrollments],
  );
  const selectedStudentOrders = useMemo(
    () =>
      orders
        .filter((order) => selectedStudentOrderReferences.has(order.reference))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders, selectedStudentOrderReferences],
  );
  const selectedStudentPayments = useMemo(
    () =>
      payments
        .filter((payment) => selectedStudentOrderReferences.has(payment.order_reference))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [payments, selectedStudentOrderReferences],
  );

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Gestion des étudiants</p>
          <h1 className="adm-page-title">Étudiants & prospects</h1>
          <p className="adm-page-desc">
            Suivez les comptes, les inscriptions, les paiements et les accès pédagogiques depuis une fiche unifiée.
          </p>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><FaGraduationCap /></span>
          <span>Étudiants & prospects</span>
          <strong>{students.length}</strong>
          <small>{activeStudents} actifs</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><BadgeCheck strokeWidth={1.2} /></span>
          <span>Accès ouverts</span>
          <strong>{studentsWithAccessCount}</strong>
          <small>avec formation active</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><BookOpen strokeWidth={1.2} /></span>
          <span>Inscriptions</span>
          <strong>{enrollments.length}</strong>
          <small>toutes formations</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--red">
          <span className="adm-kpi-card__bg-icon"><UserMinus strokeWidth={1.2} /></span>
          <span>Suspendus</span>
          <strong>{suspendedStudents}</strong>
          <small>comptes bloqués</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="adm-card">
          <div className="adm-card__header adm-student-card__header">
            <div>
              <h2 className="adm-card__title">Liste des profils étudiants</h2>
              <p className="adm-card__desc">
                Le statut contrôle l’accès global au compte. Les inscriptions, commandes et paiements restent visibles dans chaque fiche.
              </p>
            </div>
            <label className="adm-search">
              <FaSearch />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom, email, téléphone, code étudiant…"
              />
            </label>
          </div>

          <div className="adm-student-toolbar">
            <div className="adm-filter-row">
              <button
                className={`adm-filter-btn${kindFilter === "all" ? " is-active" : ""}`}
                type="button"
                onClick={() => setKindFilter("all")}
              >
                Tous <strong>{students.length}</strong>
              </button>
              <button
                className={`adm-filter-btn${kindFilter === "student" ? " is-active" : ""}`}
                type="button"
                onClick={() => setKindFilter("student")}
              >
                Étudiants <strong>{studentsOnlyCount}</strong>
              </button>
              <button
                className={`adm-filter-btn${kindFilter === "guest" ? " is-active" : ""}`}
                type="button"
                onClick={() => setKindFilter("guest")}
              >
                Prospects <strong>{prospectsCount}</strong>
              </button>
            </div>

            <div className="adm-filter-row">
              <button
                className={`adm-filter-btn${accessFilter === "all" ? " is-active" : ""}`}
                type="button"
                onClick={() => setAccessFilter("all")}
              >
                Tous accès <strong>{students.length}</strong>
              </button>
              <button
                className={`adm-filter-btn${accessFilter === "with_access" ? " is-active" : ""}`}
                type="button"
                onClick={() => setAccessFilter("with_access")}
              >
                Avec accès <strong>{studentsWithAccessCount}</strong>
              </button>
              <button
                className={`adm-filter-btn${accessFilter === "without_access" ? " is-active" : ""}`}
                type="button"
                onClick={() => setAccessFilter("without_access")}
              >
                Sans accès <strong>{studentsWithoutAccessCount}</strong>
              </button>
            </div>

            <label className="adm-field adm-student-toolbar__select">
              <span>Statut du compte</span>
              <select
                className="adm-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StudentStatusFilter)}
              >
                <option value="all">Tous les statuts</option>
                {userStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Profil</th>
                  <th>Code étudiant</th>
                  <th>Inscriptions</th>
                  <th>Accès</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? (
                  paginated.map((user) => {
                    const draft = userDrafts[user.id];
                    const isSaving = savingUserId === user.id;
                    const studentEnrollments = enrollments.filter((enrollment) => enrollment.user_id === user.id);
                    const activeEnrollments = studentEnrollments.filter(
                      (enrollment) => enrollment.status === "active" || enrollment.status === "completed",
                    );

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="adm-user-cell">
                            <UserAvatar user={user} />
                            <div>
                              <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                                {user.full_name}
                              </strong>
                              <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {user.student_code ? (
                            <span className="usr-code-pill">
                              <FaIdBadge style={{ marginRight: "0.3rem", opacity: 0.6 }} />
                              {user.student_code}
                            </span>
                          ) : (
                            <span className="adm-td-muted">Non attribué</span>
                          )}
                        </td>
                        <td>
                          <strong>{studentEnrollments.length}</strong>
                          <span className="adm-td-muted" style={{ marginLeft: "0.35rem" }}>
                            formation{studentEnrollments.length > 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          <span className={activeEnrollments.length ? "adm-badge adm-badge--green" : "adm-badge adm-badge--gray"}>
                            {activeEnrollments.length
                              ? `${activeEnrollments.length} actif${activeEnrollments.length > 1 ? "s" : ""}`
                              : "Aucun accès"}
                          </span>
                        </td>
                        <td className="adm-td-muted">{user.phone || "—"}</td>
                        <td>
                          <div className="adm-row-actions">
                            {user.role === "guest" && (
                              <span className="adm-badge adm-badge--gray">Prospect</span>
                            )}
                            <select
                              className="adm-select"
                              value={draft?.status ?? user.status}
                              onChange={(event) =>
                                syncUserDraft(user.id, "status", event.target.value as typeof user.status)
                              }
                            >
                              {userStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div className="adm-student-table-actions">
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="button"
                              onClick={() => setSelectedStudentId(user.id)}
                            >
                              Voir fiche
                            </button>
                            <button
                              className="adm-btn adm-btn--sm adm-btn--primary"
                              type="button"
                              disabled={!draft || isSaving}
                              onClick={() => handleSaveUser(user)}
                            >
                              {isSaving ? "…" : <><FaEdit /> Enregistrer</>}
                            </button>
                            <span className={toneBadge(draft?.status ?? user.status)}>
                              {statusLabel(draft?.status ?? user.status)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}><div className="adm-empty">Aucun étudiant trouvé.</div></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminTablePager
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            label="Profils étudiants"
            onPageChange={setPage}
          />
        </div>
      )}

      {selectedStudent && (
        <StudentDetailModal
          user={selectedStudent}
          enrollments={selectedStudentEnrollments}
          sessions={sessions}
          orders={selectedStudentOrders}
          payments={selectedStudentPayments}
          draftStatus={userDrafts[selectedStudent.id]?.status ?? selectedStudent.status}
          enrollmentDrafts={Object.fromEntries(
            selectedStudentEnrollments.map((enrollment) => [
              enrollment.id,
              enrollmentDrafts[enrollment.id] ?? {
                status: enrollment.status,
                sessionId: enrollment.session_id ?? null,
              },
            ]),
          )}
          enrollmentStatuses={enrollmentStatuses}
          savingUserId={savingUserId}
          savingEnrollmentId={savingEnrollmentId}
          userFeedback={userFeedbackById[selectedStudent.id]}
          enrollmentFeedbackById={Object.fromEntries(
            selectedStudentEnrollments.map((enrollment) => [
              enrollment.id,
              enrollmentFeedbackById[enrollment.id],
            ]),
          )}
          onClose={() => setSelectedStudentId(null)}
          onSyncUserStatus={(status) => syncUserDraft(selectedStudent.id, "status", status)}
          onSaveUser={() => handleSaveUser(selectedStudent)}
          onSyncEnrollmentStatus={(enrollmentId, status) => syncEnrollmentDraft(enrollmentId, status)}
          onSyncEnrollmentSession={(enrollmentId, sessionId) =>
            syncEnrollmentSessionDraft(enrollmentId, sessionId)
          }
          onSaveEnrollment={(enrollment) => handleSaveEnrollment(enrollment)}
        />
      )}
    </div>
  );
}
