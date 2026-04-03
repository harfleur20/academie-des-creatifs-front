import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { fetchStudentDashboardSummary, type StudentDashboardSummary } from "../lib/commerceApi";

function useFocusMode(search: string) {
  return useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("focus");
  }, [search]);
}

function getFormatLabel(formatType: "live" | "ligne" | "presentiel") {
  if (formatType === "ligne") {
    return "Formation en ligne";
  }

  if (formatType === "presentiel") {
    return "Formation en presentiel";
  }

  return "Formation live";
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const focusMode = useFocusMode(location.search);
  const checkoutMessage =
    location.state &&
    typeof location.state === "object" &&
    "checkoutMessage" in location.state &&
    typeof location.state.checkoutMessage === "string"
      ? location.state.checkoutMessage
      : "";

  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentDashboardSummary()
      .then((nextSummary) => {
        setSummary(nextSummary);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Espace etudiant</p>
          <h1>Chargement de vos inscriptions...</h1>
        </section>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="page commerce-page">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Espace etudiant</p>
        <h1>Bienvenue {user?.full_name.split(" ")[0]}</h1>
        <p className="page-intro">
          Retrouvez ici vos formations actives, vos acces pedagogiques et votre
          progression selon le type de parcours achete.
        </p>
      </section>

      {checkoutMessage ? (
        <div className="dashboard-notice">
          <p>{checkoutMessage}</p>
        </div>
      ) : null}

      <div className="student-dashboard-grid">
        <article className="student-dashboard-card">
          <span>Code etudiant</span>
          <strong>{summary.student_code ?? "Non attribue pour le moment"}</strong>
        </article>
        <article className="student-dashboard-card">
          <span>Dashboards classiques</span>
          <strong>{summary.classic_enrollments_count}</strong>
        </article>
        <article className="student-dashboard-card">
          <span>Dashboards guides</span>
          <strong>{summary.guided_enrollments_count}</strong>
        </article>
        <article className="student-dashboard-card">
          <span>Live / Ligne / Presentiel</span>
          <strong>
            {summary.live_enrollments_count} / {summary.ligne_enrollments_count} /{" "}
            {summary.presentiel_enrollments_count}
          </strong>
        </article>
      </div>

      <section className={`student-enrollment-section ${focusMode === "classic" ? "is-focused" : ""}`}>
        <div className="student-enrollment-section__heading">
          <h2>Mes formations en ligne</h2>
          <Link to="/formations">Voir le catalogue</Link>
        </div>
        {summary.classic_enrollments.length > 0 ? (
          <div className="student-enrollment-grid">
            {summary.classic_enrollments.map((enrollment) => (
              <article className="student-enrollment-card" key={enrollment.id}>
                <img src={enrollment.image} alt={enrollment.formation_title} />
                <div className="student-enrollment-card__body">
                  <span>
                    {getFormatLabel(enrollment.format_type)} · {enrollment.session_label}
                  </span>
                  <h3>{enrollment.formation_title}</h3>
                  <p>Commande : {enrollment.order_reference}</p>
                  <Link
                    className="button button--primary"
                    to={`/espace/etudiant/classic/${enrollment.id}`}
                  >
                    Acceder au parcours
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-state">
            <p>Vous n'avez pas encore de formation en ligne active.</p>
          </div>
        )}
      </section>

      <section className={`student-enrollment-section ${focusMode === "guided" ? "is-focused" : ""}`}>
        <div className="student-enrollment-section__heading">
          <h2>Mes parcours guides</h2>
          <Link to="/formations">Decouvrir les offres</Link>
        </div>
        {summary.guided_enrollments.length > 0 ? (
          <div className="student-enrollment-grid">
            {summary.guided_enrollments.map((enrollment) => (
              <article className="student-enrollment-card" key={enrollment.id}>
                <img src={enrollment.image} alt={enrollment.formation_title} />
                <div className="student-enrollment-card__body">
                  <span>
                    {getFormatLabel(enrollment.format_type)} · {enrollment.session_label}
                  </span>
                  <h3>{enrollment.formation_title}</h3>
                  <p>
                    {enrollment.format_type === "presentiel"
                      ? `Code etudiant : ${enrollment.student_code ?? "A venir"}`
                      : `Commande : ${enrollment.order_reference}`}
                  </p>
                  <Link
                    className="button button--secondary"
                    to={`/espace/etudiant/guided/${enrollment.id}`}
                  >
                    {enrollment.format_type === "presentiel"
                      ? "Ouvrir le suivi scolaire"
                      : "Acceder au parcours guide"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-state">
            <p>Vous n'avez pas encore de parcours guide actif.</p>
          </div>
        )}
      </section>
    </div>
  );
}
