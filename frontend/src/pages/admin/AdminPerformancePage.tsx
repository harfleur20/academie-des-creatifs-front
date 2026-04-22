import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CreditCard,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  fetchAdminPerformance,
  type AdminPerformanceOverview,
  type PerformanceTone,
} from "../../lib/catalogApi";
import { formatTypeLabel } from "../../admin/adminDashboardUtils";

function kpiClass(tone: PerformanceTone, index: number) {
  if (tone === "danger") return "adm-kpi-card adm-kpi-card--red";
  if (tone === "warning") return "adm-kpi-card adm-kpi-card--yellow";
  if (tone === "good") return index === 0 ? "adm-kpi-card adm-kpi-card--dark" : "adm-kpi-card adm-kpi-card--green";
  return "adm-kpi-card adm-kpi-card--blue";
}

function alertClass(tone: PerformanceTone) {
  if (tone === "danger") return "adm-perf-alert adm-perf-alert--danger";
  if (tone === "warning") return "adm-perf-alert adm-perf-alert--warning";
  if (tone === "good") return "adm-perf-alert adm-perf-alert--good";
  return "adm-perf-alert";
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

const kpiIcons = [
  <CreditCard strokeWidth={1.2} key="revenue" />,
  <AlertTriangle strokeWidth={1.2} key="late" />,
  <Users strokeWidth={1.2} key="students" />,
  <Activity strokeWidth={1.2} key="activity" />,
];

export default function AdminPerformancePage() {
  const [performance, setPerformance] = useState<AdminPerformanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchAdminPerformance()
      .then(setPerformance)
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les indicateurs de performance.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const maxRevenue = useMemo(
    () => Math.max(...(performance?.monthly_series.map((point) => point.revenue_amount) ?? [0]), 1),
    [performance?.monthly_series],
  );

  return (
    <div className="adm-workspace adm-performance-page">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Pilotage</p>
          <h1 className="adm-page-title">Performance</h1>
          <p className="adm-page-desc">
            Suivez les revenus, les inscriptions, le remplissage des sessions et les points pedagogiques a traiter.
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
                  <h2 className="adm-card__title">Tendance sur 6 mois</h2>
                  <p className="adm-card__desc">Revenus confirmes, commandes et inscriptions.</p>
                </div>
                <TrendingUp size={18} />
              </div>
              <div className="adm-perf-chart">
                {performance.monthly_series.map((point) => {
                  const height = Math.max(8, (point.revenue_amount / maxRevenue) * 100);
                  return (
                    <div className="adm-perf-chart__item" key={point.key}>
                      <div className="adm-perf-chart__bar-wrap">
                        <span className="adm-perf-chart__bar" style={{ height: `${height}%` }} />
                      </div>
                      <strong>{point.label}</strong>
                      <span>{point.revenue_label}</span>
                      <small>{point.enrollments_count} insc. · {point.orders_count} cmd.</small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="adm-card adm-performance-card">
              <div className="adm-card__header">
                <div>
                  <h2 className="adm-card__title">Alertes actionnables</h2>
                  <p className="adm-card__desc">Les points qui demandent une decision admin.</p>
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
          </div>

          <section className="adm-card adm-card--wide">
            <div className="adm-card__header">
              <div>
                <h2 className="adm-card__title">Formations qui performent</h2>
                <p className="adm-card__desc">Classement par revenus confirmes et inscriptions actives.</p>
              </div>
              <BookOpen size={18} />
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Formation</th>
                    <th>Format</th>
                    <th>Inscriptions</th>
                    <th>Revenus</th>
                    <th>Sessions</th>
                    <th>Remplissage</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.top_formations.map((formation) => (
                    <tr key={formation.formation_id}>
                      <td>
                        <div className="adm-td-title">
                          <strong>{formation.title}</strong>
                        </div>
                      </td>
                      <td><span className="adm-badge adm-badge--blue">{formatTypeLabel(formation.format_type)}</span></td>
                      <td>{formation.enrollments_count}</td>
                      <td><strong>{formation.revenue_label}</strong></td>
                      <td>{formation.sessions_count}</td>
                      <td>{formation.avg_fill_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="adm-performance-grid">
            <section className="adm-card">
              <div className="adm-card__header">
                <div>
                  <h2 className="adm-card__title">Sessions a surveiller</h2>
                  <p className="adm-card__desc">Remplissage, presence et corrections restantes.</p>
                </div>
                <CalendarDays size={18} />
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table adm-table--compact">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Inscrits</th>
                      <th>Presence</th>
                      <th>Corrections</th>
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
                        <td>
                          <span className={session.pending_reviews_count > 0 ? "adm-badge adm-badge--red" : "adm-badge adm-badge--green"}>
                            {session.pending_reviews_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="adm-card">
              <div className="adm-card__header">
                <div>
                  <h2 className="adm-card__title">Performance enseignants</h2>
                  <p className="adm-card__desc">Vue rapide sur le suivi pedagogique par formateur.</p>
                </div>
                <GraduationCap size={18} />
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table adm-table--compact">
                  <thead>
                    <tr>
                      <th>Enseignant</th>
                      <th>Sessions</th>
                      <th>Etudiants</th>
                      <th>Presence</th>
                      <th>Quiz</th>
                      <th>Corrections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.teachers.map((teacher) => (
                      <tr key={teacher.teacher_name}>
                        <td><strong>{teacher.teacher_name}</strong></td>
                        <td>{teacher.sessions_count}</td>
                        <td>{teacher.students_count}</td>
                        <td>{formatPct(teacher.attendance_rate_pct)}</td>
                        <td>{formatPct(teacher.quiz_average_score_pct)}</td>
                        <td>
                          <span className={teacher.pending_reviews_count > 0 ? "adm-badge adm-badge--red" : "adm-badge adm-badge--green"}>
                            {teacher.pending_reviews_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!performance.teachers.length && (
                      <tr>
                        <td colSpan={6} className="adm-td-muted">Aucune session enseignant a analyser.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
