import { useEffect, useState } from "react";
import { useToast } from "../../toast/ToastContext";
import { CheckCircle, Plus, Trash2, Users, X, BarChart2, Calendar, BookOpen, Timer, Wand2 } from "lucide-react";
import {
  fetchTeacherOverview,
  fetchSessionCourseDays,
  fetchSessionQuizzes,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  fetchQuizResults,
  generateQuizDraft,
  type TeacherSession,
  type CourseDay,
  type QuizView,
  type QuizResults,
} from "../../lib/teacherApi";

type QuestionDraft = { text: string; options: string[]; correct_index: number };
const EMPTY_QUESTION: QuestionDraft = { text: "", options: ["", "", ""], correct_index: 0 };
type QuizCreationMode = "manual" | "ai";

const STATUS_MAP = {
  draft:  { label: "Brouillon", color: "gray" },
  active: { label: "Actif",     color: "green" },
  closed: { label: "Fermé",     color: "red" },
} as const;

export default function TeacherQuizzesPage() {
  const [sessions, setSessions]             = useState<TeacherSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courseDays, setCourseDays]           = useState<CourseDay[]>([]);
  const [selectedCourseDayId, setSelectedCourseDayId] = useState<number | null>(null);
  const [quizzes, setQuizzes]               = useState<QuizView[]>([]);
  const [results, setResults]               = useState<QuizResults | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [creationMode, setCreationMode]     = useState<QuizCreationMode>("manual");
  const [saving, setSaving]                 = useState(false);
  const { success, error: toastError } = useToast();
  const [aiTopic, setAiTopic]               = useState("");
  const [aiLevel, setAiLevel]               = useState("");
  const [aiObjectives, setAiObjectives]     = useState("");
  const [aiQuestionsCount, setAiQuestionsCount] = useState(5);
  const [aiOptionsPerQuestion, setAiOptionsPerQuestion] = useState(4);
  const [aiGenerating, setAiGenerating]     = useState(false);

  const [title, setTitle]                   = useState("");
  const [scheduledAt, setScheduledAt]       = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [questions, setQuestions]           = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION }]);

  useEffect(() => {
    fetchTeacherOverview()
      .then((o) => {
        setSessions(o.sessions);
        if (o.sessions.length > 0) setSelectedSessionId(o.sessions[0].id);
      })
      .catch((e) => toastError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    setQuizzes([]);
    setCourseDays([]);
    setSelectedCourseDayId(null);
    Promise.all([
      fetchSessionQuizzes(selectedSessionId),
      fetchSessionCourseDays(selectedSessionId),
    ])
      .then(([quizRows, dayRows]) => {
        setQuizzes(quizRows);
        setCourseDays(dayRows);
        setSelectedCourseDayId(dayRows[0]?.id ?? null);
      })
      .catch(() => {});
  }, [selectedSessionId]);

  function addQuestion() {
    setQuestions((p) => [...p, { ...EMPTY_QUESTION, options: ["", "", ""] }]);
  }
  function removeQuestion(i: number) {
    setQuestions((p) => p.filter((_, idx) => idx !== i));
  }
  function updateQuestion(i: number, field: keyof QuestionDraft, value: unknown) {
    setQuestions((p) => p.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }
  function addOption(qi: number) {
    setQuestions((p) => p.map((q, idx) => idx === qi ? { ...q, options: [...q.options, ""] } : q));
  }
  function removeOption(qi: number, oi: number) {
    setQuestions((p) => p.map((q, idx) => {
      if (idx !== qi) return q;
      const opts = q.options.filter((_, i) => i !== oi);
      return { ...q, options: opts, correct_index: Math.min(q.correct_index, opts.length - 1) };
    }));
  }
  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((p) => p.map((q, idx) =>
      idx === qi ? { ...q, options: q.options.map((o, oidx) => oidx === oi ? value : o) } : q
    ));
  }

  function resetForm() {
    setCreationMode("manual");
    setTitle("");
    setScheduledAt("");
    setDurationMinutes(null);
    setQuestions([{ ...EMPTY_QUESTION }]);
    setAiTopic("");
    setAiLevel("");
    setAiObjectives("");
    setAiQuestionsCount(5);
    setAiOptionsPerQuestion(4);
  }

  async function handleGenerateQuizDraft() {
    if (!selectedSessionId) return;
    if (!aiTopic.trim()) {
      toastError("Indiquez le sujet du quiz à générer.");
      return;
    }
    setAiGenerating(true);
    try {
      const draft = await generateQuizDraft({
        session_id: selectedSessionId,
        topic: aiTopic.trim(),
        level: aiLevel.trim() || null,
        objectives: aiObjectives.trim() || null,
        course_day_id: selectedCourseDayId,
        questions_count: aiQuestionsCount,
        options_per_question: aiOptionsPerQuestion,
      });
      setTitle(draft.title);
      setDurationMinutes(draft.duration_minutes);
      setQuestions(draft.questions.map((question) => ({
        text: question.text,
        options: question.options.length >= 2 ? question.options : ["", ""],
        correct_index: Math.min(question.correct_index, Math.max(question.options.length - 1, 0)),
      })));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Impossible de générer le quiz.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleCreate() {
    if (!selectedSessionId || !title.trim()) { toastError("Titre requis."); return; }
    if (questions.some((q) => !q.text.trim() || q.options.some((o) => !o.trim()))) {
      toastError("Toutes les questions et options doivent être remplies."); return;
    }
    setSaving(true);
    try {
      const quiz = await createQuiz(selectedSessionId, {
        title: title.trim(),
        course_day_id: selectedCourseDayId,
        scheduled_at: scheduledAt || null,
        duration_minutes: durationMinutes,
        questions: questions.map((q, i) => ({ ...q, order_index: i })),
      });
      setQuizzes((p) => [...p, quiz]);
      setShowForm(false);
      resetForm();
      success("Quiz créé.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Erreur lors de la création du quiz.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(quiz: QuizView, s: "draft" | "active" | "closed") {
    const updated = await updateQuiz(quiz.id, { status: s });
    setQuizzes((p) => p.map((q) => q.id === quiz.id ? updated : q));
  }

  async function handleDelete(quizId: number) {
    if (!confirm("Supprimer ce quiz ?")) return;
    await deleteQuiz(quizId);
    setQuizzes((p) => p.filter((q) => q.id !== quizId));
  }

  async function handleViewResults(quizId: number) {
    const res = await fetchQuizResults(quizId);
    setResults(res);
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Quizz & Examens</h1>
        <p className="dsh-page__subtitle">Créez des quiz, programmez des examens et consultez les résultats.</p>
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
          <button
            type="button"
            className="dsh-btn dsh-btn--primary"
            onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Annuler" : "Nouveau quiz"}
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="dsh-form-card">
          <h3>Nouveau quiz</h3>
          <div className="create-mode-tabs" role="tablist" aria-label="Mode de création du quiz">
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
                  placeholder="ex: quiz sur les fondamentaux du branding"
                />
              </label>
              <button
                type="button"
                className="dsh-btn dsh-btn--ghost"
                disabled={aiGenerating || !selectedSessionId}
                onClick={handleGenerateQuizDraft}
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
                    placeholder="ex: débutant à intermédiaire"
                  />
                </label>
                <label className="dsh-form-field">
                  <span>Questions</span>
                  <select
                    className="dsh-select"
                    value={aiQuestionsCount}
                    onChange={(e) => setAiQuestionsCount(Number(e.target.value))}
                  >
                    {[2, 3, 5, 8, 10, 15, 20].map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <label className="dsh-form-field">
                  <span>Options / question</span>
                  <select
                    className="dsh-select"
                    value={aiOptionsPerQuestion}
                    onChange={(e) => setAiOptionsPerQuestion(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6].map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <label className="dsh-form-field ai-draft-options__wide">
                  <span>Objectifs évalués <small>(optionnel)</small></span>
                  <textarea
                    className="dsh-textarea"
                    rows={2}
                    value={aiObjectives}
                    onChange={(e) => setAiObjectives(e.target.value)}
                    placeholder="ex: vérifier la compréhension des canaux, des personas et des indicateurs"
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
              <span>Titre du quiz</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Examen mi-parcours" />
            </label>
            <label className="dsh-form-field">
              <span>Date de passage <small>(optionnel)</small></span>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
            <label className="dsh-form-field">
              <span>Durée limite <small>(optionnel)</small></span>
              <select
                className="dsh-select"
                value={durationMinutes ?? ""}
                onChange={(e) => setDurationMinutes(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pas de limite</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 heure</option>
                <option value="90">1h30</option>
                <option value="120">2 heures</option>
              </select>
            </label>
          </div>

          <div className="quiz-builder">
            {questions.map((q, qi) => (
              <div className="quiz-builder__question" key={qi}>
                <div className="quiz-builder__q-header">
                  <span className="quiz-builder__q-num">Q{qi + 1}</span>
                  <input
                    className="quiz-builder__q-input"
                    type="text"
                    placeholder="Énoncé de la question…"
                    value={q.text}
                    onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                  />
                  {questions.length > 1 && (
                    <button type="button" className="dsh-icon-btn dsh-icon-btn--danger" onClick={() => removeQuestion(qi)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="quiz-builder__options">
                  {q.options.map((opt, oi) => (
                    <div className="quiz-builder__option" key={oi}>
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_index === oi}
                        onChange={() => updateQuestion(qi, "correct_index", oi)}
                        title="Bonne réponse"
                      />
                      <input
                        type="text"
                        className="quiz-builder__opt-input"
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                      />
                      {q.options.length > 2 && (
                        <button type="button" className="dsh-icon-btn" style={{ opacity: 0.45 }} onClick={() => removeOption(qi, oi)}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="quiz-builder__add-opt" onClick={() => addOption(qi)}>
                    + Ajouter une option
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="quiz-builder__add-q" onClick={addQuestion}>
              <Plus size={14} /> Ajouter une question
            </button>
          </div>

          <div className="dsh-form-actions">
            <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => { setShowForm(false); resetForm(); }}>Annuler</button>
            <button type="button" className="dsh-btn dsh-btn--primary" disabled={saving} onClick={handleCreate}>
              {saving ? "Création…" : "Créer le quiz"}
            </button>
          </div>
        </div>
      )}

      {/* ── Quiz grid ── */}
      {quizzes.length === 0 && !showForm ? (
        <div className="dsh-empty"><p>Aucun quiz pour cette session. Créez-en un ci-dessus.</p></div>
      ) : (
        <div className="quiz-grid">
          {quizzes.map((quiz) => {
            const s = STATUS_MAP[quiz.status];
            const day = courseDays.find((item) => item.id === quiz.course_day_id);
            return (
              <div className="quiz-card" key={quiz.id}>
                <div className="quiz-card__top">
                  <span className={`dsh-badge dsh-badge--${s.color}`}>{s.label}</span>
                  <div className="quiz-card__actions">
                    <button type="button" className="dsh-icon-btn" title="Résultats" onClick={() => handleViewResults(quiz.id)}>
                      <BarChart2 size={15} />
                    </button>
                    <button type="button" className="dsh-icon-btn dsh-icon-btn--danger" title="Supprimer" onClick={() => handleDelete(quiz.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="quiz-card__title">{quiz.title}</h3>

                <div className="quiz-card__meta">
                  <span><BookOpen size={13} /> {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</span>
                  {quiz.duration_minutes && (
                    <span><Timer size={13} /> {quiz.duration_minutes >= 60
                      ? `${Math.floor(quiz.duration_minutes / 60)}h${quiz.duration_minutes % 60 > 0 ? String(quiz.duration_minutes % 60).padStart(2, "0") : ""}`
                      : `${quiz.duration_minutes} min`}
                    </span>
                  )}
                  {quiz.scheduled_at && (
                    <span><Calendar size={13} /> {new Date(quiz.scheduled_at).toLocaleDateString("fr-FR")}</span>
                  )}
                  {day && <span><Calendar size={13} /> {day.title}</span>}
                </div>

                <div className="quiz-card__footer">
                  <select
                    className="dsh-select dsh-select--sm"
                    value={quiz.status}
                    onChange={(e) => handleStatusChange(quiz, e.target.value as "draft" | "active" | "closed")}
                  >
                    <option value="draft">Brouillon</option>
                    <option value="active">Activer</option>
                    <option value="closed">Fermer</option>
                  </select>
                  <button type="button" className="dsh-btn dsh-btn--ghost dsh-btn--sm" onClick={() => handleViewResults(quiz.id)}>
                    <Users size={13} /> Résultats
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Results modal ── */}
      {results && (
        <div className="dsh-modal-overlay" onClick={() => setResults(null)}>
          <div className="dsh-modal dsh-modal--large" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <div>
                <h3>{results.title}</h3>
                <p className="dsh-modal__meta">
                  {results.attempts.length} tentative{results.attempts.length !== 1 ? "s" : ""} ·{" "}
                  {results.total_students} étudiant{results.total_students !== 1 ? "s" : ""} inscrits
                </p>
              </div>
              <button type="button" className="dsh-icon-btn" onClick={() => setResults(null)}><X size={16} /></button>
            </div>
            {results.attempts.length === 0 ? (
              <div className="dsh-empty dsh-empty--inline"><p>Aucun étudiant n'a encore passé ce quiz.</p></div>
            ) : (
              <table className="dsh-table">
                <thead>
                  <tr><th>Étudiant</th><th>Tentative</th><th>Score</th><th>Résultat</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {results.attempts.map((a, i) => (
                    <tr key={i}>
                      <td><strong>{a.student_name}</strong></td>
                      <td className="dsh-td--muted">{a.attempt_number}</td>
                      <td>
                        <div className="quiz-score-bar">
                          <div className="quiz-score-bar__fill" style={{ width: `${a.score_pct}%`, background: a.score_pct >= 80 ? "#16a34a" : "#dc2626" }} />
                        </div>
                        <span style={{ fontWeight: 700, color: a.score_pct >= 80 ? "#16a34a" : "#dc2626" }}>{a.score_pct}%</span>
                      </td>
                      <td>
                        {a.score_pct >= 80
                          ? <span className="dsh-badge dsh-badge--green"><CheckCircle size={11} /> Réussi</span>
                          : <span className="dsh-badge dsh-badge--red">Échoué</span>}
                      </td>
                      <td className="dsh-td--muted">{new Date(a.submitted_at).toLocaleDateString("fr-FR")}</td>
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
