import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  fetchTeacherPerformance,
  type TeacherPerformanceOverview,
  type TeacherPerformanceTone,
} from "../../lib/teacherApi";

function kpiClass(tone: TeacherPerformanceTone, index: number) {
  if (tone === "danger") return "adm-kpi-card adm-kpi-card--red";
  if (tone === "warning") return "adm-kpi-card adm-kpi-card--yellow";
  if (tone === "good") return index === 0 ? "adm-kpi-card adm-kpi-card--dark" : "adm-kpi-card adm-kpi-card--green";
  return "adm-kpi-card adm-kpi-card--blue";
}

function alertClass(tone: TeacherPerformanceTone) {
  if (tone === "danger") return "adm-perf-alert adm-perf-alert--danger";
  if (tone === "warning") return "adm-perf-alert adm-perf-alert--warning";
  if (tone === "good") return "adm-perf-alert adm-perf-alert--good";
  return "adm-perf-alert";
}

function toneBadgeClass(tone: TeacherPerformanceTone) {
  if (tone === "danger") return "adm-badge adm-badge--red";
  if (tone === "warning") return "adm-badge adm-badge--yellow";
  if (tone === "good") return "adm-badge adm-badge--green";
  return "adm-badge adm-badge--blue";
}

function sessionStatusLabel(status: string) {
  if (status === "open") return "Ouverte";
  if (status === "planned") return "Planifiee";
  if (status === "completed") return "Terminee";
  if (status === "cancelled") return "Annulee";
  return status;
}

function formatPct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLastActivity(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const kpiIcons = [
  <CalendarDays strokeWidth={1.2} key="sessions" />,
  <Users strokeWidth={1.2} key="students" />,
  <Activity strokeWidth={1.2} key="attendance" />,
  <ClipboardList strokeWidth={1.2} key="reviews" />,
];

export default function TeacherPerformancePage() {
  const [performance, setPerformance] = useState<TeacherPerformanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchTeacherPerformance()
      .then(setPerformance)
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les indicateurs enseignant.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="adm-workspace adm-performance-page">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Pilotage enseignant</p>
          <h1 className="adm-page-title">Performance</h1>
          <p className="adm-page-desc">
            Suivez vos sessions, la progression des etudiants, les presences et les corrections a terminer.
          </p>
        </div>
        {performance && (
          <span className="adm-perf-updated">
            Mis a jour le {formatGeneratedAt(performance.generated_at)}
          </span>
        )}
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {errorMessage && <div className="adm-state-card adm-state-card--error"><p>{errorMessage}</p></div>}

      {performance && !loading && !errorMessage && (
        <>
          <div className="adm-kpi-row">
            {performance.kpis.map((kpi, index) => (
              <div className={kpiClass(kpi.tone, index)} key={kpi.label}>
                <span className="adm-kpi-card__bg-icon">
                  {kpiIcons[index] ?? kpiIcons[0]}
                </span>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.detail}</small>
              </div>
            ))}
          </div>

          <div className="adm-performance-grid">
            <section className="adm-card adm-performance-card">
              <div className="adm-card__header">
                <div>
                  <h2 className="adm-card__title">Alertes actionnables</h2>
                  <p className="adm-card__desc">Les points a traiter en priorite dans vos cohortes.</p>
                </div>
                <AlertTriangle size={18} />
              </div>
              <div className="adm-perf-alert-list">
                {performance.alerts.map((alert) => (
                  <article className={alertClass(alert.tone)} key={alert.code}>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </div>
                    <Link to={alert.action_path}>{alert.action_label}</Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="adm-card adm-performance-card">
              <div className="adm-card__header">
                <div>
                  <h2 className="adm-card__title">Vue rapide</h2>
                  <p className="adm-card__desc">Accedez directement a vos espaces de suivi.</p>
                </div>
                <TrendingUp size={18} />
              </div>
              <div className="stu-shortcuts-grid">
                <Link to="/espace/enseignant/sessions" className="stu-shortcut-card">
                  <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)" }}>
                    <CalendarDays size={18} />
                  </span>
                  <span className="stu-shortcut-card__label">Mes sessions</span>
                </Link>
                <Link to="/espace/enseignant/devoirs" className="stu-shortcut-card">
                  <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
                    <ClipboardList size={18} />
                  </span>
                  <span className="stu-shortcut-card__label">Corrections</span>
                </Link>
                <Link to="/espace/enseignant/quizz" className="stu-shortcut-card">
                  <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    <Activity size={18} />
                  </span>
                  <span className="stu-shortcut-card__label">Quiz</span>
                </Link>
                <Link to="/espace/enseignant/cours" className="stu-shortcut-card">
                  <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
                    <TrendingUp size={18} />
                  </span>
                  <span className="stu-shortcut-card__label">Cours</span>
                </Link>
              </div>
            </section>
          </div>

          <section className="adm-card adm-card--wide">
            <div className="adm-card__header">
              <div>
                <h2 className="adm-card__title">Sessions a suivre</h2>
                <p className="adm-card__desc">Remplissage, presence, progression et corrections par session.</p>
              </div>
              <CalendarDays size={18} />
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Inscrits</th>
                    <th>Presence</th>
                    <th>Progression</th>
                    <th>Quiz</th>
                    <th>Corrections</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.sessions.map((session) => (
                    <tr key={session.session_id}>
                      <td>
                        <div className="adm-td-title">
                          <strong>{session.formation_title}</strong>
                          <span>{session.session_label} · {sessionStatusLabel(session.status)}</span>
                        </div>
                      </td>
                      <td>{session.enrolled_count}/{session.seat_capacity || "—"} · {session.fill_rate_pct}%</td>
                      <td>{formatPct(session.attendance_rate_pct)}</td>
                      <td>{session.progress_pct}%</td>
                      <td>{formatPct(session.quiz_average_score_pct)}</td>
                      <td>
                        <span className={toneBadgeClass(session.alert_level)}>
                          {session.pending_reviews_count}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/espace/enseignant/session/${session.session_id}`}
                          style={{ fontWeight: 700, color: "#4f46e5", textDecoration: "none" }}
                        >
                          Session
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adm-card adm-card--wide">
            <div className="adm-card__header">
              <div>
                <h2 className="adm-card__title">Etudiants a relancer</h2>
                <p className="adm-card__desc">Les profils qui demandent votre attention en priorite.</p>
              </div>
              <Users size={18} />
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Etudiant</th>
                    <th>Session</th>
                    <th>Progression</th>
                    <th>Presence</th>
                    <th>Note moyenne</th>
                    <th>Corrections</th>
                    <th>Derniere activite</th>
                    <th>Niveau</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.students.slice(0, 12).map((student) => (
                    <tr key={student.enrollment_id}>
                      <td>
                        <div className="adm-td-title">
                          <strong>{student.student_name}</strong>
                          <span>{student.student_code ?? "Code indisponible"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="adm-td-title">
                          <strong>{student.session_label}</strong>
                          <span>{student.formation_title}</span>
                        </div>
                      </td>
                      <td>{student.progress_pct}%</td>
                      <td>{formatPct(student.attendance_rate_pct)}</td>
                      <td>{formatPct(student.average_grade_pct)}</td>
                      <td>{student.pending_reviews_count}</td>
                      <td>{formatLastActivity(student.last_activity_at)}</td>
                      <td>
                        <span className={toneBadgeClass(student.risk_level)}>
                          {student.risk_level === "danger"
                            ? "Critique"
                            : student.risk_level === "warning"
                            ? "A suivre"
                            : student.risk_level === "good"
                            ? "Stable"
                            : "Neutre"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!performance.students.length && (
                    <tr>
                      <td colSpan={8} className="adm-td-muted">Aucun etudiant actif a analyser.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
