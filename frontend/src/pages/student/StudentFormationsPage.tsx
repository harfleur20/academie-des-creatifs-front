import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudentDashboardSummary, type StudentDashboardSummary } from "../../lib/commerceApi";

type Filter = "tous" | "ligne" | "guidé";

const FORMAT_LABEL: Record<string, string> = {
  live: "Live",
  ligne: "En ligne",
  presentiel: "Présentiel",
};

const FORMAT_COLOR: Record<string, string> = {
  live: "blue",
  ligne: "green",
  presentiel: "yellow",
};

export default function StudentFormationsPage() {
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("tous");

  useEffect(() => {
    fetchStudentDashboardSummary().then(setSummary).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;
  if (!summary) return null;

  const classic = summary.classic_enrollments.map((e) => ({ ...e, _type: "classic" as const }));
  const guided  = summary.guided_enrollments.map((e) => ({ ...e, _type: "guided" as const }));
  const all = [...classic, ...guided];

  const visible = filter === "tous"   ? all
                : filter === "ligne"  ? classic
                : guided;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Mes parcours</h1>
        <p className="dsh-page__subtitle">{all.length} parcours actif{all.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="stp-filters">
        {(["tous", "ligne", "guidé"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`stp-filter-btn${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "tous" ? `Tous (${all.length})` : f === "ligne" ? `En ligne (${classic.length})` : `Guidés (${guided.length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="dsh-empty">
          <p>Aucun parcours dans cette catégorie.</p>
          <Link to="/formations" className="dsh-btn dsh-btn--primary">Découvrir les offres</Link>
        </div>
      ) : (
        <div className="student-enrollment-grid">
          {visible.map((enrollment) => (
            <article className="student-enrollment-card" key={`${enrollment._type}-${enrollment.id}`}>
              <img src={enrollment.image} alt={enrollment.formation_title} />
              <div className="student-enrollment-card__body">
                <div className="stp-card-meta">
                  <span className={`dsh-badge dsh-badge--${FORMAT_COLOR[enrollment.format_type] ?? "gray"}`}>
                    {FORMAT_LABEL[enrollment.format_type] ?? enrollment.format_type}
                  </span>
                  <span className={`dsh-badge dsh-badge--${enrollment._type === "guided" ? "blue" : "gray"}`}>
                    {enrollment._type === "guided" ? "Guidé" : "Autonome"}
                  </span>
                </div>
                <h3>{enrollment.formation_title}</h3>
                <p>{enrollment.session_label || "Session à venir"}</p>
                {enrollment._type === "classic" ? (
                  <Link className="button button--secondary stp-card-btn" to={`/espace/etudiant/classic/${enrollment.id}`}>
                    Accéder au parcours
                  </Link>
                ) : (
                  <Link className="button button--secondary stp-card-btn" to={`/espace/etudiant/guided/${enrollment.id}`}>
                    {enrollment.format_type === "presentiel" ? "Ouvrir le suivi scolaire" : "Accéder au parcours guidé"}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
