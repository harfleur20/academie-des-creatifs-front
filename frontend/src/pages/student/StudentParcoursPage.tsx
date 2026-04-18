import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudentDashboardSummary, type StudentDashboardSummary } from "../../lib/commerceApi";

function formatLabel(type: string) {
  return { live: "Live", ligne: "En ligne", presentiel: "Présentiel" }[type] ?? type;
}

export default function StudentParcoursPage() {
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentDashboardSummary().then(setSummary).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;
  if (!summary) return null;

  const enrollments = summary.guided_enrollments;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Parcours guidés</h1>
        <p className="dsh-page__subtitle">
          {enrollments.length} parcours{enrollments.length !== 1 ? "" : ""} actif{enrollments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="dsh-empty">
          <p>Vous n'avez pas encore de parcours guidé actif.</p>
          <Link to="/formations" className="dsh-btn dsh-btn--primary">Découvrir les offres</Link>
        </div>
      ) : (
        <div className="student-enrollment-grid">
          {enrollments.map((enrollment) => (
            <article className="student-enrollment-card" key={enrollment.id}>
              <img src={enrollment.image} alt={enrollment.formation_title} />
              <div className="student-enrollment-card__body">
                <span>{formatLabel(enrollment.format_type)} · {enrollment.session_label}</span>
                <h3>{enrollment.formation_title}</h3>
                <p>
                  {enrollment.format_type === "presentiel"
                    ? `Code étudiant : ${enrollment.student_code ?? "À venir"}`
                    : `Commande : ${enrollment.order_reference}`}
                </p>
                <Link className="button button--secondary" to={`/espace/etudiant/guided/${enrollment.id}`}>
                  {enrollment.format_type === "presentiel" ? "Ouvrir le suivi scolaire" : "Accéder au parcours guidé"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
