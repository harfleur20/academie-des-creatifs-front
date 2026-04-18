import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaChalkboardTeacher, FaMapMarkerAlt, FaUsers } from "react-icons/fa";
import { fetchTeacherOverview, type TeacherSession } from "../../lib/teacherApi";

type StatusFilter = "all" | "planned" | "open" | "completed" | "cancelled";

function statusLabel(status: string) {
  const map: Record<string, string> = {
    planned: "Planifiée", open: "Ouverte", completed: "Terminée", cancelled: "Annulée",
  };
  return map[status] ?? status;
}

export default function TeacherSessionsPage() {
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchTeacherOverview()
      .then((o) => setSessions(o.sessions))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement des sessions…</div>;
  if (error) return <div className="dsh-page-error">{error}</div>;

  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Mes sessions</h1>
        <p className="dsh-page__subtitle">{sessions.length} session{sessions.length !== 1 ? "s" : ""} assignée{sessions.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="dsh-filter-bar">
        {(["all", "planned", "open", "completed", "cancelled"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`dsh-filter-btn${filter === s ? " is-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "Toutes" : statusLabel(s)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="dsh-empty">
          <p>Aucune session{filter !== "all" ? ` avec le statut "${statusLabel(filter)}"` : ""} pour le moment.</p>
        </div>
      ) : (
        <div className="teacher-session-grid">
          {filtered.map((session) => (
            <article className="teacher-session-card" key={session.id}>
              <div className="teacher-session-card__top">
                <span className={`admin-status admin-status--${session.status}`}>
                  {statusLabel(session.status)}
                </span>
                <strong>{session.label}</strong>
              </div>
              <h3>{session.formation_title}</h3>
              <ul className="teacher-session-card__meta">
                <li><FaCalendarAlt /><span>Début : {session.start_date}</span></li>
                <li><FaMapMarkerAlt /><span>{session.campus_label}</span></li>
                <li><FaUsers /><span>{session.enrolled_count}/{session.seat_capacity} étudiants</span></li>
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
      )}
    </div>
  );
}
