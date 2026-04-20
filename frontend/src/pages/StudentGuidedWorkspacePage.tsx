import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaAward,
  FaBookOpen,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaChalkboardTeacher,
  FaClock,
  FaExternalLinkAlt,
  FaFileAlt,
  FaIdCard,
  FaMapMarkerAlt,
  FaQuestionCircle,
  FaTasks,
  FaUsers,
  FaVideo,
} from "react-icons/fa";

import { Monitor, CalendarCheck, Hash, MapPin, FileText } from "lucide-react";
import { fetchStudentEnrollments, type Enrollment } from "../lib/commerceApi";
import {
  fetchEnrollmentResults,
  fetchMyAssignments,
  fetchMyCourseDays,
  fetchMyCourses,
  fetchMyQuizzes,
  fetchMyResources,
  type AssignmentStudentStatus,
  type StudentAssignment,
  type StudentCourse,
  type StudentCourseDay,
  type StudentEnrollmentResults,
  type StudentQuizView,
  type StudentResource,
} from "../lib/studentApi";
import { fetchMyLiveEvents, type StudentLiveEvent } from "../lib/teacherApi";
import AiChatWidget from "../components/AiChatWidget";
import AssignedTeacherCard from "../components/AssignedTeacherCard";

type HubTab = "overview" | "program" | "calendar" | "assignments" | "quizzes" | "resources" | "results";

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStudentStatus, string> = {
  pending: "À rendre",
  submitted: "Rendu",
  late: "En retard",
  reviewed: "Corrigé",
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Excusé",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
  return `${minutes} min`;
}

function courseDayStatusLabel(status: string) {
  return {
    planned: "Planifié",
    live: "En live",
    done: "Terminé",
    cancelled: "Annulé",
  }[status] ?? status;
}

function quizAttemptLabel(quiz: StudentQuizView) {
  if (quiz.attempt_status === "passed") return "Réussi";
  if (quiz.attempt_status === "failed_no_retry") return "Échoué";
  if (quiz.attempt_status === "failed_retry_after") return "Réessai verrouillé";
  if (quiz.attempt_status === "failed_retry_now") return "Réessai disponible";
  return quiz.status === "active" ? "À faire" : quiz.status;
}

const JOIN_WINDOW_MINUTES = 15;

function getLiveAccess(startDate: string, endDate: string): { canJoin: boolean; label: string } {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const diffMs = start - now;
  if (now > end) return { canJoin: false, label: "Terminée" };
  if (diffMs <= 0) return { canJoin: true, label: "Rejoindre" };
  if (diffMs <= JOIN_WINDOW_MINUTES * 60 * 1000) return { canJoin: true, label: "Rejoindre" };
  const dayMs = 24 * 3600000;
  if (diffMs >= dayMs) {
    const d = Math.floor(diffMs / dayMs);
    const h = Math.floor((diffMs % dayMs) / 3600000);
    return { canJoin: false, label: `Dans ${d}j${h > 0 ? ` ${h}h` : ""}` };
  }
  const diffH = Math.floor(diffMs / 3600000);
  const diffMin = Math.floor((diffMs % 3600000) / 60000);
  if (diffH > 0) return { canJoin: false, label: `Dans ${diffH}h${diffMin > 0 ? `${diffMin}m` : ""}` };
  return { canJoin: false, label: `Dans ${diffMin} min` };
}

function resourceTypeLabel(type: string) {
  return { pdf: "PDF", link: "Lien", video: "Vidéo", image: "Image" }[type] ?? type;
}

function averageGrade(results: StudentEnrollmentResults | null) {
  const grades = results?.grades.filter((grade) => grade.max_score > 0) ?? [];
  const score = grades.reduce((sum, grade) => sum + grade.score, 0);
  const max = grades.reduce((sum, grade) => sum + grade.max_score, 0);
  return max > 0 ? (score / max) * 20 : null;
}

export default function StudentGuidedWorkspacePage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hubLoading, setHubLoading] = useState(false);
  const [tab, setTab] = useState<HubTab>("overview");
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [courseDays, setCourseDays] = useState<StudentCourseDay[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuizView[]>([]);
  const [resources, setResources] = useState<StudentResource[]>([]);
  const [liveEvents, setLiveEvents] = useState<StudentLiveEvent[]>([]);
  const [results, setResults] = useState<StudentEnrollmentResults | null>(null);

  useEffect(() => {
    fetchStudentEnrollments()
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const enrollment = useMemo(() => {
    const id = Number.parseInt(enrollmentId ?? "", 10);
    if (!Number.isInteger(id)) return null;
    return enrollments.find((item) => item.id === id && item.dashboard_type === "guided") ?? null;
  }, [enrollmentId, enrollments]);

  useEffect(() => {
    if (!isLoading && !enrollment) {
      navigate("/espace/etudiant", { replace: true });
    }
  }, [enrollment, isLoading, navigate]);

  useEffect(() => {
    if (!enrollment) return;
    if (!enrollment.session_id) {
      setCourses([]);
      setCourseDays([]);
      setAssignments([]);
      setQuizzes([]);
      setResources([]);
      setLiveEvents([]);
      setResults(null);
      return;
    }

    setHubLoading(true);
    Promise.all([
      fetchMyCourses().catch(() => [] as StudentCourse[]),
      fetchMyCourseDays().catch(() => [] as StudentCourseDay[]),
      fetchMyAssignments().catch(() => [] as StudentAssignment[]),
      fetchMyQuizzes().catch(() => [] as StudentQuizView[]),
      fetchMyResources().catch(() => [] as StudentResource[]),
      fetchMyLiveEvents().catch(() => [] as StudentLiveEvent[]),
      fetchEnrollmentResults(enrollment.id).catch(() => null),
    ])
      .then(([courseRows, dayRows, assignmentRows, quizRows, resourceRows, liveRows, resultRows]) => {
        const sessionId = enrollment.session_id;
        setCourses(courseRows.filter((course) => course.session_id === sessionId));
        setCourseDays(dayRows.filter((day) => day.session_id === sessionId));
        setAssignments(assignmentRows.filter((assignment) => assignment.session_id === sessionId));
        setQuizzes(quizRows.filter((quiz) => quiz.session_id === sessionId));
        setResources(resourceRows.filter((resource) => resource.session_id === sessionId));
        setLiveEvents(liveRows.filter((event) => event.session_id === sessionId));
        setResults(resultRows);
      })
      .finally(() => setHubLoading(false));
  }, [enrollment]);

  if (isLoading || !enrollment) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Parcours guidé</p>
          <h1>Chargement de votre parcours…</h1>
        </section>
      </div>
    );
  }

  const isPresentiel = enrollment.format_type === "presentiel";
  const isLive = enrollment.format_type === "live";
  const totalLessons = courses.reduce((sum, course) => sum + course.total_lessons, 0);
  const completedLessons = courses.reduce((sum, course) => sum + course.completed_lessons, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const pendingAssignments = assignments.filter((assignment) =>
    assignment.student_status === "pending" || assignment.student_status === "late"
  );
  const activeQuizzes = quizzes.filter((quiz) =>
    quiz.status === "active" && quiz.attempt_status !== "passed" && quiz.attempt_status !== "failed_no_retry"
  );
  const gradeAverage = averageGrade(results);
  const nextCourseDay = courseDays.find((day) => new Date(day.scheduled_at).getTime() >= Date.now()) ?? null;
  const liveByEventId = new Map(liveEvents.map((event) => [event.id, event]));

  const tabs: Array<{ id: HubTab; label: string; count?: number }> = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "program", label: "Programme", count: totalLessons },
    { id: "calendar", label: "Calendrier", count: courseDays.length },
    { id: "assignments", label: "Devoirs", count: pendingAssignments.length },
    { id: "quizzes", label: "Quiz", count: activeQuizzes.length },
    { id: "resources", label: "Ressources", count: resources.length },
    { id: "results", label: "Notes", count: results?.grades.length ?? 0 },
  ];

  return (
    <div className="page commerce-page">
      <section className="workspace-hero">
        <div className="workspace-hero__content">
          <p className="eyebrow">{isPresentiel ? "Parcours présentiel" : "Parcours live"}</p>
          <h1>{enrollment.formation_title}</h1>
          <p>
            {isPresentiel
              ? "Votre formation, votre calendrier, vos cours, vos devoirs et vos résultats au même endroit."
              : "Votre cohorte live, les séances, les supports, les quiz et les corrections au même endroit."}
          </p>
          <div className="workspace-hero__actions">
            <Link className="button button--primary" to="/espace/etudiant/parcours">
              Retour à mes parcours
            </Link>
            <Link className="button button--secondary" to={`/formations/${enrollment.formation_slug}`}>
              Revoir la fiche
            </Link>
            {enrollment.status === "completed" && (
              <Link className="button button--accent wsp-cert-btn" to={`/espace/etudiant/certificat/${enrollment.id}`}>
                <FaAward /> Mon certificat
              </Link>
            )}
            {(enrollment.session_id || enrollment.assigned_teacher) && (
              <AssignedTeacherCard teacher={enrollment.assigned_teacher} />
            )}
          </div>
        </div>
        <img src={enrollment.image} alt={enrollment.formation_title} />
      </section>

      <div className="workspace-grid workspace-grid--classic">
        <article className="workspace-card workspace-card--blue">
          <span><Monitor size={14} /> Format</span>
          <strong>{isPresentiel ? "Présentiel" : "Live"}</strong>
          <p>{isPresentiel ? "Cours en salle, présences et corrections suivies." : "Cours en direct, calendrier et supports synchronisés."}</p>
          <span className="workspace-card__bg-icon" aria-hidden><Monitor size={52} /></span>
        </article>
        <article className="workspace-card workspace-card--purple">
          <span><CalendarCheck size={14} /> Session</span>
          <strong>{enrollment.session_label || "À venir"}</strong>
          <p>{nextCourseDay ? `Prochain cours : ${formatDateTime(nextCourseDay.scheduled_at)}` : "Le calendrier sera complété par l'équipe pédagogique."}</p>
          <span className="workspace-card__bg-icon" aria-hidden><CalendarCheck size={52} /></span>
        </article>
        <article className="workspace-card workspace-card--green">
          <span><Hash size={14} /> {isPresentiel ? "Code étudiant" : "Référence"}</span>
          <strong className="wsp-code">{isPresentiel ? (enrollment.student_code ?? "En attente") : enrollment.order_reference}</strong>
          <p>{isPresentiel ? "Votre identifiant officiel pour cette formation." : "Commande liée à votre cohorte live."}</p>
          <span className="workspace-card__bg-icon" aria-hidden><Hash size={52} /></span>
        </article>
      </div>

      <section className="workspace-section workspace-hub">
        <div className="workspace-section__heading">
          <h2>Espace pédagogique</h2>
          <p>Tout est filtré sur cette formation et cette session.</p>
        </div>

        <div className="wsp-tabs" role="tablist" aria-label="Sections du parcours">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`wsp-tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.count !== undefined && <span>{item.count}</span>}
            </button>
          ))}
        </div>

        {hubLoading ? (
          <div className="dsh-page-loading">Chargement du contenu pédagogique…</div>
        ) : (
          <div className="wsp-tab-panel">
            {tab === "overview" && (
              <OverviewTab
                progressPct={progressPct}
                completedLessons={completedLessons}
                totalLessons={totalLessons}
                pendingAssignments={pendingAssignments.length}
                activeQuizzes={activeQuizzes.length}
                resourcesCount={resources.length}
                average={gradeAverage}
                nextCourseDay={nextCourseDay}
              />
            )}

            {tab === "program" && (
              <ProgramTab courses={courses} />
            )}

            {tab === "calendar" && (
              <CalendarTab courseDays={courseDays} liveByEventId={liveByEventId} sessionId={enrollment.session_id} />
            )}

            {tab === "assignments" && (
              <AssignmentsTab assignments={assignments} />
            )}

            {tab === "quizzes" && (
              <QuizzesTab quizzes={quizzes} />
            )}

            {tab === "resources" && (
              <ResourcesTab resources={resources} />
            )}

            {tab === "results" && (
              <ResultsTab results={results} />
            )}
          </div>
        )}
      </section>

      <AiChatWidget formationTitle={enrollment.formation_title} />

      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>Besoin d'aide ?</h2>
          <p>Contactez l'équipe pédagogique pour toute question sur votre parcours.</p>
        </div>
        <div className="workspace-grid">
          <article className="workspace-card workspace-card--blue">
            <span><MapPin size={14} /> Accès</span>
            <strong>{isLive ? "En ligne" : "Campus"}</strong>
            <p>{isLive ? "Le bouton de salle live s'active autour de chaque séance." : "Les informations pratiques seront communiquées avec le calendrier."}</p>
            <span className="workspace-card__bg-icon" aria-hidden><MapPin size={52} /></span>
          </article>
          <article className="workspace-card workspace-card--green">
            <span><FileText size={14} /> Référence commande</span>
            <strong className="wsp-code">{enrollment.order_reference}</strong>
            <p>À mentionner pour tout contact avec l'administration.</p>
            <span className="workspace-card__bg-icon" aria-hidden><FileText size={52} /></span>
          </article>
        </div>
      </section>
    </div>
  );
}

function OverviewTab({
  progressPct,
  completedLessons,
  totalLessons,
  pendingAssignments,
  activeQuizzes,
  resourcesCount,
  average,
  nextCourseDay,
}: {
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
  pendingAssignments: number;
  activeQuizzes: number;
  resourcesCount: number;
  average: number | null;
  nextCourseDay: StudentCourseDay | null;
}) {
  return (
    <div className="wsp-hub-grid">
      <HubMetric icon={<FaChartLine />} label="Progression" value={`${progressPct}%`} sub={`${completedLessons}/${totalLessons} leçons terminées`} />
      <HubMetric icon={<FaTasks />} label="Devoirs à traiter" value={pendingAssignments} sub="À rendre ou en retard" />
      <HubMetric icon={<FaQuestionCircle />} label="Quiz ouverts" value={activeQuizzes} sub="À faire ou à reprendre" />
      <HubMetric icon={<FaFileAlt />} label="Ressources" value={resourcesCount} sub="Supports publiés" />
      <HubMetric icon={<FaAward />} label="Moyenne" value={average === null ? "—" : `${average.toFixed(1)}/20`} sub="Notes publiées" />
      <HubMetric icon={<FaCalendarAlt />} label="Prochain cours" value={nextCourseDay ? formatDateTime(nextCourseDay.scheduled_at) : "À venir"} sub={nextCourseDay?.title ?? "Aucune séance planifiée"} />
    </div>
  );
}

function HubMetric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }) {
  return (
    <article className="wsp-hub-metric">
      <span className="wsp-hub-metric__icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{sub}</p>
    </article>
  );
}

function ProgramTab({ courses }: { courses: StudentCourse[] }) {
  if (courses.length === 0) {
    return <div className="dsh-empty dsh-empty--inline"><p>Le programme de cette session est en préparation.</p></div>;
  }
  return (
    <div className="wsp-program-list">
      {courses.map((course) => (
        <article className="wsp-program-card" key={course.id}>
          <div className="wsp-program-card__head">
            <div>
              <span><FaBookOpen /> Programme</span>
              <h3>{course.title}</h3>
              {course.description && <p>{course.description}</p>}
            </div>
            <strong>{course.progress_pct}%</strong>
          </div>
          <div className="wsp-progress-bar">
            <div className="wsp-progress-bar__fill" style={{ width: `${course.progress_pct}%` }} />
          </div>
          <div className="wsp-program-chapters">
            {course.chapters.map((chapter) => (
              <div className="wsp-program-chapter" key={chapter.id}>
                <strong>{chapter.title}</strong>
                <ul>
                  {chapter.lessons.map((lesson) => (
                    <li key={lesson.id} className={lesson.is_completed ? "is-done" : ""}>
                      {lesson.is_completed ? <FaCheckCircle /> : <FaClock />}
                      <span>{lesson.title}</span>
                      <small>{lesson.lesson_type}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Link className="dsh-btn dsh-btn--primary dsh-btn--sm" to="/espace/etudiant/cours">
            Ouvrir le lecteur de cours
          </Link>
        </article>
      ))}
    </div>
  );
}

function CalendarTab({
  courseDays,
  liveByEventId,
  sessionId,
}: {
  courseDays: StudentCourseDay[];
  liveByEventId: Map<number, StudentLiveEvent>;
  sessionId: number | null;
}) {
  if (courseDays.length === 0) {
    return <div className="dsh-empty dsh-empty--inline"><p>Aucune journée de cours planifiée pour cette session.</p></div>;
  }
  return (
    <div className="wsp-timeline">
      {courseDays.map((day) => {
        const linkedLive = day.live_event_id ? liveByEventId.get(day.live_event_id) : null;
        return (
          <article className="wsp-timeline-item" key={day.id}>
            <div className="wsp-timeline-item__date">
              <span className="wsp-timeline-item__date-day">
                {new Date(day.scheduled_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className="wsp-timeline-item__date-time">
                {new Date(day.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="wsp-timeline-item__date-duration">{formatDuration(day.duration_minutes)}</span>
              <FaCalendarAlt className="wsp-timeline-item__date-bg" />
            </div>
            <div className="wsp-timeline-item__body">
              <div className="wsp-timeline-item__body-top">
                <span className={`dsh-badge dsh-badge--${day.status === "done" ? "green" : day.status === "cancelled" ? "red" : "blue"}`}>
                  {courseDayStatusLabel(day.status)}
                </span>
                {linkedLive?.meeting_link && sessionId && (() => {
                  const endIso = new Date(new Date(day.scheduled_at).getTime() + day.duration_minutes * 60000).toISOString();
                  const { canJoin, label } = getLiveAccess(day.scheduled_at, endIso);
                  if (label === "Terminée") return null;
                  return (
                    <button
                      className={`dsh-btn dsh-btn--sm ${canJoin ? "dsh-btn--primary" : "dsh-btn--ghost"}`}
                      disabled={!canJoin}
                      title={canJoin ? undefined : "Accès ouvert 15 min avant le début"}
                      onClick={() => canJoin && (window.location.href = `/live/${sessionId}`)}
                    >
                      <FaVideo /> {canJoin ? "Rejoindre le live" : label}
                    </button>
                  );
                })()}
              </div>
              <h3>{day.title}</h3>
              <p>{day.quiz_count} quiz · {day.assignment_count} devoir · {day.resource_count} ressource · {day.grade_count} note</p>
              <FaChalkboardTeacher className="wsp-timeline-item__body-bg" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AssignmentsTab({ assignments }: { assignments: StudentAssignment[] }) {
  if (assignments.length === 0) {
    return <div className="dsh-empty dsh-empty--inline"><p>Aucun devoir assigné pour cette session.</p></div>;
  }
  return (
    <div className="wsp-compact-list">
      {assignments.map((assignment) => (
        <article className="wsp-compact-item" key={assignment.id}>
          <div>
            <strong>{assignment.title}</strong>
            <span>{formatDateTime(assignment.due_date)}{assignment.is_final_project ? " · Projet final" : ""}</span>
            {assignment.instructions && <p>{assignment.instructions}</p>}
          </div>
          <div className="wsp-compact-item__actions">
            <span className={`dsh-badge dsh-badge--${assignment.student_status === "late" ? "red" : assignment.student_status === "reviewed" ? "green" : "blue"}`}>
              {ASSIGNMENT_STATUS_LABELS[assignment.student_status]}
            </span>
            {assignment.review_score !== null && <span className="dsh-badge dsh-badge--yellow">{assignment.review_score}/{assignment.review_max_score}</span>}
            <Link className="dsh-btn dsh-btn--ghost dsh-btn--sm" to="/espace/etudiant/devoirs">Consulter</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function QuizzesTab({ quizzes }: { quizzes: StudentQuizView[] }) {
  if (quizzes.length === 0) {
    return <div className="dsh-empty dsh-empty--inline"><p>Aucun quiz disponible pour cette session.</p></div>;
  }
  return (
    <div className="wsp-compact-list">
      {quizzes.map((quiz) => (
        <article className="wsp-compact-item" key={quiz.id}>
          <div>
            <strong>{quiz.title}</strong>
            <span>{quiz.scheduled_at ? formatDateTime(quiz.scheduled_at) : "Non programmé"}{quiz.duration_minutes ? ` · ${formatDuration(quiz.duration_minutes)}` : ""}</span>
            {quiz.best_score_pct !== null && <p>Meilleur score : {quiz.best_score_pct}%</p>}
          </div>
          <div className="wsp-compact-item__actions">
            <span className={`dsh-badge dsh-badge--${quiz.attempt_status === "passed" ? "green" : quiz.status === "active" ? "blue" : "gray"}`}>
              {quizAttemptLabel(quiz)}
            </span>
            <Link className="dsh-btn dsh-btn--ghost dsh-btn--sm" to="/espace/etudiant/quizz">Ouvrir</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function ResourcesTab({ resources }: { resources: StudentResource[] }) {
  if (resources.length === 0) {
    return <div className="dsh-empty dsh-empty--inline"><p>Aucune ressource publiée pour cette session.</p></div>;
  }
  return (
    <div className="wsp-resource-grid">
      {resources.map((resource) => (
        <article className="wsp-resource-card" key={resource.id}>
          <span>{resourceTypeLabel(resource.resource_type)}</span>
          <strong>{resource.title}</strong>
          <p>{resource.published_at ? `Publié le ${formatDateTime(resource.published_at)}` : "Disponible maintenant"}</p>
          <a className="dsh-btn dsh-btn--ghost dsh-btn--sm" href={resource.url} target="_blank" rel="noopener noreferrer">
            Ouvrir <FaExternalLinkAlt />
          </a>
        </article>
      ))}
    </div>
  );
}

function ResultsTab({ results }: { results: StudentEnrollmentResults | null }) {
  if (!results) {
    return <div className="dsh-empty dsh-empty--inline"><p>Aucun résultat chargé pour cette session.</p></div>;
  }
  return (
    <div className="wsp-results-grid">
      <section className="wsp-results-block">
        <h3>Notes</h3>
        {results.grades.length === 0 ? (
          <p className="dsh-empty-inline">Aucune note publiée.</p>
        ) : (
          <table className="dsh-table">
            <thead>
              <tr><th>Évaluation</th><th>Journée</th><th>Note</th><th>Commentaire</th></tr>
            </thead>
            <tbody>
              {results.grades.map((grade, index) => (
                <tr key={`${grade.label}-${index}`}>
                  <td><strong>{grade.label}</strong></td>
                  <td>{grade.course_day_title ?? "Session"}</td>
                  <td><strong>{grade.score}/{grade.max_score}</strong></td>
                  <td>{grade.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="wsp-results-block">
        <h3>Présences</h3>
        {results.attendance.length === 0 ? (
          <p className="dsh-empty-inline">Aucune présence enregistrée.</p>
        ) : (
          <table className="dsh-table">
            <thead>
              <tr><th>Journée</th><th>Statut</th><th>Remarque</th></tr>
            </thead>
            <tbody>
              {results.attendance.map((attendance, index) => (
                <tr key={`${attendance.course_day_id ?? "session"}-${index}`}>
                  <td>{attendance.course_day_title ?? "Session"}</td>
                  <td><strong>{ATTENDANCE_LABELS[attendance.status] ?? attendance.status}</strong></td>
                  <td>{attendance.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
