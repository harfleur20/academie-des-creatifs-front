import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudentDashboardSummary, type StudentDashboardSummary } from "../../lib/commerceApi";

export default function StudentFormationsPage() {
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentDashboardSummary().then(setSummary).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;
  if (!summary) return null;

  const enrollments = summary.classic_enrollments;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Formations en ligne</h1>
        <p className="dsh-page__subtitle">
          {enrollments.length} formation{enrollments.length !== 1 ? "s" : ""} active{enrollments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="dsh-empty">
          <p>Vous n'avez pas encore de formation en ligne active.</p>
          <Link to="/formations" className="dsh-btn dsh-btn--primary">Voir le catalogue</Link>
        </div>
      ) : (
        <div className="student-enrollment-grid">
          {enrollments.map((enrollment) => (
            <article className="student-enrollment-card" key={enrollment.id}>
              <img src={enrollment.image} alt={enrollment.formation_title} />
              <div className="student-enrollment-card__body">
                <span>{enrollment.format_type === "ligne" ? "En ligne" : "Live"} · {enrollment.session_label}</span>
                <h3>{enrollment.formation_title}</h3>
                <p>Commande : {enrollment.order_reference}</p>
                <Link className="button button--primary" to={`/espace/etudiant/classic/${enrollment.id}`}>
                  Accéder au parcours
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
