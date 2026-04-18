import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaChalkboardTeacher, FaMapMarkerAlt, FaUsers } from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import { fetchTeacherOverview, type TeacherOverview } from "../lib/teacherApi";

function statusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTeacherOverview()
      .then((nextOverview) => {
        setOverview(nextOverview);
      })
      .catch((nextError) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Impossible de charger l'espace enseignant.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Espace enseignant</p>
          <h1>Chargement de vos cohortes...</h1>
        </section>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Espace enseignant</p>
          <h1>Impossible de charger vos donnees.</h1>
          <p className="page-intro">{error || "Reessayez dans un instant."}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page commerce-page">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Espace enseignant</p>
        <h1>Bonjour {user?.full_name.split(" ")[0]}</h1>
        <p className="page-intro">
          Retrouvez ici vos cohortes attribuees, les sessions a venir et une
          vue rapide de votre charge pedagogique.
        </p>
      </section>

      <div className="teacher-overview-grid">
        <article className="teacher-overview-card">
          <span>Sessions attribuees</span>
          <strong>{overview.assigned_sessions_count}</strong>
        </article>
        <article className="teacher-overview-card">
          <span>Sessions ouvertes</span>
          <strong>{overview.open_sessions_count}</strong>
        </article>
        <article className="teacher-overview-card">
          <span>Sessions planifiees</span>
          <strong>{overview.planned_sessions_count}</strong>
        </article>
        <article className="teacher-overview-card">
          <span>Etudiants suivis</span>
          <strong>{overview.total_students_count}</strong>
        </article>
      </div>

      <section className="teacher-workspace">
        <div className="teacher-workspace__hero">
          <div>
            <p className="eyebrow">Prochaine intervention</p>
            <h2>{overview.next_session_label ?? "Aucune session attribuee pour le moment"}</h2>
            <p>
              L'espace enseignant est maintenant branche aux sessions
              presencielles affectees dans l'admin. La prochaine etape sera la
              saisie des notes et la gestion des travaux.
            </p>
          </div>
          <Link className="button button--secondary" to="/admin#admin-sessions">
            Voir la planification admin
          </Link>
        </div>

        {overview.sessions.length > 0 ? (
          <div className="teacher-session-grid">
            {overview.sessions.map((session) => (
              <article className="teacher-session-card" key={session.id}>
                <div className="teacher-session-card__top">
                  <span className={`admin-status admin-status--${session.status}`}>
                    {statusLabel(session.status)}
                  </span>
                  <strong>{session.label}</strong>
                </div>
                <h3>{session.formation_title}</h3>
                <ul className="teacher-session-card__meta">
                  <li>
                    <FaCalendarAlt />
                    <span>Debut: {session.start_date}</span>
                  </li>
                  <li>
                    <FaMapMarkerAlt />
                    <span>{session.campus_label}</span>
                  </li>
                  <li>
                    <FaUsers />
                    <span>
                      {session.enrolled_count}/{session.seat_capacity} etudiants
                    </span>
                  </li>
                </ul>
                <Link
                  to={`/espace/enseignant/session/${session.id}`}
                  className="button button--primary button--sm teacher-session-card__cta"
                >
                  <FaChalkboardTeacher /> Gérer la session
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-state">
            <p>Aucune session n'est encore affectee a votre compte enseignant.</p>
          </div>
        )}
      </section>
    </div>
  );
}
