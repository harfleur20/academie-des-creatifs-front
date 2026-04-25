import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FaBan, FaCopy, FaEnvelope, FaIdBadge, FaSearch, FaTimes, FaUserTie } from "react-icons/fa";
import { BookOpen, CalendarDays, Link2, UserCheck, Users } from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { CountryCombobox } from "../../components/CountryCombobox";
import { useAdminDashboard } from "../../admin/adminDashboardContext";
import { useToast } from "../../toast/ToastContext";
import {
  AdminTablePager,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";
import {
  fetchAdminTeacherSessionCourseDays,
  assignTeacherToFormation,
  fetchAdminTeacherDetail,
  fetchAdminTeacherInvitations,
  fetchAdminTeachers,
  inviteTeacher,
  removeTeacherFromFormation,
  revokeTeacherInvitation,
  updateAdminTeacher,
  updateAdminTeacherAssignmentDueDate,
  updateAdminTeacherQuizStatus,
  updateAdminTeacherResourcePublication,
  type AdminTeacherCourseDayPage,
  type AdminTeacherDetail,
  type AdminTeacherItem,
  type TeacherInviteView,
} from "../../lib/teacherApi";
import {
  OTHER_TEACHER_SPECIALTY,
  TEACHER_SPECIALTY_OPTIONS,
  resolveTeacherSubject,
  splitTeacherSubject,
} from "../../lib/teacherSpecialties";

const PAGE_SIZE = 10;
const PEDAGOGY_CARD_PREVIEW_LIMIT = 4;
const PEDAGOGY_DRAWER_DAY_PAGE_SIZE = 10;

const EMPTY_INVITE_DRAFT = {
  full_name: "",
  email: "",
  whatsapp: "",
  nationality: "",
  subject: "",
  custom_subject: "",
  experience_years: "",
  portfolio_url: "",
  bio: "",
};

const EMPTY_TEACHER_EDIT_DRAFT = {
  full_name: "",
  email: "",
  whatsapp: "",
  nationality: "",
  subject: "",
  custom_subject: "",
  experience_years: "",
  portfolio_url: "",
  bio: "",
};

type TeacherTab = "teachers" | "invitations" | "assignments" | "pedagogy";

function statusBadge(status: string) {
  if (status === "active" || status === "accepted") return "adm-badge adm-badge--green";
  if (status === "pending") return "adm-badge adm-badge--yellow";
  if (status === "expired" || status === "cancelled" || status === "suspended") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

function invitationLink(token: string) {
  return `${window.location.origin}/invitation/enseignant/${token}`;
}

function invitationStatusLabel(status: string) {
  if (status === "pending") return "En attente";
  if (status === "accepted") return "Acceptée";
  if (status === "cancelled") return "Révoquée";
  if (status === "expired") return "Expirée";
  return statusLabel(status);
}

function formatActivityPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatActivityDate(value: string | null) {
  if (!value) return "Aucune activité";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatAuditDate(value: string | null) {
  if (!value) return "Non planifié";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function contentTypeLabel(value: string) {
  if (value === "assignment") return "Devoir";
  if (value === "quiz") return "Quiz";
  if (value.startsWith("resource:")) {
    const type = value.replace("resource:", "");
    if (type === "pdf") return "Ressource PDF";
    if (type === "video") return "Ressource vidéo";
    if (type === "image") return "Ressource image";
    return "Ressource lien";
  }
  return value;
}

function auditStatusLabel(value: string | null) {
  if (!value) return "Sans statut";
  if (value === "published") return "Publié";
  if (value === "draft") return "Brouillon";
  if (value === "pending_review") return "À corriger";
  if (value === "assigned") return "Assigné";
  return statusLabel(value);
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  return new Date(value).toISOString();
}

function pedagogyAlertClass(level: "info" | "warning" | "critical") {
  if (level === "critical") return "adm-teacher-alert-pill adm-teacher-alert-pill--critical";
  if (level === "warning") return "adm-teacher-alert-pill adm-teacher-alert-pill--warning";
  return "adm-teacher-alert-pill adm-teacher-alert-pill--info";
}

function TeacherPedagogyAuditView({
  detail,
  onDetailChange,
}: {
  detail: AdminTeacherDetail;
  onDetailChange: (nextDetail: AdminTeacherDetail) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courseDayPage, setCourseDayPage] = useState<AdminTeacherCourseDayPage | null>(null);
  const [courseDayError, setCourseDayError] = useState("");
  const [isCourseDayLoading, setIsCourseDayLoading] = useState(false);
  const [isLoadingMoreCourseDays, setIsLoadingMoreCourseDays] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [sessionAlertFilter, setSessionAlertFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [contentActionKey, setContentActionKey] = useState<string | null>(null);
  const [assignmentDueDrafts, setAssignmentDueDrafts] = useState<Record<number, string>>({});
  const { success, error: toastError } = useToast();

  useEffect(() => {
    setSelectedSessionId(null);
    setSessionStatusFilter("all");
    setSessionAlertFilter("all");
    setContentFilter("all");
  }, [detail.teacher.id]);

  const filteredPedagogy = useMemo(
    () =>
      detail.pedagogy.filter((sessionAudit) => {
        if (sessionStatusFilter !== "all" && sessionAudit.session_status !== sessionStatusFilter) {
          return false;
        }
        if (sessionAlertFilter === "with_alerts" && sessionAudit.alerts.length === 0) {
          return false;
        }
        if (sessionAlertFilter === "critical" && !sessionAudit.alerts.some((alert) => alert.level === "critical")) {
          return false;
        }
        if (sessionAlertFilter === "warning" && !sessionAudit.alerts.some((alert) => alert.level === "warning")) {
          return false;
        }
        if (sessionAlertFilter === "clean" && sessionAudit.alerts.length > 0) {
          return false;
        }
        return true;
      }),
    [detail.pedagogy, sessionAlertFilter, sessionStatusFilter],
  );
  const selectedSession = useMemo(
    () => detail.pedagogy.find((sessionAudit) => sessionAudit.session_id === selectedSessionId) ?? null,
    [detail.pedagogy, selectedSessionId],
  );
  const selectedSessionStudents = useMemo(
    () =>
      selectedSession
        ? detail.students.filter((student) => student.session_id === selectedSession.session_id)
        : [],
    [detail.students, selectedSession],
  );
  const filteredSelectedContents = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.contents.filter((content) => {
      if (contentFilter === "all") return true;
      if (contentFilter === "resource") return content.content_type.startsWith("resource:");
      if (contentFilter === "assignment") return content.content_type === "assignment";
      if (contentFilter === "quiz") return content.content_type === "quiz";
      if (contentFilter === "attention") {
        return content.status === "draft" || content.status === "pending_review" || content.pending_reviews_count > 0;
      }
      return true;
    });
  }, [contentFilter, selectedSession]);
  const sessionsWithAlertsCount = detail.pedagogy.filter((sessionAudit) => sessionAudit.alerts.length > 0).length;
  const displayedCourseDays = selectedSession ? (courseDayPage?.items ?? selectedSession.course_days) : [];
  const totalCourseDays = selectedSession ? (courseDayPage?.total_count ?? selectedSession.course_days_count) : 0;
  const canLoadMoreCourseDays = Boolean(selectedSession && displayedCourseDays.length < totalCourseDays);
  const sessionStatusOptions = useMemo(
    () => Array.from(new Set(detail.pedagogy.map((sessionAudit) => sessionAudit.session_status))),
    [detail.pedagogy],
  );

  useEffect(() => {
    if (!selectedSession) {
      setAssignmentDueDrafts({});
      return;
    }
    setAssignmentDueDrafts(
      Object.fromEntries(
        selectedSession.contents
          .filter((content) => content.content_type === "assignment" && content.due_date)
          .map((content) => [content.id, toLocalDateTimeValue(content.due_date)]),
      ),
    );
  }, [selectedSession?.contents, selectedSession?.session_id]);

  useEffect(() => {
    if (!selectedSession) {
      setCourseDayPage(null);
      setCourseDayError("");
      setIsCourseDayLoading(false);
      setIsLoadingMoreCourseDays(false);
      return;
    }

    let cancelled = false;
    setCourseDayError("");
    setIsCourseDayLoading(true);
    setCourseDayPage({
      items: selectedSession.course_days,
      total_count: selectedSession.course_days_count,
      offset: 0,
      limit: PEDAGOGY_DRAWER_DAY_PAGE_SIZE,
    });

    void (async () => {
      try {
        const page = await fetchAdminTeacherSessionCourseDays(detail.teacher.id, selectedSession.session_id, {
          offset: 0,
          limit: PEDAGOGY_DRAWER_DAY_PAGE_SIZE,
        });
        if (!cancelled) {
          setCourseDayPage(page);
        }
      } catch {
        if (!cancelled) {
          setCourseDayError("Impossible de charger toutes les journées de cours pour le moment.");
        }
      } finally {
        if (!cancelled) {
          setIsCourseDayLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detail.teacher.id, selectedSession?.session_id]);

  async function loadMoreCourseDays() {
    if (!selectedSession || isLoadingMoreCourseDays || !canLoadMoreCourseDays) return;
    setCourseDayError("");
    setIsLoadingMoreCourseDays(true);
    try {
      const nextPage = await fetchAdminTeacherSessionCourseDays(detail.teacher.id, selectedSession.session_id, {
        offset: displayedCourseDays.length,
        limit: PEDAGOGY_DRAWER_DAY_PAGE_SIZE,
      });
      setCourseDayPage((current) => ({
        items: [...(current?.items ?? selectedSession.course_days), ...nextPage.items],
        total_count: nextPage.total_count,
        offset: nextPage.offset,
        limit: nextPage.limit,
      }));
    } catch {
      setCourseDayError("Impossible de charger les journées supplémentaires pour le moment.");
    } finally {
      setIsLoadingMoreCourseDays(false);
    }
  }

  async function handleQuizStatusUpdate(quizId: number, status: "draft" | "active" | "closed") {
    setContentActionKey(`quiz-${quizId}-${status}`);
    try {
      const nextDetail = await updateAdminTeacherQuizStatus(detail.teacher.id, quizId, { status });
      onDetailChange(nextDetail);
      success("Statut du quiz mis à jour.");
    } catch {
      toastError("Impossible de mettre à jour ce quiz.");
    } finally {
      setContentActionKey(null);
    }
  }

  async function handleResourcePublicationToggle(resourceId: number, publish: boolean) {
    setContentActionKey(`resource-${resourceId}`);
    try {
      const nextDetail = await updateAdminTeacherResourcePublication(detail.teacher.id, resourceId, {
        published_at: publish ? new Date().toISOString() : null,
      });
      onDetailChange(nextDetail);
      success(publish ? "Ressource publiée." : "Ressource retirée de la publication.");
    } catch {
      toastError("Impossible de mettre à jour cette ressource.");
    } finally {
      setContentActionKey(null);
    }
  }

  async function handleAssignmentDueDateUpdate(assignmentId: number) {
    const nextDueDate = assignmentDueDrafts[assignmentId];
    if (!nextDueDate) {
      toastError("Choisissez une échéance valide pour ce devoir.");
      return;
    }
    setContentActionKey(`assignment-${assignmentId}`);
    try {
      const nextDetail = await updateAdminTeacherAssignmentDueDate(detail.teacher.id, assignmentId, {
        due_date: localDateTimeToIso(nextDueDate),
      });
      onDetailChange(nextDetail);
      success("Échéance du devoir mise à jour.");
    } catch {
      toastError("Impossible de mettre à jour ce devoir.");
    } finally {
      setContentActionKey(null);
    }
  }

  return (
    <>
      <section className="adm-teacher-pedagogy-section">
        <div className="adm-section-title-row">
          <div>
            <h4>Contrôle pédagogique</h4>
            <p>
              {filteredPedagogy.length} session(s) affichée(s) · {sessionsWithAlertsCount} session(s) avec alerte.
            </p>
          </div>
        </div>

        <div className="adm-teacher-pedagogy-controls">
          <label className="adm-field">
            <span>Statut de session</span>
            <select
              className="adm-select"
              value={sessionStatusFilter}
              onChange={(event) => setSessionStatusFilter(event.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {sessionStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            <span>Niveau d’alerte</span>
            <select
              className="adm-select"
              value={sessionAlertFilter}
              onChange={(event) => setSessionAlertFilter(event.target.value)}
            >
              <option value="all">Toutes les sessions</option>
              <option value="with_alerts">Avec alertes</option>
              <option value="critical">Avec critique</option>
              <option value="warning">Avec warning</option>
              <option value="clean">Sans alerte</option>
            </select>
          </label>
        </div>

        {filteredPedagogy.length ? (
          <div className="adm-teacher-pedagogy-list">
            {filteredPedagogy.map((sessionAudit) => {
              const previewCourseDays = sessionAudit.course_days.slice(0, PEDAGOGY_CARD_PREVIEW_LIMIT);
              const remainingCourseDays = Math.max(0, sessionAudit.course_days_count - previewCourseDays.length);

              return (
                <article key={sessionAudit.session_id} className="adm-teacher-pedagogy-card">
                  <div className="adm-teacher-pedagogy-card__header">
                    <div>
                      <span className="adm-badge adm-badge--gray">{sessionAudit.session_label}</span>
                      <h5>{sessionAudit.formation_title}</h5>
                      <p>
                        {formatAuditDate(sessionAudit.start_date)} - {formatAuditDate(sessionAudit.end_date)}
                      </p>
                    </div>
                    <div className="adm-teacher-pedagogy-card__actions">
                      <span className={statusBadge(sessionAudit.session_status)}>
                        {statusLabel(sessionAudit.session_status)}
                      </span>
                      <button
                        className="adm-btn adm-btn--sm adm-btn--ghost"
                        type="button"
                        onClick={() => setSelectedSessionId(sessionAudit.session_id)}
                      >
                        Voir le détail
                      </button>
                    </div>
                  </div>

                  <div className="adm-teacher-alert-row">
                    {sessionAudit.alerts.length ? (
                      sessionAudit.alerts.map((alert) => (
                        <span key={`${sessionAudit.session_id}-${alert.code}`} className={pedagogyAlertClass(alert.level)}>
                          {alert.label}
                        </span>
                      ))
                    ) : (
                      <span className="adm-teacher-alert-pill adm-teacher-alert-pill--ok">Aucune alerte</span>
                    )}
                  </div>

                  <div className="adm-teacher-pedagogy-metrics">
                    <span><strong>{sessionAudit.students_count}</strong> Étudiants</span>
                    <span><strong>{sessionAudit.course_days_count}</strong> Journées</span>
                    <span><strong>{sessionAudit.lessons_count}</strong> Leçons</span>
                    <span><strong>{sessionAudit.resources_count}</strong> Ressources</span>
                    <span><strong>{sessionAudit.assignments_count}</strong> Devoirs</span>
                    <span><strong>{sessionAudit.quizzes_count}</strong> Quiz</span>
                    <span><strong>{sessionAudit.pending_reviews_count}</strong> À corriger</span>
                  </div>

                  <div className="adm-teacher-audit-columns">
                    <div>
                      <h6>Cours & leçons</h6>
                      {sessionAudit.courses.length ? (
                        <div className="adm-teacher-audit-mini-list">
                          {sessionAudit.courses.map((course) => (
                            <span key={course.id}>
                              <strong>{course.title}</strong>
                              {course.chapters_count} chapitre(s) · {course.lessons_count} leçon(s)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="adm-empty adm-empty--compact">Aucun cours créé.</p>
                      )}
                    </div>

                    <div>
                      <h6>Journées de cours</h6>
                      {previewCourseDays.length ? (
                        <>
                          <div className="adm-teacher-audit-mini-list">
                            {previewCourseDays.map((day) => (
                              <span key={day.id}>
                                <strong>{day.title}</strong>
                                {formatAuditDate(day.scheduled_at)} · {auditStatusLabel(day.status)} · {day.present_count}/{day.attendance_count} présence(s)
                              </span>
                            ))}
                          </div>
                          {remainingCourseDays > 0 && (
                            <div className="adm-teacher-audit-footer">
                              <small>
                                {previewCourseDays.length} sur {sessionAudit.course_days_count} journée(s) affichée(s)
                              </small>
                              <button
                                className="adm-btn adm-btn--sm adm-btn--ghost"
                                type="button"
                                onClick={() => setSelectedSessionId(sessionAudit.session_id)}
                              >
                                Voir les {remainingCourseDays} autres
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="adm-empty adm-empty--compact">Aucune journée planifiée.</p>
                      )}
                    </div>

                    <div>
                      <h6>Contenus évaluables</h6>
                      {sessionAudit.contents.length ? (
                        <div className="adm-teacher-audit-mini-list">
                          {sessionAudit.contents.map((content) => (
                            <span key={`${content.content_type}-${content.id}`}>
                              <strong>{content.title}</strong>
                              {contentTypeLabel(content.content_type)} · {auditStatusLabel(content.status)} ·{" "}
                              {content.due_date
                                ? formatAuditDate(content.due_date)
                                : formatAuditDate(content.scheduled_at)}
                              {content.pending_reviews_count > 0 && (
                                <> · {content.pending_reviews_count} à corriger</>
                              )}
                              {content.attempts_count > 0 && (
                                <> · {content.attempts_count} tentative(s)</>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="adm-empty adm-empty--compact">Aucun devoir, quiz ou ressource.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="adm-empty adm-empty--compact">Aucune session ne correspond aux filtres de suivi pédagogique.</p>
        )}
      </section>

      {selectedSession && (
        <div className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="teacher-pedagogy-session-title">
          <button
            aria-label="Fermer le détail pédagogique"
            className="admin-drawer__backdrop"
            type="button"
            onClick={() => setSelectedSessionId(null)}
          />
          <div className="admin-drawer__panel adm-pedagogy-drawer">
            <div className="admin-drawer__header">
              <div>
                <p className="admin-modal__eyebrow">Suivi pédagogique</p>
                <h3 id="teacher-pedagogy-session-title">
                  {selectedSession.session_label} · {selectedSession.formation_title}
                </h3>
                <p>
                  {detail.teacher.full_name} · {statusLabel(selectedSession.session_status)} ·{" "}
                  {formatAuditDate(selectedSession.start_date)} - {formatAuditDate(selectedSession.end_date)}
                </p>
              </div>
              <button
                aria-label="Fermer le détail pédagogique"
                className="admin-icon-button admin-icon-button--close"
                type="button"
                onClick={() => setSelectedSessionId(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="admin-drawer__body">
              <div className="adm-pedagogy-drawer__summary">
                <span><strong>{selectedSession.students_count}</strong> Étudiants</span>
                <span><strong>{selectedSession.course_days_count}</strong> Journées</span>
                <span><strong>{selectedSession.live_events_count}</strong> Lives</span>
                <span><strong>{selectedSession.courses_count}</strong> Cours</span>
                <span><strong>{selectedSession.lessons_count}</strong> Leçons</span>
                <span><strong>{selectedSession.pending_reviews_count}</strong> Corrections en attente</span>
              </div>

              <section className="adm-pedagogy-drawer__section">
                <div className="adm-section-title-row">
                  <div>
                    <h4>Alertes pédagogiques</h4>
                    <p>Vue de contrôle rapide pour l’admin sur cette session.</p>
                  </div>
                </div>
                {selectedSession.alerts.length ? (
                  <div className="adm-pedagogy-alert-list">
                    {selectedSession.alerts.map((alert) => (
                      <article key={`${selectedSession.session_id}-${alert.code}`} className="adm-pedagogy-alert-item">
                        <span className={pedagogyAlertClass(alert.level)}>{alert.label}</span>
                        {alert.detail ? <p>{alert.detail}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="adm-empty adm-empty--compact">
                    Aucun signal bloquant ou à surveiller sur cette session.
                  </div>
                )}
              </section>

              <div className="adm-pedagogy-drawer-grid">
                <section className="adm-pedagogy-drawer__section">
                  <div className="adm-section-title-row">
                    <div>
                      <h4>Étudiants suivis</h4>
                      <p>{selectedSessionStudents.length} étudiant(s) rattaché(s) à cette session.</p>
                    </div>
                  </div>
                  {selectedSessionStudents.length ? (
                    <div className="adm-pedagogy-student-list">
                      {selectedSessionStudents.map((student) => (
                        <article key={student.enrollment_id}>
                          <div>
                            <strong>{student.full_name}</strong>
                            <span>{student.email}</span>
                            {student.student_code ? <span className="adm-code">{student.student_code}</span> : null}
                          </div>
                          <div className="adm-pedagogy-student-list__metrics">
                            <span><strong>{Math.round(student.progress_pct)}%</strong> Progression</span>
                            <span><strong>{student.present_count}</strong> Présences</span>
                            <span><strong>{formatActivityPercent(student.average_grade_pct)}</strong> Moyenne</span>
                            <span><strong>{student.pending_reviews_count}</strong> À corriger</span>
                            <span><strong>{formatActivityDate(student.last_activity_at)}</strong> Dernière activité</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="adm-empty adm-empty--compact">Aucun étudiant actif sur cette session.</div>
                  )}
                </section>

                <section className="adm-pedagogy-drawer__section">
                  <div className="adm-section-title-row">
                    <div>
                      <h4>Journées de cours</h4>
                      <p>
                        Présences, ressources et évaluations par journée.
                        {totalCourseDays > 0 ? ` ${displayedCourseDays.length} sur ${totalCourseDays} affichée(s).` : ""}
                      </p>
                    </div>
                  </div>
                  {displayedCourseDays.length ? (
                    <>
                      <div className="adm-pedagogy-detail-list">
                        {displayedCourseDays.map((day) => (
                          <article key={day.id}>
                            <strong>{day.title}</strong>
                            <span>{formatAuditDate(day.scheduled_at)} · {auditStatusLabel(day.status)}</span>
                            <span>
                              {day.present_count} présent(s) · {day.late_count} retard(s) · {day.absent_count} absent(s)
                            </span>
                            <span>
                              {day.resource_count} ressource(s) · {day.assignment_count} devoir(s) · {day.quiz_count} quiz
                            </span>
                          </article>
                        ))}
                      </div>
                      {(courseDayError || canLoadMoreCourseDays || isCourseDayLoading) && (
                        <div className="adm-pedagogy-detail-actions">
                          {courseDayError ? <p>{courseDayError}</p> : <span />}
                          {canLoadMoreCourseDays && (
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="button"
                              onClick={() => void loadMoreCourseDays()}
                              disabled={isLoadingMoreCourseDays || isCourseDayLoading}
                            >
                              {isLoadingMoreCourseDays || isCourseDayLoading
                                ? "Chargement…"
                                : `Afficher ${Math.min(PEDAGOGY_DRAWER_DAY_PAGE_SIZE, totalCourseDays - displayedCourseDays.length)} journée(s) de plus`}
                            </button>
                          )}
                          {!canLoadMoreCourseDays && isCourseDayLoading && (
                            <small>Chargement des journées de cours…</small>
                          )}
                        </div>
                      )}
                    </>
                  ) : isCourseDayLoading ? (
                    <div className="adm-empty adm-empty--compact">Chargement des journées de cours…</div>
                  ) : (
                    <div className="adm-empty adm-empty--compact">Aucune journée de cours planifiée.</div>
                  )}
                </section>

                <section className="adm-pedagogy-drawer__section">
                  <div className="adm-section-title-row">
                    <div>
                      <h4>Cours & leçons</h4>
                      <p>Structure pédagogique créée pour cette session.</p>
                    </div>
                  </div>
                  {selectedSession.courses.length ? (
                    <div className="adm-pedagogy-detail-list">
                      {selectedSession.courses.map((course) => (
                        <article key={course.id}>
                          <strong>{course.title}</strong>
                          <span>{course.chapters_count} chapitre(s)</span>
                          <span>{course.lessons_count} leçon(s)</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="adm-empty adm-empty--compact">Aucun cours structuré pour cette session.</div>
                  )}
                </section>

                <section className="adm-pedagogy-drawer__section">
                  <div className="adm-section-title-row">
                    <div>
                      <h4>Contenus & évaluations</h4>
                      <p>{filteredSelectedContents.length} contenu(s) affiché(s) sur {selectedSession.contents.length}.</p>
                    </div>
                    <label className="adm-field adm-pedagogy-content-filter">
                      <span>Filtrer</span>
                      <select
                        className="adm-select"
                        value={contentFilter}
                        onChange={(event) => setContentFilter(event.target.value)}
                      >
                        <option value="all">Tous</option>
                        <option value="resource">Ressources</option>
                        <option value="assignment">Devoirs</option>
                        <option value="quiz">Quiz</option>
                        <option value="attention">À surveiller</option>
                      </select>
                    </label>
                  </div>

                  {filteredSelectedContents.length ? (
                    <div className="adm-pedagogy-detail-list">
                      {filteredSelectedContents.map((content) => {
                        const isResource = content.content_type.startsWith("resource:");
                        const isAssignment = content.content_type === "assignment";
                        const isQuiz = content.content_type === "quiz";
                        const assignmentDraft = assignmentDueDrafts[content.id] ?? "";

                        return (
                          <article key={`${content.content_type}-${content.id}`} className="adm-pedagogy-content-card">
                            <div className="adm-pedagogy-content-card__header">
                              <div>
                                <strong>{content.title}</strong>
                                <span>{contentTypeLabel(content.content_type)} · {auditStatusLabel(content.status)}</span>
                              </div>
                              {content.pending_reviews_count > 0 ? (
                                <span className="adm-badge adm-badge--yellow">
                                  {content.pending_reviews_count} à corriger
                                </span>
                              ) : null}
                            </div>

                            <span>
                              {content.due_date
                                ? `Échéance ${formatAuditDate(content.due_date)}`
                                : `Planifié ${formatAuditDate(content.scheduled_at)}`}
                            </span>
                            {content.attempts_count > 0 ? (
                              <span>{content.attempts_count} tentative(s)</span>
                            ) : null}

                            {isResource ? (
                              <div className="adm-pedagogy-content-actions">
                                <button
                                  className="adm-btn adm-btn--sm adm-btn--ghost"
                                  type="button"
                                  disabled={contentActionKey === `resource-${content.id}`}
                                  onClick={() => void handleResourcePublicationToggle(content.id, content.status !== "published")}
                                >
                                  {contentActionKey === `resource-${content.id}`
                                    ? "Mise à jour…"
                                    : content.status === "published"
                                      ? "Retirer de la publication"
                                      : "Publier maintenant"}
                                </button>
                              </div>
                            ) : null}

                            {isQuiz ? (
                              <div className="adm-pedagogy-content-actions">
                                {(["draft", "active", "closed"] as const).map((statusValue) => (
                                  <button
                                    key={statusValue}
                                    className={`adm-btn adm-btn--sm ${
                                      content.status === statusValue ? "adm-btn--primary" : "adm-btn--ghost"
                                    }`}
                                    type="button"
                                    disabled={
                                      content.status === statusValue || contentActionKey === `quiz-${content.id}-${statusValue}`
                                    }
                                    onClick={() => void handleQuizStatusUpdate(content.id, statusValue)}
                                  >
                                    {contentActionKey === `quiz-${content.id}-${statusValue}`
                                      ? "Mise à jour…"
                                      : auditStatusLabel(statusValue)}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {isAssignment ? (
                              <div className="adm-pedagogy-content-actions adm-pedagogy-content-actions--assignment">
                                <input
                                  className="adm-input adm-input--sm"
                                  type="datetime-local"
                                  value={assignmentDraft}
                                  onChange={(event) =>
                                    setAssignmentDueDrafts((current) => ({
                                      ...current,
                                      [content.id]: event.target.value,
                                    }))
                                  }
                                />
                                <button
                                  className="adm-btn adm-btn--sm adm-btn--ghost"
                                  type="button"
                                  disabled={contentActionKey === `assignment-${content.id}` || !assignmentDraft}
                                  onClick={() => void handleAssignmentDueDateUpdate(content.id)}
                                >
                                  {contentActionKey === `assignment-${content.id}` ? "Mise à jour…" : "Mettre à jour l’échéance"}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="adm-empty adm-empty--compact">Aucun contenu ne correspond au filtre sélectionné.</div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminTeachersPage() {
  const { loadingError, formations, sessions } = useAdminDashboard();
  const { success, error: toastError } = useToast();
  const [teachers, setTeachers] = useState<AdminTeacherItem[]>([]);
  const [invitations, setInvitations] = useState<TeacherInviteView[]>([]);
  const [tab, setTab] = useState<TeacherTab>("teachers");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteDraft, setInviteDraft] = useState({ ...EMPTY_INVITE_DRAFT });
  const [isInviting, setIsInviting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<TeacherInviteView | null>(null);
  const [modalError, setModalError] = useState("");
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ teacherId: "", formationSlug: "" });
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<AdminTeacherDetail | null>(null);
  const [teacherEditDraft, setTeacherEditDraft] = useState({ ...EMPTY_TEACHER_EDIT_DRAFT });
  const [teacherDetailError, setTeacherDetailError] = useState("");
  const [isTeacherDetailLoading, setIsTeacherDetailLoading] = useState(false);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [detailAssignmentSlug, setDetailAssignmentSlug] = useState("");
  const [removingFormationSlug, setRemovingFormationSlug] = useState<string | null>(null);
  const [pedagogyTeacherId, setPedagogyTeacherId] = useState("");
  const [pedagogyDetail, setPedagogyDetail] = useState<AdminTeacherDetail | null>(null);
  const [isPedagogyLoading, setIsPedagogyLoading] = useState(false);
  const [pedagogyError, setPedagogyError] = useState("");

  async function refreshTeachers() {
    setIsLoading(true);
    try {
      const [teacherRows, invitationRows] = await Promise.all([
        fetchAdminTeachers(),
        fetchAdminTeacherInvitations(),
      ]);
      setTeachers(teacherRows);
      setInvitations(invitationRows);
    } catch {
      toastError("Impossible de charger la gestion des enseignants.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshTeachers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const activeTeachers = teachers.filter((teacher) => teacher.status === "active").length;
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending").length;
  const assignedSessions = sessions.filter((session) => Boolean(session.teacher_name)).length;
  const sessionsWithoutTeacher = sessions.filter((session) => !session.teacher_name).length;

  const filteredTeachers = useMemo(
    () =>
      teachers.filter((teacher) =>
        includesSearchValue(
          [
            teacher.full_name,
            teacher.email,
            teacher.teacher_code ?? "",
            teacher.whatsapp ?? "",
            teacher.nationality ?? "",
            teacher.subject ?? "",
            teacher.status,
          ],
          search,
        ),
      ),
    [teachers, search],
  );

  const filteredInvitations = useMemo(
    () =>
      invitations.filter((invitation) =>
        includesSearchValue(
          [invitation.full_name, invitation.email, invitation.whatsapp ?? "", invitation.nationality ?? "", invitation.status],
          search,
        ),
      ),
    [invitations, search],
  );

  const visibleRows = tab === "invitations" ? filteredInvitations : filteredTeachers;
  const totalPages = getTotalPages(visibleRows.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginatedTeachers = useMemo(
    () => getPageItems(filteredTeachers, safePage, PAGE_SIZE),
    [filteredTeachers, safePage],
  );
  const paginatedInvitations = useMemo(
    () => getPageItems(filteredInvitations, safePage, PAGE_SIZE),
    [filteredInvitations, safePage],
  );
  const invitePhoneInvalid = Boolean(inviteDraft.whatsapp && !isValidPhoneNumber(inviteDraft.whatsapp));
  const inviteCustomSubjectInvalid =
    inviteDraft.subject === OTHER_TEACHER_SPECIALTY && !inviteDraft.custom_subject.trim();
  const teacherEditPhoneInvalid = Boolean(
    teacherEditDraft.whatsapp && !isValidPhoneNumber(teacherEditDraft.whatsapp),
  );
  const teacherEditCustomSubjectInvalid =
    teacherEditDraft.subject === OTHER_TEACHER_SPECIALTY && !teacherEditDraft.custom_subject.trim();
  const assignedFormationSlugs = useMemo(
    () => new Set((teacherDetail?.formations ?? []).map((formation) => formation.slug)),
    [teacherDetail],
  );
  const detailAssignableFormations = useMemo(
    () => formations.filter((formation) => !assignedFormationSlugs.has(formation.slug)),
    [assignedFormationSlugs, formations],
  );

  function syncTeacherEditDraft(detail: AdminTeacherDetail) {
    const subject = splitTeacherSubject(detail.teacher.subject);
    setTeacherEditDraft({
      full_name: detail.teacher.full_name,
      email: detail.teacher.email,
      whatsapp: detail.teacher.whatsapp ?? "",
      nationality: detail.teacher.nationality ?? "",
      subject: subject.selectedSubject,
      custom_subject: subject.customSubject,
      experience_years:
        detail.teacher.experience_years !== null ? String(detail.teacher.experience_years) : "",
      portfolio_url: detail.teacher.portfolio_url ?? "",
      bio: detail.teacher.bio ?? "",
    });
  }

  async function loadTeacherDetail(teacherId: number) {
    setSelectedTeacherId(teacherId);
    setTeacherDetail(null);
    setTeacherDetailError("");
    setDetailAssignmentSlug("");
    setIsTeacherDetailLoading(true);
    try {
      const detail = await fetchAdminTeacherDetail(teacherId);
      setTeacherDetail(detail);
      syncTeacherEditDraft(detail);
    } catch {
      setTeacherDetailError("Impossible de charger la fiche de cet enseignant.");
    } finally {
      setIsTeacherDetailLoading(false);
    }
  }

  async function loadPedagogyDetail(teacherId: string) {
    setPedagogyTeacherId(teacherId);
    setPedagogyDetail(null);
    setPedagogyError("");
    if (!teacherId) return;
    setIsPedagogyLoading(true);
    try {
      const detail = await fetchAdminTeacherDetail(Number(teacherId));
      setPedagogyDetail(detail);
    } catch {
      setPedagogyError("Impossible de charger le suivi pédagogique de cet enseignant.");
    } finally {
      setIsPedagogyLoading(false);
    }
  }

  function syncPedagogyDetailIfSelected(detail: AdminTeacherDetail) {
    if (pedagogyTeacherId === String(detail.teacher.id)) {
      setPedagogyDetail(detail);
    }
  }

  function closeTeacherDetail() {
    if (isSavingTeacher) return;
    setSelectedTeacherId(null);
    setTeacherDetail(null);
    setTeacherDetailError("");
    setDetailAssignmentSlug("");
  }

  function openCreateTeacherModal() {
    setInviteDraft({ ...EMPTY_INVITE_DRAFT });
    setCreatedInvitation(null);
    setModalError("");
    setIsCreateModalOpen(true);
  }

  function closeCreateTeacherModal() {
    if (isInviting) return;
    setIsCreateModalOpen(false);
    setCreatedInvitation(null);
    setModalError("");
  }

  function createAnotherTeacher() {
    setInviteDraft({ ...EMPTY_INVITE_DRAFT });
    setCreatedInvitation(null);
    setModalError("");
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviting(true);
    setModalError("");
    try {
      if (invitePhoneInvalid) {
        setModalError("Le numéro WhatsApp n’est pas valide. Choisis le pays puis saisis le numéro complet.");
        setIsInviting(false);
        return;
      }
      if (inviteCustomSubjectInvalid) {
        setModalError("Précise la spécialité de l’enseignant dans le champ Autre.");
        setIsInviting(false);
        return;
      }
      const subject = resolveTeacherSubject(inviteDraft.subject, inviteDraft.custom_subject);
      const payload = {
        full_name: inviteDraft.full_name.trim(),
        email: inviteDraft.email.trim(),
        whatsapp: inviteDraft.whatsapp.trim() || null,
        nationality: inviteDraft.nationality.trim() || null,
        subject: subject || null,
        experience_years: inviteDraft.experience_years
          ? Number(inviteDraft.experience_years)
          : null,
        portfolio_url: inviteDraft.portfolio_url.trim() || null,
        bio: inviteDraft.bio.trim() || null,
      };
      const invitation = await inviteTeacher(payload);
      setInviteDraft({ ...EMPTY_INVITE_DRAFT });
      setCreatedInvitation(invitation);
      setTab("invitations");
      success("Enseignant préparé. Le lien d’invitation est prêt à copier.");
      await refreshTeachers();
    } catch {
      setModalError("Impossible de créer cet enseignant. Vérifie l’email et les champs saisis.");
      toastError("Impossible de créer cette invitation enseignant.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentDraft.teacherId || !assignmentDraft.formationSlug) return;
    setIsAssigning(true);
    try {
      await assignTeacherToFormation(assignmentDraft.formationSlug, Number(assignmentDraft.teacherId));
      setAssignmentDraft({ teacherId: "", formationSlug: "" });
      success("Enseignant assigné à la formation.");
      await refreshTeachers();
    } catch {
      toastError("Impossible d’assigner cet enseignant à cette formation.");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleSaveTeacherDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherDetail) return;
    setTeacherDetailError("");
    if (teacherEditPhoneInvalid) {
      setTeacherDetailError("Le numéro WhatsApp n’est pas valide.");
      return;
    }
    if (teacherEditCustomSubjectInvalid) {
      setTeacherDetailError("Précise la spécialité dans le champ Autre.");
      return;
    }
    const subject = resolveTeacherSubject(teacherEditDraft.subject, teacherEditDraft.custom_subject);
    setIsSavingTeacher(true);
    try {
      const detail = await updateAdminTeacher(teacherDetail.teacher.id, {
        full_name: teacherEditDraft.full_name.trim(),
        email: teacherEditDraft.email.trim(),
        whatsapp: teacherEditDraft.whatsapp.trim() || null,
        nationality: teacherEditDraft.nationality.trim() || null,
        subject: subject || null,
        experience_years: teacherEditDraft.experience_years
          ? Number(teacherEditDraft.experience_years)
          : null,
        portfolio_url: teacherEditDraft.portfolio_url.trim() || null,
        bio: teacherEditDraft.bio.trim() || null,
      });
      setTeacherDetail(detail);
      syncTeacherEditDraft(detail);
      setTeachers((rows) => rows.map((row) => (row.id === detail.teacher.id ? detail.teacher : row)));
      syncPedagogyDetailIfSelected(detail);
      success("Fiche enseignant mise à jour.");
    } catch {
      setTeacherDetailError("Impossible d’enregistrer cette fiche. Vérifie l’email et les champs saisis.");
    } finally {
      setIsSavingTeacher(false);
    }
  }

  async function handleToggleTeacherStatus() {
    if (!teacherDetail) return;
    const nextStatus = teacherDetail.teacher.status === "active" ? "suspended" : "active";
    const actionLabel = nextStatus === "suspended" ? "Suspendre" : "Réactiver";
    if (!window.confirm(`${actionLabel} ${teacherDetail.teacher.full_name} ?`)) return;
    setTeacherDetailError("");
    setIsSavingTeacher(true);
    try {
      const detail = await updateAdminTeacher(teacherDetail.teacher.id, { status: nextStatus });
      setTeacherDetail(detail);
      syncTeacherEditDraft(detail);
      setTeachers((rows) => rows.map((row) => (row.id === detail.teacher.id ? detail.teacher : row)));
      syncPedagogyDetailIfSelected(detail);
      success(nextStatus === "suspended" ? "Enseignant suspendu." : "Enseignant réactivé.");
    } catch {
      setTeacherDetailError("Impossible de modifier le statut de cet enseignant.");
    } finally {
      setIsSavingTeacher(false);
    }
  }

  async function handleDetailAssignFormation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherDetail || !detailAssignmentSlug) return;
    setTeacherDetailError("");
    setIsAssigning(true);
    try {
      await assignTeacherToFormation(detailAssignmentSlug, teacherDetail.teacher.id);
      const detail = await fetchAdminTeacherDetail(teacherDetail.teacher.id);
      setTeacherDetail(detail);
      syncTeacherEditDraft(detail);
      setTeachers((rows) => rows.map((row) => (row.id === detail.teacher.id ? detail.teacher : row)));
      syncPedagogyDetailIfSelected(detail);
      setDetailAssignmentSlug("");
      success("Formation ajoutée à cet enseignant.");
    } catch {
      setTeacherDetailError("Impossible d’ajouter cette formation à l’enseignant.");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemoveDetailFormation(slug: string) {
    if (!teacherDetail) return;
    if (!window.confirm("Retirer cette formation de l’enseignant ?")) return;
    setTeacherDetailError("");
    setRemovingFormationSlug(slug);
    try {
      await removeTeacherFromFormation(slug, teacherDetail.teacher.id);
      const detail = await fetchAdminTeacherDetail(teacherDetail.teacher.id);
      setTeacherDetail(detail);
      syncTeacherEditDraft(detail);
      setTeachers((rows) => rows.map((row) => (row.id === detail.teacher.id ? detail.teacher : row)));
      syncPedagogyDetailIfSelected(detail);
      success("Formation retirée de l’enseignant.");
    } catch {
      setTeacherDetailError("Impossible de retirer cette formation.");
    } finally {
      setRemovingFormationSlug(null);
    }
  }

  async function copyInvitation(token: string) {
    const link = invitationLink(token);
    try {
      await navigator.clipboard.writeText(link);
      success("Lien d’invitation copié.");
    } catch {
      toastError(link);
    }
  }

  async function handleRevokeInvitation(invitation: TeacherInviteView) {
    if (!window.confirm(`Révoquer l’invitation de ${invitation.full_name} ?`)) return;
    setRevokingId(invitation.id);
    try {
      const updated = await revokeTeacherInvitation(invitation.id);
      setInvitations((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setCreatedInvitation((current) => (current?.id === updated.id ? updated : current));
      success("Invitation révoquée. Le lien ne peut plus être utilisé.");
    } catch {
      toastError("Impossible de révoquer cette invitation.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Gestion des enseignants</p>
          <h1 className="adm-page-title">Enseignants</h1>
          <p className="adm-page-desc">
            Invitez les formateurs, suivez leurs codes enseignants et contrôlez leurs affectations pédagogiques.
          </p>
        </div>
        <button
          className="adm-btn adm-btn--primary"
          type="button"
          onClick={openCreateTeacherModal}
        >
          <FaUserTie /> Créer un enseignant
        </button>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--purple">
          <span className="adm-kpi-card__bg-icon"><FaUserTie /></span>
          <span>Enseignants</span>
          <strong>{teachers.length}</strong>
          <small>{activeTeachers} actifs</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><FaEnvelope /></span>
          <span>Invitations</span>
          <strong>{pendingInvitations}</strong>
          <small>en attente</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><CalendarDays strokeWidth={1.2} /></span>
          <span>Sessions assignées</span>
          <strong>{assignedSessions}</strong>
          <small>{sessionsWithoutTeacher} sans enseignant</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><BookOpen strokeWidth={1.2} /></span>
          <span>Formations</span>
          <strong>{formations.length}</strong>
          <small>catalogue actif</small>
        </div>
      </div>

      {loadingError && (
        <div className="adm-state-card adm-state-card--error">
          <p>{loadingError}</p>
        </div>
      )}

      <div className="adm-card">
        <div className="usr-tabs">
          <button
            type="button"
            className={`usr-tab${tab === "teachers" ? " is-active" : ""}`}
            onClick={() => setTab("teachers")}
          >
            <UserCheck size={15} />
            Enseignants
            <span className="usr-tab__count">{teachers.length}</span>
          </button>
          <button
            type="button"
            className={`usr-tab${tab === "invitations" ? " is-active" : ""}`}
            onClick={() => setTab("invitations")}
          >
            <Link2 size={15} />
            Invitation & lien
            <span className="usr-tab__count">{invitations.length}</span>
          </button>
          <button
            type="button"
            className={`usr-tab${tab === "assignments" ? " is-active" : ""}`}
            onClick={() => setTab("assignments")}
          >
            <Users size={15} />
            Affectations
          </button>
          <button
            type="button"
            className={`usr-tab${tab === "pedagogy" ? " is-active" : ""}`}
            onClick={() => setTab("pedagogy")}
          >
            <BookOpen size={15} />
            Suivi pédagogique
          </button>
        </div>

        <div className="adm-card__header" style={{ borderTop: "1px solid #f0f2f8" }}>
          <div>
            <h2 className="adm-card__title">
              {tab === "teachers"
                ? "Liste des enseignants"
                : tab === "invitations"
                  ? "Invitations enseignants"
                  : tab === "assignments"
                    ? "Affectations pédagogiques"
                    : "Suivi pédagogique"}
            </h2>
            <p className="adm-card__desc">
              {tab === "assignments"
                ? "Assignez un enseignant à une formation. Les sessions restent configurées depuis l’onglet Sessions."
                : tab === "invitations"
                  ? "Copiez ou révoquez les liens existants. La création d’un enseignant se fait depuis le bouton dédié."
                  : tab === "pedagogy"
                    ? "Filtrez par enseignant pour contrôler ses cours, journées, ressources, devoirs et quiz."
                    : "Recherchez par nom, email, code enseignant, spécialité ou statut."}
            </p>
          </div>
          {tab === "invitations" && (
            <button className="adm-btn adm-btn--primary" type="button" onClick={openCreateTeacherModal}>
              <FaUserTie /> Créer un enseignant
            </button>
          )}
          {tab !== "assignments" && tab !== "invitations" && tab !== "pedagogy" && (
            <label className="adm-search">
              <FaSearch />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom, email, code, spécialité…"
              />
            </label>
          )}
          {tab === "invitations" && (
            <label className="adm-search">
              <FaSearch />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom, email, statut…"
              />
            </label>
          )}
        </div>

        {tab === "teachers" && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Enseignant</th>
                  <th>Code</th>
                  <th>Spécialité</th>
                  <th>Formations</th>
                  <th>Sessions</th>
                  <th>Étudiants suivis</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><div className="adm-empty">Chargement…</div></td></tr>
                ) : paginatedTeachers.length ? (
                  paginatedTeachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <div className="adm-user-cell">
                          <span className="usr-avatar">{teacher.full_name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                              {teacher.full_name}
                            </strong>
                            <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>{teacher.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {teacher.teacher_code ? (
                          <span className="usr-code-pill"><FaIdBadge /> {teacher.teacher_code}</span>
                        ) : (
                          <span className="adm-td-muted">Non généré</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "0.82rem", color: "#111827" }}>
                          {teacher.subject || "—"}
                        </strong>
                        {teacher.nationality && (
                          <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>{teacher.nationality}</span>
                        )}
                      </td>
                      <td><strong>{teacher.assigned_formations_count}</strong></td>
                      <td><strong>{teacher.assigned_sessions_count}</strong></td>
                      <td><strong>{teacher.students_count}</strong></td>
                      <td><span className={statusBadge(teacher.status)}>{statusLabel(teacher.status)}</span></td>
                      <td>
                        <button
                          className="adm-btn adm-btn--sm adm-btn--ghost"
                          type="button"
                          onClick={() => loadTeacherDetail(teacher.id)}
                        >
                          Voir fiche
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8}><div className="adm-empty">Aucun enseignant trouvé.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invitations" && (
          <>
            <div className="adm-info-flow">
              <div>
                <strong>Création des enseignants</strong>
                <span>Le bouton “Créer un enseignant” ouvre un formulaire clair. Une fois validé, le lien d’invitation est généré et copiable.</span>
              </div>
              <ol>
                <li>Le profil prévu est enregistré avec l’invitation.</li>
                <li>L’enseignant active son compte en créant son mot de passe.</li>
                <li>Tu peux copier, annuler la création ou révoquer le lien tant qu’il n’est pas accepté.</li>
              </ol>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Invité</th>
                    <th>Profil prévu</th>
                    <th>Statut</th>
                    <th>Expiration</th>
                    <th>Actions</th>
                    <th>Créée le</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6}><div className="adm-empty">Chargement…</div></td></tr>
                  ) : paginatedInvitations.length ? (
                    paginatedInvitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>
                          <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                            {invitation.full_name}
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>{invitation.email}</span>
                        </td>
                        <td>
                          <strong style={{ display: "block", fontSize: "0.82rem", color: "#111827" }}>
                            {invitation.subject || "Spécialité non renseignée"}
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>
                            {[invitation.whatsapp, invitation.nationality].filter(Boolean).join(" · ") || "WhatsApp non renseigné"}
                          </span>
                        </td>
                        <td><span className={statusBadge(invitation.status)}>{invitationStatusLabel(invitation.status)}</span></td>
                        <td className="adm-td-muted">{new Date(invitation.expires_at).toLocaleDateString("fr-FR")}</td>
                        <td>
                          <div className="adm-row-actions">
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="button"
                              onClick={() => copyInvitation(invitation.token)}
                            >
                              <FaCopy /> Copier
                            </button>
                            {invitation.status === "pending" && (
                              <button
                                className="adm-btn adm-btn--sm adm-btn--red"
                                type="button"
                                onClick={() => handleRevokeInvitation(invitation)}
                                disabled={revokingId === invitation.id}
                              >
                                <FaBan /> {revokingId === invitation.id ? "Révocation…" : "Révoquer"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="adm-td-muted">{new Date(invitation.created_at).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6}><div className="adm-empty">Aucune invitation trouvée.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "assignments" && (
          <div className="adm-table-wrap">
            <form className="adm-card__header" onSubmit={handleAssign} style={{ alignItems: "end" }}>
              <label className="adm-field">
                <span>Enseignant</span>
                <select
                  className="adm-select"
                  value={assignmentDraft.teacherId}
                  onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, teacherId: event.target.value }))}
                  required
                >
                  <option value="">Sélectionner</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name} {teacher.teacher_code ? `· ${teacher.teacher_code}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="adm-field">
                <span>Formation</span>
                <select
                  className="adm-select"
                  value={assignmentDraft.formationSlug}
                  onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, formationSlug: event.target.value }))}
                  required
                >
                  <option value="">Sélectionner</option>
                  {formations.map((formation) => (
                    <option key={formation.slug} value={formation.slug}>{formation.title}</option>
                  ))}
                </select>
              </label>
              <button className="adm-btn adm-btn--primary" type="submit" disabled={isAssigning}>
                {isAssigning ? "Affectation…" : "Assigner"}
              </button>
            </form>

            <table className="adm-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Formation</th>
                  <th>Enseignant</th>
                  <th>Étudiants</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length ? (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td><strong>{session.label}</strong></td>
                      <td className="adm-td-muted">{session.formation_title}</td>
                      <td>
                        {session.teacher_name ? (
                          <span className="adm-badge adm-badge--green">{session.teacher_name}</span>
                        ) : (
                          <span className="adm-badge adm-badge--red">Non défini</span>
                        )}
                      </td>
                      <td><strong>{session.enrolled_count}</strong></td>
                      <td><span className={statusBadge(session.status)}>{statusLabel(session.status)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}><div className="adm-empty">Aucune session trouvée.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "pedagogy" && (
          <div className="adm-teacher-pedagogy-tab">
            <div className="adm-teacher-pedagogy-filter">
              <label className="adm-field">
                <span>Enseignant à contrôler</span>
                <select
                  className="adm-select"
                  value={pedagogyTeacherId}
                  onChange={(event) => loadPedagogyDetail(event.target.value)}
                >
                  <option value="">Sélectionner un enseignant</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name} {teacher.teacher_code ? `· ${teacher.teacher_code}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {pedagogyDetail && (
                <div className="adm-teacher-pedagogy-filter__summary">
                  <strong>{pedagogyDetail.teacher.full_name}</strong>
                  <span>
                    {pedagogyDetail.teacher.assigned_sessions_count} session(s) · {pedagogyDetail.teacher.students_count} étudiant(s) suivi(s)
                  </span>
                </div>
              )}
            </div>

            {isPedagogyLoading ? (
              <div className="adm-empty">Chargement du suivi pédagogique…</div>
            ) : pedagogyError ? (
              <div className="adm-state-card adm-state-card--error">
                <p>{pedagogyError}</p>
              </div>
            ) : pedagogyDetail ? (
              <TeacherPedagogyAuditView detail={pedagogyDetail} onDetailChange={setPedagogyDetail} />
            ) : (
              <div className="adm-empty">
                Sélectionnez un enseignant pour afficher son suivi pédagogique détaillé.
              </div>
            )}
          </div>
        )}

        {(tab === "teachers" || tab === "invitations") && (
          <AdminTablePager
            page={safePage}
            totalPages={totalPages}
            totalItems={visibleRows.length}
            label={tab === "teachers" ? "Enseignants" : "Invitations"}
            onPageChange={setPage}
          />
        )}
      </div>

      {selectedTeacherId !== null && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-detail-title">
          <button
            aria-label="Fermer"
            className="admin-modal__backdrop"
            type="button"
            onClick={closeTeacherDetail}
          />
          <div className="admin-modal__panel admin-modal__panel--teacher">
            <div className="admin-modal__header">
              <div>
                <p className="admin-modal__eyebrow">Fiche enseignant</p>
                <h3 id="teacher-detail-title">
                  {teacherDetail?.teacher.full_name ?? "Chargement de l’enseignant"}
                </h3>
                <p>
                  Modifiez les informations, contrôlez le statut et suivez les affectations.
                </p>
              </div>
              <button
                aria-label="Fermer la fiche"
                className="admin-icon-button admin-icon-button--close"
                type="button"
                onClick={closeTeacherDetail}
                disabled={isSavingTeacher}
              >
                <FaTimes />
              </button>
            </div>

            <div className="admin-modal__body">
              {isTeacherDetailLoading ? (
                <div className="adm-empty">Chargement de la fiche…</div>
              ) : teacherDetail ? (
                <div className="adm-teacher-detail">
                  {teacherDetailError && (
                    <div className="adm-state-card adm-state-card--error">
                      <p>{teacherDetailError}</p>
                    </div>
                  )}

                  <div className="adm-teacher-detail__summary">
                    <div>
                      <span>Code enseignant</span>
                      <strong>{teacherDetail.teacher.teacher_code ?? "Non généré"}</strong>
                    </div>
                    <div>
                      <span>Statut</span>
                      <strong>{statusLabel(teacherDetail.teacher.status)}</strong>
                    </div>
                    <div>
                      <span>Formations</span>
                      <strong>{teacherDetail.teacher.assigned_formations_count}</strong>
                    </div>
                    <div>
                      <span>Étudiants suivis</span>
                      <strong>{teacherDetail.teacher.students_count}</strong>
                    </div>
                  </div>

                  <div className="adm-teacher-activity">
                    <div>
                      <span>Sessions actives</span>
                      <strong>{teacherDetail.activity.active_sessions_count}</strong>
                      <small>{teacherDetail.activity.sessions_count} au total</small>
                    </div>
                    <div>
                      <span>Contenus publiés</span>
                      <strong>{teacherDetail.activity.lessons_count}</strong>
                      <small>{teacherDetail.activity.courses_count} cours · {teacherDetail.activity.resources_count} ressource(s)</small>
                    </div>
                    <div>
                      <span>Évaluations</span>
                      <strong>{teacherDetail.activity.assignments_count + teacherDetail.activity.quizzes_count}</strong>
                      <small>{teacherDetail.activity.pending_reviews_count} correction(s) en attente</small>
                    </div>
                    <div>
                      <span>Présences</span>
                      <strong>{teacherDetail.activity.attendance_present_count}</strong>
                      <small>{teacherDetail.activity.attendance_late_count} retard · {teacherDetail.activity.attendance_absent_count} absence</small>
                    </div>
                    <div>
                      <span>Notes</span>
                      <strong>{formatActivityPercent(teacherDetail.activity.average_grade_pct)}</strong>
                      <small>{teacherDetail.activity.grades_count} note(s)</small>
                    </div>
                    <div>
                      <span>Quiz passés</span>
                      <strong>{teacherDetail.activity.quiz_attempts_count}</strong>
                      <small>{teacherDetail.activity.submissions_count} rendu(s)</small>
                    </div>
                  </div>

                  <form className="adm-teacher-detail__form" onSubmit={handleSaveTeacherDetail}>
                    <label className="adm-field">
                      <span>Nom complet</span>
                      <input
                        className="adm-input"
                        minLength={2}
                        required
                        value={teacherEditDraft.full_name}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({ ...draft, full_name: event.target.value }))
                        }
                      />
                    </label>
                    <label className="adm-field">
                      <span>Email</span>
                      <input
                        className="adm-input"
                        required
                        type="email"
                        value={teacherEditDraft.email}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({ ...draft, email: event.target.value }))
                        }
                      />
                    </label>
                    <label className="adm-field">
                      <span>WhatsApp</span>
                      <PhoneInput
                        className={`adm-phone-input${teacherEditPhoneInvalid ? " is-invalid" : ""}`}
                        international
                        defaultCountry="CM"
                        countryCallingCodeEditable={false}
                        value={teacherEditDraft.whatsapp}
                        onChange={(value) =>
                          setTeacherEditDraft((draft) => ({ ...draft, whatsapp: value ?? "" }))
                        }
                        placeholder="Numéro WhatsApp"
                        aria-invalid={teacherEditPhoneInvalid}
                      />
                    </label>
                    <CountryCombobox
                      fieldClassName="adm-field"
                      label="Nationalité"
                      onClear={() => setTeacherEditDraft((draft) => ({ ...draft, nationality: "" }))}
                      onSelect={(country) =>
                        setTeacherEditDraft((draft) => ({ ...draft, nationality: country.name }))
                      }
                      placeholder="Saisir ou rechercher un pays"
                      value={teacherEditDraft.nationality}
                    />
                    <label className="adm-field">
                      <span>Spécialité</span>
                      <select
                        className="adm-select"
                        value={teacherEditDraft.subject}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({
                            ...draft,
                            custom_subject:
                              event.target.value === OTHER_TEACHER_SPECIALTY ? draft.custom_subject : "",
                            subject: event.target.value,
                          }))
                        }
                      >
                        <option value="">Sélectionner une spécialité</option>
                        {TEACHER_SPECIALTY_OPTIONS.map((specialty) => (
                          <option key={specialty} value={specialty}>
                            {specialty}
                          </option>
                        ))}
                      </select>
                    </label>
                    {teacherEditDraft.subject === OTHER_TEACHER_SPECIALTY && (
                      <label className="adm-field">
                        <span>Préciser la spécialité</span>
                        <input
                          className="adm-input"
                          required
                          value={teacherEditDraft.custom_subject}
                          onChange={(event) =>
                            setTeacherEditDraft((draft) => ({
                              ...draft,
                              custom_subject: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                    <label className="adm-field">
                      <span>Années d’expérience</span>
                      <input
                        className="adm-input"
                        type="number"
                        min="0"
                        max="60"
                        value={teacherEditDraft.experience_years}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({ ...draft, experience_years: event.target.value }))
                        }
                      />
                    </label>
                    <label className="adm-field">
                      <span>Portfolio</span>
                      <input
                        className="adm-input"
                        type="url"
                        value={teacherEditDraft.portfolio_url}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({ ...draft, portfolio_url: event.target.value }))
                        }
                      />
                    </label>
                    <label className="adm-field adm-field--wide">
                      <span>Bio</span>
                      <textarea
                        className="adm-input"
                        rows={4}
                        value={teacherEditDraft.bio}
                        onChange={(event) =>
                          setTeacherEditDraft((draft) => ({ ...draft, bio: event.target.value }))
                        }
                      />
                    </label>

                    <div className="adm-teacher-detail__actions">
                      <button
                        className="adm-btn adm-btn--outline"
                        type="button"
                        onClick={handleToggleTeacherStatus}
                        disabled={isSavingTeacher}
                      >
                        {teacherDetail.teacher.status === "active" ? "Suspendre" : "Réactiver"}
                      </button>
                      <button
                        className="adm-btn adm-btn--primary"
                        type="submit"
                        disabled={isSavingTeacher || teacherEditPhoneInvalid || teacherEditCustomSubjectInvalid}
                      >
                        {isSavingTeacher ? "Enregistrement…" : "Enregistrer la fiche"}
                      </button>
                    </div>
                  </form>

                  <div className="adm-teacher-detail__sections">
                    <section>
                      <div className="adm-section-title-row">
                        <div>
                          <h4>Formations assignées</h4>
                          <p>{teacherDetail.formations.length} formation(s)</p>
                        </div>
                      </div>
                      <form className="adm-inline-form" onSubmit={handleDetailAssignFormation}>
                        <select
                          className="adm-select"
                          value={detailAssignmentSlug}
                          onChange={(event) => setDetailAssignmentSlug(event.target.value)}
                        >
                          <option value="">Ajouter une formation</option>
                          {detailAssignableFormations.map((formation) => (
                            <option key={formation.slug} value={formation.slug}>
                              {formation.title}
                            </option>
                          ))}
                        </select>
                        <button
                          className="adm-btn adm-btn--ghost"
                          type="submit"
                          disabled={!detailAssignmentSlug || isAssigning || teacherDetail.teacher.status !== "active"}
                        >
                          Ajouter
                        </button>
                      </form>
                      <div className="adm-mini-list">
                        {teacherDetail.formations.length ? (
                          teacherDetail.formations.map((formation) => (
                            <article key={formation.slug}>
                              <div>
                                <strong>{formation.title}</strong>
                                <span>{statusLabel(formation.format_type)} · {formation.session_label ?? "Sans session active"}</span>
                              </div>
                              <button
                                className="adm-btn adm-btn--sm adm-btn--red"
                                type="button"
                                disabled={removingFormationSlug === formation.slug}
                                onClick={() => handleRemoveDetailFormation(formation.slug)}
                              >
                                Retirer
                              </button>
                            </article>
                          ))
                        ) : (
                          <p className="adm-empty adm-empty--compact">Aucune formation assignée.</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <div className="adm-section-title-row">
                        <div>
                          <h4>Sessions liées</h4>
                          <p>{teacherDetail.sessions.length} session(s)</p>
                        </div>
                      </div>
                      <div className="adm-mini-list">
                        {teacherDetail.sessions.length ? (
                          teacherDetail.sessions.map((session) => (
                            <article key={session.id}>
                              <div>
                                <strong>{session.formation_title}</strong>
                                <span>
                                  {session.label} · {new Date(session.start_date).toLocaleDateString("fr-FR")} · {session.enrolled_count} inscrit(s)
                                </span>
                              </div>
                              <span className={statusBadge(session.status)}>{statusLabel(session.status)}</span>
                            </article>
                          ))
                        ) : (
                          <p className="adm-empty adm-empty--compact">Aucune session liée à cet enseignant.</p>
                        )}
                      </div>
                    </section>

                    <section className="adm-teacher-students-section">
                      <div className="adm-section-title-row">
                        <div>
                          <h4>Étudiants suivis</h4>
                          <p>
                            {teacherDetail.students.length} rattachement(s) avec progression, présences et corrections.
                          </p>
                        </div>
                      </div>
                      {teacherDetail.students.length ? (
                        <div className="adm-teacher-student-list">
                          {teacherDetail.students.map((student) => (
                            <article key={`${student.enrollment_id}-${student.session_id ?? "none"}`}>
                              <div className="adm-teacher-student-list__main">
                                <strong>{student.full_name}</strong>
                                <span>{student.email}</span>
                                <span>{student.formation_title} · {student.session_label ?? "Sans session"}</span>
                                {student.student_code && <code className="adm-code">{student.student_code}</code>}
                              </div>
                              <div className="adm-teacher-student-list__metrics">
                                <span>
                                  <strong>{formatActivityPercent(student.progress_pct)}</strong>
                                  Progression
                                </span>
                                <span>
                                  <strong>{student.present_count}/{student.attendance_count}</strong>
                                  Présences
                                </span>
                                <span>
                                  <strong>{formatActivityPercent(student.average_grade_pct)}</strong>
                                  Moyenne
                                </span>
                                <span>
                                  <strong>{student.pending_reviews_count}</strong>
                                  À corriger
                                </span>
                                <span>
                                  <strong>{formatActivityDate(student.last_activity_at)}</strong>
                                  Dernière activité
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="adm-empty adm-empty--compact">Aucun étudiant rattaché à cet enseignant.</p>
                      )}
                    </section>
                  </div>
                </div>
              ) : (
                <div className="adm-state-card adm-state-card--error">
                  <p>{teacherDetailError || "Fiche enseignant indisponible."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="create-teacher-title">
          <button
            aria-label="Fermer"
            className="admin-modal__backdrop"
            type="button"
            onClick={closeCreateTeacherModal}
          />
          <div className="admin-modal__panel admin-modal__panel--narrow">
            <div className="admin-modal__header">
              <div>
                <p className="admin-modal__eyebrow">Gestion enseignants</p>
                <h3 id="create-teacher-title">Créer un enseignant</h3>
                <p>
                  Renseigne la fiche enseignant. Le lien d’invitation est généré seulement après validation.
                </p>
              </div>
              <button
                aria-label="Fermer le modal"
                className="admin-icon-button admin-icon-button--close"
                type="button"
                onClick={closeCreateTeacherModal}
                disabled={isInviting}
              >
                <FaTimes />
              </button>
            </div>

            {createdInvitation ? (
              <>
                <div className="admin-modal__body">
                  <div className="adm-invite-result">
                    <span className={statusBadge(createdInvitation.status)}>
                      {invitationStatusLabel(createdInvitation.status)}
                    </span>
                    <strong>{createdInvitation.full_name}</strong>
                    <small>{createdInvitation.email}</small>
                    {createdInvitation.nationality && <small>{createdInvitation.nationality}</small>}
                  </div>
                  <label className="adm-field">
                    <span>Lien d’invitation</span>
                    <input
                      className="adm-input"
                      readOnly
                      value={invitationLink(createdInvitation.token)}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </label>
                  <p className="adm-modal-note">
                    Ce lien reste utilisable jusqu’au{" "}
                    {new Date(createdInvitation.expires_at).toLocaleDateString("fr-FR")} tant qu’il n’est pas révoqué.
                  </p>
                </div>
                <div className="admin-modal__footer">
                  {createdInvitation.status === "pending" && (
                    <button
                      className="adm-btn adm-btn--red"
                      type="button"
                      onClick={() => handleRevokeInvitation(createdInvitation)}
                      disabled={revokingId === createdInvitation.id}
                    >
                      <FaBan /> {revokingId === createdInvitation.id ? "Révocation…" : "Révoquer"}
                    </button>
                  )}
                  <button
                    className="adm-btn adm-btn--ghost"
                    type="button"
                    onClick={() => copyInvitation(createdInvitation.token)}
                  >
                    <FaCopy /> Copier le lien
                  </button>
                  <button className="adm-btn adm-btn--outline" type="button" onClick={createAnotherTeacher}>
                    Créer un autre
                  </button>
                  <button className="adm-btn adm-btn--primary" type="button" onClick={closeCreateTeacherModal}>
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="admin-modal__body adm-modal-form">
                  {modalError && (
                    <div className="adm-state-card adm-state-card--error">
                      <p>{modalError}</p>
                    </div>
                  )}
                  <label className="adm-field">
                    <span>Nom complet</span>
                    <input
                      className="adm-input"
                      value={inviteDraft.full_name}
                      onChange={(event) => setInviteDraft((draft) => ({ ...draft, full_name: event.target.value }))}
                      required
                      minLength={2}
                      placeholder="Nom de l’enseignant"
                    />
                  </label>
                  <label className="adm-field">
                    <span>Email</span>
                    <input
                      className="adm-input"
                      type="email"
                      value={inviteDraft.email}
                      onChange={(event) => setInviteDraft((draft) => ({ ...draft, email: event.target.value }))}
                      required
                      placeholder="email@domaine.com"
                    />
                  </label>
                  <label className="adm-field">
                    <span>WhatsApp</span>
                    <PhoneInput
                      className={`adm-phone-input${invitePhoneInvalid ? " is-invalid" : ""}`}
                      international
                      defaultCountry="CM"
                      countryCallingCodeEditable={false}
                      value={inviteDraft.whatsapp}
                      onChange={(value) => setInviteDraft((draft) => ({ ...draft, whatsapp: value ?? "" }))}
                      placeholder="Numéro WhatsApp"
                      aria-invalid={invitePhoneInvalid}
                    />
                    {invitePhoneInvalid && (
                      <p className="adm-field-error">
                        Numéro invalide pour le pays sélectionné. Exemple Cameroun : +237600000000.
                      </p>
                    )}
                  </label>
                  <CountryCombobox
                    fieldClassName="adm-field"
                    label="Nationalité"
                    onClear={() => setInviteDraft((draft) => ({ ...draft, nationality: "" }))}
                    onSelect={(country) =>
                      setInviteDraft((draft) => ({ ...draft, nationality: country.name }))
                    }
                    placeholder="Saisir ou rechercher un pays"
                    value={inviteDraft.nationality}
                  />
                  <label className="adm-field">
                    <span>Spécialité</span>
                    <select
                      className="adm-select"
                      value={inviteDraft.subject}
                      onChange={(event) =>
                        setInviteDraft((draft) => ({
                          ...draft,
                          custom_subject:
                            event.target.value === OTHER_TEACHER_SPECIALTY ? draft.custom_subject : "",
                          subject: event.target.value,
                        }))
                      }
                    >
                      <option value="">Sélectionner une spécialité</option>
                      {TEACHER_SPECIALTY_OPTIONS.map((specialty) => (
                        <option key={specialty} value={specialty}>
                          {specialty}
                        </option>
                      ))}
                    </select>
                  </label>
                  {inviteDraft.subject === OTHER_TEACHER_SPECIALTY && (
                    <label className="adm-field">
                      <span>Préciser la spécialité</span>
                      <input
                        className="adm-input"
                        value={inviteDraft.custom_subject}
                        onChange={(event) =>
                          setInviteDraft((draft) => ({ ...draft, custom_subject: event.target.value }))
                        }
                        placeholder="Entrer la spécialité"
                        required
                      />
                    </label>
                  )}
                  <label className="adm-field">
                    <span>Années d’expérience</span>
                    <input
                      className="adm-input"
                      type="number"
                      min="0"
                      max="60"
                      value={inviteDraft.experience_years}
                      onChange={(event) => setInviteDraft((draft) => ({ ...draft, experience_years: event.target.value }))}
                      placeholder="ex. 5"
                    />
                  </label>
                  <label className="adm-field">
                    <span>Portfolio</span>
                    <input
                      className="adm-input"
                      type="url"
                      value={inviteDraft.portfolio_url}
                      onChange={(event) => setInviteDraft((draft) => ({ ...draft, portfolio_url: event.target.value }))}
                      placeholder="https://portfolio.com"
                    />
                  </label>
                  <label className="adm-field">
                    <span>Bio</span>
                    <textarea
                      className="adm-input"
                      rows={4}
                      value={inviteDraft.bio}
                      onChange={(event) => setInviteDraft((draft) => ({ ...draft, bio: event.target.value }))}
                      placeholder="Courte présentation du profil enseignant"
                    />
                  </label>
                </div>
                <div className="admin-modal__footer">
                  <button className="adm-btn adm-btn--outline" type="button" onClick={closeCreateTeacherModal} disabled={isInviting}>
                    Annuler
                  </button>
                  <button
                    className="adm-btn adm-btn--primary"
                    type="submit"
                    disabled={isInviting || invitePhoneInvalid || inviteCustomSubjectInvalid}
                  >
                    {isInviting ? "Création…" : "Créer l’enseignant"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
