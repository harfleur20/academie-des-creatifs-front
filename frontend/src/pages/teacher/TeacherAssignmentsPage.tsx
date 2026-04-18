import { useEffect, useState } from "react";
import { CheckCircle, Clock, Plus, Trash2, Users } from "lucide-react";
import {
  fetchTeacherOverview,
  fetchSessionCourseDays,
  fetchSessionAssignments,
  createAssignment,
  deleteAssignment,
  fetchAssignmentSubmissions,
  markSubmissionReviewed,
  type TeacherSession,
  type CourseDay,
  type AssignmentView,
  type AssignmentSubmission,
} from "../../lib/teacherApi";

export default function TeacherAssignmentsPage() {
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courseDays, setCourseDays] = useState<CourseDay[]>([]);
  const [selectedCourseDayId, setSelectedCourseDayId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[] | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewScores, setReviewScores] = useState<Record<number, string>>({});

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isFinalProject, setIsFinalProject] = useState(false);

  useEffect(() => {
    fetchTeacherOverview()
      .then((o) => {
        setSessions(o.sessions);
        if (o.sessions.length > 0) setSelectedSessionId(o.sessions[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    setAssignments([]);
    setCourseDays([]);
    setSelectedCourseDayId(null);
    Promise.all([
      fetchSessionAssignments(selectedSessionId),
      fetchSessionCourseDays(selectedSessionId),
    ])
      .then(([assignmentRows, dayRows]) => {
        setAssignments(assignmentRows);
        setCourseDays(dayRows);
        setSelectedCourseDayId(dayRows[0]?.id ?? null);
      })
      .catch(() => {});
  }, [selectedSessionId]);

  async function handleCreate() {
    if (!selectedSessionId || !title.trim() || !dueDate) {
      setError("Titre et date limite requis.");
      return;
    }
    setSaving(true); setError("");
    try {
      const assignment = await createAssignment(selectedSessionId, {
        title: title.trim(),
        course_day_id: selectedCourseDayId,
        instructions: instructions.trim(),
        due_date: new Date(dueDate).toISOString(),
        is_final_project: isFinalProject,
      });
      setAssignments((prev) => [...prev, assignment]);
      setShowForm(false);
      setTitle(""); setInstructions(""); setDueDate(""); setIsFinalProject(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce devoir ?")) return;
    await deleteAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleViewSubmissions(assignment: AssignmentView) {
    setSelectedAssignment(assignment);
    const subs = await fetchAssignmentSubmissions(assignment.id);
    setSubmissions(subs);
    setReviewScores(Object.fromEntries(
      subs.map((submission) => [
        submission.id,
        submission.review_score !== null ? String(submission.review_score) : "",
      ]),
    ));
  }

  async function handleMarkReviewed(submissionId: number) {
    const rawScore = reviewScores[submissionId]?.trim().replace(",", ".");
    const score = rawScore ? Number(rawScore) : null;
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 20)) {
      setError("La note doit être comprise entre 0 et 20.");
      return;
    }
    const updated = await markSubmissionReviewed(
      submissionId,
      score !== null ? { review_score: score, review_max_score: 20 } : undefined,
    );
    setSubmissions((prev) => prev?.map((s) => s.id === submissionId ? updated : s) ?? null);
    setReviewScores((prev) => ({
      ...prev,
      [submissionId]: updated.review_score !== null ? String(updated.review_score) : "",
    }));
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const isPast = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Devoirs</h1>
        <p className="dsh-page__subtitle">Fixez les dates de remise et consultez les soumissions.</p>
      </div>

      {sessions.length > 0 && (
        <div className="dsh-section-bar">
          <label className="dsh-select-label">
            Session :
            <select
              className="dsh-select"
              value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.formation_title} — {s.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="dsh-btn dsh-btn--primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} /> Créer un devoir
          </button>
        </div>
      )}

      {error && <p className="dsh-error">{error}</p>}

      {showForm && (
        <div className="dsh-form-card">
          <h3>Nouveau devoir</h3>
          <div className="dsh-form-row">
            <label className="dsh-form-field">
              <span>Journée de cours <small>(optionnel)</small></span>
              <select
                className="dsh-select"
                value={selectedCourseDayId ?? ""}
                onChange={(e) => setSelectedCourseDayId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Non lié</option>
                {courseDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.title} · {new Date(day.scheduled_at).toLocaleDateString("fr-FR")}
                  </option>
                ))}
              </select>
            </label>
            <label className="dsh-form-field">
              <span>Titre</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Projet final" />
            </label>
            <label className="dsh-form-field">
              <span>Date limite de remise</span>
              <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <div className="dsh-form-field">
              <span>Validation finale</span>
              <label className="dsh-checkbox-line">
                <input
                  type="checkbox"
                  checked={isFinalProject}
                  onChange={(e) => setIsFinalProject(e.target.checked)}
                />
                Projet final
              </label>
            </div>
          </div>
          <label className="dsh-form-field">
            <span>Consigne</span>
            <textarea
              className="dsh-textarea"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Décrivez le travail attendu…"
            />
          </label>
          <div className="dsh-form-actions">
            <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => setShowForm(false)}>Annuler</button>
            <button type="button" className="dsh-btn dsh-btn--primary" disabled={saving} onClick={handleCreate}>
              {saving ? "Création…" : "Créer le devoir"}
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 && !showForm ? (
        <div className="dsh-empty"><p>Aucun devoir pour cette session.</p></div>
      ) : (
        <div className="dsh-list">
          {assignments.map((a) => {
            const day = courseDays.find((item) => item.id === a.course_day_id);
            return (
              <div className="dsh-list-item" key={a.id}>
                <div className="dsh-list-item__icon">
                  {isPast(a.due_date)
                    ? <CheckCircle size={18} style={{ color: "#6b7280" }} />
                    : <Clock size={18} style={{ color: "#f59e0b" }} />}
                </div>
                <div className="dsh-list-item__main">
                  <strong>{a.title}</strong>
                  <span className="dsh-list-item__meta">
                    Date limite : {new Date(a.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{a.submissions_count} soumission{a.submissions_count !== 1 ? "s" : ""}
                    {day ? ` · ${day.title}` : ""}
                    {a.is_final_project ? " · Projet final" : ""}
                  </span>
                </div>
                <div className="dsh-list-item__actions">
                  <button type="button" className="dsh-icon-btn" title="Voir les soumissions" onClick={() => handleViewSubmissions(a)}>
                    <Users size={15} />
                  </button>
                  <button type="button" className="dsh-icon-btn dsh-icon-btn--danger" title="Supprimer" onClick={() => handleDelete(a.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submissions modal */}
      {submissions !== null && selectedAssignment && (
        <div className="dsh-modal-overlay" onClick={() => { setSubmissions(null); setSelectedAssignment(null); }}>
          <div className="dsh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Soumissions — {selectedAssignment.title}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => { setSubmissions(null); setSelectedAssignment(null); }}>✕</button>
            </div>
            {submissions.length === 0 ? (
              <p className="dsh-empty-inline">Aucune soumission reçue.</p>
            ) : (
              <table className="dsh-table">
                <thead><tr><th>Étudiant</th><th>Date de remise</th><th>Fichier</th><th>Note /20</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.student_name}</strong></td>
                      <td className="dsh-td--muted">{new Date(s.submitted_at).toLocaleDateString("fr-FR")}</td>
                      <td>
                        <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="dsh-link">
                          Voir le fichier
                        </a>
                      </td>
                      <td>
                        <input
                          className="dsh-inline-input dsh-inline-input--score"
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="16"
                          value={reviewScores[s.id] ?? ""}
                          onChange={(e) => setReviewScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        {s.is_reviewed
                          ? <span className="dsh-badge dsh-badge--green">Corrigé{s.review_score !== null ? ` · ${s.review_score}/20` : ""}</span>
                          : <span className="dsh-badge dsh-badge--yellow">En attente</span>}
                      </td>
                      <td>
                        <button type="button" className="dsh-btn dsh-btn--sm dsh-btn--ghost" onClick={() => handleMarkReviewed(s.id)}>
                          {s.is_reviewed ? "Enregistrer" : "Corriger"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
