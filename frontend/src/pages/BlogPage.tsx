import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaSearch, FaStar, FaTimes, FaThLarge, FaBriefcase, FaPaintBrush, FaCompass, FaBullhorn, FaVideo, FaRobot, FaCode, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { fetchBlogPosts, type BlogPost } from "../lib/blogApi";

const CATEGORIES: { label: string; icon: React.ReactNode }[] = [
  { label: "Tous",                    icon: <FaThLarge /> },
  { label: "Freelance",               icon: <FaBriefcase /> },
  { label: "Design Graphique",        icon: <FaPaintBrush /> },
  { label: "Découverte",              icon: <FaCompass /> },
  { label: "Marketing Digital",       icon: <FaBullhorn /> },
  { label: "Vidéo & Motion",          icon: <FaVideo /> },
  { label: "Intelligence Artificielle", icon: <FaRobot /> },
  { label: "No-Code & Tech",          icon: <FaCode /> },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Les plus récents" },
  { value: "popular", label: "Les plus populaires" },
  { value: "rating", label: "Mieux notés" },
];

const PER_PAGE = 8;

export function catClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("freelance")) return "blog-cat-badge--freelance";
  if (c.includes("design")) return "blog-cat-badge--design";
  if (c.includes("découv") || c.includes("decouv")) return "blog-cat-badge--decouverte";
  if (c.includes("marketing")) return "blog-cat-badge--marketing";
  if (c.includes("vidéo") || c.includes("video") || c.includes("motion")) return "blog-cat-badge--video";
  if (c.includes("no-code") || c.includes("nocode")) return "blog-cat-badge--nocode";
  if (c.includes("ia") || c.includes("intelligence") || c.includes("artificielle")) return "blog-cat-badge--ia";
  return "blog-cat-badge--default";
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchBlogPosts()
      .then(setPosts)
      .catch(() => setError("Erreur lors du chargement des articles."));
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, activeCategory, sort]);

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, { label }) => {
    acc[label] = label === "Tous" ? posts.length : posts.filter((p) => p.category === label).length;
    return acc;
  }, {});

  const filtered = posts
    .filter((p) => {
      const matchesCat = activeCategory === "Tous" || p.category === activeCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "popular") return b.reviews_count - a.reviews_count;
      if (sort === "rating") return b.rating - a.rating;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const featured = posts.find((p) => p.is_featured);

  function getPageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="blog-page">
      {/* Hero */}
      <section className="blog-hero">
        <div className="blog-hero__overlay" />
        <div className="blog-hero__content">
          <p className="blog-eyebrow">Blog Académie des Créatifs</p>
          <h1>Conseils, tutoriels et <span>inspirations créatives</span></h1>
          <p>Des ressources pour les graphistes, designers et créatifs francophones.</p>
        </div>
      </section>

      <div className="blog-layout">
        {/* ── Sidebar ── */}
        <aside className="blog-sidebar">
          <div className="blog-sidebar__section">
            <p className="blog-sidebar__heading">Catégories</p>
            <ul className="blog-sidebar__cats">
              {CATEGORIES.map(({ label, icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    className={`blog-sidebar__cat-btn${activeCategory === label ? " is-active" : ""}`}
                    onClick={() => setActiveCategory(label)}
                  >
                    <span className="blog-sidebar__cat-inner">
                      <span className="blog-sidebar__cat-icon">{icon}</span>
                      <span>{label}</span>
                    </span>
                    <span className="blog-sidebar__count">{categoryCounts[label]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {activeCategory !== "Tous" && (
            <button
              type="button"
              className="blog-sidebar__reset"
              onClick={() => setActiveCategory("Tous")}
            >
              <FaTimes /> Réinitialiser le filtre
            </button>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="blog-content">
          {/* Toolbar */}
          <div className="blog-toolbar">
            <label className="blog-search">
              <FaSearch />
              <input
                type="search"
                placeholder="Rechercher un article…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="blog-search__clear" onClick={() => setSearch("")}>
                  <FaTimes />
                </button>
              )}
            </label>
            <select
              className="blog-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="blog-error">{error}</p>}

          <div className="blog-content-animated" key={`${activeCategory}-${search}-${sort}-${page}`}>

          {/* Featured */}
          {!search && activeCategory === "Tous" && page === 1 && featured && (
            <Link to={`/blog/${featured.slug}`} className="blog-featured">
              <div className="blog-featured__cover">
                <img src={featured.cover_image} alt={featured.title} />
                <span className="blog-featured__badge">À la une</span>
              </div>
              <div className="blog-featured__body">
                <span className={`blog-cat-badge ${catClass(featured.category)}`}>{featured.category}</span>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <div className="blog-featured__meta">
                  <span>Par {featured.author}</span>
                  <span>{featured.published_at}</span>
                </div>
                <span className="blog-featured__read">
                  Lire l'article <FaArrowRight />
                </span>
              </div>
            </Link>
          )}

          {/* Results info */}
          <p className="blog-results-count">
            {filtered.length} article{filtered.length > 1 ? "s" : ""}
            {activeCategory !== "Tous" && <> dans <strong>{activeCategory}</strong></>}
            {search && <> pour « <strong>{search}</strong> »</>}
            {totalPages > 1 && <> &nbsp;·&nbsp; page {page}/{totalPages}</>}
          </p>

          {/* Grid */}
          <div className="blog-grid">
            {paginated.length === 0 && !error ? (
              <p className="blog-empty">Aucun article ne correspond à cette recherche.</p>
            ) : (
              paginated.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.slug} className="blog-card">
                  <div className="blog-card__cover">
                    <img src={post.cover_image} alt={post.title} />
                    <span className={`blog-card__cat blog-cat-badge ${catClass(post.category)}`}>{post.category}</span>
                  </div>
                  <div className="blog-card__body">
                    <span className="blog-card__date">{post.published_at}</span>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="blog-card__footer">
                      {post.reviews_count > 0 && (
                        <span className="blog-card__rating">
                          <FaStar /> {post.rating.toFixed(1)} <em>({post.reviews_count})</em>
                        </span>
                      )}
                      <span className="blog-card__read">Lire la suite →</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="blog-pagination" aria-label="Pagination">
              <button
                className="blog-pagination__btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Page précédente"
              >
                <FaChevronLeft />
              </button>

              {getPageNumbers().map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="blog-pagination__ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`blog-pagination__btn${page === p ? " is-active" : ""}`}
                    onClick={() => setPage(p as number)}
                    aria-current={page === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                className="blog-pagination__btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Page suivante"
              >
                <FaChevronRight />
              </button>
            </nav>
          )}
          </div>{/* end blog-content-animated */}
        </main>
      </div>
    </div>
  );
}
