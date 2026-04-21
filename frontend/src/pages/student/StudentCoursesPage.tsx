import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, CheckCircle, ChevronDown, ChevronRight, ClipboardList, FileText, FolderOpen, HelpCircle, Video } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchMyCourses, completeLesson, type StudentCourse, type StudentLesson } from "../../lib/studentApi";

const LESSON_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  text:       { label: "Cours",     icon: <BookOpen size={13} />,      color: "#6366f1" },
  video:      { label: "Vidéo",     icon: <Video size={13} />,         color: "#8b5cf6" },
  pdf:        { label: "PDF",       icon: <FileText size={13} />,      color: "#ef4444" },
  quiz:       { label: "Quiz",      icon: <HelpCircle size={13} />,    color: "#f59e0b" },
  assignment: { label: "Devoir",    icon: <ClipboardList size={13} />, color: "#0ea5e9" },
  resource:   { label: "Ressource", icon: <FolderOpen size={13} />,    color: "#10b981" },
};

type CourseGroup = {
  key: string;
  formation_title: string;
  session_label: string;
  courses: StudentCourse[];
};

export default function StudentCoursesPage() {
  const [courses, setCourses]             = useState<StudentCourse[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [expandedCourses, setExpandedCourses]   = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [activeLesson, setActiveLesson]   = useState<StudentLesson | null>(null);
  const [completing, setCompleting]       = useState<number | null>(null);

  const courseGroups = useMemo<CourseGroup[]>(() => {
    const groups = new Map<string, CourseGroup>();
    for (const course of courses) {
      const key = `${course.session_id}:${course.formation_id}`;
      const group = groups.get(key);
      if (group) {
        group.courses.push(course);
        continue;
      }

      groups.set(key, {
        key,
        formation_title: course.formation_title || course.title,
        session_label: course.session_label,
        courses: [course],
      });
    }
    return Array.from(groups.values());
  }, [courses]);

  useEffect(() => {
    fetchMyCourses()
      .then((list) => {
        setCourses(list);
        if (list.length > 0) {
          setExpandedCourses(new Set([list[0].id]));
          if (list[0].chapters.length > 0) setExpandedChapters(new Set([list[0].chapters[0].id]));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleComplete(lesson: StudentLesson) {
    if (lesson.is_completed || completing === lesson.id) return;
    setCompleting(lesson.id);
    try {
      await completeLesson(lesson.id);
      const refreshedCourses = await fetchMyCourses();
      setCourses(refreshedCourses);
      if (activeLesson?.id === lesson.id) {
        const updatedLesson = refreshedCourses
          .flatMap((course) => course.chapters)
          .flatMap((ch) => ch.lessons)
          .find((l) => l.id === lesson.id);
        if (updatedLesson) setActiveLesson(updatedLesson);
      }
    } finally {
      setCompleting(null);
    }
  }

  function toggleCourse(id: number) {
    setExpandedCourses((s) => { const n = new Set(s); s.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleChapter(id: number) {
    setExpandedChapters((s) => { const n = new Set(s); s.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  if (courses.length === 0) return (
    <div className="dsh-page">
      <div className="dsh-page__header"><h1>Mes cours</h1></div>
      <div className="dsh-empty"><p>Aucun cours disponible pour vos sessions actuelles.</p></div>
    </div>
  );

  return (
    <div className="dsh-page cv-layout">
      {/* ── Left panel: course tree ── */}
      <aside className="cv-sidebar">
        <h2 className="cv-sidebar__title">Mes formations</h2>
        {courseGroups.map((group) => (
          <section className="cv-formation-block" key={group.key}>
            <div className="cv-formation-head">
              <span className="cv-formation-head__label">{group.session_label || "Session en cours"}</span>
              <strong>{group.formation_title}</strong>
            </div>

            {group.courses.map((course) => {
              const isOpen = expandedCourses.has(course.id);
              return (
                <div className="cv-course-block" key={course.id}>
                  <div className="cv-progress-row" onClick={() => toggleCourse(course.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && toggleCourse(course.id)}>
                    <span className="cv-progress-row__caret">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <div className="cv-progress-row__info">
                      <strong>{course.title}</strong>
                      <div className="cv-progress-bar">
                        <div className="cv-progress-bar__fill" style={{ width: `${course.progress_pct}%` }} />
                      </div>
                      <span className="cv-progress-row__pct">{course.completed_lessons}/{course.total_lessons} leçons · {course.progress_pct}%</span>
                    </div>
                  </div>

                  {isOpen && course.chapters.map((chapter) => {
                    const chOpen = expandedChapters.has(chapter.id);
                    const allDone = chapter.lessons.length > 0 && chapter.lessons.every((l) => l.is_completed);
                    return (
                      <div className="cv-chapter-block" key={chapter.id}>
                        <div className="cv-chapter-header" onClick={() => toggleChapter(chapter.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && toggleChapter(chapter.id)}>
                          <span className="cv-chapter-header__caret">{chOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                          <span className={`cv-chapter-header__title${allDone ? " is-done" : ""}`}>{chapter.title}</span>
                          {allDone && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                        </div>
                        {chOpen && chapter.lessons.map((lesson) => {
                          const meta = LESSON_TYPE_META[lesson.lesson_type] ?? LESSON_TYPE_META.text;
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <button
                              key={lesson.id}
                              type="button"
                              className={`cv-lesson-item${isActive ? " is-active" : ""}${lesson.is_completed ? " is-done" : ""}`}
                              onClick={() => setActiveLesson(lesson)}
                            >
                              <span className="cv-lesson-item__check">
                                {lesson.is_completed
                                  ? <CheckCircle size={13} style={{ color: "#22c55e" }} />
                                  : <span className="cv-lesson-item__dot" style={{ background: meta.color }} />}
                              </span>
                              <span className="cv-lesson-item__label">{lesson.title}</span>
                              <span className="cv-lesson-item__type" style={{ color: meta.color }}>{meta.icon}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        ))}
      </aside>

      {/* ── Right panel: lesson content ── */}
      <main className="cv-content">
        {!activeLesson ? (
          <div className="cv-welcome">
            <BookOpen size={40} style={{ color: "#d1d5db" }} />
            <p>Sélectionnez une leçon dans le menu pour commencer.</p>
          </div>
        ) : (
          <LessonViewer lesson={activeLesson} onComplete={() => handleComplete(activeLesson)} completing={completing === activeLesson.id} />
        )}
      </main>
    </div>
  );
}

function LessonViewer({ lesson, onComplete, completing }: {
  lesson: StudentLesson;
  onComplete: () => void;
  completing: boolean;
}) {
  const meta = LESSON_TYPE_META[lesson.lesson_type] ?? LESSON_TYPE_META.text;

  return (
    <article className="cv-lesson-viewer">
      <header className="cv-lesson-viewer__header">
        <span className="cv-lesson-viewer__type-badge" style={{ background: meta.color + "1a", color: meta.color }}>
          {meta.icon} {meta.label}
        </span>
        <h2 className="cv-lesson-viewer__title">{lesson.title}</h2>
      </header>

      <div className="cv-lesson-viewer__body">
        {/* TEXT */}
        {lesson.lesson_type === "text" && lesson.content && (
          <div className="cv-text-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {lesson.content}
            </ReactMarkdown>
          </div>
        )}

        {/* VIDEO */}
        {lesson.lesson_type === "video" && (
          lesson.video_url?.includes("youtube.com") || lesson.video_url?.includes("youtu.be") || lesson.video_url?.includes("vimeo.com") ? (
            <div className="cv-video-embed">
              <iframe
                src={toEmbedUrl(lesson.video_url ?? "")}
                title={lesson.title}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : lesson.video_url ? (
            <video src={lesson.video_url} controls className="cv-video-native" />
          ) : (
            <p className="cv-empty-state">Aucune vidéo attachée.</p>
          )
        )}

        {/* PDF */}
        {lesson.lesson_type === "pdf" && (
          lesson.file_url ? (
            <div className="cv-pdf-block">
              <FileText size={32} style={{ color: "#ef4444" }} />
              <p>Document PDF</p>
              <a href={lesson.file_url} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--primary">
                Ouvrir le PDF
              </a>
            </div>
          ) : <p className="cv-empty-state">Aucun fichier attaché.</p>
        )}

        {/* QUIZ */}
        {lesson.lesson_type === "quiz" && (
          <div className="cv-linked-block">
            <HelpCircle size={28} style={{ color: "#f59e0b" }} />
            <strong>{lesson.quiz_title ?? "Quiz"}</strong>
            <p>Rendez-vous dans l'onglet <strong>Mes quizz</strong> pour passer ce quiz.</p>
            <a href="/espace/etudiant/quizz" className="dsh-btn dsh-btn--primary">Aller aux quizz</a>
          </div>
        )}

        {/* ASSIGNMENT */}
        {lesson.lesson_type === "assignment" && (
          <div className="cv-linked-block">
            <ClipboardList size={28} style={{ color: "#0ea5e9" }} />
            <strong>{lesson.assignment_title ?? "Devoir"}</strong>
            <p>Rendez-vous dans l'onglet <strong>Devoirs</strong> pour déposer le fichier et échanger avec le formateur.</p>
            <a href="/espace/etudiant/devoirs" className="dsh-btn dsh-btn--primary">Aller aux devoirs</a>
          </div>
        )}

        {/* RESOURCE */}
        {lesson.lesson_type === "resource" && (
          <div className="cv-linked-block">
            <FolderOpen size={28} style={{ color: "#10b981" }} />
            <strong>{lesson.resource_title ?? "Ressource"}</strong>
            <p>Retrouvez cette ressource dans l'onglet <strong>Ressources</strong>.</p>
            <a href="/espace/etudiant/ressources" className="dsh-btn dsh-btn--primary">Aller aux ressources</a>
          </div>
        )}

        <LessonExtras lesson={lesson} />
      </div>

      <footer className="cv-lesson-viewer__footer">
        {lesson.is_completed ? (
          <span className="cv-done-badge"><CheckCircle size={15} /> Leçon complétée</span>
        ) : (
          <button type="button" className="dsh-btn dsh-btn--primary" disabled={completing} onClick={onComplete}>
            {completing ? "Enregistrement…" : <><Award size={14} /> Marquer comme terminé</>}
          </button>
        )}
      </footer>
    </article>
  );
}

function LessonExtras({ lesson }: { lesson: StudentLesson }) {
  const extras = [
    lesson.lesson_type !== "resource" && lesson.resource_id ? {
      key: "resource",
      icon: <FolderOpen size={16} />,
      title: lesson.resource_title ?? "Ressource associée",
      copy: "Consultez cette ressource pour approfondir la leçon.",
      href: "/espace/etudiant/ressources",
      action: "Voir la ressource",
    } : null,
    lesson.lesson_type !== "quiz" && lesson.quiz_id ? {
      key: "quiz",
      icon: <HelpCircle size={16} />,
      title: lesson.quiz_title ?? "Quiz associé",
      copy: "Testez votre compréhension avec ce quiz.",
      href: "/espace/etudiant/quizz",
      action: "Passer le quiz",
    } : null,
    lesson.lesson_type !== "assignment" && lesson.assignment_id ? {
      key: "assignment",
      icon: <ClipboardList size={16} />,
      title: lesson.assignment_title ?? "Exercice / devoir associé",
      copy: "Réalisez l'exercice demandé et déposez votre rendu.",
      href: "/espace/etudiant/devoirs",
      action: "Voir le devoir",
    } : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: React.ReactNode;
    title: string;
    copy: string;
    href: string;
    action: string;
  }>;

  if (extras.length === 0) return null;

  return (
    <section className="cv-lesson-extras">
      <h3>Ressources et exercices</h3>
      <div className="cv-lesson-extras__grid">
        {extras.map((extra) => (
          <a className="cv-lesson-extra" href={extra.href} key={extra.key}>
            <span className={`cv-lesson-extra__icon cv-lesson-extra__icon--${extra.key}`}>{extra.icon}</span>
            <strong>{extra.title}</strong>
            <span>{extra.copy}</span>
            <em>{extra.action}</em>
          </a>
        ))}
      </div>
    </section>
  );
}

function toEmbedUrl(url: string): string {
  if (url.includes("youtube.com/watch")) return url.replace("watch?v=", "embed/").split("&")[0];
  if (url.includes("youtu.be/")) return url.replace("youtu.be/", "www.youtube.com/embed/");
  if (url.includes("vimeo.com/")) return url.replace("vimeo.com/", "player.vimeo.com/video/");
  return url;
}
