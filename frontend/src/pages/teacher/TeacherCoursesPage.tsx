import { useEffect, useState } from "react";
import { useToast } from "../../toast/ToastContext";
import {
  BookOpen, ChevronDown, ChevronRight, FileText, Link2, Plus,
  Trash2, Video, Image, X, HelpCircle, ClipboardList, FolderOpen, Wand2,
} from "lucide-react";
import {
  fetchTeacherOverview,
  fetchSessionCourses,
  createCourse,
  deleteCourse,
  createChapter,
  deleteChapter,
  createLesson,
  deleteLesson,
  fetchSessionQuizzes,
  fetchSessionAssignments,
  fetchSessionResources,
  generateCourseDraft,
  generateCourseDraftFromDocument,
  uploadTeacherAsset,
  type TeacherSession,
  type CourseView,
  type ChapterView,
  type LessonView,
  type LessonType,
  type AiCourseDraft,
  type QuizView,
  type AssignmentView,
  type ResourceView,
} from "../../lib/teacherApi";

const LESSON_TYPE_META: Record<LessonType, { label: string; icon: React.ReactNode; color: string }> = {
  text:       { label: "Texte",     icon: <FileText size={14} />,      color: "#6366f1" },
  video:      { label: "Vidéo",     icon: <Video size={14} />,         color: "#8b5cf6" },
  pdf:        { label: "PDF",       icon: <FileText size={14} />,      color: "#ef4444" },
  quiz:       { label: "Quiz",      icon: <HelpCircle size={14} />,    color: "#f59e0b" },
  assignment: { label: "Devoir",    icon: <ClipboardList size={14} />, color: "#0ea5e9" },
  resource:   { label: "Ressource", icon: <FolderOpen size={14} />,    color: "#10b981" },
};

type LessonFormState = {
  chapterId: number;
  title: string;
  lesson_type: LessonType;
  content: string;
  video_url: string;
  file_url: string;
  quiz_id: number | null;
  assignment_id: number | null;
  resource_id: number | null;
  uploadState: "idle" | "uploading" | "done" | "error";
  uploadProgress: number;
};

const EMPTY_LESSON = (chapterId: number): LessonFormState => ({
  chapterId, title: "", lesson_type: "text", content: "",
  video_url: "", file_url: "", quiz_id: null, assignment_id: null, resource_id: null,
  uploadState: "idle", uploadProgress: 0,
});

type CourseCreationMode = "manual" | "ai";

export default function TeacherCoursesPage() {
  const [sessions, setSessions]                 = useState<TeacherSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courses, setCourses]                   = useState<CourseView[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const { success, error: toastError } = useToast();

  // Course creation form
  const [showCourseForm, setShowCourseForm]     = useState(false);
  const [courseCreationMode, setCourseCreationMode] = useState<CourseCreationMode>("manual");
  const [courseTitle, setCourseTitle]           = useState("");
  const [courseDesc, setCourseDesc]             = useState("");
  const [savingCourse, setSavingCourse]         = useState(false);
  const [aiCourseTopic, setAiCourseTopic]       = useState("");
  const [aiCourseDocument, setAiCourseDocument] = useState<File | null>(null);
  const [aiCourseLevel, setAiCourseLevel]       = useState("");
  const [aiCourseObjectives, setAiCourseObjectives] = useState("");
  const [aiCourseChapterCount, setAiCourseChapterCount] = useState(3);
  const [aiCourseLessonsPerChapter, setAiCourseLessonsPerChapter] = useState(3);
  const [aiGeneratingCourse, setAiGeneratingCourse] = useState(false);
  const [pendingCourseDraft, setPendingCourseDraft] = useState<AiCourseDraft | null>(null);

  // Chapter form (courseId → title)
  const [chapterForms, setChapterForms]         = useState<Record<number, string>>({});

  // Expanded state
  const [expandedCourses, setExpandedCourses]   = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  // Lesson form
  const [lessonForm, setLessonForm]             = useState<LessonFormState | null>(null);
  const [savingLesson, setSavingLesson]         = useState(false);

  // Linked object lists
  const [quizzes, setQuizzes]                   = useState<QuizView[]>([]);
  const [assignments, setAssignments]           = useState<AssignmentView[]>([]);
  const [resources, setResources]               = useState<ResourceView[]>([]);

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
    setCourses([]);
    fetchSessionCourses(selectedSessionId).then(setCourses).catch(() => {});
    fetchSessionQuizzes(selectedSessionId).then(setQuizzes).catch(() => {});
    fetchSessionAssignments(selectedSessionId).then(setAssignments).catch(() => {});
    fetchSessionResources(selectedSessionId).then(setResources).catch(() => {});
  }, [selectedSessionId]);

  function resetCourseForm() {
    setCourseCreationMode("manual");
    setCourseTitle("");
    setCourseDesc("");
    setAiCourseTopic("");
    setAiCourseDocument(null);
    setAiCourseLevel("");
    setAiCourseObjectives("");
    setAiCourseChapterCount(3);
    setAiCourseLessonsPerChapter(3);
    setPendingCourseDraft(null);
  }

  async function handleGenerateCourseDraft() {
    if (!selectedSessionId) return;
    if (!aiCourseDocument && !aiCourseTopic.trim()) {
      toastError("Indiquez le sujet du cours à générer.");
      return;
    }
    setAiGeneratingCourse(true);
    try {
      const commonPayload = {
        session_id: selectedSessionId,
        level: aiCourseLevel.trim() || null,
        objectives: aiCourseObjectives.trim() || null,
        chapters_count: aiCourseChapterCount,
        lessons_per_chapter: aiCourseLessonsPerChapter,
      };
      const draft = aiCourseDocument
        ? await generateCourseDraftFromDocument(aiCourseDocument, commonPayload)
        : await generateCourseDraft({
          ...commonPayload,
          topic: aiCourseTopic.trim(),
        });
      setPendingCourseDraft(draft);
      setCourseTitle(draft.title);
      setCourseDesc(draft.description);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Impossible de générer le cours.");
    } finally {
      setAiGeneratingCourse(false);
    }
  }

  async function handleCreateCourse() {
    if (!selectedSessionId || !courseTitle.trim()) { toastError("Titre requis."); return; }
    setSavingCourse(true);
    try {
      const course = await createCourse(selectedSessionId, { title: courseTitle.trim(), description: courseDesc.trim() });
      let createdCourse = course;
      const openedChapterIds: number[] = [];
      if (pendingCourseDraft?.chapters.length) {
        const createdChapters: ChapterView[] = [];
        for (const [chapterIndex, chapterDraft] of pendingCourseDraft.chapters.entries()) {
          const chapter = await createChapter(course.id, {
            title: chapterDraft.title.trim(),
            order_index: chapterIndex,
          });
          openedChapterIds.push(chapter.id);
          const lessons: LessonView[] = [];
          for (const [lessonIndex, lessonDraft] of chapterDraft.lessons.entries()) {
            const lesson = await createLesson(chapter.id, {
              title: lessonDraft.title.trim(),
              lesson_type: "text",
              content: lessonDraft.content.trim(),
              order_index: lessonIndex,
            });
            lessons.push(lesson);
          }
          createdChapters.push({ ...chapter, lessons });
        }
        createdCourse = {
          ...course,
          chapters: createdChapters,
          total_lessons: createdChapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
        };
      }
      setCourses((p) => [...p, createdCourse]);
      setShowCourseForm(false);
      resetCourseForm();
      setExpandedCourses((s) => new Set(s).add(course.id));
      setExpandedChapters((s) => {
        const next = new Set(s);
        openedChapterIds.forEach((id) => next.add(id));
        return next;
      });
      success("Cours créé.");
    } catch (e) { toastError(e instanceof Error ? e.message : "Erreur lors de la création du cours."); }
    finally { setSavingCourse(false); }
  }

  async function handleDeleteCourse(courseId: number) {
    if (!confirm("Supprimer ce cours et tout son contenu ?")) return;
    await deleteCourse(courseId);
    setCourses((p) => p.filter((c) => c.id !== courseId));
  }

  async function handleAddChapter(courseId: number) {
    const title = chapterForms[courseId]?.trim();
    if (!title) return;
    const chapter = await createChapter(courseId, { title, order_index: courses.find((c) => c.id === courseId)?.chapters.length ?? 0 });
    setCourses((p) => p.map((c) => c.id === courseId ? { ...c, chapters: [...c.chapters, chapter] } : c));
    setChapterForms((p) => ({ ...p, [courseId]: "" }));
    setExpandedChapters((s) => new Set(s).add(chapter.id));
  }

  async function handleDeleteChapter(courseId: number, chapterId: number) {
    if (!confirm("Supprimer ce chapitre ?")) return;
    await deleteChapter(chapterId);
    setCourses((p) => p.map((c) => c.id === courseId
      ? { ...c, chapters: c.chapters.filter((ch) => ch.id !== chapterId) }
      : c));
  }

  async function handleSaveLesson() {
    if (!lessonForm || !lessonForm.title.trim()) { toastError("Titre requis."); return; }
    setSavingLesson(true);
    try {
      const lesson = await createLesson(lessonForm.chapterId, {
        title: lessonForm.title.trim(),
        lesson_type: lessonForm.lesson_type,
        content: lessonForm.content || null,
        video_url: lessonForm.video_url || null,
        file_url: lessonForm.file_url || null,
        quiz_id: lessonForm.quiz_id,
        assignment_id: lessonForm.assignment_id,
        resource_id: lessonForm.resource_id,
        order_index: 0,
      });
      const chapterId = lessonForm.chapterId;
      setCourses((p) => p.map((c) => ({
        ...c,
        chapters: c.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, lessons: [...ch.lessons, lesson] } : ch
        ),
      })));
      setLessonForm(null);
      success("Leçon ajoutée.");
    } catch (e) { toastError(e instanceof Error ? e.message : "Erreur lors de l'ajout de la leçon."); }
    finally { setSavingLesson(false); }
  }

  async function handleDeleteLesson(courseId: number, chapterId: number, lessonId: number) {
    if (!confirm("Supprimer cette leçon ?")) return;
    await deleteLesson(lessonId);
    setCourses((p) => p.map((c) => c.id === courseId ? {
      ...c,
      chapters: c.chapters.map((ch) => ch.id === chapterId
        ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== lessonId) }
        : ch),
    } : c));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !lessonForm) return;
    setLessonForm((p) => p ? { ...p, uploadState: "uploading", uploadProgress: 0 } : p);
    const interval = setInterval(() => setLessonForm((p) => p ? { ...p, uploadProgress: Math.min((p.uploadProgress || 0) + 10, 85) } : p), 150);
    try {
      const asset = await uploadTeacherAsset(file);
      clearInterval(interval);
      setLessonForm((p) => p ? { ...p, uploadState: "done", uploadProgress: 100,
        file_url: lessonForm.lesson_type === "pdf" ? asset.public_url : p?.file_url ?? "",
        video_url: lessonForm.lesson_type === "video" ? asset.public_url : p?.video_url ?? "",
      } : p);
    } catch {
      clearInterval(interval);
      setLessonForm((p) => p ? { ...p, uploadState: "error" } : p);
    }
    e.target.value = "";
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Cours structurés</h1>
        <p className="dsh-page__subtitle">Construisez vos cours par chapitres et liez quiz, devoirs et ressources.</p>
      </div>

      {sessions.length > 0 && (
        <div className="dsh-section-bar">
          <label className="dsh-select-label">
            Session :
            <select className="dsh-select" value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.formation_title} — {s.label}</option>)}
            </select>
          </label>
          <button type="button" className="dsh-btn dsh-btn--primary"
            onClick={() => { if (showCourseForm) resetCourseForm(); setShowCourseForm((v) => !v); }}>
            {showCourseForm ? <X size={15} /> : <Plus size={15} />}
            {showCourseForm ? "Annuler" : "Nouveau cours"}
          </button>
        </div>
      )}

      {/* ── New course form ── */}
      {showCourseForm && (
        <div className="dsh-form-card">
          <h3>Nouveau cours</h3>
          <div className="create-mode-tabs" role="tablist" aria-label="Mode de création du cours">
            <button
              type="button"
              className={`create-mode-tabs__btn${courseCreationMode === "manual" ? " is-active" : ""}`}
              onClick={() => { setCourseCreationMode("manual"); setPendingCourseDraft(null); }}
            >
              Manuel
            </button>
            <button
              type="button"
              className={`create-mode-tabs__btn${courseCreationMode === "ai" ? " is-active" : ""}`}
              onClick={() => setCourseCreationMode("ai")}
            >
              <Wand2 size={14} />
              Avec IA
            </button>
          </div>

          {courseCreationMode === "ai" ? (
            <div className="ai-draft-panel">
              <label className="dsh-form-field">
                <span>Prompt <small>(optionnel si document ajouté)</small></span>
                <input
                  type="text"
                  value={aiCourseTopic}
                  onChange={(e) => setAiCourseTopic(e.target.value)}
                  placeholder="ex: bases du marketing digital pour débutants"
                />
              </label>
              <button
                type="button"
                className="dsh-btn dsh-btn--ghost"
                disabled={aiGeneratingCourse || !selectedSessionId}
                onClick={handleGenerateCourseDraft}
              >
                <Wand2 size={15} />
                {aiGeneratingCourse ? "Génération…" : "Générer"}
              </button>
              <label className="ai-doc-picker">
                <span>Document PDF ou Word</span>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setAiCourseDocument(event.target.files?.[0] ?? null)}
                />
                <small>
                  {aiCourseDocument ? aiCourseDocument.name : "L'IA peut reconstruire le programme complet depuis un support."}
                </small>
              </label>
              <div className="ai-draft-options">
                <label className="dsh-form-field">
                  <span>Niveau <small>(optionnel)</small></span>
                  <input
                    type="text"
                    value={aiCourseLevel}
                    onChange={(e) => setAiCourseLevel(e.target.value)}
                    placeholder="ex: débutant, intermédiaire"
                  />
                </label>
              <label className="dsh-form-field">
                <span>Chapitres</span>
                <select
                  className="dsh-select"
                  value={aiCourseChapterCount}
                  onChange={(e) => setAiCourseChapterCount(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label className="dsh-form-field">
                <span>Leçons / chapitre</span>
                <select
                  className="dsh-select"
                  value={aiCourseLessonsPerChapter}
                  onChange={(e) => setAiCourseLessonsPerChapter(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
                <label className="dsh-form-field ai-draft-options__wide">
                  <span>Objectifs pédagogiques <small>(optionnel)</small></span>
                  <textarea
                    className="dsh-textarea"
                    rows={2}
                    value={aiCourseObjectives}
                    onChange={(e) => setAiCourseObjectives(e.target.value)}
                    placeholder="ex: savoir créer une campagne simple et mesurer les résultats"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {courseCreationMode === "ai" && pendingCourseDraft ? (
            <span className="dsh-form-hint">
              Brouillon IA prêt : {pendingCourseDraft.chapters.length} chapitre{pendingCourseDraft.chapters.length !== 1 ? "s" : ""} et{" "}
              {pendingCourseDraft.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0)} leçon{pendingCourseDraft.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0) !== 1 ? "s" : ""} seront ajoutés à la création.
            </span>
          ) : null}
          <div className="dsh-form-row">
            <label className="dsh-form-field">
              <span>Titre du cours</span>
              <input type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="ex: Introduction à la photographie" />
            </label>
          </div>
          <label className="dsh-form-field">
            <span>Description <small>(optionnel)</small></span>
            <textarea className="dsh-textarea" rows={2} value={courseDesc}
              onChange={(e) => setCourseDesc(e.target.value)} placeholder="Décrivez l'objectif du cours…" />
          </label>
          <div className="dsh-form-actions">
            <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => { setShowCourseForm(false); resetCourseForm(); }}>Annuler</button>
            <button type="button" className="dsh-btn dsh-btn--primary" disabled={savingCourse} onClick={handleCreateCourse}>
              {savingCourse ? "Création…" : "Créer le cours"}
            </button>
          </div>
        </div>
      )}

      {/* ── Courses list ── */}
      {courses.length === 0 && !showCourseForm ? (
        <div className="dsh-empty"><p>Aucun cours pour cette session. Créez-en un ci-dessus.</p></div>
      ) : (
        <div className="cb-course-list">
          {courses.map((course) => {
            const isOpen = expandedCourses.has(course.id);
            const totalLessons = course.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
            return (
              <div className="cb-course" key={course.id}>
                {/* Course header */}
                <div className="cb-course__header" onClick={() => setExpandedCourses((s) => { const n = new Set(s); isOpen ? n.delete(course.id) : n.add(course.id); return n; })}>
                  <span className="cb-course__caret">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                  <BookOpen size={16} className="cb-course__icon" />
                  <div className="cb-course__info">
                    <strong>{course.title}</strong>
                    <span>{course.chapters.length} chapitre{course.chapters.length !== 1 ? "s" : ""} · {totalLessons} leçon{totalLessons !== 1 ? "s" : ""}</span>
                  </div>
                  <button type="button" className="dsh-icon-btn dsh-icon-btn--danger"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {isOpen && (
                  <div className="cb-course__body">
                    {course.description && <p className="cb-course__desc">{course.description}</p>}

                    {/* Chapters */}
                    {course.chapters.map((chapter) => {
                      const chOpen = expandedChapters.has(chapter.id);
                      return (
                        <div className="cb-chapter" key={chapter.id}>
                          <div className="cb-chapter__header"
                            onClick={() => setExpandedChapters((s) => { const n = new Set(s); chOpen ? n.delete(chapter.id) : n.add(chapter.id); return n; })}>
                            <span className="cb-chapter__caret">{chOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                            <strong className="cb-chapter__title">{chapter.title}</strong>
                            <span className="cb-chapter__count">{chapter.lessons.length} leçon{chapter.lessons.length !== 1 ? "s" : ""}</span>
                            <button type="button" className="dsh-icon-btn dsh-icon-btn--danger"
                              onClick={(e) => { e.stopPropagation(); handleDeleteChapter(course.id, chapter.id); }}>
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {chOpen && (
                            <div className="cb-chapter__body">
                              {chapter.lessons.map((lesson) => (
                                <LessonRow
                                  key={lesson.id}
                                  lesson={lesson}
                                  onDelete={() => handleDeleteLesson(course.id, chapter.id, lesson.id)}
                                />
                              ))}
                              <button type="button" className="cb-add-lesson-btn"
                                onClick={() => setLessonForm(EMPTY_LESSON(chapter.id))}>
                                <Plus size={13} /> Ajouter une leçon
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add chapter */}
                    <div className="cb-add-chapter">
                      <input
                        type="text"
                        className="cb-add-chapter__input"
                        placeholder="Titre du nouveau chapitre…"
                        value={chapterForms[course.id] ?? ""}
                        onChange={(e) => setChapterForms((p) => ({ ...p, [course.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddChapter(course.id)}
                      />
                      <button type="button" className="dsh-btn dsh-btn--ghost dsh-btn--sm"
                        onClick={() => handleAddChapter(course.id)}>
                        <Plus size={13} /> Chapitre
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lesson form modal ── */}
      {lessonForm && (
        <div className="dsh-modal-overlay" onClick={() => setLessonForm(null)}>
          <div className="dsh-modal dsh-modal--large" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal__header">
              <h3>Nouvelle leçon</h3>
              <button type="button" className="dsh-icon-btn" onClick={() => setLessonForm(null)}><X size={16} /></button>
            </div>

            {/* Type picker */}
            <div style={{ padding: "0 1.5rem" }}>
              <div className="res-type-picker">
                {(Object.keys(LESSON_TYPE_META) as LessonType[]).map((t) => (
                  <button key={t} type="button"
                    className={`res-type-btn${lessonForm.lesson_type === t ? " is-active" : ""}`}
                    onClick={() => setLessonForm((p) => p ? { ...p, lesson_type: t, uploadState: "idle", uploadProgress: 0 } : p)}>
                    {LESSON_TYPE_META[t].icon}
                    <span>{LESSON_TYPE_META[t].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "0.75rem 1.5rem 0" }}>
              <label className="dsh-form-field">
                <span>Titre de la leçon</span>
                <input type="text" value={lessonForm.title}
                  onChange={(e) => setLessonForm((p) => p ? { ...p, title: e.target.value } : p)}
                  placeholder="ex: Introduction à la lumière naturelle" />
              </label>
            </div>

            <div style={{ padding: "0.75rem 1.5rem 0" }}>
              {lessonForm.lesson_type === "text" && (
                <label className="dsh-form-field">
                  <span>Contenu</span>
                  <textarea className="dsh-textarea" rows={6}
                    value={lessonForm.content}
                    onChange={(e) => setLessonForm((p) => p ? { ...p, content: e.target.value } : p)}
                    placeholder="Rédigez le contenu de la leçon…" />
                </label>
              )}

              {lessonForm.lesson_type === "video" && (
                <>
                  <label className="dsh-form-field">
                    <span>URL vidéo (YouTube, Vimeo…)</span>
                    <input type="url" value={lessonForm.video_url}
                      onChange={(e) => setLessonForm((p) => p ? { ...p, video_url: e.target.value } : p)}
                      placeholder="https://youtube.com/watch?v=…" />
                  </label>
                  <p className="cb-or-divider">ou uploadez un fichier</p>
                  <FileUploadZone lessonForm={lessonForm} accept=".mp4,.webm,.mov" onFileSelect={handleFileUpload} />
                </>
              )}

              {lessonForm.lesson_type === "pdf" && (
                <FileUploadZone lessonForm={lessonForm} accept=".pdf" onFileSelect={handleFileUpload} />
              )}

              {lessonForm.lesson_type === "quiz" && (
                <label className="dsh-form-field">
                  <span>Sélectionner un quiz</span>
                  <select className="dsh-select"
                    value={lessonForm.quiz_id ?? ""}
                    onChange={(e) => setLessonForm((p) => p ? { ...p, quiz_id: e.target.value ? Number(e.target.value) : null } : p)}>
                    <option value="">— Choisir un quiz —</option>
                    {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
                  {quizzes.length === 0 && <span className="dsh-form-hint">Aucun quiz disponible pour cette session. Créez-en d'abord dans l'onglet Quizz.</span>}
                </label>
              )}

              {lessonForm.lesson_type === "assignment" && (
                <label className="dsh-form-field">
                  <span>Sélectionner un devoir</span>
                  <select className="dsh-select"
                    value={lessonForm.assignment_id ?? ""}
                    onChange={(e) => setLessonForm((p) => p ? { ...p, assignment_id: e.target.value ? Number(e.target.value) : null } : p)}>
                    <option value="">— Choisir un devoir —</option>
                    {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                  {assignments.length === 0 && <span className="dsh-form-hint">Aucun devoir disponible. Créez-en d'abord dans l'onglet Devoirs.</span>}
                </label>
              )}

              {lessonForm.lesson_type === "resource" && (
                <label className="dsh-form-field">
                  <span>Sélectionner une ressource</span>
                  <select className="dsh-select"
                    value={lessonForm.resource_id ?? ""}
                    onChange={(e) => setLessonForm((p) => p ? { ...p, resource_id: e.target.value ? Number(e.target.value) : null } : p)}>
                    <option value="">— Choisir une ressource —</option>
                    {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                  {resources.length === 0 && <span className="dsh-form-hint">Aucune ressource disponible. Créez-en d'abord dans l'onglet Ressources.</span>}
                </label>
              )}
            </div>

            <div className="dsh-modal__footer">
              <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => setLessonForm(null)}>Annuler</button>
              <button type="button" className="dsh-btn dsh-btn--primary" disabled={savingLesson} onClick={handleSaveLesson}>
                {savingLesson ? "Ajout…" : "Ajouter la leçon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson, onDelete }: { lesson: LessonView; onDelete: () => void }) {
  const meta = LESSON_TYPE_META[lesson.lesson_type];
  const subtitle =
    lesson.lesson_type === "quiz" ? lesson.quiz_title :
    lesson.lesson_type === "assignment" ? lesson.assignment_title :
    lesson.lesson_type === "resource" ? lesson.resource_title :
    null;
  return (
    <div className="cb-lesson-row">
      <span className="cb-lesson-row__type-badge" style={{ background: meta.color + "1a", color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      <span className="cb-lesson-row__title">{lesson.title}</span>
      {subtitle && <span className="cb-lesson-row__sub">→ {subtitle}</span>}
      <button type="button" className="dsh-icon-btn dsh-icon-btn--danger" onClick={onDelete}><Trash2 size={13} /></button>
    </div>
  );
}

function FileUploadZone({ lessonForm, accept, onFileSelect }: {
  lessonForm: LessonFormState;
  accept: string;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { uploadState, uploadProgress } = lessonForm;
  return (
    <div className="res-upload-zone">
      <input type="file" accept={accept} style={{ display: "none" }} id="lesson-file-input" onChange={onFileSelect} />
      {uploadState === "idle" && (
        <label htmlFor="lesson-file-input" className="res-upload-btn" style={{ cursor: "pointer" }}>
          <Image size={20} />
          <span>Cliquer pour uploader</span>
        </label>
      )}
      {uploadState === "uploading" && (
        <div className="res-upload-progress">
          <span>Upload en cours…</span>
          <div className="res-progress-bar"><div className="res-progress-bar__fill" style={{ width: `${uploadProgress}%` }} /></div>
          <span>{uploadProgress}%</span>
        </div>
      )}
      {uploadState === "done" && (
        <div className="res-upload-done">
          <FileText size={18} style={{ color: "#059669" }} />
          <span className="res-upload-done__name">Fichier uploadé</span>
        </div>
      )}
      {uploadState === "error" && (
        <label htmlFor="lesson-file-input" className="res-upload-btn res-upload-btn--error" style={{ cursor: "pointer" }}>
          <span>Erreur — Réessayer</span>
        </label>
      )}
    </div>
  );
}
