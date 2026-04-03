import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchStudentEnrollments, type Enrollment } from "../lib/commerceApi";

const classicModules = [
  "Introduction et prise en main du parcours",
  "Modules video et ressources telechargeables",
  "Quiz de validation et progression",
  "Projet final et badge de completion",
];

export default function StudentClassicWorkspacePage() {
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
        (item) => item.id === id && item.dashboard_type === "classic",
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
          <p className="eyebrow">Dashboard classique</p>
          <h1>Chargement de votre parcours...</h1>
        </section>
      </div>
    );
  }

  return (
    <div className="page commerce-page">
      <section className="workspace-hero">
        <div className="workspace-hero__content">
          <p className="eyebrow">Dashboard classique</p>
          <h1>{enrollment.formation_title}</h1>
          <p>
            Vous etes dans le flux `ligne`. Ce dashboard regroupe videos,
            chapitres, quiz, progression et ressources de travail.
          </p>
          <div className="workspace-hero__actions">
            <Link className="button button--primary" to="/espace/etudiant?focus=classic">
              Retour a mes parcours
            </Link>
            <Link className="button button--secondary" to={`/formations/${enrollment.formation_slug}`}>
              Revoir la fiche formation
            </Link>
          </div>
        </div>
        <img src={enrollment.image} alt={enrollment.formation_title} />
      </section>

      <div className="workspace-grid workspace-grid--classic">
        <article className="workspace-card">
          <span>Etat du parcours</span>
          <strong>Session active</strong>
          <p>{enrollment.session_label}</p>
        </article>
        <article className="workspace-card">
          <span>Progression</span>
          <strong>0%</strong>
          <p>Le tracking fin sera branche avec les modules et les quiz.</p>
        </article>
        <article className="workspace-card">
          <span>Quiz disponibles</span>
          <strong>4 checkpoints</strong>
          <p>Validation module par module avant badge final.</p>
        </article>
      </div>

      <section className="workspace-section">
        <div className="workspace-section__heading">
          <h2>Structure du parcours</h2>
          <p>Base actuelle du dashboard classique en attendant les contenus reels.</p>
        </div>
        <div className="workspace-module-list">
          {classicModules.map((module, index) => (
            <article className="workspace-module-card" key={module}>
              <span>Module {index + 1}</span>
              <strong>{module}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
