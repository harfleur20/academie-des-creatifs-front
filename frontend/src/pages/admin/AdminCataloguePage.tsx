import { useEffect, useMemo, useState } from "react";
import { FaEdit, FaEye, FaPlus, FaSearch } from "react-icons/fa";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  badgeIcon,
  badgeLabel,
  dashboardTypeLabel,
  formatTypeLabel,
  getPageItems,
  getTotalPages,
} from "../../admin/adminDashboardUtils";

const PAGE_SIZE = 7;

export default function AdminCataloguePage() {
  const {
    overview,
    loading,
    loadingError,
    filteredFormations,
    featuredFormationsCount,
    catalogSearch,
    catalogDisplayFilter,
    setCatalogSearch,
    setCatalogDisplayFilter,
    openCreateFormationEditor,
    openEditFormationEditor,
  } = useAdminDashboard();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [catalogSearch, catalogDisplayFilter, filteredFormations.length]);

  const totalPages = getTotalPages(filteredFormations.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => getPageItems(filteredFormations, safePage, PAGE_SIZE),
    [filteredFormations, safePage],
  );

  return (
    <div className="admin-workspace">
      <section className="admin-page-head">
        <div>
          <p className="admin-section__eyebrow">Catalogue</p>
          <h1>Gere les formations comme une vraie collection de produits.</h1>
          <p>
            Liste nette, recherche directe, mise en avant accueil et edition en drawer
            sans casser la lecture.
          </p>
        </div>
        <button className="admin-action-button" type="button" onClick={openCreateFormationEditor}>
          <FaPlus />
          Nouvelle formation
        </button>
      </section>

      {loading ? (
        <div className="admin-state-card">
          <p>Chargement du catalogue...</p>
        </div>
      ) : null}

      {loadingError ? (
        <div className="admin-state-card admin-state-card--error">
          <p>{loadingError}</p>
        </div>
      ) : null}

      {!loading && !loadingError ? (
        <>
          <section className="admin-metric-strip admin-metric-strip--compact">
            <article className="admin-stat-card">
              <span>Toutes les formations</span>
              <strong>{overview?.formations_count ?? filteredFormations.length}</strong>
              <small>produits administrables</small>
            </article>
            <article className="admin-stat-card">
              <span>Vedettes accueil</span>
              <strong>{featuredFormationsCount}</strong>
              <small>vitrine e-commerce</small>
            </article>
            <article className="admin-stat-card">
              <span>Formats guides</span>
              <strong>
                {(overview?.live_formations_count ?? 0) + (overview?.presentiel_formations_count ?? 0)}
              </strong>
              <small>live et presentiel</small>
            </article>
          </section>

          <section className="admin-table-card">
            <div className="admin-table-card__header admin-table-card__header--stack">
              <div>
                <p className="admin-section__eyebrow">Liste produits</p>
                <h2>Catalogue des formations</h2>
                <p>Chaque ligne reste legere. L’edition detaillee s’ouvre a part.</p>
              </div>
              <div className="admin-section__toolbar">
                <label className="admin-inline-search">
                  <FaSearch />
                  <input
                    type="search"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="Rechercher une formation"
                  />
                </label>
                <div className="admin-filter-toggle">
                  <button
                    className={catalogDisplayFilter === "all" ? "is-active" : undefined}
                    type="button"
                    onClick={() => setCatalogDisplayFilter("all")}
                  >
                    Toutes
                    <strong>{overview?.formations_count ?? filteredFormations.length}</strong>
                  </button>
                  <button
                    className={catalogDisplayFilter === "featured" ? "is-active" : undefined}
                    type="button"
                    onClick={() => setCatalogDisplayFilter("featured")}
                  >
                    Vedettes
                    <strong>{featuredFormationsCount}</strong>
                  </button>
                </div>
              </div>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-resource-table">
                <thead>
                  <tr>
                    <th>Formation</th>
                    <th>Format</th>
                    <th>Tarif</th>
                    <th>Vitrine</th>
                    <th>Dashboard</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((formation) => (
                      <tr key={formation.slug}>
                        <td>
                          <div className="admin-resource-table__identity">
                            <img
                              className="admin-resource-table__thumb"
                              src={formation.image}
                              alt={formation.title}
                            />
                            <div>
                              <strong>{formation.title}</strong>
                              <span>{formation.category}</span>
                              <div className="admin-table-badges">
                                {formation.badges.map((badge) => (
                                  <span className={`admin-market-badge admin-market-badge--${badge}`} key={badge}>
                                    {badgeIcon(badge)}
                                    {badgeLabel(badge)}
                                  </span>
                                ))}
                                {formation.is_featured_home ? (
                                  <span className="admin-feature-pill">Accueil #{formation.home_feature_rank}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-format-pill admin-format-pill--${formation.format_type}`}>
                            {formatTypeLabel(formation.format_type)}
                          </span>
                        </td>
                        <td>
                          <div className="admin-inline-stack">
                            <strong>{formation.current_price_label}</strong>
                            <small>{formation.original_price_label ?? "Pas de prix barre"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="admin-inline-stack">
                            <strong>{formation.is_featured_home ? "Visible" : "Masquee"}</strong>
                            <small>
                              {formation.is_featured_home ? `Ordre ${formation.home_feature_rank}` : "Hors vitrine"}
                            </small>
                          </div>
                        </td>
                        <td>{dashboardTypeLabel(formation.format_type)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              aria-label={`Voir ${formation.title}`}
                              className="admin-icon-button admin-icon-button--ghost"
                              type="button"
                            >
                              <FaEye />
                            </button>
                            <button
                              aria-label={`Editer ${formation.title}`}
                              className="admin-icon-button admin-icon-button--accent"
                              type="button"
                              onClick={() => openEditFormationEditor(formation.slug)}
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="admin-empty-table">Aucune formation ne correspond a ce filtre.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <AdminTablePager
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredFormations.length}
              label="Formations"
              onPageChange={setPage}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
