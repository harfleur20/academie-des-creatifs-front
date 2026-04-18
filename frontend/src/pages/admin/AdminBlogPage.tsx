import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor/nohighlight";
import { FaEdit, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import {
  fetchBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPost,
  type BlogPostPayload,
} from "../../lib/blogApi";

type Draft = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author: string;
  category: string;
  is_featured: boolean;
  is_popular: boolean;
  published_at: string;
};

function emptyDraft(): Draft {
  return {
    slug: "", title: "", excerpt: "", content: "",
    cover_image: "", author: "Francis Kenne", category: "",
    is_featured: false, is_popular: false, published_at: "",
  };
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-");
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchBlogPosts()
      .then(setPosts)
      .catch(() => setError("Impossible de charger les articles."))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setFeedback(null);
    setEditorOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id);
    setDraft({
      slug: post.slug, title: post.title, excerpt: post.excerpt,
      content: post.content, cover_image: post.cover_image,
      author: post.author, category: post.category,
      is_featured: post.is_featured, is_popular: post.is_popular,
      published_at: post.published_at,
    });
    setFeedback(null);
    setEditorOpen(true);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    if (!draft.title.trim()) { setFeedback({ type: "error", msg: "Le titre est requis." }); return; }
    if (!draft.slug.trim()) { setFeedback({ type: "error", msg: "Le slug est requis." }); return; }
    setSaving(true);
    setFeedback(null);
    try {
      if (editingId !== null) {
        const updated = await updateBlogPost(editingId, draft);
        setPosts((p) => p.map((x) => (x.id === editingId ? updated : x)));
      } else {
        const created = await createBlogPost(draft as BlogPostPayload);
        setPosts((p) => [created, ...p]);
      }
      setFeedback({ type: "success", msg: editingId ? "Article mis à jour." : "Article créé." });
      setTimeout(() => setEditorOpen(false), 800);
    } catch (e: unknown) {
      setFeedback({ type: "error", msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer cet article définitivement ?")) return;
    setDeletingId(id);
    try {
      await deleteBlogPost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Blog</p>
          <h1 className="adm-page-title">Articles</h1>
          <p className="adm-page-desc">Gérez les articles du blog, leur visibilité et leur contenu.</p>
        </div>
        <div className="adm-page-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={openCreate}>
            <FaPlus /> Nouvel article
          </button>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {error && <div className="adm-state-card adm-state-card--error"><p>{error}</p></div>}

      {!loading && !error && (
        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">{posts.length} article(s)</h2>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Auteur</th>
                  <th>Catégorie</th>
                  <th>Date</th>
                  <th>Badges</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr><td colSpan={6}><div className="adm-empty">Aucun article.</div></td></tr>
                ) : posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="adm-catalogue-identity">
                        {post.cover_image && (
                          <img className="adm-catalogue-thumb" src={post.cover_image} alt={post.title} />
                        )}
                        <div>
                          <strong style={{ fontSize: "0.875rem", color: "#111827", fontWeight: 700, display: "block" }}>
                            {post.title}
                          </strong>
                          <span style={{ fontSize: "0.78rem", color: "#8a95b0" }}>{post.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{post.author}</td>
                    <td>
                      <span className="adm-badge adm-badge--gray" style={{ fontSize: "0.78rem" }}>
                        {post.category}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "#6b7280" }}>{post.published_at}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {post.is_featured && <span className="adm-badge adm-badge--green">À la une</span>}
                        {post.is_popular && <span className="adm-badge adm-badge--blue">Populaire</span>}
                      </div>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <button
                          className="adm-icon-btn adm-icon-btn--accent"
                          type="button"
                          onClick={() => openEdit(post)}
                          aria-label="Éditer"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="adm-icon-btn adm-icon-btn--danger"
                          type="button"
                          disabled={deletingId === post.id}
                          onClick={() => void handleDelete(post.id)}
                          aria-label="Supprimer"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Drawer éditeur ── */}
      {editorOpen && (
        <div className="admin-drawer-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="admin-drawer__header">
              <h3>{editingId ? "Modifier l'article" : "Nouvel article"}</h3>
              <button type="button" className="admin-drawer__close" onClick={() => setEditorOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="admin-drawer__body">
              <div className="fe-fields">
                <label className="admin-field fe-span-full">
                  <span>Titre</span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => {
                      set("title", e.target.value);
                      if (!editingId) set("slug", slugify(e.target.value));
                    }}
                    placeholder="Titre de l'article"
                  />
                </label>

                <label className="admin-field">
                  <span>Slug (URL)</span>
                  <input
                    type="text"
                    value={draft.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="mon-article"
                  />
                </label>

                <label className="admin-field">
                  <span>Auteur</span>
                  <input
                    type="text"
                    value={draft.author}
                    onChange={(e) => set("author", e.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Catégorie</span>
                  <select value={draft.category} onChange={(e) => set("category", e.target.value)}>
                    <option value="">— Choisir —</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Design Graphique">Design Graphique</option>
                    <option value="Découverte">Découverte</option>
                    <option value="Communauté">Communauté</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>Date de publication</span>
                  <input
                    type="text"
                    value={draft.published_at}
                    onChange={(e) => set("published_at", e.target.value)}
                    placeholder="Ex: 17 avril 2026"
                  />
                </label>

                <label className="admin-field">
                  <span>Image de couverture (URL)</span>
                  <input
                    type="text"
                    value={draft.cover_image}
                    onChange={(e) => set("cover_image", e.target.value)}
                    placeholder="/images-blog/mon-image.jpg"
                  />
                </label>

                {draft.cover_image && (
                  <div className="fe-span-full">
                    <img
                      src={draft.cover_image}
                      alt="preview"
                      style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }}
                    />
                  </div>
                )}

                <label className="admin-field fe-span-full">
                  <span>Résumé</span>
                  <textarea
                    rows={3}
                    value={draft.excerpt}
                    onChange={(e) => set("excerpt", e.target.value)}
                    placeholder="Courte description affichée dans les listes…"
                  />
                </label>

                <div className="admin-field fe-span-full">
                  <span>Contenu complet</span>
                  <div data-color-mode="light" style={{ marginTop: "0.4rem" }}>
                    <MDEditor
                      value={draft.content}
                      onChange={(val) => set("content", val ?? "")}
                      height={420}
                      preview="edit"
                    />
                  </div>
                </div>

                <div className="admin-field fe-span-full" style={{ display: "flex", gap: "1.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={draft.is_featured}
                      onChange={(e) => set("is_featured", e.target.checked)}
                    />
                    <span>À la une</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={draft.is_popular}
                      onChange={(e) => set("is_popular", e.target.checked)}
                    />
                    <span>Populaire (affiché sur l'accueil)</span>
                  </label>
                </div>
              </div>

              {feedback && (
                <p className={`admin-feedback admin-feedback--${feedback.type}`} style={{ marginTop: "1rem" }}>
                  {feedback.msg}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditorOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="admin-primary-button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  <FaSave /> {saving ? "Enregistrement…" : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
