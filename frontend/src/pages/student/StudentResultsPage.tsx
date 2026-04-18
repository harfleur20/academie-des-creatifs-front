import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { fetchStudentEnrollments, type Enrollment } from "../../lib/commerceApi";
import {
  fetchEnrollmentResults,
  type StudentEnrollmentResults,
} from "../../lib/studentApi";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présent", absent: "Absent", late: "En retard", excused: "Excusé",
};
const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#22c55e", absent: "#ef4444", late: "#f59e0b", excused: "#6366f1",
};

export default function StudentResultsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [results, setResults] = useState<StudentEnrollmentResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchStudentEnrollments()
      .then((list) => {
        setEnrollments(list);
        const first = list.find((e) => e.format_type === "presentiel" || e.format_type === "live");
        if (first) setSelectedId(first.id);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    fetchEnrollmentResults(selectedId)
      .then(setResults)
      .catch(() => setResults(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const guidedEnrollments = enrollments.filter(
    (e) => e.format_type === "presentiel" || e.format_type === "live",
  );
  const allEnrollments = enrollments;

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Mes résultats</h1>
        <p className="dsh-page__subtitle">Notes, présences et certificats.</p>
      </div>

      {/* Certificates section */}
      <section className="dsh-section">
        <h2 className="dsh-section__title">Certificats disponibles</h2>
        {allEnrollments.length === 0 ? (
          <div className="dsh-empty dsh-empty--inline"><p>Aucun certificat disponible pour l'instant.</p></div>
        ) : (
          <div className="dsh-list">
            {allEnrollments.map((e) => (
              <div className="dsh-list-item" key={e.id}>
                <div className="dsh-list-item__icon"><Award size={18} style={{ color: "#f59e0b" }} /></div>
                <div className="dsh-list-item__main">
                  <strong>{e.formation_title}</strong>
                  <span className="dsh-list-item__meta">
                    {e.session_label} ·{" "}
                    {e.status === "completed"
                      ? "Parcours validé"
                      : e.dashboard_type === "classic"
                      ? "Formation en ligne"
                      : "En cours"}
                  </span>
                </div>
                <div className="dsh-list-item__actions">
                  <Link
                    to={`/espace/etudiant/certificat/${e.id}`}
                    className="dsh-btn dsh-btn--primary dsh-btn--sm"
                  >
                    Voir le certificat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes & Attendance — guided/presentiel/live only */}
      {guidedEnrollments.length > 0 && (
        <section className="dsh-section">
          <div className="dsh-section__header">
            <h2 className="dsh-section__title">Notes & Présences</h2>
            <label className="dsh-select-label">
              Inscription :
              <select
                className="dsh-select"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                {guidedEnrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.formation_title} — {e.session_label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {detailLoading ? (
            <div className="dsh-page-loading">Chargement des détails…</div>
          ) : results ? (
            <>
              <div className="dsh-results-block">
                <h3>Notes</h3>
                {results.grades.length === 0 ? (
                  <p className="dsh-empty-inline">Aucune note enregistrée.</p>
                ) : (
                  <table className="dsh-table">
                    <thead>
                      <tr><th>Évaluation</th><th>Note</th><th>/ Max</th><th>Commentaire</th></tr>
                    </thead>
                    <tbody>
                      {results.grades.map((g, i) => (
                        <tr key={i}>
                          <td><strong>{g.label}</strong></td>
                          <td>
                            <strong style={{ color: g.score >= g.max_score * 0.5 ? "#16a34a" : "#dc2626" }}>
                              {g.score}
                            </strong>
                          </td>
                          <td className="dsh-td--muted">{g.max_score}</td>
                          <td className="dsh-td--muted">{g.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="dsh-results-block">
                <h3>Présences</h3>
                {results.attendance.length === 0 ? (
                  <p className="dsh-empty-inline">Aucune présence enregistrée.</p>
                ) : (
                  <table className="dsh-table">
                    <thead>
                      <tr><th>Statut</th><th>Remarque</th></tr>
                    </thead>
                    <tbody>
                      {results.attendance.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{ color: ATTENDANCE_COLORS[a.status] ?? "#6b7280", fontWeight: 600 }}>
                              {ATTENDANCE_LABELS[a.status] ?? a.status}
                            </span>
                          </td>
                          <td className="dsh-td--muted">{a.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
