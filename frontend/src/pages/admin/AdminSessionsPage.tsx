import { useEffect, useMemo, useState } from "react";
import { FaChevronRight, FaEdit, FaPlus, FaSearch } from "react-icons/fa";
import { CalendarCheck, CalendarDays, UnlockKeyhole, Users } from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  formatTypeLabel,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  sessionStateLabel,
  statusLabel,
} from "../../admin/adminDashboardUtils";

const PAGE_SIZE = 8;

function sessionStateBadge(state: string) {
  if (state === "upcoming") return "adm-badge adm-badge--blue";
  if (state === "started_open") return "adm-badge adm-badge--green";
  if (state === "started_closed") return "adm-badge adm-badge--yellow";
  if (state === "ended") return "adm-badge adm-badge--gray";
  if (state === "unscheduled") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

function sessionStatusBadge(status: string) {
  if (status === "open") return "adm-badge adm-badge--green";
  if (status === "planned") return "adm-badge adm-badge--blue";
  if (status === "completed") return "adm-badge adm-badge--gray";
  if (status === "cancelled") return "adm-badge adm-badge--red";
  return "adm-badge adm-badge--gray";
}

function formatTypePill(formatType: string) {
  if (formatType === "live") return "adm-format-pill adm-format-pill--live";
  if (formatType === "presentiel") return "adm-format-pill adm-format-pill--presentiel";
  return "adm-format-pill adm-format-pill--ligne";
}

export default function AdminSessionsPage() {
  const {
    loading,
    loadingError,
    sessions,
    availableSessionCreateFormations,
    openCreateSessionEditor,
    openEditSessionEditor,
  } = useAdminDashboard();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => sessions.filter((s) =>
      includesSearchValue([s.formation_title, s.label, s.campus_label, s.teacher_name, s.status], search),
    ),
    [search, sessions],
  );

  useEffect(() => { setPage(1); }, [search, sessions.length]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => getPageItems(filtered, safePage, PAGE_SIZE), [filtered, safePage]);

  const openCount = sessions.filter((s) => s.status === "open").length;
  const plannedCount = sessions.filter((s) => s.status === "planned").length;
  const totalEnrolled = sessions.reduce((acc, s) => acc + s.enrolled_count, 0);

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Planning</p>
          <h1 className="adm-page-title">Sessions</h1>
          <p className="adm-page-desc">Gérez les cohortes live et présentiel, planifiez les dates et suivez les inscriptions.</p>
        </div>
        <div className="adm-page-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openCreateSessionEditor()}>
            <FaPlus /> Nouvelle session
          </button>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--dark">
          <span className="adm-kpi-card__bg-icon"><CalendarDays strokeWidth={1.2} /></span>
          <span>Total sessions</span>
          <strong>{sessions.length}</strong>
          <small>toutes cohortes</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><UnlockKeyhole strokeWidth={1.2} /></span>
          <span>Ouvertes</span>
          <strong>{openCount}</strong>
          <small>inscriptions actives</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><CalendarCheck strokeWidth={1.2} /></span>
          <span>Planifiées</span>
          <strong>{plannedCount}</strong>
          <small>à venir</small>
        </div>
        <div className="adm-kpi-card">
          <span className="adm-kpi-card__bg-icon"><Users strokeWidth={1.2} /></span>
          <span>Inscrits total</span>
          <strong>{totalEnrolled}</strong>
          <small>sur toutes sessions</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="adm-sessions-layout">
          {/* Eligibility panel */}
          <div className="adm-card adm-sessions-eligibility">
            <div className="adm-card__header">
              <div>
                <h2 className="adm-card__title">Formations planifiables</h2>
                <p className="adm-card__desc">Ajoutez une cohorte live ou présentiel à chaque période.</p>
              </div>
            </div>
            <div className="adm-eligibility-list">
              {availableSessionCreateFormations.length ? (
                availableSessionCreateFormations.map((formation) => (
                  <button
                    key={formation.id}
                    type="button"
                    className="adm-eligibility-item"
                    onClick={() => openCreateSessionEditor(formation.id)}
                  >
                    <div className="adm-eligibility-item__info">
                      <strong>{formation.title}</strong>
                      <span>
                        <span className={formatTypePill(formation.format_type)}>
                          {formatTypeLabel(formation.format_type)}
                        </span>
                        {" · "}
                        {formation.session_label ?? "Aucune date planifiée"}
                      </span>
                    </div>
                    <FaChevronRight className="adm-eligibility-item__arrow" />
                  </button>
                ))
              ) : (
                <div className="adm-empty">Aucune formation live ou présentiel disponible.</div>
              )}
            </div>
          </div>

          {/* Sessions table */}
          <div className="adm-card adm-sessions-table-card">
            <div className="adm-card__header">
              <div>
                <h2 className="adm-card__title">Toutes les sessions</h2>
                <p className="adm-card__desc">{sessions.length} sessions au total</p>
              </div>
              <label className="adm-search">
                <FaSearch />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Formation, lieu, enseignant…"
                />
              </label>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Formation</th>
                    <th>Dates</th>
                    <th>Lieu · Enseignant</th>
                    <th>Inscrits</th>
                    <th>État</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? paginated.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div className="adm-td-title">
                          <strong>{session.formation_title}</strong>
                          <span style={{ color: "#8a95b0", fontSize: "0.78rem" }}>{session.label}</span>
                          <span className={formatTypePill(session.format_type)} style={{ marginTop: "0.3rem", display: "inline-block" }}>
                            {formatTypeLabel(session.format_type)}
                          </span>
                        </div>
                      </td>
                      <td className="adm-td-muted">
                        <span style={{ display: "block", fontSize: "0.82rem" }}>{session.start_date}</span>
                        <span style={{ display: "block", fontSize: "0.82rem" }}>→ {session.end_date}</span>
                      </td>
                      <td className="adm-td-muted">
                        <span style={{ display: "block", fontSize: "0.82rem" }}>
                          {session.campus_label || "—"}
                        </span>
                        <span style={{ display: "block", fontSize: "0.82rem" }}>
                          {session.teacher_name || "—"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#111827", fontSize: "0.875rem" }}>
                          {session.enrolled_count}
                          <span style={{ color: "#8a95b0", fontWeight: 400 }}>/{session.seat_capacity}</span>
                        </strong>
                        <span style={{ display: "block", fontSize: "0.74rem", color: session.can_purchase ? "#15803d" : "#b91c1c" }}>
                          {session.can_purchase ? "Paiement ouvert" : "Paiement fermé"}
                        </span>
                      </td>
                      <td>
                        <span className={sessionStateBadge(session.session_state)}>
                          {sessionStateLabel(session.session_state)}
                        </span>
                      </td>
                      <td>
                        <span className={sessionStatusBadge(session.status)}>
                          {statusLabel(session.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          aria-label={`Éditer ${session.label}`}
                          className="adm-icon-btn adm-icon-btn--accent"
                          type="button"
                          onClick={() => openEditSessionEditor(session.id)}
                        >
                          <FaEdit />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7}>
                        <div className="adm-empty">Aucune session trouvée.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <AdminTablePager
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              label="Sessions"
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
