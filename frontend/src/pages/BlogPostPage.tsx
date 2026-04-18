import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { FaArrowLeft, FaCalendarAlt, FaUser, FaStar, FaRegStar, FaFacebook, FaTwitter, FaWhatsapp, FaLinkedin, FaLink, FaCheck } from "react-icons/fa";
import { fetchBlogPost, fetchBlogPosts, rateBlogPost, type BlogPost } from "../lib/blogApi";

function catClass(category: string): string {
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

function StarRating({ post, onRated }: { post: BlogPost; onRated: (updated: BlogPost) => void }) {
  const storageKey = `blog_rated_${post.slug}`;
  const alreadyVoted = !!localStorage.getItem(storageKey);
  const [hover, setHover] = useState(0);
  const [voted, setVoted] = useState(alreadyVoted);
  const [loading, setLoading] = useState(false);
  const [localPost, setLocalPost] = useState(post);

  useEffect(() => {
    setLocalPost(post);
    setVoted(!!localStorage.getItem(storageKey));
  }, [post.slug]);

  async function handleRate(stars: number) {
    if (voted || loading) return;
    setLoading(true);
    try {
      const updated = await rateBlogPost(post.slug, stars);
      localStorage.setItem(storageKey, String(stars));
      setVoted(true);
      setLocalPost(updated);
      onRated(updated);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  const displayRating = localPost.rating;
  const displayCount = localPost.reviews_count;

  return (
    <div className="blog-post-rating">
      <p className="blog-post-rating__label">
        {voted ? "Merci pour votre note !" : "Notez cet article"}
      </p>
      <div className="blog-post-rating__stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = hover ? s <= hover : voted && s <= Math.round(displayRating);
          return (
            <button
              key={s}
              type="button"
              className={`blog-post-rating__star${filled ? " is-filled" : ""}${voted ? " is-disabled" : ""}`}
              onMouseEnter={() => !voted && setHover(s)}
              onClick={() => handleRate(s)}
              disabled={voted || loading}
              aria-label={`${s} étoile${s > 1 ? "s" : ""}`}
            >
              {filled ? <FaStar /> : <FaRegStar />}
            </button>
          );
        })}
      </div>
      <p className="blog-post-rating__count">
        <strong>{displayRating.toFixed(1)}</strong> / 5 &nbsp;·&nbsp; {displayCount} vote{displayCount > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function ShareBar({ post }: { post: BlogPost }) {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(post.title);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="blog-post-share">
      <span className="blog-post-share__label">Partager :</span>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${url}`}
        target="_blank" rel="noopener noreferrer"
        className="blog-post-share__btn blog-post-share__btn--fb"
        aria-label="Partager sur Facebook"
      >
        <FaFacebook />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`}
        target="_blank" rel="noopener noreferrer"
        className="blog-post-share__btn blog-post-share__btn--tw"
        aria-label="Partager sur Twitter / X"
      >
        <FaTwitter />
      </a>
      <a
        href={`https://wa.me/?text=${text}%20${url}`}
        target="_blank" rel="noopener noreferrer"
        className="blog-post-share__btn blog-post-share__btn--wa"
        aria-label="Partager sur WhatsApp"
      >
        <FaWhatsapp />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`}
        target="_blank" rel="noopener noreferrer"
        className="blog-post-share__btn blog-post-share__btn--li"
        aria-label="Partager sur LinkedIn"
      >
        <FaLinkedin />
      </a>
      <button
        type="button"
        className={`blog-post-share__btn blog-post-share__btn--copy${copied ? " is-copied" : ""}`}
        onClick={copyLink}
        aria-label="Copier le lien"
      >
        {copied ? <FaCheck /> : <FaLink />}
      </button>
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError("");
    window.scrollTo(0, 0);

    fetchBlogPost(slug)
      .then((data) => {
        setPost(data);
        return fetchBlogPosts().then((all) =>
          setRelated(all.filter((p) => p.slug !== slug && p.category === data.category).slice(0, 3))
        );
      })
      .catch(() => setError("Article introuvable."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-post-page">
        <div className="blog-post-skeleton">
          <div className="blog-post-skeleton__cover" />
          <div className="blog-post-skeleton__body">
            <div className="blog-post-skeleton__line blog-post-skeleton__line--sm" />
            <div className="blog-post-skeleton__line blog-post-skeleton__line--lg" />
            <div className="blog-post-skeleton__line" />
            <div className="blog-post-skeleton__line" />
            <div className="blog-post-skeleton__line blog-post-skeleton__line--md" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-post-page">
        <div className="blog-post-not-found">
          <p>😕 {error || "Cet article n'existe pas."}</p>
          <button type="button" className="blog-post-back" onClick={() => navigate("/blog")}>
            <FaArrowLeft /> Retour au blog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-post-page">
      <div className="blog-post-nav">
        <Link to="/blog" className="blog-post-back">
          <FaArrowLeft /> Retour au blog
        </Link>
      </div>

      <article className="blog-post-article">
        {post.cover_image && (
          <div className="blog-post-cover">
            <img src={post.cover_image} alt={post.title} />
          </div>
        )}

        <header className="blog-post-header">
          <span className={`blog-cat-badge ${catClass(post.category)}`}>{post.category}</span>
          <h1>{post.title}</h1>
          <div className="blog-post-meta">
            <span><FaUser /> {post.author}</span>
            <span><FaCalendarAlt /> {post.published_at}</span>
            <span className="blog-post-meta__rating">
              <FaStar style={{ color: "#f59e0b" }} />
              {post.rating.toFixed(1)} ({post.reviews_count} votes)
            </span>
          </div>
          {post.excerpt && <p className="blog-post-excerpt">{post.excerpt}</p>}
        </header>

        <div className="blog-post-content">
          {post.content ? (
            <ReactMarkdown
              components={{
                img: ({ src, alt }) => (
                  <span className="blog-post-img-wrap">
                    <img src={src} alt={alt ?? ""} loading="lazy" />
                    {alt && <span className="blog-post-img-caption">{alt}</span>}
                  </span>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="blog-post-blockquote">{children}</blockquote>
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          ) : (
            <p className="blog-post-no-content">
              Le contenu complet de cet article sera disponible prochainement.
            </p>
          )}
        </div>

        {/* Footer : share + rating */}
        <div className="blog-post-footer">
          <ShareBar post={post} />
          <StarRating post={post} onRated={setPost} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="blog-post-related">
          <h2>Articles similaires</h2>
          <div className="blog-grid blog-grid--related">
            {related.map((r) => (
              <Link to={`/blog/${r.slug}`} key={r.slug} className="blog-card">
                <div className="blog-card__cover">
                  <img src={r.cover_image} alt={r.title} />
                  <span className={`blog-card__cat blog-cat-badge ${catClass(r.category)}`}>{r.category}</span>
                </div>
                <div className="blog-card__body">
                  <span className="blog-card__date">{r.published_at}</span>
                  <h3>{r.title}</h3>
                  <p>{r.excerpt}</p>
                  <div className="blog-card__footer">
                    <span className="blog-card__rating">
                      <FaStar /> {r.rating.toFixed(1)} <em>({r.reviews_count})</em>
                    </span>
                    <span className="blog-card__read">Lire la suite →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
