import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Check, Plus, Save, Users } from "lucide-react";

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

type Tab = "days" | "students" | "attendance" | "grades";

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

const DAY_STATUS_LABELS: Record<CourseDay["status"], string> = {
  planned: "Planifié",
  live: "En live",
  done: "Terminé",
  cancelled: "Annulé",
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
  const id = Number(sessionId);

  const [tab, setTab] = useState<Tab>("days");
  const [students, setStudents] = useState<SessionStudent[]>([]);
  const [courseDays, setCourseDays] = useState<CourseDay[]>([]);
  const [selectedCourseDayId, setSelectedCourseDayId] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [attDraft, setAttDraft] = useState<Record<number, AttendanceStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [gradeLabel, setGradeLabel] = useState("Évaluation");
  const [maxScore, setMaxScore] = useState(20);
  const [scoreDraft, setScoreDraft] = useState<Record<number, string>>({});

  const [showDayForm, setShowDayForm] = useState(false);
  const [dayTitle, setDayTitle] = useState("Journée de cours");
  const [dayAt, setDayAt] = useState(defaultCourseDayDate());
  const [dayDuration, setDayDuration] = useState(90);

  const selectedCourseDay = useMemo(
    () => courseDays.find((day) => day.id === selectedCourseDayId) ?? null,
    [courseDays, selectedCourseDayId],
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSessionStudents(id),
      fetchSessionCourseDays(id),
      fetchSessionGrades(id),
    ])
      .then(([studentRows, dayRows, gradeRows]) => {
        setStudents(studentRows);
        setCourseDays(dayRows);
        setGrades(gradeRows);
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

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <div>
          <h1>Session #{id}</h1>
          <p className="dsh-page__subtitle">
            Suivi pédagogique par journée · <Users size={13} style={{ verticalAlign: "middle" }} />
            {" "}<strong>{students.length}</strong> étudiant{students.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="dsh-tabs">
        {(["days", "students", "attendance", "grades"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`dsh-tab${tab === item ? " is-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {{ days: "Journées", students: "Étudiants", attendance: "Présences", grades: "Notes" }[item]}
          </button>
        ))}
      </div>

      {error && <p className="dsh-error">{error}</p>}

      {tab === "days" && (
        <div className="dsh-section">
          <div className="dsh-section__header">
            <div>
              <h2>Calendrier pédagogique</h2>
              <p className="dsh-page__subtitle">Chaque live Jitsi crée une journée de cours. Vous pouvez aussi ajouter une journée hors live.</p>
            </div>
            <button type="button" className="dsh-btn dsh-btn--primary" onClick={() => setShowDayForm((value) => !value)}>
              <Plus size={15} /> Ajouter une journée
            </button>
          </div>

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

          {courseDays.length === 0 ? (
            <div className="dsh-empty"><p>Aucune journée de cours planifiée.</p></div>
          ) : (
            <div className="dsh-list">
              {courseDays.map((day) => (
                <button
                  type="button"
                  className={`dsh-list-item dsh-course-day-item${day.id === selectedCourseDayId ? " is-active" : ""}`}
                  key={day.id}
                  onClick={() => setSelectedCourseDayId(day.id)}
                >
                  <div className="dsh-list-item__icon"><CalendarDays size={18} /></div>
                  <div className="dsh-list-item__main">
                    <strong>{day.title}</strong>
                    <span className="dsh-list-item__meta">
                      {formatDateTime(day.scheduled_at)} · {day.duration_minutes} min · {DAY_STATUS_LABELS[day.status]}
                    </span>
                    <span className="dsh-list-item__desc">
                      {day.attendance_count} présence{day.attendance_count !== 1 ? "s" : ""} · {day.quiz_count} quiz · {day.assignment_count} devoir{day.assignment_count !== 1 ? "s" : ""} · {day.grade_count} note{day.grade_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
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
