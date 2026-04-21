import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaAward, FaCheckCircle, FaChevronDown, FaChevronUp, FaRegCircle } from "react-icons/fa";
import { CalendarCheck, TrendingUp, Layers } from "lucide-react";

import { fetchStudentEnrollments, type Enrollment } from "../lib/commerceApi";
import {
  fetchEnrollmentProgress,
  fetchPublicFormation,
  toggleLessonCompletion,
  type EnrollmentProgress,
  type FormationModule,
} from "../lib/catalogApi";
import AiChatWidget from "../components/AiChatWidget";
import AssignedTeacherCard from "../components/AssignedTeacherCard";

export default function StudentClassicWorkspacePage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [modules, setModules] = useState<FormationModule[]>([]);
  const [progress, setProgress] = useState<EnrollmentProgress | null>(null);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set([0]));
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const enrollment = useMemo(() => {
    const id = Number.parseInt(enrollmentId ?? "", 10);
    if (!Number.isInteger(id)) return null;
    return enrollments.find((e) => e.id === id && e.dashboard_type === "classic") ?? null;
  }, [enrollmentId, enrollments]);

  useEffect(() => {
    fetchStudentEnrollments()
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!enrollment) return;
    const id = enrollment.id;
    Promise.all([
      fetchPublicFormation(enrollment.formation_slug).then((f) => setModules(f.modules ?? [])),
      fetchEnrollmentProgress(id).then(setProgress),
    ]).catch(() => {});
  }, [enrollment]);

  useEffect(() => {
    if (!isLoading && !enrollment) {
      navigate("/espace/etudiant", { replace: true });
    }
  }, [enrollment, isLoading, navigate]);

  const isLessonDone = useCallback(
    (mi: number, li: number) =>
      progress?.completed.some((k) => k.module_index === mi && k.lesson_index === li) ?? false,
    [progress],
  );

  const handleToggle = useCallback(
    async (mi: number, li: number) => {
      if (!enrollment) return;
      const key = `${mi}-${li}`;
      setTogglingKey(key);
      try {
        const next = await toggleLessonCompletion(enrollment.id, mi, li);
        setProgress(next);
      } finally {
        setTogglingKey(null);
      }
    },
    [enrollment],
  );

  const toggleModule = (mi: number) => {
    setActiveModuleIndex(mi);
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(mi)) next.delete(mi);
      else next.add(mi);
      return next;
    });
  };

  if (isLoading || !enrollment) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Parcours en ligne</p>
          <h1>Chargement de votre parcours…</h1>
        </section>
      </div>
    );
  }

  const pct = progress?.progress_pct ?? 0;
  const completedCount = progress?.completed_count ?? 0;
  const totalLessons = progress?.total_lessons ?? 0;

  return (
    <div className="page commerce-page">
      {/* ── Hero ── */}
      <section className="workspace-hero">
        <div className="workspace-hero__content">
          <p className="eyebrow">Parcours en ligne</p>
          <h1>{enrollment.formation_title}</h1>
          <p>
            Progressez à votre rythme. Cochez chaque leçon terminée pour suivre
            votre avancement en temps réel.
          </p>
          <div className="workspace-hero__actions">
            <Link className="button button--primary" to="/espace/etudiant?focus=classic">
              Retour à mes parcours
            </Link>
            <Link className="button button--secondary" to={`/formations/${enrollment.formation_slug}`}>
              Revoir la fiche
            </Link>
            {pct === 100 && (
              <Link
                className="button button--accent wsp-cert-btn"
                to={`/espace/etudiant/certificat/${enrollment.id}`}
              >
                <FaAward /> Mon certificat
              </Link>
            )}
            {(enrollment.session_id || enrollment.assigned_teacher) && (
              <AssignedTeacherCard teacher={enrollment.assigned_teacher} />
            )}
          </div>
        </div>
        <img src={enrollment.image} alt={enrollment.formation_title} />
      </section>

      {/* ── KPI row ── */}
      <div className="workspace-grid workspace-grid--classic">
        <article className="workspace-card workspace-card--blue">
          <span><CalendarCheck size={14} /> Session</span>
          <strong>{enrollment.session_label || "Accès immédiat"}</strong>
          <p>État du parcours</p>
          <span className="workspace-card__bg-icon" aria-hidden><CalendarCheck size={52} /></span>
        </article>
        <article className="workspace-card workspace-card--purple workspace-card--progress">
          <span><TrendingUp size={14} /> Progression</span>
          <strong style={{ color: pct === 100 ? "#22c55e" : undefined }}>{pct}%</strong>
          <div className="wsp-progress-bar">
            <div className="wsp-progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <p>{completedCount} / {totalLessons} leçon{totalLessons !== 1 ? "s" : ""} complétée{totalLessons !== 1 ? "s" : ""}</p>
          <span className="workspace-card__bg-icon" aria-hidden><TrendingUp size={52} /></span>
        </article>
        <article className="workspace-card workspace-card--green">
          <span><Layers size={14} /> Modules</span>
          <strong>{modules.length}</strong>
          <p>{modules.reduce((a, m) => a + m.lessons.length, 0)} leçons au total</p>
          <span className="workspace-card__bg-icon" aria-hidden><Layers size={52} /></span>
        </article>
      </div>

      {/* ── Modules accordion ── */}
      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>Contenu du parcours</h2>
          <p>Cliquez sur un module pour le déplier, puis cochez les leçons au fur et à mesure.</p>
        </div>

        {modules.length === 0 ? (
          <p className="adm-empty" style={{ padding: "1rem 0" }}>
            Le contenu de cette formation n'est pas encore disponible.
          </p>
        ) : (
          <div className="wsp-accordion">
            {modules.map((mod, mi) => {
              const modDone = mod.lessons.filter((_, li) => isLessonDone(mi, li)).length;
              const modTotal = mod.lessons.length;
              const isOpen = openModules.has(mi);
              return (
                <div key={mi} className={`wsp-accordion__item${isOpen ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="wsp-accordion__header"
                    onClick={() => toggleModule(mi)}
                  >
                    <div className="wsp-accordion__header-left">
                      <span className="wsp-module-num">Module {mi + 1}</span>
                      <div>
                        <strong className="wsp-module-title">{mod.title}</strong>
                        {mod.duration && (
                          <span className="wsp-module-duration">{mod.duration}</span>
                        )}
                      </div>
                    </div>
                    <div className="wsp-accordion__header-right">
                      <span className={`wsp-module-count${modDone === modTotal && modTotal > 0 ? " is-done" : ""}`}>
                        {modDone}/{modTotal}
                      </span>
                      {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="wsp-accordion__body">
                      {mod.summary && (
                        <p className="wsp-module-summary">{mod.summary}</p>
                      )}
                      <ul className="wsp-lesson-list">
                        {mod.lessons.map((lesson, li) => {
                          const done = isLessonDone(mi, li);
                          const key = `${mi}-${li}`;
                          const busy = togglingKey === key;
                          return (
                            <li key={li} className={`wsp-lesson${done ? " is-done" : ""}`}>
                              <button
                                type="button"
                                className="wsp-lesson__check"
                                onClick={() => handleToggle(mi, li)}
                                disabled={busy}
                                aria-label={done ? "Marquer comme non fait" : "Marquer comme fait"}
                              >
                                {done
                                  ? <FaCheckCircle className="wsp-check-icon wsp-check-icon--done" />
                                  : <FaRegCircle className="wsp-check-icon" />
                                }
                              </button>
                              <span className="wsp-lesson__title">{lesson}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AiChatWidget
        formationTitle={enrollment.formation_title}
        enrollmentId={enrollment.id}
        moduleTitle={modules[activeModuleIndex]?.title}
        panelSubtitle={enrollment.session_label || "Modules et progression"}
        introTitle="Je peux vous aider a vous repérer dans votre formation."
        introText="Demandez ou vous en etes, quel module reprendre ou comment valider votre parcours."
        suggestions={[
          "Ou en est ma progression ?",
          "Quel module dois-je continuer maintenant ?",
          "Comment obtenir mon certificat ?",
        ]}
      />
    </div>
  );
}
