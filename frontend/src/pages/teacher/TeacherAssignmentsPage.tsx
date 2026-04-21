import { useEffect, useState } from "react";
import { CheckCircle, Clock, MessageSquare, Plus, Trash2, Users, Wand2 } from "lucide-react";
import AssignmentConversationPanel from "../../components/AssignmentConversationPanel";
import {
  createAssignment,
  createAssignmentCommentForEnrollment,
  deleteAssignment,
  fetchAssignmentCommentsForEnrollment,
  fetchAssignmentSubmissions,
  fetchSessionAssignments,
  fetchSessionCourseDays,
  fetchTeacherOverview,
  generateAssignmentDraft,
  markSubmissionReviewed,
  uploadTeacherAsset,
  type AssignmentComment,
  type AssignmentSubmission,
  type AssignmentView,
  type CourseDay,
  type TeacherSession,
} from "../../lib/teacherApi";

function fileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "fichier");
  } catch {
    return url.split("/").pop() || "fichier";
  }
}

function toDateTimeLocal(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type AssignmentCreationMode = "manual" | "ai";

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
  const [creationMode, setCreationMode] = useState<AssignmentCreationMode>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewScores, setReviewScores] = useState<Record<number, string>>({});
  const [aiTopic, setAiTopic] = useState("");
  const [aiLevel, setAiLevel] = useState("");
  const [aiObjectives, setAiObjectives] = useState("");
  const [aiDurationDays, setAiDurationDays] = useState(7);
  const [aiGenerating, setAiGenerating] = useState(false);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isFinalProject, setIsFinalProject] = useState(false);

  const [conversationTarget, setConversationTarget] = useState<AssignmentSubmission | null>(null);
  const [comments, setComments] = useState<AssignmentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentAttachmentUrl, setCommentAttachmentUrl] = useState("");
  const [commentAttachmentName, setCommentAttachmentName] = useState("");
  const [commentUploading, setCommentUploading] = useState(false);
  const [commentUploadError, setCommentUploadError] = useState("");

  useEffect(() => {
    fetchTeacherOverview()
      .then((overview) => {
        setSessions(overview.sessions);
        if (overview.sessions.length > 0) setSelectedSessionId(overview.sessions[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur"))
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
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les devoirs."));
  }, [selectedSessionId]);

  function resetAssignmentForm() {
    setCreationMode("manual");
    setTitle("");
    setInstructions("");
    setDueDate("");
    setIsFinalProject(false);
    setAiTopic("");
    setAiLevel("");
    setAiObjectives("");
    setAiDurationDays(7);
    setError("");
  }

  async function handleGenerateAssignmentDraft() {
    if (!selectedSessionId) return;
    if (!aiTopic.trim()) {
      setError("Indiquez le sujet du devoir à générer.");
      return;
    }
    setAiGenerating(true);
    setError("");
    try {
      const draft = await generateAssignmentDraft({
        session_id: selectedSessionId,
        topic: aiTopic.trim(),
        level: aiLevel.trim() || null,
        objectives: aiObjectives.trim() || null,
        course_day_id: selectedCourseDayId,
        duration_days: aiDurationDays,
        is_final_project: isFinalProject,
      });
      setTitle(draft.title);
      setInstructions(draft.instructions);
      setIsFinalProject(draft.is_final_project);
      if (!dueDate) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + draft.duration_days);
        deadline.setHours(23, 59, 0, 0);
        setDueDate(toDateTimeLocal(deadline));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer le devoir.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleCreate() {
    if (!selectedSessionId || !title.trim() || !dueDate) {
      setError("Titre et date limite requis.");
      return;
    }
    setSaving(true);
    setError("");
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
      resetAssignmentForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce devoir ?")) return;
    await deleteAssignment(id);
    setAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
  }

  async function handleViewSubmissions(assignment: AssignmentView) {
    setSelectedAssignment(assignment);
    setConversationTarget(null);
    const rows = await fetchAssignmentSubmissions(assignment.id);
    setSubmissions(rows);
    setReviewScores(Object.fromEntries(
      rows.map((submission) => [
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
    setSubmissions((prev) => prev?.map((submission) => submission.id === submissionId ? updated : submission) ?? null);
    setConversationTarget((prev) => prev?.id === submissionId ? updated : prev);
    setReviewScores((prev) => ({
      ...prev,
      [submissionId]: updated.review_score !== null ? String(updated.review_score) : "",
    }));
  }

  async function openConversation(submission: AssignmentSubmission) {
    if (!selectedAssignment) return;
    setConversationTarget(submission);
    setCommentsLoading(true);
    setCommentDraft("");
    setCommentError("");
    setCommentAttachmentUrl("");
    setCommentAttachmentName("");
    setCommentUploadError("");
    try {
      const rows = await fetchAssignmentCommentsForEnrollment(selectedAssignment.id, submission.enrollment_id);
      setComments(rows);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Impossible de charger les échanges.");
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleCommentAttachmentUpload(file: File) {
    setCommentUploading(true);
    setCommentUploadError("");
    try {
      const uploaded = await uploadTeacherAsset(file);
      setCommentAttachmentUrl(uploaded.public_url);
      setCommentAttachmentName(uploaded.filename);
    } catch (err) {
      setCommentUploadError(err instanceof Error ? err.message : "Impossible d'ajouter cette pièce jointe.");
    } finally {
      setCommentUploading(false);
    }
  }

  async function handleSendComment() {
    if (!selectedAssignment || !conversationTarget) return;
    if (!commentDraft.trim() && !commentAttachmentUrl) {
      setCommentError("Ajoutez un message ou une pièce jointe.");
      return;
    }
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const created = await createAssignmentCommentForEnrollment(
        selectedAssignment.id,
        conversationTarget.enrollment_id,
        {
          body: commentDraft.trim() || null,
          attachment_url: commentAttachmentUrl || null,
        },
      );
      setComments((prev) => [...prev, created]);
      setSubmissions((prev) => prev?.map((submission) => (
        submission.id === conversationTarget.id
          ? { ...submission, comment_count: submission.comment_count + 1 }
          : submission
      )) ?? null);
      setConversationTarget((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
      setCommentDraft("");
      setCommentAttachmentUrl("");
      setCommentAttachmentName("");
      setCommentUploadError("");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Impossible d'envoyer le message.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const isPast = (deadline: string) => new Date(deadline) < new Date();

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Devoirs</h1>
        <p className="dsh-page__subtitle">Créez les devoirs, recevez les rendus et échangez directement avec les étudiants.</p>
      </div>

      {sessions.length > 0 ? (
        <div className="dsh-section-bar">
          <label className="dsh-select-label">
            Session :
            <select
              className="dsh-select"
              value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.formation_title} — {session.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="dsh-btn dsh-btn--primary" onClick={() => { if (showForm) resetAssignmentForm(); setShowForm((value) => !value); }}>
            <Plus size={15} />
            Créer un devoir
          </button>
        </div>
      ) : null}

      {error ? <p className="dsh-error">{error}</p> : null}

      {showForm ? (
        <div className="dsh-form-card">
          <h3>Nouveau devoir</h3>
          <div className="create-mode-tabs" role="tablist" aria-label="Mode de création du devoir">
            <button
              type="button"
              className={`create-mode-tabs__btn${creationMode === "manual" ? " is-active" : ""}`}
              onClick={() => setCreationMode("manual")}
            >
              Manuel
            </button>
            <button
              type="button"
              className={`create-mode-tabs__btn${creationMode === "ai" ? " is-active" : ""}`}
              onClick={() => setCreationMode("ai")}
            >
              <Wand2 size={14} />
              Avec IA
            </button>
          </div>

          {creationMode === "ai" ? (
            <div className="ai-draft-panel">
              <label className="dsh-form-field">
                <span>Sujet à générer avec l'IA</span>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="ex: devoir pratique sur une campagne social media"
                />
              </label>
              <button
                type="button"
                className="dsh-btn dsh-btn--ghost"
                disabled={aiGenerating || !selectedSessionId}
                onClick={handleGenerateAssignmentDraft}
              >
                <Wand2 size={15} />
                {aiGenerating ? "Génération…" : "Générer"}
              </button>
              <div className="ai-draft-options">
                <label className="dsh-form-field">
                  <span>Niveau <small>(optionnel)</small></span>
                  <input
                    type="text"
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value)}
                    placeholder="ex: intermédiaire"
                  />
                </label>
                <label className="dsh-form-field">
                  <span>Délai suggéré</span>
                  <select
                    className="dsh-select"
                    value={aiDurationDays}
                    onChange={(e) => setAiDurationDays(Number(e.target.value))}
                  >
                    {[1, 2, 3, 5, 7, 10, 14, 21, 30].map((days) => (
                      <option key={days} value={days}>{days} jour{days > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="dsh-form-field ai-draft-options__wide">
                  <span>Objectifs / contraintes <small>(optionnel)</small></span>
                  <textarea
                    className="dsh-textarea"
                    rows={2}
                    value={aiObjectives}
                    onChange={(e) => setAiObjectives(e.target.value)}
                    placeholder="ex: demander un rendu PDF, inclure un barème et une présentation courte"
                  />
                </label>
              </div>
            </div>
          ) : null}
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
            <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => { setShowForm(false); resetAssignmentForm(); }}>Annuler</button>
            <button type="button" className="dsh-btn dsh-btn--primary" disabled={saving} onClick={handleCreate}>
              {saving ? "Création…" : "Créer le devoir"}
            </button>
          </div>
        </div>
      ) : null}

      {assignments.length === 0 && !showForm ? (
        <div className="dsh-empty"><p>Aucun devoir pour cette session.</p></div>
      ) : (
        <div className="dsh-list">
          {assignments.map((assignment) => {
            const day = courseDays.find((item) => item.id === assignment.course_day_id);
            return (
              <div className="dsh-list-item" key={assignment.id}>
                <div className="dsh-list-item__icon">
                  {isPast(assignment.due_date)
                    ? <CheckCircle size={18} style={{ color: "#6b7280" }} />
                    : <Clock size={18} style={{ color: "#f59e0b" }} />}
                </div>
                <div className="dsh-list-item__main">
                  <strong>{assignment.title}</strong>
                  <span className="dsh-list-item__meta">
                    Date limite : {new Date(assignment.due_date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}{assignment.submissions_count} soumission{assignment.submissions_count !== 1 ? "s" : ""}
                    {day ? ` · ${day.title}` : ""}
                    {assignment.is_final_project ? " · Projet final" : ""}
                  </span>
                </div>
                <div className="dsh-list-item__actions">
                  <button type="button" className="dsh-icon-btn" title="Voir les soumissions" onClick={() => handleViewSubmissions(assignment)}>
                    <Users size={15} />
                  </button>
                  <button type="button" className="dsh-icon-btn dsh-icon-btn--danger" title="Supprimer" onClick={() => handleDelete(assignment.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {submissions !== null && selectedAssignment ? (
        <div className="dsh-modal-overlay" onClick={() => { setSubmissions(null); setSelectedAssignment(null); }}>
          <div className="dsh-modal asg-submissions-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Soumissions — {selectedAssignment.title}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => { setSubmissions(null); setSelectedAssignment(null); }}>✕</button>
            </div>
            {submissions.length === 0 ? (
              <p className="dsh-empty-inline">Aucune soumission reçue.</p>
            ) : (
              <table className="dsh-table">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Date de remise</th>
                    <th>Fichier</th>
                    <th>Note /20</th>
                    <th>Statut</th>
                    <th>Échanges</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td><strong>{submission.student_name}</strong></td>
                      <td className="dsh-td--muted">{new Date(submission.submitted_at).toLocaleDateString("fr-FR")}</td>
                      <td>
                        <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="dsh-link">
                          {fileNameFromUrl(submission.file_url)}
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
                          value={reviewScores[submission.id] ?? ""}
                          onChange={(e) => setReviewScores((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        {submission.is_reviewed
                          ? <span className="dsh-badge dsh-badge--green">Corrigé{submission.review_score !== null ? ` · ${submission.review_score}/20` : ""}</span>
                          : <span className="dsh-badge dsh-badge--yellow">En attente</span>}
                      </td>
                      <td>
                        <button type="button" className="dsh-btn dsh-btn--ghost dsh-btn--sm" onClick={() => openConversation(submission)}>
                          <MessageSquare size={14} />
                          {submission.comment_count > 0 ? submission.comment_count : "Ouvrir"}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="dsh-btn dsh-btn--sm dsh-btn--ghost" onClick={() => handleMarkReviewed(submission.id)}>
                          {submission.is_reviewed ? "Enregistrer" : "Corriger"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {conversationTarget && selectedAssignment ? (
        <div className="dsh-modal-overlay" onClick={() => setConversationTarget(null)}>
          <div className="dsh-modal asg-thread-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Échanges — {conversationTarget.student_name}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => setConversationTarget(null)}>✕</button>
            </div>
            <p className="dsh-modal__meta">
              Travail : {selectedAssignment.title} · rendu {new Date(conversationTarget.submitted_at).toLocaleDateString("fr-FR")}
            </p>

            <AssignmentConversationPanel
              comments={comments}
              currentRole="teacher"
              draft={commentDraft}
              onDraftChange={setCommentDraft}
              onSend={handleSendComment}
              loading={commentsLoading}
              sending={commentSubmitting}
              emptyLabel="Aucun échange pour cette soumission."
              placeholder="Ajoutez une correction, une consigne ou un retour avec emoji…"
              attachmentUrl={commentAttachmentUrl}
              attachmentLabel={commentAttachmentName || (commentAttachmentUrl ? fileNameFromUrl(commentAttachmentUrl) : "")}
              uploadingAttachment={commentUploading}
              uploadError={commentUploadError}
              composerError={commentError}
              onUploadAttachment={handleCommentAttachmentUpload}
              onClearAttachment={() => {
                setCommentAttachmentUrl("");
                setCommentAttachmentName("");
                setCommentUploadError("");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
