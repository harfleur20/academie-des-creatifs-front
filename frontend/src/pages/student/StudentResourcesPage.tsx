import { useState, useEffect } from "react";
import { ExternalLink, FileText, Image, Link2, Video, X } from "lucide-react";
import { fetchMyResources, type StudentResource } from "../../lib/studentApi";

function ResourceIcon({ type }: { type: string }) {
  if (type === "pdf")   return <FileText size={18} style={{ color: "#ef4444" }} />;
  if (type === "video") return <Video    size={18} style={{ color: "#8b5cf6" }} />;
  if (type === "image") return <Image    size={18} style={{ color: "#f59e0b" }} />;
  return <Link2 size={18} style={{ color: "#0ea5e9" }} />;
}

function typeLabel(type: string) {
  return { pdf: "PDF", link: "Lien", video: "Vidéo", image: "Image" }[type] ?? type;
}

type PreviewTarget = { type: "image" | "video"; url: string; title: string } | null;

export default function StudentResourcesPage() {
  const [resources, setResources] = useState<StudentResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [preview, setPreview] = useState<PreviewTarget>(null);

  useEffect(() => {
    fetchMyResources().then(setResources).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const sessions = Array.from(new Set(resources.map((r) => r.session_label)));
  const filtered = filter === "all" ? resources : resources.filter((r) => r.session_label === filter);

  function handleOpen(r: StudentResource) {
    if (r.resource_type === "image") {
      setPreview({ type: "image", url: r.url, title: r.title });
    } else if (r.resource_type === "video") {
      setPreview({ type: "video", url: r.url, title: r.title });
    } else {
      window.open(r.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Ressources</h1>
        <p className="dsh-page__subtitle">
          {resources.length} ressource{resources.length !== 1 ? "s" : ""} disponible{resources.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessions.length > 1 && (
        <div className="dsh-filter-bar">
          <button
            type="button"
            className={`dsh-filter-btn${filter === "all" ? " is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Toutes
          </button>
          {sessions.map((s) => (
            <button
              key={s}
              type="button"
              className={`dsh-filter-btn${filter === s ? " is-active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="dsh-empty"><p>Aucune ressource disponible pour le moment.</p></div>
      ) : (
        <div className="res-grid">
          {filtered.map((r) => (
            <div className="res-card" key={r.id}>
              <div className="res-card__icon-wrap">
                <ResourceIcon type={r.resource_type} />
              </div>
              <div className="res-card__body">
                <strong className="res-card__title">{r.title}</strong>
                <span className="res-card__meta">
                  {typeLabel(r.resource_type)} · {r.session_label}
                </span>
              </div>
              <div className="res-card__actions">
                <button
                  type="button"
                  className="dsh-btn dsh-btn--ghost dsh-btn--sm"
                  onClick={() => handleOpen(r)}
                >
                  <ExternalLink size={13} />
                  {r.resource_type === "pdf" ? "Télécharger"
                    : r.resource_type === "image" || r.resource_type === "video" ? "Voir"
                    : "Ouvrir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="dsh-modal-overlay"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="dsh-media-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dsh-media-preview__header">
              <strong>{preview.title}</strong>
              <button
                type="button"
                className="dsh-icon-btn"
                onClick={() => setPreview(null)}
              >
                <X size={18} />
              </button>
            </div>
            {preview.type === "image" ? (
              <img src={preview.url} alt={preview.title} className="dsh-media-preview__img" />
            ) : (
              <video
                src={preview.url}
                controls
                className="dsh-media-preview__video"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
