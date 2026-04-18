import { useEffect, useState } from "react";
import { CheckCircle, Clock, Upload, XCircle } from "lucide-react";
import { fetchMyAssignments, submitAssignment, type StudentAssignment, type AssignmentStudentStatus } from "../../lib/studentApi";

function StatusBadge({ status }: { status: AssignmentStudentStatus }) {
  const map: Record<AssignmentStudentStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending:  { label: "À rendre",  color: "blue",   icon: <Clock size={12} /> },
    submitted:{ label: "Rendu",     color: "yellow", icon: <Upload size={12} /> },
    late:     { label: "En retard", color: "red",    icon: <XCircle size={12} /> },
    reviewed: { label: "Corrigé",   color: "green",  icon: <CheckCircle size={12} /> },
  };
  const { label, color, icon } = map[status];
  return <span className={`dsh-badge dsh-badge--${color}`}>{icon} {label}</span>;
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitTarget, setSubmitTarget] = useState<StudentAssignment | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetchMyAssignments().then(setAssignments).finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit() {
    if (!submitTarget || !fileUrl.trim()) { setSubmitError("L'URL du fichier est requise."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const updated = await submitAssignment(submitTarget.id, fileUrl.trim());
      setAssignments((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      setSubmitTarget(null);
      setFileUrl("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erreur de soumission.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const canSubmit = (a: StudentAssignment) => a.student_status === "pending" || a.student_status === "submitted";

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Devoirs</h1>
        <p className="dsh-page__subtitle">
          {assignments.filter((a) => a.student_status === "pending").length} devoir{assignments.filter((a) => a.student_status === "pending").length !== 1 ? "s" : ""} à rendre
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="dsh-empty"><p>Aucun devoir assigné pour le moment.</p></div>
      ) : (
        <div className="dsh-list">
          {assignments.map((a) => (
            <div className="dsh-list-item" key={a.id}>
              <div className="dsh-list-item__main">
                <strong>{a.title}</strong>
                <span className="dsh-list-item__meta">
                  {a.formation_title} · {a.session_label}
                  {" · "}Date limite : <strong>{new Date(a.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
                  {a.is_final_project ? " · Projet final" : ""}
                </span>
                {a.instructions && (
                  <p className="dsh-list-item__desc">{a.instructions}</p>
                )}
                {a.submitted_at && (
                  <span className="dsh-list-item__meta">
                    Soumis le {new Date(a.submitted_at).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              <div className="dsh-list-item__actions">
                <StatusBadge status={a.student_status} />
                {a.review_score !== null && (
                  <span className="dsh-badge dsh-badge--blue">{a.review_score}/{a.review_max_score}</span>
                )}
                {canSubmit(a) && (
                  <button
                    type="button"
                    className="dsh-btn dsh-btn--primary dsh-btn--sm"
                    onClick={() => { setSubmitTarget(a); setFileUrl(a.file_url ?? ""); setSubmitError(""); }}
                  >
                    <Upload size={14} /> {a.student_status === "submitted" ? "Modifier" : "Remettre"}
                  </button>
                )}
                {a.file_url && (
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--ghost dsh-btn--sm">
                    Voir le fichier
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {submitTarget && (
        <div className="dsh-modal-overlay" onClick={() => setSubmitTarget(null)}>
          <div className="dsh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Remettre — {submitTarget.title}</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => setSubmitTarget(null)}>✕</button>
            </div>
            <p className="dsh-modal__meta">
              Date limite : {new Date(submitTarget.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {submitTarget.instructions && (
              <div className="dsh-modal__instructions">
                <strong>Consigne :</strong>
                <p>{submitTarget.instructions}</p>
              </div>
            )}
            <label className="dsh-form-field">
              <span>URL de votre fichier (Google Drive, Dropbox, lien direct…)</span>
              <input
                type="url"
                className="dsh-input"
                placeholder="https://…"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </label>
            {submitError && <p className="dsh-error">{submitError}</p>}
            <div className="dsh-modal__footer">
              <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => setSubmitTarget(null)}>Annuler</button>
              <button type="button" className="dsh-btn dsh-btn--primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Envoi…" : "Confirmer la remise"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
