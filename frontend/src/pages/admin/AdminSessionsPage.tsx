import { useEffect, useMemo, useState } from "react";
import { FaChevronRight, FaEdit, FaPlus, FaSearch } from "react-icons/fa";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  formatTypeLabel,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  sessionStateClassName,
  sessionStateLabel,
  statusLabel,
} from "../../admin/adminDashboardUtils";

const PAGE_SIZE = 6;

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
    () =>
      sessions.filter((session) =>
        includesSearchValue(
          [session.formation_title, session.label, session.campus_label, session.teacher_name, session.status],
          search,
        ),
      ),
    [search, sessions],
  );

  useEffect(() => {
    setPage(1);
  }, [search, sessions.length]);

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => getPageItems(filtered, safePage, PAGE_SIZE), [filtered, safePage]);

  return (
    <div className="admin-workspace">
      <section className="admin-page-head">
        <div>
          <p className="admin-section__eyebrow">Sessions</p>
          <h1>Planifie les cohortes sans casser la logique metier.</h1>
          <p>
            Les formations live et presentiel eligibles apparaissent clairement. Une
            session non terminee bloque la creation d’une nouvelle.
          </p>
        </div>
        <button className="admin-action-button" type="button" onClick={() => openCreateSessionEditor()}>
          <FaPlus />
          Nouvelle session
        </button>
      </section>

      {loading ? (
        <div className="admin-state-card">
          <p>Chargement des sessions...</p>
        </div>
      ) : null}

      {loadingError ? (
        <div className="admin-state-card admin-state-card--error">
          <p>{loadingError}</p>
        </div>
      ) : null}

      {!loading && !loadingError ? (
        <section className="admin-session-layout">
          <article className="admin-panel">
            <div className="admin-panel__heading">
              <div>
                <p className="admin-section__eyebrow">Eligibilite</p>
                <h3>Formations prêtes pour une session</h3>
                <p>Seulement live et presentiel, sans session non terminee.</p>
              </div>
            </div>
            <div className="admin-session-eligibility-list">
              {availableSessionCreateFormations.length ? (
                availableSessionCreateFormations.map((formation) => (
                  <button
                    className="admin-session-eligibility"
                    key={formation.id}
                    type="button"
                    onClick={() => openCreateSessionEditor(formation.id)}
                  >
                    <div className="admin-session-eligibility__content">
                      <div className="admin-session-eligibility__topline">
                        <strong>{formation.title}</strong>
                        <span className={`admin-format-pill admin-format-pill--${formation.format_type}`}>
                          {formatTypeLabel(formation.format_type)}
                        </span>
                      </div>
                      <span>{formation.session_label ?? "Nouvelle date a programmer"}</span>
                    </div>
                    <FaChevronRight />
                  </button>
                ))
              ) : (
                <div className="admin-empty-table">
                  Toutes les formations live et presentiel ont deja une session non terminee.
                </div>
              )}
            </div>
          </article>

          <article className="admin-panel admin-panel--table">
            <div className="admin-panel__heading">
              <div>
                <p className="admin-section__eyebrow">Suivi</p>
                <h3>Sessions planifiees</h3>
                <p>Inscriptions, fenetres d’achat et cohortes en cours.</p>
              </div>
              <label className="admin-inline-search">
                <FaSearch />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une session"
                />
              </label>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-resource-table">
                <thead>
                  <tr>
                    <th>Formation</th>
                    <th>Periode</th>
                    <th>Inscrits</th>
                    <th>Etat</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <div className="admin-inline-stack">
                            <strong>{session.formation_title}</strong>
                            <small>{session.label}</small>
                            <small>{session.campus_label || "Lieu a preciser"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="admin-inline-stack">
                            <strong>
                              {session.start_date} → {session.end_date}
                            </strong>
                            <small>{session.teacher_name || "Enseignant a attribuer"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="admin-inline-stack">
                            <strong>
                              {session.enrolled_count}/{session.seat_capacity}
                            </strong>
                            <small>{session.can_purchase ? "Paiement autorise" : "Paiement ferme"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="admin-inline-stack">
                            <span className={sessionStateClassName(session.session_state)}>
                              {sessionStateLabel(session.session_state)}
                            </span>
                            <span className={`admin-status admin-status--${session.status}`}>
                              {statusLabel(session.status)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              aria-label={`Editer ${session.label}`}
                              className="admin-icon-button admin-icon-button--accent"
                              type="button"
                              onClick={() => openEditSessionEditor(session.id)}
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="admin-empty-table">Aucune session ne correspond a cette recherche.</div>
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
          </article>
        </section>
      ) : null}
    </div>
  );
}
