import { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor/nohighlight";
import { FaEdit, FaImage, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import {
  fetchBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPost,
  type BlogPostPayload,
} from "../../lib/blogApi";
import { uploadAdminAsset } from "../../lib/catalogApi";
import { useToast } from "../../toast/ToastContext";

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

function todayFr(): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function emptyDraft(): Draft {
  return {
    slug: "", title: "", excerpt: "", content: "",
    cover_image: "", author: "Francis Kenne", category: "",
    is_featured: false, is_popular: false, published_at: todayFr(),
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
  const { success, error: toastError } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [slugLocked, setSlugLocked] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBlogPosts()
      .then(setPosts)
      .catch(() => setLoadError("Impossible de charger les articles."))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setSlugLocked(true);
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
    setSlugLocked(true);
    setEditorOpen(true);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    if (!draft.title.trim()) { toastError("Le titre est requis."); return; }
    if (!draft.slug.trim()) { toastError("Le slug est requis."); return; }
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await updateBlogPost(editingId, draft);
        setPosts((p) => p.map((x) => (x.id === editingId ? updated : x)));
        success("Article mis à jour.");
      } else {
        const created = await createBlogPost(draft as BlogPostPayload);
        setPosts((p) => [created, ...p]);
        success("Article créé.");
      }
      setEditorOpen(false);
    } catch (e: unknown) {
      toastError((e as Error).message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const asset = await uploadAdminAsset(file);
      set("cover_image", asset.public_url);
    } catch {
      toastError("Échec de l'upload de l'image.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer cet article définitivement ?")) return;
    setDeletingId(id);
    try {
      await deleteBlogPost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      success("Article supprimé.");
    } catch {
      toastError("Erreur lors de la suppression.");
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
      {loadError && <div className="adm-state-card adm-state-card--error"><p>{loadError}</p></div>}

      {!loading && !loadError && (
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

      {/* ── Éditeur plein écran ── */}
      {editorOpen && (
        <div className="admin-drawer" onClick={() => setEditorOpen(false)}>
          <div className="admin-drawer__backdrop" />
          <div className="admin-drawer__panel" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="admin-drawer__header">
              <div>
                <p className="adm-eyebrow" style={{ margin: 0, fontSize: "0.7rem" }}>Blog</p>
                <h3 style={{ margin: "0.15rem 0 0" }}>
                  {editingId ? "Modifier l'article" : "Nouvel article"}
                </h3>
              </div>
              <div className="blog-ed-header-actions">
                <button type="button" className="admin-secondary-button" onClick={() => setEditorOpen(false)}>
                  Annuler
                </button>
                <button type="button" className="adm-btn adm-btn--primary" disabled={saving} onClick={() => void handleSave()}>
                  <FaSave /> {saving ? "Enregistrement…" : "Sauvegarder"}
                </button>
                <button type="button" className="blog-ed-close" onClick={() => setEditorOpen(false)} aria-label="Fermer">
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Split body */}
            <div className="blog-ed-body">

              {/* ─ Sidebar gauche : métadonnées ─ */}
              <div className="blog-ed-sidebar">

                <div className="blog-ed-section">
                  <p className="blog-ed-section__label">Informations</p>
                  <label className="admin-field">
                    <span>Titre de l'article</span>
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
                  <div className="admin-field">
                    <span>Slug (URL)</span>
                    <div className="blog-ed-slug-row">
                      <input
                        type="text"
                        value={draft.slug}
                        readOnly={slugLocked}
                        onChange={(e) => set("slug", e.target.value)}
                        placeholder="mon-article"
                        className={slugLocked ? "blog-ed-slug-locked" : ""}
                      />
                      <button
                        type="button"
                        className="blog-ed-slug-btn"
                        onClick={() => setSlugLocked((l) => !l)}
                        title={slugLocked ? "Modifier le slug" : "Verrouiller le slug"}
                      >
                        <FaEdit />
                        {slugLocked ? "Modifier" : "Verrouiller"}
                      </button>
                    </div>
                  </div>
                  <div className="blog-ed-row">
                    <label className="admin-field">
                      <span>Auteur</span>
                      <input type="text" value={draft.author} onChange={(e) => set("author", e.target.value)} />
                    </label>
                    <div className="admin-field">
                      <span>Date de publication</span>
                      <div className="blog-ed-date-row">
                        <input
                          type="text"
                          value={draft.published_at}
                          onChange={(e) => set("published_at", e.target.value)}
                          placeholder="24 avril 2026"
                        />
                      </div>
                    </div>
                  </div>
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
                </div>

                <div className="blog-ed-section">
                  <p className="blog-ed-section__label">Image de couverture</p>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleCoverUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {draft.cover_image ? (
                    <div className="blog-ed-cover-wrap">
                      <img src={draft.cover_image} alt="aperçu" className="blog-ed-cover-preview" />
                      <div className="blog-ed-cover-actions">
                        <button
                          type="button"
                          className="blog-ed-cover-btn"
                          disabled={uploadingCover}
                          onClick={() => coverInputRef.current?.click()}
                        >
                          <FaImage /> {uploadingCover ? "Upload…" : "Changer"}
                        </button>
                        <button
                          type="button"
                          className="blog-ed-cover-btn blog-ed-cover-btn--danger"
                          onClick={() => set("cover_image", "")}
                        >
                          <FaTimes /> Supprimer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="blog-ed-cover-drop"
                      disabled={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      <FaImage className="blog-ed-cover-drop__icon" />
                      <span>{uploadingCover ? "Upload en cours…" : "Cliquer pour choisir une image"}</span>
                      <small>JPG, PNG, WEBP — max 8 Mo</small>
                    </button>
                  )}
                </div>

                <div className="blog-ed-section">
                  <p className="blog-ed-section__label">Résumé</p>
                  <label className="admin-field">
                    <textarea
                      rows={4}
                      value={draft.excerpt}
                      onChange={(e) => set("excerpt", e.target.value)}
                      placeholder="Courte description affichée dans les listes…"
                    />
                  </label>
                </div>

                <div className="blog-ed-section">
                  <p className="blog-ed-section__label">Mise en avant</p>
                  <label className="blog-ed-toggle">
                    <input type="checkbox" checked={draft.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
                    <div className="blog-ed-toggle__info">
                      <span>À la une</span>
                      <small>Affiché en tête du blog</small>
                    </div>
                  </label>
                  <label className="blog-ed-toggle">
                    <input type="checkbox" checked={draft.is_popular} onChange={(e) => set("is_popular", e.target.checked)} />
                    <div className="blog-ed-toggle__info">
                      <span>Populaire</span>
                      <small>Affiché sur la page d'accueil</small>
                    </div>
                  </label>
                </div>

              </div>

              {/* ─ Zone droite : éditeur markdown ─ */}
              <div className="blog-ed-content">
                <p className="blog-ed-section__label" style={{ marginBottom: "0.75rem" }}>Contenu complet</p>
                <div data-color-mode="light" className="blog-ed-md-wrap">
                  <MDEditor
                    value={draft.content}
                    onChange={(val) => set("content", val ?? "")}
                    height="100%"
                    preview="edit"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
