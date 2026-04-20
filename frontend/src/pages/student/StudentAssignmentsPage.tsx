import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle, Clock, ExternalLink, MessageSquare, Upload, XCircle } from "lucide-react";
import AssignmentConversationPanel from "../../components/AssignmentConversationPanel";
import {
  createAssignmentComment,
  fetchAssignmentComments,
  fetchMyAssignments,
  submitAssignment,
  uploadStudentAsset,
  type AssignmentComment,
  type AssignmentStudentStatus,
  type StudentAssignment,
} from "../../lib/studentApi";

function StatusBadge({ status }: { status: AssignmentStudentStatus }) {
  const map: Record<AssignmentStudentStatus, { label: string; color: string; icon: ReactNode }> = {
    pending: { label: "À rendre", color: "blue", icon: <Clock size={12} /> },
    submitted: { label: "Rendu", color: "yellow", icon: <Upload size={12} /> },
    late: { label: "En retard", color: "red", icon: <XCircle size={12} /> },
    reviewed: { label: "Corrigé", color: "green", icon: <CheckCircle size={12} /> },
  };
  const { label, color, icon } = map[status];
  return <span className={`dsh-badge dsh-badge--${color}`}>{icon} {label}</span>;
}

function fileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "fichier");
  } catch {
    return url.split("/").pop() || "fichier";
  }
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitTarget, setSubmitTarget] = useState<StudentAssignment | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submissionUploadError, setSubmissionUploadError] = useState("");
  const [submissionUploading, setSubmissionUploading] = useState(false);
  const [submissionFileName, setSubmissionFileName] = useState("");

  const [commentTarget, setCommentTarget] = useState<StudentAssignment | null>(null);
  const [comments, setComments] = useState<AssignmentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentAttachmentUrl, setCommentAttachmentUrl] = useState("");
  const [commentAttachmentName, setCommentAttachmentName] = useState("");
  const [commentUploadError, setCommentUploadError] = useState("");
  const [commentUploading, setCommentUploading] = useState(false);

  const submissionInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchMyAssignments().then(setAssignments).finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit() {
    if (!submitTarget || !fileUrl.trim()) {
      setSubmitError("Ajoutez un fichier ou une URL avant de confirmer la remise.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const updated = await submitAssignment(submitTarget.id, fileUrl.trim());
      setAssignments((prev) => prev.map((assignment) => assignment.id === updated.id ? updated : assignment));
      setSubmitTarget(null);
      setFileUrl("");
      setSubmissionFileName("");
      setSubmissionUploadError("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Erreur de soumission.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmissionUpload(file: File) {
    setSubmissionUploading(true);
    setSubmissionUploadError("");
    try {
      const uploaded = await uploadStudentAsset(file);
      setFileUrl(uploaded.public_url);
      setSubmissionFileName(uploaded.filename);
    } catch (error) {
      setSubmissionUploadError(error instanceof Error ? error.message : "Échec de l'upload.");
    } finally {
      setSubmissionUploading(false);
    }
  }

  async function openCommentThread(assignment: StudentAssignment) {
    setCommentTarget(assignment);
    setCommentsLoading(true);
    setCommentError("");
    setCommentDraft("");
    setCommentAttachmentUrl("");
    setCommentAttachmentName("");
    setCommentUploadError("");
    try {
      const rows = await fetchAssignmentComments(assignment.id);
      setComments(rows);
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Impossible de charger les échanges.");
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleCommentAttachmentUpload(file: File) {
    setCommentUploading(true);
    setCommentUploadError("");
    try {
      const uploaded = await uploadStudentAsset(file);
      setCommentAttachmentUrl(uploaded.public_url);
      setCommentAttachmentName(uploaded.filename);
    } catch (error) {
      setCommentUploadError(error instanceof Error ? error.message : "Impossible d'ajouter cette pièce jointe.");
    } finally {
      setCommentUploading(false);
    }
  }

  async function handleSendComment() {
    if (!commentTarget) return;
    if (!commentDraft.trim() && !commentAttachmentUrl) {
      setCommentError("Ajoutez un message ou une pièce jointe.");
      return;
    }
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const created = await createAssignmentComment(commentTarget.id, {
        body: commentDraft.trim() || null,
        attachment_url: commentAttachmentUrl || null,
      });
      setComments((prev) => [...prev, created]);
      setAssignments((prev) => prev.map((assignment) => (
        assignment.id === commentTarget.id
          ? { ...assignment, comment_count: assignment.comment_count + 1 }
          : assignment
      )));
      setCommentTarget((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
      setCommentDraft("");
      setCommentAttachmentUrl("");
      setCommentAttachmentName("");
      setCommentUploadError("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Impossible d'envoyer le message.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const canSubmit = (assignment: StudentAssignment) =>
    assignment.student_status === "pending" || assignment.student_status === "submitted";
  const openAssignments = assignments.filter((assignment) =>
    assignment.student_status === "pending" || assignment.student_status === "late"
  ).length;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Devoirs</h1>
        <p className="dsh-page__subtitle">
          {openAssignments} devoir{openAssignments !== 1 ? "s" : ""} à suivre, avec remise et échanges au même endroit
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="dsh-empty"><p>Aucun devoir assigné pour le moment.</p></div>
      ) : (
        <div className="dsh-list">
          {assignments.map((assignment) => (
            <div className="dsh-list-item" key={assignment.id}>
              <div className="dsh-list-item__main">
                <strong>{assignment.title}</strong>
                <span className="dsh-list-item__meta">
                  {assignment.formation_title} · {assignment.session_label}
                  {" · "}Date limite : <strong>{formatDateLabel(assignment.due_date)}</strong>
                  {assignment.is_final_project ? " · Projet final" : ""}
                </span>
                {assignment.instructions ? (
                  <p className="dsh-list-item__desc">{assignment.instructions}</p>
                ) : null}
                {assignment.submitted_at ? (
                  <span className="dsh-list-item__meta">
                    Remis le {formatDateLabel(assignment.submitted_at)}
                  </span>
                ) : null}
              </div>

              <div className="dsh-list-item__actions">
                <StatusBadge status={assignment.student_status} />
                {assignment.review_score !== null ? (
                  <span className="dsh-badge dsh-badge--blue">{assignment.review_score}/{assignment.review_max_score}</span>
                ) : null}
                <button
                  type="button"
                  className="dsh-btn dsh-btn--ghost dsh-btn--sm"
                  onClick={() => openCommentThread(assignment)}
                >
                  <MessageSquare size={14} />
                  Échanges{assignment.comment_count > 0 ? ` (${assignment.comment_count})` : ""}
                </button>
                {canSubmit(assignment) ? (
                  <button
                    type="button"
                    className="dsh-btn dsh-btn--primary dsh-btn--sm"
                    onClick={() => {
                      setSubmitTarget(assignment);
                      setFileUrl(assignment.file_url ?? "");
                      setSubmissionFileName(assignment.file_url ? fileNameFromUrl(assignment.file_url) : "");
                      setSubmitError("");
                      setSubmissionUploadError("");
                    }}
                  >
                    <Upload size={14} />
                    {assignment.student_status === "submitted" ? "Modifier la remise" : "Remettre"}
                  </button>
                ) : null}
                {assignment.file_url ? (
                  <a href={assignment.file_url} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--ghost dsh-btn--sm">
                    <ExternalLink size={14} />
                    Voir le fichier
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {submitTarget ? (
        <div className="dsh-modal-overlay" onClick={() => setSubmitTarget(null)}>
          <div className="dsh-modal asg-submit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Remettre — {submitTarget.title}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => setSubmitTarget(null)}>✕</button>
            </div>

            <p className="dsh-modal__meta">
              Date limite : {formatDateLabel(submitTarget.due_date)}
            </p>

            {submitTarget.instructions ? (
              <div className="dsh-modal__instructions">
                <strong>Consigne</strong>
                <p>{submitTarget.instructions}</p>
              </div>
            ) : null}

            <div className="asg-submit-upload">
              <div className="asg-submit-upload__copy">
                <strong>Déposez votre rendu</strong>
                <span>JPG, JPEG, PNG, WebP jusqu'à 2 Mo · PDF jusqu'à 5 Mo · MP4, WebM, MOV jusqu'à 30 Mo · DOCX jusqu'à 10 Mo · ZIP, RAR jusqu'à 50 Mo.</span>
              </div>
              <input
                ref={submissionInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.zip,.rar,.docx"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleSubmissionUpload(file);
                  e.target.value = "";
                }}
              />
              <div className="asg-submit-upload__actions">
                <button
                  type="button"
                  className="dsh-btn dsh-btn--primary dsh-btn--sm"
                  onClick={() => submissionInputRef.current?.click()}
                  disabled={submissionUploading}
                >
                  <Upload size={14} />
                  {submissionUploading ? "Upload…" : "Téléverser un fichier"}
                </button>
                {fileUrl ? (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--ghost dsh-btn--sm">
                    <ExternalLink size={14} />
                    Ouvrir
                  </a>
                ) : null}
              </div>
              {submissionFileName ? (
                <div className="asg-submit-upload__done">📎 {submissionFileName}</div>
              ) : null}
              {submissionUploadError ? <p className="dsh-error">{submissionUploadError}</p> : null}
            </div>

            <label className="dsh-form-field">
              <span>Ou collez une URL externe</span>
              <input
                type="url"
                className="dsh-input"
                placeholder="https://…"
                value={fileUrl}
                onChange={(e) => {
                  setFileUrl(e.target.value);
                  setSubmissionFileName(e.target.value ? fileNameFromUrl(e.target.value) : "");
                }}
              />
            </label>

            {submitError ? <p className="dsh-error">{submitError}</p> : null}

            <div className="dsh-modal__footer">
              <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => setSubmitTarget(null)}>Annuler</button>
              <button type="button" className="dsh-btn dsh-btn--primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Envoi…" : "Confirmer la remise"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commentTarget ? (
        <div className="dsh-modal-overlay" onClick={() => setCommentTarget(null)}>
          <div className="dsh-modal asg-thread-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Échanges — {commentTarget.title}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => setCommentTarget(null)}>✕</button>
            </div>
            <p className="dsh-modal__meta">
              Posez vos questions, ajoutez des précisions ou joignez une image de votre avancement.
            </p>

            <AssignmentConversationPanel
              comments={comments}
              currentRole="student"
              draft={commentDraft}
              onDraftChange={setCommentDraft}
              onSend={handleSendComment}
              loading={commentsLoading}
              sending={commentSubmitting}
              emptyLabel="Aucun échange pour ce devoir."
              placeholder="Décrivez votre blocage, votre avancement ou votre question…"
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
