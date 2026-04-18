import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaAward,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaIdCard,
  FaMapMarkerAlt,
  FaUsers,
} from "react-icons/fa";

import { fetchStudentEnrollments, type Enrollment } from "../lib/commerceApi";
import AiChatWidget from "../components/AiChatWidget";

export default function StudentGuidedWorkspacePage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentEnrollments()
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const enrollment = useMemo(() => {
    const id = Number.parseInt(enrollmentId ?? "", 10);
    if (!Number.isInteger(id)) return null;
    return enrollments.find((e) => e.id === id && e.dashboard_type === "guided") ?? null;
  }, [enrollmentId, enrollments]);

  useEffect(() => {
    if (!isLoading && !enrollment) {
      navigate("/espace/etudiant", { replace: true });
    }
  }, [enrollment, isLoading, navigate]);

  if (isLoading || !enrollment) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Parcours guidé</p>
          <h1>Chargement de votre parcours…</h1>
        </section>
      </div>
    );
  }

  const isPresentiel = enrollment.format_type === "presentiel";
  const isLive = enrollment.format_type === "live";

  return (
    <div className="page commerce-page">
      {/* ── Hero ── */}
      <section className="workspace-hero">
        <div className="workspace-hero__content">
          <p className="eyebrow">{isPresentiel ? "Parcours présentiel" : "Parcours live"}</p>
          <h1>{enrollment.formation_title}</h1>
          <p>
            {isPresentiel
              ? "Votre suivi scolaire centralisé : code étudiant, calendrier et jalons pédagogiques."
              : "Retrouvez ici vos sessions live, replays et jalons d'accompagnement."}
          </p>
          <div className="workspace-hero__actions">
            <Link className="button button--primary" to="/espace/etudiant?focus=guided">
              Retour à mes parcours
            </Link>
            <Link className="button button--secondary" to={`/formations/${enrollment.formation_slug}`}>
              Revoir la fiche
            </Link>
            {enrollment.status === "completed" && (
              <Link
                className="button button--accent wsp-cert-btn"
                to={`/espace/etudiant/certificat/${enrollment.id}`}
              >
                <FaAward /> Mon certificat
              </Link>
            )}
          </div>
        </div>
        <img src={enrollment.image} alt={enrollment.formation_title} />
      </section>

      {/* ── Info cards ── */}
      <div className="workspace-grid">
        {/* Format badge */}
        <article className="workspace-card">
          <span>Format</span>
          <strong>{isPresentiel ? "Présentiel" : "Live"}</strong>
          <p>
            {isPresentiel
              ? "Cours en salle avec encadrement direct."
              : "Sessions en direct avec replay disponible."}
          </p>
        </article>

        {/* Session / dates */}
        {enrollment.session_label ? (
          <article className="workspace-card workspace-card--icon">
            <span><FaCalendarAlt /> Session</span>
            <strong>{enrollment.session_label}</strong>
            <p>Calendrier officiel de votre cohorte.</p>
          </article>
        ) : (
          <article className="workspace-card">
            <span><FaCalendarAlt /> Session</span>
            <strong>À venir</strong>
            <p>La date de session sera communiquée prochainement.</p>
          </article>
        )}

        {/* Identifiant */}
        <article className="workspace-card">
          <span>
            {isPresentiel ? <><FaIdCard /> Code étudiant</> : <><FaIdCard /> Référence</>}
          </span>
          <strong className="wsp-code">
            {isPresentiel
              ? (enrollment.student_code ?? "En attente d'attribution")
              : enrollment.order_reference}
          </strong>
          <p>
            {isPresentiel
              ? "Communiquez ce code pour toute démarche administrative."
              : "Référence de commande rattachée à ce parcours."}
          </p>
        </article>
      </div>

      {/* ── Jalons pédagogiques ── */}
      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>{isPresentiel ? "Suivi scolaire" : "Jalons d'accompagnement"}</h2>
          <p>
            {isPresentiel
              ? "Les grandes étapes de votre parcours en présentiel."
              : "Les grandes étapes de votre accompagnement live."}
          </p>
        </div>

        <div className="wsp-milestones">
          {isPresentiel ? (
            <>
              <MilestoneItem
                icon={<FaIdCard />}
                num={1}
                title="Intégration & code étudiant"
                desc="Attribution de votre code étudiant et accès à l'espace de suivi administratif."
                done={!!enrollment.student_code}
              />
              <MilestoneItem
                icon={<FaCalendarAlt />}
                num={2}
                title="Calendrier & feuille de route"
                desc="Prise de connaissance du planning de cours, des horaires et des intervenants."
                done={!!enrollment.session_label}
              />
              <MilestoneItem
                icon={<FaChalkboardTeacher />}
                num={3}
                title="Cours & exercices"
                desc="Participation aux séances en salle, remise des exercices et corrections encadrées."
                done={false}
              />
              <MilestoneItem
                icon={<FaUsers />}
                num={4}
                title="Évaluation finale & badge"
                desc="Validation du parcours, délivrance du certificat et badge de niveau."
                done={false}
              />
            </>
          ) : (
            <>
              <MilestoneItem
                icon={<FaCalendarAlt />}
                num={1}
                title="Accès aux sessions live"
                desc="Rejoignez les sessions en direct via le lien communiqué par email avant chaque séance."
                done={!!enrollment.session_label}
              />
              <MilestoneItem
                icon={<FaChalkboardTeacher />}
                num={2}
                title="Replays & ressources"
                desc="Accès aux enregistrements et supports pédagogiques après chaque session."
                done={false}
              />
              <MilestoneItem
                icon={<FaUsers />}
                num={3}
                title="Corrections & projets guidés"
                desc="Retours personnalisés sur vos projets et exercices en groupe."
                done={false}
              />
              <MilestoneItem
                icon={<FaIdCard />}
                num={4}
                title="Rendu final & certification"
                desc="Soumission du projet final et obtention du certificat de parcours."
                done={false}
              />
            </>
          )}
        </div>
      </section>

      <AiChatWidget formationTitle={enrollment.formation_title} />

      {/* ── Contact bloc ── */}
      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>Besoin d'aide ?</h2>
          <p>Contactez l'équipe pédagogique pour toute question sur votre parcours.</p>
        </div>
        <div className="workspace-grid">
          <article className="workspace-card">
            <span><FaMapMarkerAlt /> Campus</span>
            <strong>{isPresentiel ? "Sur site" : "En ligne"}</strong>
            <p>
              {isPresentiel
                ? "Retrouvez les informations de localisation dans votre convocation."
                : "Accès 100 % à distance, lien envoyé par email."}
            </p>
          </article>
          <article className="workspace-card">
            <span>Référence commande</span>
            <strong className="wsp-code">{enrollment.order_reference}</strong>
            <p>À mentionner pour tout contact avec l'administration.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

/* ── Milestone card ── */
function MilestoneItem({
  icon,
  num,
  title,
  desc,
  done,
}: {
  icon: React.ReactNode;
  num: number;
  title: string;
  desc: string;
  done: boolean;
}) {
  return (
    <div className={`wsp-milestone${done ? " is-done" : ""}`}>
      <div className="wsp-milestone__num">{icon}</div>
      <div className="wsp-milestone__body">
        <div className="wsp-milestone__header">
          <span className="wsp-milestone__step">Étape {num}</span>
          {done && <span className="wsp-milestone__badge">Complété</span>}
        </div>
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>
    </div>
  );
}
