import { useEffect, useMemo, useState } from "react";
import { FaEdit, FaEye, FaPlus, FaSearch } from "react-icons/fa";
import { BookOpen, Library, Star, Tv2 } from "lucide-react";

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

const PAGE_SIZE = 8;

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

  useEffect(() => { setPage(1); }, [catalogSearch, catalogDisplayFilter, filteredFormations.length]);

  const totalPages = getTotalPages(filteredFormations.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => getPageItems(filteredFormations, safePage, PAGE_SIZE),
    [filteredFormations, safePage],
  );

  const guideCount = filteredFormations.filter(
    (f) => f.format_type === "live" || f.format_type === "presentiel"
  ).length;

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Catalogue</p>
          <h1 className="adm-page-title">Formations</h1>
          <p className="adm-page-desc">Gérez les offres, leur visibilité vitrine et leur tarification.</p>
        </div>
        <div className="adm-page-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={openCreateFormationEditor}>
            <FaPlus /> Nouvelle formation
          </button>
        </div>
      </div>

      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--dark">
          <span className="adm-kpi-card__bg-icon"><Library strokeWidth={1.2} /></span>
          <span>Total</span>
          <strong>{overview?.formations_count ?? filteredFormations.length}</strong>
          <small>formations au catalogue</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><Star strokeWidth={1.2} /></span>
          <span>Vedettes accueil</span>
          <strong>{featuredFormationsCount}</strong>
          <small>visibles sur la vitrine</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--purple">
          <span className="adm-kpi-card__bg-icon"><BookOpen strokeWidth={1.2} /></span>
          <span>Formats guidés</span>
          <strong>{guideCount}</strong>
          <small>live + présentiel</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--green">
          <span className="adm-kpi-card__bg-icon"><Tv2 strokeWidth={1.2} /></span>
          <span>En ligne</span>
          <strong>{overview?.ligne_formations_count ?? 0}</strong>
          <small>accès classique</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement du catalogue…</p></div>}
      {loadingError && <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>}

      {!loading && !loadingError && (
        <div className="adm-card">
          <div className="adm-card__header">
            <div style={{ flex: 1 }}>
              <h2 className="adm-card__title">Toutes les formations</h2>
              <p className="adm-card__desc">Cliquez sur l'icône crayon pour éditer une fiche.</p>
            </div>
            <div className="adm-filter-row">
              <button
                type="button"
                className={`adm-filter-btn${catalogDisplayFilter === "all" ? " is-active" : ""}`}
                onClick={() => setCatalogDisplayFilter("all")}
              >
                Toutes <strong>{overview?.formations_count ?? filteredFormations.length}</strong>
              </button>
              <button
                type="button"
                className={`adm-filter-btn${catalogDisplayFilter === "featured" ? " is-active" : ""}`}
                onClick={() => setCatalogDisplayFilter("featured")}
              >
                Vedettes <strong>{featuredFormationsCount}</strong>
              </button>
            </div>
            <label className="adm-search">
              <FaSearch />
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Titre, catégorie…"
              />
            </label>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Formation</th>
                  <th>Format</th>
                  <th>Tarif</th>
                  <th>Vitrine</th>
                  <th>Dashboard</th>
                  <th>Badges</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map((formation) => (
                  <tr key={formation.slug}>
                    <td>
                      <div className="adm-catalogue-identity">
                        <img
                          className="adm-catalogue-thumb"
                          src={formation.image}
                          alt={formation.title}
                        />
                        <div>
                          <strong style={{ display: "block", color: "#111827", fontSize: "0.875rem", fontWeight: 700 }}>
                            {formation.title}
                          </strong>
                          <span style={{ display: "block", color: "#8a95b0", fontSize: "0.78rem", marginTop: "0.1rem" }}>
                            {formation.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`adm-format-pill adm-format-pill--${formation.format_type}`}>
                        {formatTypeLabel(formation.format_type)}
                      </span>
                    </td>
                    <td>
                      <strong style={{ display: "block", color: "#111827", fontSize: "0.875rem" }}>
                        {formation.current_price_label}
                      </strong>
                      {formation.original_price_label && (
                        <small style={{ color: "#8b7390", textDecoration: "line-through", fontSize: "0.78rem" }}>
                          {formation.original_price_label}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className={`adm-badge ${formation.is_featured_home ? "adm-badge--green" : "adm-badge--gray"}`}>
                        {formation.is_featured_home ? `Accueil #${formation.home_feature_rank}` : "Masquée"}
                      </span>
                    </td>
                    <td className="adm-td-muted">{dashboardTypeLabel(formation.format_type)}</td>
                    <td>
                      <div className="adm-market-badges">
                        {formation.badges.map((badge) => (
                          <span className={`adm-market-badge adm-market-badge--${badge}`} key={badge}>
                            {badgeIcon(badge)} {badgeLabel(badge)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <button
                          aria-label={`Voir ${formation.title}`}
                          className="adm-icon-btn"
                          type="button"
                        >
                          <FaEye />
                        </button>
                        <button
                          aria-label={`Éditer ${formation.title}`}
                          className="adm-icon-btn adm-icon-btn--accent"
                          type="button"
                          onClick={() => openEditFormationEditor(formation.slug)}
                        >
                          <FaEdit />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="adm-empty">Aucune formation ne correspond à ce filtre.</div>
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
        </div>
      )}
    </div>
  );
}
