import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarOff,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Layers,
  Star,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  confirmStripeCheckoutSession,
  fetchNotifications,
  fetchStudentDashboardSummary,
  fetchMySessions,
  type NotificationItem,
  type StudentDashboardSummary,
  type StudentSession,
} from "../../lib/commerceApi";
import { getUserActionErrorMessage } from "../../lib/userMessages";
import {
  fetchEnrollmentResults,
  fetchMyAssignments,
  fetchMyCourses,
  fetchMyQuizzes,
  type StudentAssignment,
  type StudentCourse,
  type StudentEnrollmentResults,
  type StudentQuizView,
} from "../../lib/studentApi";
import BadgeRing, { type BadgeLevel } from "../../components/BadgeRing";
import { FaCalendarAlt, FaVideo, FaMapMarkerAlt, FaExternalLinkAlt } from "react-icons/fa";
import LiveCalendar from "../../components/LiveCalendar";
import { fetchMyLiveEvents, type StudentLiveEvent } from "../../lib/teacherApi";

function buildCalendarUrl(session: StudentSession): string {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const title = encodeURIComponent(`${session.formation_title} — ${session.label}`);
  const details = encodeURIComponent(session.meeting_link ? `Lien : ${session.meeting_link}` : "");
  const loc = encodeURIComponent(session.campus_label ?? session.meeting_link ?? "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(session.start_date)}/${fmt(session.end_date)}&details=${details}&location=${loc}`;
}

function sessionStatusBadge(status: string): { label: string; cls: string } {
  if (status === "open") return { label: "Ouverte", cls: "session-status--open" };
  if (status === "completed") return { label: "Terminée", cls: "session-status--done" };
  if (status === "planned") return { label: "Planifiée", cls: "session-status--planned" };
  return { label: status, cls: "" };
}

const JOIN_WINDOW_MINUTES = 15;

function getLiveAccess(startDate: string, endDate: string): {
  canJoin: boolean;
  label: string;
} {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const diffMs = start - now;

  if (now > end) return { canJoin: false, label: "Terminée" };
  if (diffMs <= 0) return { canJoin: true, label: "Rejoindre" };
  if (diffMs <= JOIN_WINDOW_MINUTES * 60 * 1000) return { canJoin: true, label: "Rejoindre" };

  const dayMs = 24 * 3600000;
  if (diffMs >= dayMs) {
    const diffDays = Math.floor(diffMs / dayMs);
    const remainingHours = Math.floor((diffMs % dayMs) / 3600000);
    return {
      canJoin: false,
      label: `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}${remainingHours > 0 ? ` ${remainingHours}h` : ""}`,
    };
  }

  const diffH = Math.floor(diffMs / 3600000);
  const diffMin = Math.floor((diffMs % 3600000) / 60000);
  if (diffH > 0) return { canJoin: false, label: `Dans ${diffH}h${diffMin > 0 ? diffMin + "m" : ""}` };
  return { canJoin: false, label: `Dans ${diffMin} min` };
}

function toLocalISODate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCalendarDay(date: string): string {
  return new Date(date + "T12:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ── Helpers ── */
const BADGE_ORDER = ["aventurier", "debutant", "intermediaire", "semi_pro", "professionnel"];
function normalizeBadgeLevel(value: string | null | undefined): BadgeLevel | null {
  return BADGE_ORDER.includes(value ?? "") ? (value as BadgeLevel) : null;
}

function bestBadge(courses: StudentCourse[]): StudentCourse | null {
  return courses.reduce<StudentCourse | null>((best, c) => {
    if (!c.badge_level) return best;
    if (!best?.badge_level) return c;
    return BADGE_ORDER.indexOf(c.badge_level) >= BADGE_ORDER.indexOf(best.badge_level) ? c : best;
  }, null);
}

function bestProgressCourse(courses: StudentCourse[]): StudentCourse | null {
  return courses.reduce<StudentCourse | null>((best, course) => {
    if (!best) return course;
    return (course.progress_pct ?? 0) >= (best.progress_pct ?? 0) ? course : best;
  }, null);
}

/* ── Student illustration ── */
function StudentIllustration() {
  return (
    <img
      src="/img-bg-8.png"
      alt=""
      aria-hidden
      className="stu-hero__illus"
      draggable={false}
    />
  );
}

/* ── KPI card ── */
interface KpiProps {
  label: string;
  value: number | string;
  color: "green" | "blue" | "yellow" | "purple" | "pink" | "dark";
  icon: React.ReactNode;
  sub?: string;
  progressPct?: number;
}
function KpiCard({ label, value, color, icon, sub, progressPct }: KpiProps) {
  const safeProgress = Math.max(0, Math.min(100, progressPct ?? 0));
  return (
    <div className={`stu-kpi-card stu-kpi-card--${color}`}>
      <span className="stu-kpi-card__label">{label}</span>
      <strong className="stu-kpi-card__value">{value}</strong>
      {sub && <small className="stu-kpi-card__sub">{sub}</small>}
      {progressPct !== undefined && (
        <div className="stu-kpi-card__progress" aria-hidden>
          <span style={{ width: `${safeProgress}%` }} />
        </div>
      )}
      <span className="stu-kpi-card__bg-icon" aria-hidden>{icon}</span>
    </div>
  );
}

/* ── Shortcut card ── */
interface ShortcutProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}
function ShortcutCard({ to, label, icon, color }: ShortcutProps) {
  return (
    <Link to={to} className="stu-shortcut-card">
      <span className="stu-shortcut-card__icon" style={{ background: color }}>{icon}</span>
      <span className="stu-shortcut-card__label">{label}</span>
      <ChevronRight size={14} className="stu-shortcut-card__arrow" />
    </Link>
  );
}

type OverviewData = {
  summary: StudentDashboardSummary;
  courses: StudentCourse[];
  sessions: StudentSession[];
  liveEvents: StudentLiveEvent[];
  assignments: StudentAssignment[];
  quizzes: StudentQuizView[];
  results: StudentEnrollmentResults[];
  notifications: NotificationItem[];
};

async function loadStudentOverviewData(): Promise<OverviewData> {
  const [summary, courses, sessions, liveEvents, assignments, quizzes, notifications] = await Promise.all([
    fetchStudentDashboardSummary(),
    fetchMyCourses().catch(() => [] as StudentCourse[]),
    fetchMySessions().catch(() => [] as StudentSession[]),
    fetchMyLiveEvents().catch(() => [] as StudentLiveEvent[]),
    fetchMyAssignments().catch(() => [] as StudentAssignment[]),
    fetchMyQuizzes().catch(() => [] as StudentQuizView[]),
    fetchNotifications().catch(() => [] as NotificationItem[]),
  ]);
  const enrollmentIds = [...summary.classic_enrollments, ...summary.guided_enrollments].map((enrollment) => enrollment.id);
  const results = await Promise.all(
    enrollmentIds.map((enrollmentId) =>
      fetchEnrollmentResults(enrollmentId).catch(() => ({ attendance: [], grades: [] }) as StudentEnrollmentResults),
    ),
  );

  return { summary, courses, sessions, liveEvents, assignments, quizzes, results, notifications };
}

type DashboardAlert = {
  id: string;
  tone: NotificationItem["tone"];
  title: string;
  message: string;
  actionLabel: string;
  actionPath: string;
};

function formatAlertDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDashboardAlerts(params: {
  assignments: StudentAssignment[];
  quizzes: StudentQuizView[];
  liveEvents: StudentLiveEvent[];
  notifications: NotificationItem[];
  now: number;
}): DashboardAlert[] {
  const { assignments, quizzes, liveEvents, notifications, now } = params;
  const alerts: DashboardAlert[] = [];

  const nextAssignment = assignments
    .filter((assignment) => assignment.student_status === "pending" || assignment.student_status === "late")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  if (nextAssignment) {
    const isLate = nextAssignment.student_status === "late" || new Date(nextAssignment.due_date).getTime() < now;
    alerts.push({
      id: `assignment-${nextAssignment.id}`,
      tone: isLate ? "warning" : "info",
      title: isLate ? "Devoir en retard" : "Nouveau devoir à rendre",
      message: `${nextAssignment.title} · ${isLate ? "à traiter dès que possible" : `avant ${formatAlertDate(nextAssignment.due_date)}`}`,
      actionLabel: "Consulter",
      actionPath: "/espace/etudiant/devoirs",
    });
  }

  const activeQuiz = quizzes
    .filter((quiz) =>
      quiz.status === "active" &&
      ["not_started", "failed_retry_now", "failed_retry_after"].includes(quiz.attempt_status)
    )
    .sort((a, b) => {
      const aDate = new Date(a.next_attempt_available_at ?? a.scheduled_at ?? 0).getTime();
      const bDate = new Date(b.next_attempt_available_at ?? b.scheduled_at ?? 0).getTime();
      return aDate - bDate;
    })[0];

  if (activeQuiz) {
    const retryDate = activeQuiz.next_attempt_available_at
      ? new Date(activeQuiz.next_attempt_available_at).getTime()
      : null;
    alerts.push({
      id: `quiz-${activeQuiz.id}`,
      tone: activeQuiz.attempt_status === "failed_retry_after" ? "warning" : "info",
      title: activeQuiz.attempt_status === "not_started" ? "Quiz à faire" : "Quiz à reprendre",
      message: retryDate && retryDate > now
        ? `${activeQuiz.title} · réessai le ${formatAlertDate(activeQuiz.next_attempt_available_at as string)}`
        : `${activeQuiz.title} · ${activeQuiz.formation_title}`,
      actionLabel: "Consulter",
      actionPath: "/espace/etudiant/quizz",
    });
  }

  const latestReviewedAssignment = assignments
    .filter((assignment) => assignment.is_reviewed && assignment.review_score !== null)
    .sort((a, b) =>
      new Date(b.submitted_at ?? b.due_date).getTime() - new Date(a.submitted_at ?? a.due_date).getTime()
    )[0];

  if (latestReviewedAssignment) {
    alerts.push({
      id: `grade-${latestReviewedAssignment.id}`,
      tone: "success",
      title: "Nouvelle note disponible",
      message: `${latestReviewedAssignment.title} · ${latestReviewedAssignment.review_score}/${latestReviewedAssignment.review_max_score}`,
      actionLabel: "Consulter",
      actionPath: "/espace/etudiant/resultats",
    });
  }

  const nextLiveEvent = liveEvents
    .filter((event) => {
      const start = new Date(event.scheduled_at).getTime();
      const end = start + event.duration_minutes * 60000;
      return end >= now;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

  if (nextLiveEvent) {
    const endDate = new Date(new Date(nextLiveEvent.scheduled_at).getTime() + nextLiveEvent.duration_minutes * 60000).toISOString();
    alerts.push({
      id: `live-${nextLiveEvent.id}`,
      tone: "info",
      title: "Cours live à venir",
      message: `${nextLiveEvent.title} · ${getLiveAccess(nextLiveEvent.scheduled_at, endDate).label}`,
      actionLabel: "Voir",
      actionPath: "/espace/etudiant",
    });
  }

  const backendAlerts = notifications.slice(0, 3).map<DashboardAlert>((notification) => ({
    id: `notification-${notification.id}`,
    tone: notification.tone,
    title: notification.title,
    message: notification.message,
    actionLabel: notification.action_label ?? "Consulter",
    actionPath: notification.action_path ?? "/espace/etudiant/notifications",
  }));

  return [...alerts, ...backendAlerts].slice(0, 3);
}

/* ════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════ */
export default function StudentOverviewPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [liveEvents, setLiveEvents] = useState<StudentLiveEvent[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuizView[]>([]);
  const [enrollmentResults, setEnrollmentResults] = useState<StudentEnrollmentResults[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTick] = useState(0);
  const [isFinalizingStripe, setIsFinalizingStripe] = useState(false);

  const checkoutMessage =
    location.state && typeof location.state === "object" && "checkoutMessage" in location.state
      ? String(location.state.checkoutMessage)
      : "";

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      const data = await loadStudentOverviewData();
      if (!isMounted) {
        return;
      }
      setSummary(data.summary);
      setCourses(data.courses);
      setSessions(data.sessions);
      setLiveEvents(data.liveEvents);
      setAssignments(data.assignments);
      setQuizzes(data.quizzes);
      setEnrollmentResults(data.results);
      setNotifications(data.notifications);
    };

    loadDashboard()
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("source") !== "stripe") {
      return;
    }

    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      navigate("/espace/etudiant", {
        replace: true,
        state: {
          checkoutMessage: "Retour Stripe incomplet. Impossible de confirmer le paiement.",
        },
      });
      return;
    }

    let isMounted = true;
    setIsFinalizingStripe(true);

    confirmStripeCheckoutSession(sessionId)
      .then(async (result) => {
        const data = await loadStudentOverviewData();
        if (!isMounted) {
          return;
        }
        setSummary(data.summary);
        setCourses(data.courses);
        setSessions(data.sessions);
        setLiveEvents(data.liveEvents);
        setAssignments(data.assignments);
        setQuizzes(data.quizzes);
        setEnrollmentResults(data.results);
        setNotifications(data.notifications);
        navigate("/espace/etudiant", {
          replace: true,
          state: { checkoutMessage: result.message },
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        navigate("/espace/etudiant", {
          replace: true,
          state: {
            checkoutMessage: getUserActionErrorMessage(error, "checkout.submit"),
          },
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsFinalizingStripe(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate]);

  // Refresh access labels every minute for live countdown
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;
  if (!summary) return null;

  const firstName = user?.full_name?.split(" ")[0] ?? "Étudiant";
  const topCourse = bestBadge(courses);
  const featuredCourse = topCourse ?? bestProgressCourse(courses);
  const totalActiveEnrollments =
    (summary.classic_enrollments_count ?? 0) +
    (summary.guided_enrollments_count ?? 0);
  const hasPurchasedFormation = totalActiveEnrollments > 0;
  const featuredBadgeLevel = normalizeBadgeLevel(featuredCourse?.badge_level)
    ?? (hasPurchasedFormation ? "aventurier" : null);
  const featuredRingPct = featuredBadgeLevel
    ? featuredCourse?.badge_ring_pct ?? 0
    : Math.min(100, featuredCourse?.progress_pct ?? 0);
  const BADGE_NEXT: Record<string, string> = {
    aventurier: "Débutant",
    debutant: "Intermédiaire",
    intermediaire: "Semi-pro",
    semi_pro: "Professionnel",
  };
  const nextBadgeLabel = featuredBadgeLevel ? (BADGE_NEXT[featuredBadgeLevel] ?? null) : null;
  const totalCourseLessons = courses.reduce((sum, course) => sum + (course.total_lessons ?? 0), 0);
  const completedCourseLessons = courses.reduce((sum, course) => sum + (course.completed_lessons ?? 0), 0);
  const realProgressPct = totalCourseLessons > 0
    ? Math.round((completedCourseLessons / totalCourseLessons) * 100)
    : 0;
  const realProgressSub = totalCourseLessons > 0
    ? `${completedCourseLessons}/${totalCourseLessons} leçons terminées`
    : hasPurchasedFormation
      ? "Programme en préparation"
      : "Aucune formation active";
  const pendingAssignments = assignments.filter((assignment) =>
    assignment.student_status === "pending" || assignment.student_status === "late"
  ).length;
  const pendingQuizzes = quizzes.filter((quiz) =>
    quiz.status === "active" &&
    ["not_started", "failed_retry_now", "failed_retry_after"].includes(quiz.attempt_status)
  ).length;
  const workToDoCount = pendingAssignments + pendingQuizzes;
  const workToDoSub = workToDoCount > 0
    ? `${pendingAssignments} devoir${pendingAssignments !== 1 ? "s" : ""} · ${pendingQuizzes} quiz`
    : "À jour";
  const attendanceRows = enrollmentResults.flatMap((result) => result.attendance);
  const validatedAttendance = attendanceRows.filter((row) =>
    ["present", "late", "excused"].includes(row.status)
  ).length;
  const attendancePct = attendanceRows.length > 0
    ? Math.round((validatedAttendance / attendanceRows.length) * 100)
    : 0;
  const attendanceSub = attendanceRows.length > 0
    ? `${validatedAttendance}/${attendanceRows.length} présences validées`
    : "Aucune présence enregistrée";
  const gradeRows = enrollmentResults.flatMap((result) => result.grades).filter((grade) => grade.max_score > 0);
  const gradeScore = gradeRows.reduce((sum, grade) => sum + grade.score, 0);
  const gradeMaxScore = gradeRows.reduce((sum, grade) => sum + grade.max_score, 0);
  const averageGrade = gradeMaxScore > 0 ? (gradeScore / gradeMaxScore) * 20 : null;
  const averageGradeLabel = averageGrade !== null
    ? `${Number.isInteger(averageGrade) ? averageGrade.toFixed(0) : averageGrade.toFixed(1)}/20`
    : "—";
  const averageGradeSub = gradeRows.length > 0
    ? `${gradeRows.length} note${gradeRows.length !== 1 ? "s" : ""} publiée${gradeRows.length !== 1 ? "s" : ""}`
    : "Aucune note publiée";
  const todayDate = toLocalISODate();
  const shouldShowLiveCalendar = liveEvents.length > 0 || (summary.live_enrollments_count ?? 0) > 0;
  const dashboardAlerts = buildDashboardAlerts({
    assignments,
    quizzes,
    liveEvents,
    notifications,
    now: Date.now(),
  });

  return (
    <div className="stu-ov-page">
      {isFinalizingStripe && (
        <div className="stu-ov-notice">
          <Star size={15} />
          <span>Confirmation du paiement Stripe en cours…</span>
        </div>
      )}
      {checkoutMessage && (
        <div className="stu-ov-notice">
          <Star size={15} />
          <span>{checkoutMessage}</span>
        </div>
      )}

      <div className="stu-ov-grid">
        {/* ══════ LEFT COLUMN ══════ */}
        <div className="stu-ov-left">

          {/* Hero welcome card */}
          <div className="stu-hero">
            <div className="stu-hero__content">
              <p className="stu-hero__eyebrow">Espace étudiant</p>
              <h2 className="stu-hero__title">Bonjour, {firstName}&nbsp;👋</h2>
              <p className="stu-hero__sub">
                Code étudiant&nbsp;: <strong>{summary.student_code ?? "Non attribué"}</strong>
              </p>
              <p className="stu-hero__desc">
                Continuez votre progression et décrochez de nouveaux badges !
              </p>
            </div>
            <StudentIllustration />
          </div>

          {/* Prochain cours live */}
          {shouldShowLiveCalendar && (() => {
            const now = Date.now();
            const next = liveEvents.find((e) => new Date(e.scheduled_at).getTime() > now - 30 * 60 * 1000);
            const calEvents = liveEvents.map((e) => ({ date: e.scheduled_at.slice(0, 10) }));
            const calendarDate = selectedCalDate ?? todayDate;
            const isTodaySelected = calendarDate === todayDate;
            const dayEvents = liveEvents.filter((e) => e.scheduled_at.slice(0, 10) === calendarDate);
            return (
              <div className="stu-ov-card stu-live-card">
                <div className="stu-ov-card__head">
                  <span className="stu-ov-card__title"><Video size={16} /> Calendrier des cours live</span>
                </div>

                {/* Prochain cours — affiché 48h avant */}
                {next && new Date(next.scheduled_at).getTime() - now <= 48 * 3600 * 1000 && (() => {
                  const { canJoin, label: joinLabel } = getLiveAccess(next.scheduled_at, new Date(new Date(next.scheduled_at).getTime() + next.duration_minutes * 60000).toISOString());
                  return (
                    <div className="stu-next-course">
                      <div className="stu-next-course__main">
                        <div className="stu-next-course__badge">Prochain cours</div>
                        <strong>{next.title}</strong>
                        <span>{next.formation_title} · {next.session_label}</span>
                        <span>{new Date(next.scheduled_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {next.duration_minutes} min</span>
                      </div>
                      <div className="stu-next-course__action">
                        {next.meeting_link && (
                          <button
                            className={`button button--sm ${canJoin ? "button--primary" : "button--disabled"}`}
                            disabled={!canJoin}
                            onClick={() => canJoin && navigate(`/live/${next.session_id}`)}
                            title={canJoin ? undefined : "Accès ouvert 15 min avant le début"}
                          >
                            <FaVideo /> {joinLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Mini calendrier */}
                <div className="stu-live-cal-layout">
                  <LiveCalendar
                    events={calEvents}
                    selectedDate={calendarDate}
                    initialDate={todayDate}
                    onDayClick={(d) => setSelectedCalDate(d === selectedCalDate ? null : d)}
                  />
                  <div className="stu-live-cal-day">
                    <p className="stu-live-cal-day__label">
                      {isTodaySelected ? "Aujourd'hui" : "Date sélectionnée"} · {formatCalendarDay(calendarDate)}
                    </p>
                    {dayEvents.length === 0 ? (
                      <div className="stu-live-cal-empty">
                        <CalendarOff size={56} strokeWidth={1.2} />
                        <p className="stu-live-cal-status">
                          {`Pas de cours ${isTodaySelected ? "aujourd'hui" : "ce jour"}.`}
                        </p>
                      </div>
                    ) : (
                      <p className="stu-live-cal-status stu-live-cal-status--on">
                        {`${dayEvents.length} cours ${isTodaySelected ? "aujourd'hui" : "ce jour"}`}
                      </p>
                    )}
                    {dayEvents.map((ev) => {
                      const endIso = new Date(new Date(ev.scheduled_at).getTime() + ev.duration_minutes * 60000).toISOString();
                      const { canJoin, label: joinLabel } = getLiveAccess(ev.scheduled_at, endIso);
                      return (
                        <div className="stu-live-event-item" key={ev.id}>
                          <div>
                            <strong>{ev.title}</strong>
                            <span>{new Date(ev.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {ev.duration_minutes} min</span>
                            <span>{ev.formation_title}</span>
                          </div>
                          {ev.meeting_link && (
                            <button
                              className={`button button--sm ${canJoin ? "button--primary" : "button--disabled"}`}
                              disabled={!canJoin}
                              onClick={() => canJoin && navigate(`/live/${ev.session_id}`)}
                            >
                              <FaVideo /> {joinLabel}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Live sessions block */}
          {sessions.length > 0 && (
            <div className="stu-ov-card stu-sessions-card">
              <div className="stu-ov-card__head">
                <span className="stu-ov-card__title">
                  <Video size={16} />
                  Mes sessions programmées
                </span>
              </div>
              <div className="student-sessions-list">
                {sessions.map((session) => {
                  const { label: statusLabel, cls: statusCls } = sessionStatusBadge(session.status);
                  return (
                    <article className="student-session-card" key={session.id}>
                      <div className="student-session-card__left">
                        <span className={`session-status ${statusCls}`}>{statusLabel}</span>
                        <h3>{session.formation_title}</h3>
                        <p className="student-session-card__label">{session.label}</p>
                        <div className="student-session-card__meta">
                          <span>
                            <FaCalendarAlt />
                            {new Date(session.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            {" → "}
                            {new Date(session.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                          {session.teacher_name && <span>{session.teacher_name}</span>}
                          {session.campus_label && (
                            <span><FaMapMarkerAlt />{session.campus_label}</span>
                          )}
                        </div>
                      </div>
                      <div className="student-session-card__actions">
                        {session.meeting_link && (() => {
                          if (session.format_type === "live") {
                            const { canJoin, label: joinLabel } = getLiveAccess(session.start_date, session.end_date);
                            return (
                              <button
                                className={`button button--sm ${canJoin ? "button--primary" : "button--disabled"}`}
                                disabled={!canJoin}
                                onClick={() => canJoin && navigate(`/live/${session.id}`)}
                                title={canJoin ? undefined : `Accès ouvert 15 min avant le début`}
                              >
                                <FaVideo /> {joinLabel}
                              </button>
                            );
                          }
                          return (
                            <a className="button button--primary button--sm" href={session.meeting_link} target="_blank" rel="noopener noreferrer">
                              <FaVideo /> Rejoindre
                            </a>
                          );
                        })()}
                        <a className="button button--secondary button--sm" href={buildCalendarUrl(session)} target="_blank" rel="noopener noreferrer">
                          <FaExternalLinkAlt /> Calendrier
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress section */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title">
                <TrendingUp size={16} />
                Ma progression
              </span>
              <Link to="/espace/etudiant/formations" className="stu-ov-see-all">
                Voir tout <ChevronRight size={13} />
              </Link>
            </div>
            <div className="stu-courses-list">
              {courses.length === 0 ? (
                <p className="stu-courses-empty">
                  Vous n'êtes inscrit à aucune formation pour l'instant.
                </p>
              ) : (
                courses.slice(0, 4).map((c) => (
                  <div key={c.session_id} className="stu-course-row">
                    <div className="stu-course-row__info">
                      <strong>{c.title}</strong>
                      <span>{c.completed_lessons}/{c.total_lessons} leçons</span>
                    </div>
                    <div className="stu-course-row__right">
                      {c.badge_level && (
                        <span className="stu-course-row__badge">
                          {c.badge_level.replace("_", " ")}
                        </span>
                      )}
                      <div className="stu-progress-bar">
                        <div
                          className="stu-progress-bar__fill"
                          style={{ width: `${c.progress_pct ?? 0}%` }}
                        />
                      </div>
                      <span className="stu-course-row__pct">{Math.round(c.progress_pct ?? 0)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick access shortcuts */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title">
                <Star size={16} />
                Accès rapide
              </span>
            </div>
            <div className="stu-shortcuts-grid">
              <ShortcutCard
                to="/espace/etudiant/formations"
                label="Formations en ligne"
                icon={<BookOpen size={18} />}
                color="linear-gradient(135deg,#6366f1,#4f46e5)"
              />
              <ShortcutCard
                to="/espace/etudiant/parcours"
                label="Parcours guidés"
                icon={<Users size={18} />}
                color="linear-gradient(135deg,#0ea5e9,#0284c7)"
              />
              <ShortcutCard
                to="/espace/etudiant/quizz"
                label="Mes quizz"
                icon={<HelpCircle size={18} />}
                color="linear-gradient(135deg,#10b981,#059669)"
              />
              <ShortcutCard
                to="/espace/etudiant/resultats"
                label="Mes résultats"
                icon={<Award size={18} />}
                color="linear-gradient(135deg,#f59e0b,#d97706)"
              />
              <ShortcutCard
                to="/espace/etudiant/paiements"
                label="Mes paiements"
                icon={<CreditCard size={18} />}
                color="linear-gradient(135deg,#ec4899,#db2777)"
              />
              <ShortcutCard
                to="/espace/etudiant/devoirs"
                label="Mes devoirs"
                icon={<Layers size={18} />}
                color="linear-gradient(135deg,#8b5cf6,#7c3aed)"
              />
            </div>
          </div>
        </div>

        {/* ══════ RIGHT COLUMN ══════ */}
        <div className="stu-ov-right">
          <div className={`stu-ov-card stu-badge-card stu-badge-card--featured${featuredBadgeLevel ? "" : " is-locked"}`}>
            <div className="stu-badge-card__top">
              <span>
                <Award size={16} />
                Mon badge
              </span>
            </div>
            <div className="stu-badge-card__body">
              <BadgeRing
                badgeLevel={featuredBadgeLevel}
                ringPct={featuredRingPct}
                hint={null}
                size={118}
                showHint={false}
              />
              {nextBadgeLabel && (
                <div className="stu-badge-progress">
                  <div className="stu-badge-progress__labels">
                    <span>Vers <strong>{nextBadgeLabel}</strong></span>
                    <span>{Math.round(featuredRingPct)}%</span>
                  </div>
                  <div className="stu-badge-progress__bar">
                    <div
                      className="stu-badge-progress__fill"
                      style={{ width: `${Math.round(featuredRingPct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stu-kpi-row">
            <KpiCard
              label="Ma progression"
              value={`${realProgressPct}%`}
              color="blue"
              icon={<TrendingUp size={52} />}
              sub={realProgressSub}
              progressPct={realProgressPct}
            />
            <KpiCard
              label="Travail à faire"
              value={workToDoCount}
              color="purple"
              icon={<HelpCircle size={52} />}
              sub={workToDoSub}
            />
            <KpiCard
              label="Assiduité"
              value={`${attendancePct}%`}
              color="green"
              icon={<Users size={52} />}
              sub={attendanceSub}
            />
            <KpiCard
              label="Moyenne"
              value={averageGradeLabel}
              color="yellow"
              icon={<Layers size={52} />}
              sub={averageGradeSub}
            />
          </div>

          <div className="stu-alert-card">
            <div className="stu-alert-card__head">
              <span>Alertes importantes</span>
              <strong>{dashboardAlerts.length}</strong>
            </div>
            {dashboardAlerts.length > 0 ? (
              <div className="stu-alert-list">
                {dashboardAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.actionPath}
                    className={`stu-alert-item stu-alert-item--${alert.tone}`}
                  >
                    <span className="stu-alert-item__dot" aria-hidden />
                    <span className="stu-alert-item__body">
                      <strong>{alert.title}</strong>
                      <small>{alert.message}</small>
                    </span>
                    <span className="stu-alert-item__action">
                      {alert.actionLabel}
                      <ChevronRight size={12} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="stu-alert-card__empty">
                <strong>Aucune alerte</strong>
                <span>Vous êtes à jour pour le moment.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
