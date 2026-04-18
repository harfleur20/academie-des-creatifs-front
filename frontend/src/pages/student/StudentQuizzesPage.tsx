import { useEffect, useRef, useState } from "react";
import { CheckCircle, Clock, Timer, XCircle, AlertCircle } from "lucide-react";
import { fetchMyQuizzes, submitQuizAttempt, type StudentQuizView, type AttemptStatus } from "../../lib/studentApi";

function AttemptBadge({ status, nextAt }: { status: AttemptStatus; nextAt: string | null }) {
  if (status === "passed") return <span className="dsh-badge dsh-badge--green"><CheckCircle size={12} /> Réussi</span>;
  if (status === "failed_no_retry") return <span className="dsh-badge dsh-badge--red"><XCircle size={12} /> Échoué</span>;
  if (status === "failed_retry_after") {
    const unlockDate = nextAt ? new Date(nextAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "bientôt";
    return <span className="dsh-badge dsh-badge--yellow"><Clock size={12} /> Retry à {unlockDate}</span>;
  }
  if (status === "failed_retry_now") return <span className="dsh-badge dsh-badge--orange"><AlertCircle size={12} /> Réessai disponible</span>;
  return <span className="dsh-badge dsh-badge--blue">À faire</span>;
}

function formatDuration(minutes: number) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
  return `${minutes} min`;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getTimerState(seconds: number, total: number): "normal" | "warning" | "danger" {
  const pct = seconds / total;
  if (pct <= 0.1) return "danger";
  if (pct <= 0.25) return "warning";
  return "normal";
}

const STORAGE_KEY = (quizId: number, attempt: number) => `quiz_start_${quizId}_${attempt}`;

export default function StudentQuizzesPage() {
  const [quizzes, setQuizzes] = useState<StudentQuizView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<StudentQuizView | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resultQuiz, setResultQuiz] = useState<StudentQuizView | null>(null);

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchMyQuizzes().then(setQuizzes).finally(() => setIsLoading(false));
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function canAttempt(quiz: StudentQuizView) {
    return (
      quiz.status === "active" &&
      (quiz.attempt_status === "not_started" ||
        quiz.attempt_status === "failed_retry_now" ||
        quiz.attempt_status === "failed_retry_after")
    );
  }

  function isRetryBlocked(quiz: StudentQuizView) {
    return quiz.attempt_status === "failed_retry_after";
  }

  function startTimer(quiz: StudentQuizView) {
    if (!quiz.duration_minutes) return;

    const attemptNumber = quiz.attempts.length + 1;
    const storageKey = STORAGE_KEY(quiz.id, attemptNumber);

    // Check if a timer was already started for this attempt (page reload resilience)
    const savedStart = localStorage.getItem(storageKey);
    const startTime = savedStart ? parseInt(savedStart, 10) : Date.now();
    if (!savedStart) localStorage.setItem(storageKey, String(startTime));

    const totalSeconds = quiz.duration_minutes * 60;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);

    setSecondsLeft(remaining);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer(quiz: StudentQuizView | null) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSecondsLeft(null);
    if (quiz) {
      const attemptNumber = quiz.attempts.length + 1;
      localStorage.removeItem(STORAGE_KEY(quiz.id, attemptNumber));
    }
  }

  function openQuiz(quiz: StudentQuizView) {
    setActiveQuiz(quiz);
    setAnswers({});
    setSubmitError("");
    startTimer(quiz);
  }

  function closeQuiz() {
    stopTimer(activeQuiz);
    setActiveQuiz(null);
    setAnswers({});
  }

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (secondsLeft === 0 && activeQuiz) {
      handleSubmit(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  async function handleSubmit(isAutoSubmit = false) {
    if (!activeQuiz) return;
    if (!isAutoSubmit && activeQuiz.questions.some((q) => answers[q.id] === undefined)) {
      setSubmitError("Veuillez répondre à toutes les questions.");
      return;
    }
    setSubmitting(true); setSubmitError("");
    try {
      const answerList = activeQuiz.questions.map((q) => answers[q.id] ?? 0);
      const updated = await submitQuizAttempt(activeQuiz.id, answerList);
      setQuizzes((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      setResultQuiz(updated);
      stopTimer(activeQuiz);
      setActiveQuiz(null);
      setAnswers({});
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erreur de soumission.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement des quizz…</div>;

  const lastAttempt = resultQuiz?.attempts[resultQuiz.attempts.length - 1];
  const totalSeconds = activeQuiz?.duration_minutes ? activeQuiz.duration_minutes * 60 : null;
  const timerState = (secondsLeft !== null && totalSeconds) ? getTimerState(secondsLeft, totalSeconds) : "normal";

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Mes quizz</h1>
        <p className="dsh-page__subtitle">
          Règle : 2 essais, puis 1 dernier essai disponible après 8 h si score &lt; 80 %.
        </p>
      </div>

      {/* Result feedback */}
      {resultQuiz && lastAttempt && (
        <div className={`dsh-result-banner ${lastAttempt.score_pct >= 80 ? "dsh-result-banner--success" : "dsh-result-banner--fail"}`}>
          <div>
            <strong>
              {lastAttempt.score_pct >= 80
                ? `✓ Réussi — ${lastAttempt.score_pct}%`
                : `✗ Score : ${lastAttempt.score_pct}% — Seuil de réussite : 80%`}
            </strong>
            <p>{resultQuiz.title} · Tentative {lastAttempt.attempt_number}</p>
          </div>
          <button type="button" className="dsh-icon-btn" onClick={() => setResultQuiz(null)}>✕</button>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="dsh-empty"><p>Aucun quiz disponible pour vos sessions actuelles.</p></div>
      ) : (
        <div className="dsh-list">
          {quizzes.map((quiz) => (
            <div className="dsh-list-item" key={quiz.id}>
              <div className="dsh-list-item__main">
                <strong>{quiz.title}</strong>
                <span className="dsh-list-item__meta">
                  {quiz.formation_title} · {quiz.session_label}
                  {quiz.scheduled_at ? ` · ${new Date(quiz.scheduled_at).toLocaleDateString("fr-FR")}` : ""}
                  {quiz.duration_minutes ? ` · ` : ""}
                  {quiz.duration_minutes && (
                    <span className="dsh-quiz-duration-badge">
                      <Timer size={11} /> {formatDuration(quiz.duration_minutes)}
                    </span>
                  )}
                </span>
                {quiz.best_score_pct !== null && (
                  <span className="dsh-list-item__score">Meilleur score : {quiz.best_score_pct}%</span>
                )}
              </div>
              <div className="dsh-list-item__actions">
                <AttemptBadge status={quiz.attempt_status} nextAt={quiz.next_attempt_available_at} />
                {canAttempt(quiz) && !isRetryBlocked(quiz) && (
                  <button
                    type="button"
                    className="dsh-btn dsh-btn--primary dsh-btn--sm"
                    onClick={() => openQuiz(quiz)}
                  >
                    {quiz.attempt_status === "not_started" ? "Commencer" : "Réessayer"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz taking modal */}
      {activeQuiz && (
        <div className="dsh-modal-overlay">
          <div className="dsh-modal dsh-modal--large">
            <div className="dsh-modal__header">
              <h3>{activeQuiz.title}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {secondsLeft !== null && totalSeconds !== null && (
                  <div className={`quiz-timer quiz-timer--${timerState}`}>
                    <Timer size={14} />
                    <span className="quiz-timer__display">{formatCountdown(secondsLeft)}</span>
                    <div className="quiz-timer__bar">
                      <div
                        className="quiz-timer__bar-fill"
                        style={{ width: `${(secondsLeft / totalSeconds) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <button type="button" className="dsh-icon-btn" onClick={closeQuiz}>✕</button>
              </div>
            </div>

            <p className="dsh-modal__meta">
              {activeQuiz.questions.length} question{activeQuiz.questions.length !== 1 ? "s" : ""}
              {" · "}Tentative {(activeQuiz.attempts.length ?? 0) + 1} / {activeQuiz.attempt_status === "failed_retry_now" && activeQuiz.attempts.length === 2 ? 3 : 2}
              {activeQuiz.duration_minutes && (
                <> · <Timer size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {formatDuration(activeQuiz.duration_minutes)}</>
              )}
            </p>

            <div className="dsh-quiz-questions">
              {activeQuiz.questions.map((q, qi) => (
                <div className="dsh-quiz-question" key={q.id}>
                  <p className="dsh-quiz-question__text"><strong>{qi + 1}.</strong> {q.text}</p>
                  <div className="dsh-quiz-options">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`dsh-quiz-option${answers[q.id] === oi ? " is-selected" : ""}`}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={oi}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {submitError && <p className="dsh-error" style={{ padding: "0 1.5rem" }}>{submitError}</p>}

            {secondsLeft === 0 && (
              <p className="dsh-error" style={{ padding: "0 1.5rem", color: "#dc2626", fontWeight: 700 }}>
                ⏰ Temps écoulé — soumission automatique en cours…
              </p>
            )}

            <div className="dsh-modal__footer">
              <button type="button" className="dsh-btn dsh-btn--ghost" onClick={closeQuiz}>Annuler</button>
              <button type="button" className="dsh-btn dsh-btn--primary" disabled={submitting || secondsLeft === 0} onClick={() => handleSubmit(false)}>
                {submitting ? "Correction…" : "Soumettre le quiz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
