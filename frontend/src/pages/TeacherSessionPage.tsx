import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Award, BookOpen, CalendarDays, Check, ChevronRight, ClipboardList, FileText, HelpCircle, LayoutDashboard, Plus, Save, Users, Video } from "lucide-react";

import {
  createCourseDay,
  fetchCourseDayAttendance,
  fetchSessionCourseDays,
  fetchSessionGrades,
  fetchSessionStudents,
  saveCourseDayAttendance,
  saveSessionGrades,
  type AttendanceEntry,
  type AttendanceRow,
  type AttendanceStatus,
  type CourseDay,
  type GradeEntry,
  type GradeRow,
  type SessionStudent,
} from "../lib/catalogApi";
import {
  fetchSessionAssignments,
  fetchSessionCourses,
  fetchSessionQuizzes,
  fetchSessionResources,
  type AssignmentView,
  type CourseView,
  type QuizView,
  type ResourceView,
} from "../lib/teacherApi";

type Tab = "overview" | "days" | "content" | "students" | "attendance" | "grades";

const TAB_VALUES: Tab[] = ["overview", "days", "content", "students", "attendance", "grades"];

function resolveTabParam(value: string | null): Tab {
  return TAB_VALUES.includes(value as Tab) ? (value as Tab) : "overview";
}

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Excusé",
};

const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  present: "#22c55e",
  absent: "#ef4444",
  late: "#f59e0b",
  excused: "#6366f1",
};

const DAY_STATUS_LABELS: Record<string, string> = {
  planned:   "Planifié",
  live:      "En live",
  done:      "Terminé",
  cancelled: "Annulé",
  missed:    "Manqué",
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

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultCourseDayDate() {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
}

export default function TeacherSessionPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(sessionId);
  const tabParam = searchParams.get("tab");
  const addParam = searchParams.get("add");

  const [tab, setTab] = useState<Tab>(() => resolveTabParam(tabParam));
  const [students, setStudents] = useState<SessionStudent[]>([]);
  const [courseDays, setCourseDays] = useState<CourseDay[]>([]);
  const [selectedCourseDayId, setSelectedCourseDayId] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [sessionCourses, setSessionCourses] = useState<CourseView[]>([]);
  const [sessionQuizzes, setSessionQuizzes] = useState<QuizView[]>([]);
  const [sessionAssignments, setSessionAssignments] = useState<AssignmentView[]>([]);
  const [sessionResources, setSessionResources] = useState<ResourceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [attDraft, setAttDraft] = useState<Record<number, AttendanceStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [gradeLabel, setGradeLabel] = useState("Évaluation");
  const [maxScore, setMaxScore] = useState(20);
  const [scoreDraft, setScoreDraft] = useState<Record<number, string>>({});

  const [showDayForm, setShowDayForm] = useState(() => tabParam === "days" && addParam === "1");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayTitle, setDayTitle] = useState("Journée de cours");
  const [dayAt, setDayAt] = useState(defaultCourseDayDate());
  const [dayDuration, setDayDuration] = useState(90);

  const selectedCourseDay = useMemo(
    () => courseDays.find((day) => day.id === selectedCourseDayId) ?? null,
    [courseDays, selectedCourseDayId],
  );

  useEffect(() => {
    if (tabParam) setTab(resolveTabParam(tabParam));
    if (tabParam === "days" && addParam === "1") setShowDayForm(true);
  }, [tabParam, addParam]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSessionStudents(id),
      fetchSessionCourseDays(id),
      fetchSessionGrades(id),
      fetchSessionCourses(id),
      fetchSessionQuizzes(id),
      fetchSessionAssignments(id),
      fetchSessionResources(id),
    ])
      .then(([studentRows, dayRows, gradeRows, courseRows, quizRows, assignmentRows, resourceRows]) => {
        setStudents(studentRows);
        setCourseDays(dayRows);
        setGrades(gradeRows);
        setSessionCourses(courseRows);
        setSessionQuizzes(quizRows);
        setSessionAssignments(assignmentRows);
        setSessionResources(resourceRows);
        const today = new Date().toISOString().slice(0, 10);
        const todayDay = dayRows.find((day) => day.scheduled_at.slice(0, 10) === today);
        setSelectedCourseDayId(todayDay?.id ?? dayRows[0]?.id ?? null);
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!selectedCourseDayId) {
      setAttendance([]);
      return;
    }
    fetchCourseDayAttendance(selectedCourseDayId)
      .then((rows) => {
        setAttendance(rows);
        const draft: Record<number, AttendanceStatus> = {};
        const notes: Record<number, string> = {};
        rows.forEach((row) => {
          draft[row.enrollment_id] = row.status;
          notes[row.enrollment_id] = row.note ?? "";
        });
        setAttDraft(draft);
        setNoteDraft(notes);
      })
      .catch(() => setError("Erreur de chargement des présences."));
  }, [selectedCourseDayId]);

  useEffect(() => {
    if (!students.length) return;
    setAttDraft((prev) => {
      const next = { ...prev };
      students.forEach((student) => {
        if (!(student.enrollment_id in next)) next[student.enrollment_id] = "present";
      });
      return next;
    });
  }, [students, selectedCourseDayId]);

  useEffect(() => {
    if (!grades.length) return;
    setScoreDraft((prev) => {
      const next = { ...prev };
      grades.forEach((grade) => {
        if (!(grade.enrollment_id in next)) next[grade.enrollment_id] = String(grade.score);
      });
      return next;
    });
  }, [grades]);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const refreshCourseDays = useCallback(async () => {
    if (!id) return;
    const rows = await fetchSessionCourseDays(id);
    setCourseDays(rows);
    if (!selectedCourseDayId && rows.length) setSelectedCourseDayId(rows[0].id);
  }, [id, selectedCourseDayId]);

  const handleCreateCourseDay = useCallback(async () => {
    if (!dayTitle.trim() || !dayAt) {
      setError("Titre et date de cours requis.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const day = await createCourseDay(id, {
        title: dayTitle.trim(),
        scheduled_at: new Date(dayAt).toISOString(),
        duration_minutes: dayDuration,
        status: "planned",
      });
      setCourseDays((prev) => [...prev, day].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
      setSelectedCourseDayId(day.id);
      setShowDayForm(false);
      setDayTitle("Journée de cours");
      setDayAt(defaultCourseDayDate());
      setDayDuration(90);
      flash();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création de la journée.");
    } finally {
      setSaving(false);
    }
  }, [dayAt, dayDuration, dayTitle, id]);

  const handleSaveAttendance = useCallback(async () => {
    if (!selectedCourseDayId) {
      setError("Créez ou sélectionnez une journée de cours avant de saisir les présences.");
      return;
    }
    setSaving(true);
    setError("");
    const entries: AttendanceEntry[] = students.map((student) => ({
      enrollment_id: student.enrollment_id,
      course_day_id: selectedCourseDayId,
      status: attDraft[student.enrollment_id] ?? "present",
      note: noteDraft[student.enrollment_id] || null,
    }));
    try {
      const rows = await saveCourseDayAttendance(selectedCourseDayId, entries);
      setAttendance(rows);
      await refreshCourseDays();
      flash();
    } catch {
      setError("Erreur lors de la sauvegarde des présences.");
    } finally {
      setSaving(false);
    }
  }, [attDraft, noteDraft, refreshCourseDays, selectedCourseDayId, students]);

  const handleSaveGrades = useCallback(async () => {
    if (!gradeLabel.trim()) {
      setError("Veuillez saisir un intitulé d'évaluation.");
      return;
    }
    setSaving(true);
    setError("");
    const entries: GradeEntry[] = students
      .filter((student) => scoreDraft[student.enrollment_id] !== undefined && scoreDraft[student.enrollment_id] !== "")
      .map((student) => ({
        enrollment_id: student.enrollment_id,
        course_day_id: selectedCourseDayId,
        label: gradeLabel.trim(),
        score: parseFloat(scoreDraft[student.enrollment_id] ?? "0") || 0,
        max_score: maxScore,
      }));
    try {
      const rows = await saveSessionGrades(id, entries);
      setGrades(rows);
      await refreshCourseDays();
      flash();
    } catch {
      setError("Erreur lors de la sauvegarde des notes.");
    } finally {
      setSaving(false);
    }
  }, [gradeLabel, id, maxScore, refreshCourseDays, scoreDraft, selectedCourseDayId, students]);

  if (loading) return <div className="dsh-page-loading">Chargement de la session...</div>;

  const gradeGroups = Array.from(
    new Map(
      grades.map((grade) => [`${grade.label}-${grade.course_day_id ?? "session"}`, grade]),
    ).values(),
  );
  const totalLessons = sessionCourses.reduce((sum, course) => sum + course.total_lessons, 0);
  const contentStats = [
    { label: "Cours", value: sessionCourses.length, icon: <BookOpen size={16} /> },
    { label: "Leçons", value: totalLessons, icon: <BookOpen size={16} /> },
    { label: "Quiz", value: sessionQuizzes.length, icon: <HelpCircle size={16} /> },
    { label: "Devoirs", value: sessionAssignments.length, icon: <ClipboardList size={16} /> },
    { label: "Ressources", value: sessionResources.length, icon: <FileText size={16} /> },
  ];

  const TAB_LABELS: Record<Tab, string> = {
    overview: "Vue d'ensemble",
    days: "Journées",
    content: "Contenu",
    students: "Étudiants",
    attendance: "Présences",
    grades: "Notes",
  };

  return (
    <div className="stu-ov-page">

      {/* Session hero */}
      {(() => {
        const now = Date.now();
        const nextDay = courseDays.find(d => new Date(d.scheduled_at).getTime() >= now - 3600000);
        const lastDay = courseDays[courseDays.length - 1];
        return (
          <div className="tch-session-hero">
            <div className="tch-session-hero__left">
              <p className="stu-hero__eyebrow" style={{ color: "rgba(255,255,255,0.5)", margin: 0 }}>Espace enseignant</p>
              <h2 className="tch-session-hero__title">Session #{id}</h2>
              <p className="tch-session-hero__sub">
                <Users size={13} /> <strong>{students.length}</strong> étudiant{students.length !== 1 ? "s" : ""}
                <span className="tch-session-hero__sep" />
                <CalendarDays size={13} /> <strong>{courseDays.length}</strong> journée{courseDays.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Calendrier pédagogique — remplace les stats */}
            <div className="tch-session-hero__cal">
              {nextDay ? (
                <div className="tch-hero-cal-item">
                  <span className="tch-hero-cal-item__label">Prochain cours</span>
                  <strong className="tch-hero-cal-item__title">{nextDay.title}</strong>
                  <span className="tch-hero-cal-item__date">
                    {new Date(nextDay.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {new Date(nextDay.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}{nextDay.duration_minutes} min
                  </span>
                </div>
              ) : lastDay ? (
                <div className="tch-hero-cal-item">
                  <span className="tch-hero-cal-item__label">Dernière journée</span>
                  <strong className="tch-hero-cal-item__title">{lastDay.title}</strong>
                  <span className="tch-hero-cal-item__date">
                    {new Date(lastDay.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })} · {DAY_STATUS_LABELS[lastDay.status]}
                  </span>
                </div>
              ) : (
                <div className="tch-hero-cal-item">
                  <span className="tch-hero-cal-item__label">Calendrier</span>
                  <strong className="tch-hero-cal-item__title">Aucune journée planifiée</strong>
                  <span className="tch-hero-cal-item__date">Ajoutez une journée dans l'onglet Journées</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="tch-tabs-bar">
        {(["overview", "days", "content", "students", "attendance", "grades"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`tch-tab${tab === item ? " is-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {TAB_LABELS[item]}
          </button>
        ))}
      </div>

      {error && <p className="dsh-error">{error}</p>}

      {tab === "overview" && (
        <div className="tch-overview-grid">

          {/* ① KPI cards — en premier */}
          <div className="tch-overview-kpis">
            <button type="button" className="tch-ov-kpi tch-ov-kpi--blue" onClick={() => setTab("days")}>
              <CalendarDays size={22} />
              <strong>{courseDays.length}</strong>
              <span>Journées</span>
            </button>
            <button type="button" className="tch-ov-kpi tch-ov-kpi--green" onClick={() => setTab("students")}>
              <Users size={22} />
              <strong>{students.length}</strong>
              <span>Étudiants</span>
            </button>
            <button type="button" className="tch-ov-kpi tch-ov-kpi--purple" onClick={() => setTab("content")}>
              <HelpCircle size={22} />
              <strong>{sessionQuizzes.length}</strong>
              <span>Quiz</span>
            </button>
            <button type="button" className="tch-ov-kpi tch-ov-kpi--yellow" onClick={() => setTab("content")}>
              <ClipboardList size={22} />
              <strong>{sessionAssignments.length}</strong>
              <span>Devoirs</span>
            </button>
            <button type="button" className="tch-ov-kpi tch-ov-kpi--teal" onClick={() => setTab("content")}>
              <BookOpen size={22} />
              <strong>{totalLessons}</strong>
              <span>Leçons</span>
            </button>
            <button type="button" className="tch-ov-kpi tch-ov-kpi--pink" onClick={() => setTab("content")}>
              <FileText size={22} />
              <strong>{sessionResources.length}</strong>
              <span>Ressources</span>
            </button>
          </div>

          {/* ② Calendrier des journées */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title"><CalendarDays size={16} /> Journées de cours</span>
              <button type="button" className="stu-ov-see-all" onClick={() => setTab("days")}>
                Tout voir <ChevronRight size={13} />
              </button>
            </div>
            {courseDays.length === 0 ? (
              <p className="stu-courses-empty">Aucune journée planifiée. <button type="button" style={{ color: "#6366f1", background: "none", border: "none", cursor: "pointer", font: "inherit", fontWeight: 600 }} onClick={() => setTab("days")}>Ajouter →</button></p>
            ) : (
              <div className="stu-courses-list">
                {courseDays.slice(0, 5).map((day) => {
                  const dayColors = {
                    done:      { bg: "#d1fae5", color: "#065f46" },
                    live:      { bg: "#dbeafe", color: "#1e40af" },
                    planned:   { bg: "#f3f4f6", color: "#6b7280" },
                    cancelled: { bg: "#fee2e2", color: "#991b1b" },
                  };
                  const dc = dayColors[day.status as keyof typeof dayColors] ?? dayColors.planned;
                  return (
                    <div key={day.id} className="stu-course-row">
                      <div className="stu-course-row__info">
                        <strong>{day.title}</strong>
                        <span>{new Date(day.scheduled_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {day.duration_minutes} min</span>
                      </div>
                      <div className="stu-course-row__right">
                        <span className="stu-course-row__badge" style={{ background: dc.bg, color: dc.color }}>
                          {DAY_STATUS_LABELS[day.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ③ Liste des étudiants (aperçu) */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title"><Users size={16} /> Étudiants inscrits</span>
              <button type="button" className="stu-ov-see-all" onClick={() => setTab("students")}>
                Tout voir <ChevronRight size={13} />
              </button>
            </div>
            {students.length === 0 ? (
              <p className="stu-courses-empty">Aucun étudiant inscrit pour le moment.</p>
            ) : (
              <div className="stu-courses-list">
                {students.slice(0, 5).map((s, i) => (
                  <div key={s.enrollment_id} className="stu-course-row">
                    <div className="stu-course-row__info">
                      <strong>{s.full_name}</strong>
                      <span>{s.email}</span>
                    </div>
                    <div className="stu-course-row__right">
                      <span className="stu-course-row__badge" style={{
                        background: s.enrollment_status === "active" ? "#dcfce7" : "#f1f5f9",
                        color: s.enrollment_status === "active" ? "#14532d" : "#475569",
                      }}>
                        {s.enrollment_status === "active" ? "Actif" : s.enrollment_status}
                      </span>
                      {s.student_code && (
                        <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>#{i + 1}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ④ Actions rapides — en dernier */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title"><LayoutDashboard size={16} /> Actions rapides</span>
            </div>
            <div className="stu-shortcuts-grid">
              <button type="button" className="stu-shortcut-card" onClick={() => setTab("attendance")}>
                <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}><Users size={18} /></span>
                <span className="stu-shortcut-card__label">Saisir les présences</span>
                <ChevronRight size={14} className="stu-shortcut-card__arrow" />
              </button>
              <button type="button" className="stu-shortcut-card" onClick={() => setTab("grades")}>
                <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}><Award size={18} /></span>
                <span className="stu-shortcut-card__label">Saisir les notes</span>
                <ChevronRight size={14} className="stu-shortcut-card__arrow" />
              </button>
              <button type="button" className="stu-shortcut-card" onClick={() => setTab("days")}>
                <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)" }}><CalendarDays size={18} /></span>
                <span className="stu-shortcut-card__label">Journées de cours</span>
                <ChevronRight size={14} className="stu-shortcut-card__arrow" />
              </button>
              <button type="button" className="stu-shortcut-card" onClick={() => setTab("content")}>
                <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}><BookOpen size={18} /></span>
                <span className="stu-shortcut-card__label">Contenu pédagogique</span>
                <ChevronRight size={14} className="stu-shortcut-card__arrow" />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "days" && (() => {
        // ── Week helpers ──────────────────────────────────────────────
        const today = new Date();
        // Monday of current week + offset
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
        monday.setHours(0, 0, 0, 0);
        const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return d;
        });
        const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const todayYMD = toYMD(today);
        const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
        const weekLabel = `${monday.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} – ${weekDays[6].toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}`;

        // Group course days by YMD
        const byDay: Record<string, CourseDay[]> = {};
        for (const day of courseDays) {
          const ymd = day.scheduled_at.slice(0, 10);
          (byDay[ymd] ??= []).push(day);
        }

        const DAY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
          planned:   { bg: "#fffbeb", border: "#fde68a", text: "#1f2559", badge: "#fef3c7", badgeText: "#92400e" },
          live:      { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe", badgeText: "#1e40af" },
          done:      { bg: "#f0fdf4", border: "#86efac", text: "#14532d", badge: "#dcfce7", badgeText: "#14532d" },
          cancelled: { bg: "#fff1f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2", badgeText: "#991b1b" },
          missed:    { bg: "#fef2f2", border: "#fca5a5", text: "#7f1d1d", badge: "#fee2e2", badgeText: "#991b1b" },
        };

        const now = new Date();
        const resolveStatus = (ev: CourseDay) => {
          const isPast = new Date(ev.scheduled_at) < now;
          if (ev.status === "done") return "done";
          if (ev.status === "cancelled") return "cancelled";
          if (ev.status === "live") return "live";
          if (isPast && ev.attendance_count > 0) return "done";
          if (isPast && ev.attendance_count === 0) return "missed";
          return ev.status;
        };

        return (
          <div className="tch-timetable-section">
            {/* Header: nav + add button */}
            <div className="tch-timetable-header">
              <div className="tch-timetable-nav">
                <button type="button" className="tch-tt-nav-btn" onClick={() => setWeekOffset(w => w - 1)}>‹</button>
                <span className="tch-tt-week-label">{weekLabel}</span>
                <button type="button" className="tch-tt-nav-btn" onClick={() => setWeekOffset(w => w + 1)}>›</button>
                {weekOffset !== 0 && (
                  <button type="button" className="tch-tt-today-btn" onClick={() => setWeekOffset(0)}>Aujourd'hui</button>
                )}
              </div>
              <button type="button" className="dsh-btn dsh-btn--primary" onClick={() => setShowDayForm(v => !v)}>
                <Plus size={15} /> Ajouter une journée
              </button>
            </div>

            {/* Add form */}
            {showDayForm && (
              <div className="dsh-form-card">
                <h3>Nouvelle journée</h3>
                <div className="dsh-form-row">
                  <label className="dsh-form-field">
                    <span>Titre</span>
                    <input type="text" value={dayTitle} onChange={(e) => setDayTitle(e.target.value)} />
                  </label>
                  <label className="dsh-form-field">
                    <span>Date et heure</span>
                    <input type="datetime-local" value={dayAt} onChange={(e) => setDayAt(e.target.value)} />
                  </label>
                  <label className="dsh-form-field">
                    <span>Durée</span>
                    <select value={dayDuration} onChange={(e) => setDayDuration(Number(e.target.value))}>
                      <option value={60}>1h</option>
                      <option value={90}>1h30</option>
                      <option value={120}>2h</option>
                      <option value={180}>3h</option>
                    </select>
                  </label>
                </div>
                <div className="dsh-form-actions">
                  <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => setShowDayForm(false)}>Annuler</button>
                  <button type="button" className="dsh-btn dsh-btn--primary" disabled={saving} onClick={() => { void handleCreateCourseDay(); }}>
                    {saving ? "Création..." : "Créer la journée"}
                  </button>
                </div>
              </div>
            )}

            {/* Timetable grid */}
            <div className="tch-timetable">
              {weekDays.map((day, i) => {
                const ymd = toYMD(day);
                const events = byDay[ymd] ?? [];
                const isToday = ymd === todayYMD;
                return (
                  <div key={ymd} className={`tch-tt-col${isToday ? " is-today" : ""}`}>
                    <div className="tch-tt-col__head">
                      <span className="tch-tt-col__dow">{dayNames[i]}</span>
                      <span className={`tch-tt-col__date${isToday ? " is-today" : ""}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="tch-tt-col__body">
                      {events.length === 0 ? (
                        <div className="tch-tt-empty" />
                      ) : events.map((ev) => {
                        const rs = resolveStatus(ev);
                        const c = DAY_COLORS[rs] ?? DAY_COLORS.planned;
                        const timeStr = new Date(ev.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                        const endMs = new Date(ev.scheduled_at).getTime() + ev.duration_minutes * 60000;
                        const endStr = new Date(endMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className={`tch-tt-event${ev.id === selectedCourseDayId ? " is-selected" : ""}`}
                            style={{ background: c.bg, color: c.text }}
                            onClick={() => setSelectedCourseDayId(ev.id === selectedCourseDayId ? null : ev.id)}
                          >
                            <span className="tch-tt-event__time">{timeStr} – {endStr}</span>
                            <strong className="tch-tt-event__title">{ev.title}</strong>
                            <span className="tch-tt-event__badge" style={{ background: c.badge, color: c.badgeText }}>
                              {DAY_STATUS_LABELS[rs]}
                            </span>
                            <span className="tch-tt-event__meta">
                              {ev.attendance_count} prés. · {ev.duration_minutes} min
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected day detail */}
            {selectedCourseDayId && (() => {
              const sel = courseDays.find(d => d.id === selectedCourseDayId);
              if (!sel) return null;
              const rs = resolveStatus(sel);
              const c = DAY_COLORS[rs] ?? DAY_COLORS.planned;
              return (
                <div className="tch-tt-detail">
                  <div className="tch-tt-detail__head">
                    <strong>{sel.title}</strong>
                    <span className="tch-tt-event__badge" style={{ background: c.badge, color: c.badgeText }}>{DAY_STATUS_LABELS[rs]}</span>
                  </div>
                  <div className="tch-tt-detail__meta">
                    <span><CalendarDays size={13} /> {formatDateTime(sel.scheduled_at)}</span>
                    <span>· {sel.duration_minutes} min</span>
                    <span>· {sel.attendance_count} présence{sel.attendance_count !== 1 ? "s" : ""}</span>
                    <span>· {sel.quiz_count} quiz</span>
                    <span>· {sel.assignment_count} devoir{sel.assignment_count !== 1 ? "s" : ""}</span>
                    <span>· {sel.grade_count} note{sel.grade_count !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" className="dsh-btn dsh-btn--sm dsh-btn--ghost" onClick={() => { setTab("attendance"); }}>
                      Saisir les présences
                    </button>
                    <button type="button" className="dsh-btn dsh-btn--sm dsh-btn--ghost" onClick={() => { setTab("grades"); }}>
                      Saisir les notes
                    </button>
                    <button type="button" className="dsh-btn dsh-btn--sm dsh-btn--ghost" style={{ color: "#6b7280" }} onClick={() => setSelectedCourseDayId(null)}>
                      Fermer
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* All days outside current week — summary */}
            {courseDays.length > 0 && (
              <div className="tch-tt-all-summary">
                <span>{courseDays.length} journée{courseDays.length !== 1 ? "s" : ""} au total sur la formation</span>
              </div>
            )}
          </div>
        );
      })()}

      {tab === "content" && (
        <div className="dsh-section">
          <div className="dsh-section__header">
            <div>
              <h2>Contenu pédagogique de la session</h2>
              <p className="dsh-page__subtitle">Cours, quiz, devoirs et ressources rattachés à cette cohorte.</p>
            </div>
            <div className="teacher-session-content-actions">
              <Link className="dsh-btn dsh-btn--ghost dsh-btn--sm" to="/espace/enseignant/cours">Gérer les cours</Link>
              <Link className="dsh-btn dsh-btn--ghost dsh-btn--sm" to="/espace/enseignant/quizz">Gérer les quiz</Link>
              <Link className="dsh-btn dsh-btn--ghost dsh-btn--sm" to="/espace/enseignant/devoirs">Gérer les devoirs</Link>
            </div>
          </div>

          <div className="teacher-session-content-stats">
            {contentStats.map((stat) => (
              <article className="teacher-session-content-stat" key={stat.label}>
                <span>{stat.icon}</span>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </article>
            ))}
          </div>

          <div className="teacher-session-content-grid">
            <section className="teacher-session-content-card">
              <div className="teacher-session-content-card__head">
                <h3><BookOpen size={15} /> Programme</h3>
                <Link to="/espace/enseignant/cours">Ouvrir</Link>
              </div>
              {sessionCourses.length === 0 ? (
                <p className="dsh-empty-inline">Aucun cours structuré pour cette session.</p>
              ) : (
                <div className="teacher-session-content-list">
                  {sessionCourses.map((course) => (
                    <article key={course.id}>
                      <strong>{course.title}</strong>
                      <span>{course.chapters.length} chapitre{course.chapters.length !== 1 ? "s" : ""} · {course.total_lessons} leçon{course.total_lessons !== 1 ? "s" : ""}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="teacher-session-content-card">
              <div className="teacher-session-content-card__head">
                <h3><HelpCircle size={15} /> Quiz & examens</h3>
                <Link to="/espace/enseignant/quizz">Ouvrir</Link>
              </div>
              {sessionQuizzes.length === 0 ? (
                <p className="dsh-empty-inline">Aucun quiz créé pour cette session.</p>
              ) : (
                <div className="teacher-session-content-list">
                  {sessionQuizzes.map((quiz) => (
                    <article key={quiz.id}>
                      <strong>{quiz.title}</strong>
                      <span>{quiz.status} · {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="teacher-session-content-card">
              <div className="teacher-session-content-card__head">
                <h3><ClipboardList size={15} /> Devoirs</h3>
                <Link to="/espace/enseignant/devoirs">Ouvrir</Link>
              </div>
              {sessionAssignments.length === 0 ? (
                <p className="dsh-empty-inline">Aucun devoir créé pour cette session.</p>
              ) : (
                <div className="teacher-session-content-list">
                  {sessionAssignments.map((assignment) => (
                    <article key={assignment.id}>
                      <strong>{assignment.title}</strong>
                      <span>{formatDateTime(assignment.due_date)} · {assignment.submissions_count} rendu{assignment.submissions_count !== 1 ? "s" : ""}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="teacher-session-content-card">
              <div className="teacher-session-content-card__head">
                <h3><FileText size={15} /> Ressources</h3>
                <Link to="/espace/enseignant/ressources">Ouvrir</Link>
              </div>
              {sessionResources.length === 0 ? (
                <p className="dsh-empty-inline">Aucune ressource publiée pour cette session.</p>
              ) : (
                <div className="teacher-session-content-list">
                  {sessionResources.map((resource) => (
                    <article key={resource.id}>
                      <strong>{resource.title}</strong>
                      <span>{resource.resource_type} · {resource.published_at ? formatDateTime(resource.published_at) : "publication immédiate"}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "students" && (
        <div className="dsh-section">
          {students.length === 0 ? (
            <div className="dsh-empty"><p>Aucun étudiant inscrit à cette formation.</p></div>
          ) : (
            <table className="dsh-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nom complet</th>
                  <th>Email</th>
                  <th>Code étudiant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.enrollment_id}>
                    <td className="dsh-td--muted">{index + 1}</td>
                    <td><strong>{student.full_name}</strong></td>
                    <td className="dsh-td--muted">{student.email}</td>
                    <td>
                      {student.student_code
                        ? <span className="dsh-badge dsh-badge--blue">{student.student_code}</span>
                        : <span className="dsh-td--muted">-</span>}
                    </td>
                    <td>
                      <span className={`dsh-badge dsh-badge--${student.enrollment_status === "active" ? "green" : "yellow"}`}>
                        {student.enrollment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="dsh-section">
          <div className="dsh-section-bar">
            <label className="dsh-select-label">
              Journée :
              <select
                className="dsh-select"
                value={selectedCourseDayId ?? ""}
                onChange={(e) => setSelectedCourseDayId(e.target.value ? Number(e.target.value) : null)}
              >
                {courseDays.length === 0 && <option value="">Aucune journée</option>}
                {courseDays.map((day) => (
                  <option key={day.id} value={day.id}>{day.title} · {formatDateTime(day.scheduled_at)}</option>
                ))}
              </select>
            </label>
          </div>

          {!selectedCourseDay ? (
            <div className="dsh-empty"><p>Créez une journée de cours avant de saisir les présences.</p></div>
          ) : students.length === 0 ? (
            <div className="dsh-empty"><p>Aucun étudiant inscrit.</p></div>
          ) : (
            <table className="dsh-table dsh-table--attendance">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Présence</th>
                  <th>Remarque</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.enrollment_id}>
                    <td><strong>{student.full_name}</strong></td>
                    <td>
                      <div className="dsh-att-btns">
                        {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((statusKey) => (
                          <button
                            key={statusKey}
                            type="button"
                            className={`dsh-att-btn${attDraft[student.enrollment_id] === statusKey ? " is-active" : ""}`}
                            style={attDraft[student.enrollment_id] === statusKey ? { background: ATTENDANCE_COLORS[statusKey], color: "#fff", borderColor: ATTENDANCE_COLORS[statusKey] } : {}}
                            onClick={() => setAttDraft((prev) => ({ ...prev, [student.enrollment_id]: statusKey }))}
                          >
                            {attDraft[student.enrollment_id] === statusKey && <Check size={11} />}
                            {ATTENDANCE_LABELS[statusKey]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        className="dsh-inline-input"
                        type="text"
                        placeholder="Remarque..."
                        value={noteDraft[student.enrollment_id] ?? ""}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [student.enrollment_id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="dsh-section-footer">
            {saved && <span className="dsh-feedback-ok">Présences enregistrées</span>}
            <button
              type="button"
              className="dsh-btn dsh-btn--primary"
              disabled={saving || !students.length || !selectedCourseDayId}
              onClick={() => { void handleSaveAttendance(); }}
            >
              <Save size={15} /> {saving ? "Enregistrement..." : "Enregistrer les présences"}
            </button>
          </div>
        </div>
      )}

      {tab === "grades" && (
        <div className="dsh-section">
          {grades.length > 0 && (
            <>
              <h3 className="dsh-section__title">Notes enregistrées</h3>
              {gradeGroups.map((group) => (
                <div key={`${group.label}-${group.course_day_id ?? "session"}`} className="dsh-results-block">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <strong>{group.label}</strong>
                    <span className="dsh-td--muted">/ {group.max_score}</span>
                    {group.course_day_title && <span className="dsh-badge dsh-badge--blue">{group.course_day_title}</span>}
                  </div>
                  <table className="dsh-table">
                    <thead>
                      <tr><th>Étudiant</th><th>Note</th><th>/ Max</th></tr>
                    </thead>
                    <tbody>
                      {grades
                        .filter((grade) => grade.label === group.label && grade.course_day_id === group.course_day_id)
                        .map((grade) => (
                          <tr key={`${grade.label}-${grade.enrollment_id}-${grade.course_day_id ?? "session"}`}>
                            <td><strong>{grade.student_name}</strong></td>
                            <td><strong style={{ color: grade.score >= grade.max_score * 0.5 ? "#16a34a" : "#dc2626" }}>{grade.score}</strong></td>
                            <td className="dsh-td--muted">{grade.max_score}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}

          <h3 className="dsh-section__title">Saisir une évaluation</h3>
          <div className="dsh-form-row">
            <label className="dsh-form-field">
              <span>Journée liée</span>
              <select
                value={selectedCourseDayId ?? ""}
                onChange={(e) => setSelectedCourseDayId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Note globale session</option>
                {courseDays.map((day) => (
                  <option key={day.id} value={day.id}>{day.title} · {formatDateTime(day.scheduled_at)}</option>
                ))}
              </select>
            </label>
            <label className="dsh-form-field">
              <span>Intitulé de l'évaluation</span>
              <input
                type="text"
                value={gradeLabel}
                onChange={(e) => setGradeLabel(e.target.value)}
                placeholder="ex: Examen mi-parcours"
              />
            </label>
            <label className="dsh-form-field">
              <span>Note maximale</span>
              <input
                type="number"
                value={maxScore}
                min={1}
                onChange={(e) => setMaxScore(Number(e.target.value) || 20)}
              />
            </label>
          </div>

          {students.length === 0 ? (
            <div className="dsh-empty"><p>Aucun étudiant inscrit.</p></div>
          ) : (
            <table className="dsh-table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Note (sur {maxScore})</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.enrollment_id}>
                    <td><strong>{student.full_name}</strong></td>
                    <td>
                      <input
                        className="dsh-inline-input dsh-inline-input--score"
                        type="number"
                        min={0}
                        max={maxScore}
                        step={0.5}
                        placeholder="-"
                        value={scoreDraft[student.enrollment_id] ?? ""}
                        onChange={(e) => setScoreDraft((prev) => ({ ...prev, [student.enrollment_id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="dsh-section-footer">
            {saved && <span className="dsh-feedback-ok">Notes enregistrées</span>}
            <button
              type="button"
              className="dsh-btn dsh-btn--primary"
              disabled={saving || !students.length}
              onClick={() => { void handleSaveGrades(); }}
            >
              <Save size={15} /> {saving ? "Enregistrement..." : "Enregistrer les notes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
