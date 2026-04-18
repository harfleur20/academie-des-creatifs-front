import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaVideo, FaMapMarkerAlt, FaExternalLinkAlt } from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import {
  fetchStudentDashboardSummary,
  fetchMySessions,
  type StudentDashboardSummary,
  type StudentSession,
} from "../lib/commerceApi";

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

function buildCalendarUrl(session: StudentSession): string {
  const fmt = (d: string) => d.replace(/-/g, "");
  const start = fmt(session.start_date);
  const end = fmt(session.end_date);
  const title = encodeURIComponent(`${session.formation_title} — ${session.label}`);
  const details = encodeURIComponent(session.meeting_link ? `Lien : ${session.meeting_link}` : "");
  const location = encodeURIComponent(session.campus_label ?? session.meeting_link ?? "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function sessionStatusLabel(status: string): { label: string; cls: string } {
  if (status === "open") return { label: "Ouverte", cls: "session-status--open" };
  if (status === "completed") return { label: "Terminée", cls: "session-status--done" };
  if (status === "planned") return { label: "Planifiée", cls: "session-status--planned" };
  return { label: status, cls: "" };
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const focusMode = useFocusMode(location.search);
  const checkoutMessage =
    location.state &&
    typeof location.state === "object" &&
    "checkoutMessage" in location.state &&
    typeof location.state.checkoutMessage === "string"
      ? location.state.checkoutMessage
      : "";

  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStudentDashboardSummary(), fetchMySessions()])
      .then(([nextSummary, nextSessions]) => {
        setSummary(nextSummary);
        setSessions(nextSessions);
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

      {sessions.length > 0 && (
        <section className="student-enrollment-section student-sessions-section">
          <div className="student-enrollment-section__heading">
            <h2>Mes sessions programmées</h2>
          </div>
          <div className="student-sessions-list">
            {sessions.map((session) => {
              const { label: statusLabel, cls: statusCls } = sessionStatusLabel(session.status);
              return (
                <article className="student-session-card" key={session.id}>
                  <div className="student-session-card__left">
                    <span className={`session-status ${statusCls}`}>{statusLabel}</span>
                    <h3>{session.formation_title}</h3>
                    <p className="student-session-card__label">{session.label}</p>
                    <div className="student-session-card__meta">
                      <span>
                        <FaCalendarAlt />
                        {new Date(session.start_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {" → "}
                        {new Date(session.end_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {session.teacher_name && (
                        <span>{session.teacher_name}</span>
                      )}
                      {session.campus_label && (
                        <span>
                          <FaMapMarkerAlt />
                          {session.campus_label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="student-session-card__actions">
                    {session.meeting_link && (
                      session.format_type === "live" ? (
                        <button
                          className="button button--primary button--sm"
                          onClick={() => navigate(`/live/${session.id}`)}
                        >
                          <FaVideo />
                          Rejoindre
                        </button>
                      ) : (
                        <a
                          className="button button--primary button--sm"
                          href={session.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaVideo />
                          Rejoindre
                        </a>
                      )
                    )}
                    <a
                      className="button button--secondary button--sm"
                      href={buildCalendarUrl(session)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaExternalLinkAlt />
                      Ajouter au calendrier
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

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
