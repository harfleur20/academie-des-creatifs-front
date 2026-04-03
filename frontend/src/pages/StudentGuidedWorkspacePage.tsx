import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchStudentEnrollments, type Enrollment } from "../lib/commerceApi";

const liveMilestones = [
  "Acces aux lives et replays",
  "Corrections de projets guidees",
  "Checkpoints de progression",
  "Preparation du rendu final",
];

const presentielMilestones = [
  "Code etudiant et suivi administratif",
  "Calendrier de cours et feuilles de route",
  "Notes, exercices et evaluations",
  "Rappels de scolarite et badge de niveau",
];

export default function StudentGuidedWorkspacePage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentEnrollments()
      .then((nextEnrollments) => {
        setEnrollments(nextEnrollments);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const enrollment = useMemo(() => {
    const id = Number.parseInt(enrollmentId ?? "", 10);
    if (!Number.isInteger(id)) {
      return null;
    }
    return (
      enrollments.find(
        (item) => item.id === id && item.dashboard_type === "guided",
      ) ?? null
    );
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
          <p className="eyebrow">Dashboard guide</p>
          <h1>Chargement de votre parcours...</h1>
        </section>
      </div>
    );
  }

  const milestones =
    enrollment.format_type === "presentiel"
      ? presentielMilestones
      : liveMilestones;

  return (
    <div className="page commerce-page">
      <section className="workspace-hero">
        <div className="workspace-hero__content">
          <p className="eyebrow">Dashboard guide</p>
          <h1>{enrollment.formation_title}</h1>
          <p>
            Ce parcours suit la logique guidee utilisee pour `live` et
            `presentiel`, avec un suivi plus encadre et des jalons pedagogiques.
          </p>
          <div className="workspace-hero__actions">
            <Link className="button button--primary" to="/espace/etudiant?focus=guided">
              Retour a mes parcours
            </Link>
            <Link className="button button--secondary" to={`/formations/${enrollment.formation_slug}`}>
              Revoir la fiche formation
            </Link>
          </div>
        </div>
        <img src={enrollment.image} alt={enrollment.formation_title} />
      </section>

      <div className="workspace-grid">
        <article className="workspace-card">
          <span>Format</span>
          <strong>{enrollment.format_type === "presentiel" ? "Presentiel" : "Live"}</strong>
          <p>{enrollment.session_label}</p>
        </article>
        <article className="workspace-card">
          <span>Reference</span>
          <strong>
            {enrollment.format_type === "presentiel"
              ? enrollment.student_code ?? "Code en attente"
              : enrollment.order_reference}
          </strong>
          <p>
            {enrollment.format_type === "presentiel"
              ? "Identifiant etudiant utilise pour le suivi scolaire."
              : "Reference de commande rattachee au parcours live."}
          </p>
        </article>
        <article className="workspace-card">
          <span>Statut</span>
          <strong>{enrollment.status}</strong>
          <p>La suite du suivi detaille sera branchee sur les notes et checkpoints.</p>
        </article>
      </div>

      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>{enrollment.format_type === "presentiel" ? "Suivi scolaire" : "Roadmap d'accompagnement"}</h2>
          <p>
            Le dashboard guide est en place et differencie deja les parcours
            `live` et `presentiel`.
          </p>
        </div>
        <div className="workspace-module-list">
          {milestones.map((item, index) => (
            <article className="workspace-module-card" key={item}>
              <span>Etape {index + 1}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
