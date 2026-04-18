import { useEffect, useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, FileText, Link2, Plus,
  Trash2, Video, Image, X, HelpCircle, ClipboardList, FolderOpen,
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
  uploadTeacherAsset,
  type TeacherSession,
  type CourseView,
  type ChapterView,
  type LessonView,
  type LessonType,
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

export default function TeacherCoursesPage() {
  const [sessions, setSessions]                 = useState<TeacherSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courses, setCourses]                   = useState<CourseView[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [error, setError]                       = useState("");

  // Course creation form
  const [showCourseForm, setShowCourseForm]     = useState(false);
  const [courseTitle, setCourseTitle]           = useState("");
  const [courseDesc, setCourseDesc]             = useState("");
  const [savingCourse, setSavingCourse]         = useState(false);

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
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
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

  async function handleCreateCourse() {
    if (!selectedSessionId || !courseTitle.trim()) { setError("Titre requis."); return; }
    setSavingCourse(true); setError("");
    try {
      const course = await createCourse(selectedSessionId, { title: courseTitle.trim(), description: courseDesc.trim() });
      setCourses((p) => [...p, course]);
      setShowCourseForm(false); setCourseTitle(""); setCourseDesc("");
      setExpandedCourses((s) => new Set(s).add(course.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); }
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
    if (!lessonForm || !lessonForm.title.trim()) { setError("Titre requis."); return; }
    setSavingLesson(true); setError("");
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
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); }
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
            onClick={() => { setShowCourseForm((v) => !v); setError(""); }}>
            {showCourseForm ? <X size={15} /> : <Plus size={15} />}
            {showCourseForm ? "Annuler" : "Nouveau cours"}
          </button>
        </div>
      )}

      {error && <p className="dsh-error">{error}</p>}

      {/* ── New course form ── */}
      {showCourseForm && (
        <div className="dsh-form-card">
          <h3>Nouveau cours</h3>
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
            <button type="button" className="dsh-btn dsh-btn--ghost" onClick={() => { setShowCourseForm(false); setCourseTitle(""); setCourseDesc(""); }}>Annuler</button>
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

            {error && <p className="dsh-error" style={{ padding: "0 1.5rem" }}>{error}</p>}

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
