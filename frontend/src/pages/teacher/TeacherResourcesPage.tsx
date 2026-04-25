import { useEffect, useRef, useState } from "react";
import { useToast } from "../../toast/ToastContext";
import {
  ExternalLink, FileText, Image, Link2, Plus, Trash2, Upload, Video, X,
} from "lucide-react";
import {
  fetchTeacherOverview,
  fetchSessionCourseDays,
  fetchSessionResources,
  createResource,
  deleteResource,
  uploadTeacherAsset,
  type TeacherSession,
  type CourseDay,
  type ResourceView,
  type ResourceType,
} from "../../lib/teacherApi";

// ── file constraints ──────────────────────────────────────────────────────────
const ACCEPTED: Record<string, string> = {
  image: ".jpg,.jpeg,.png,.webp",
  video: ".mp4,.webm,.mov",
  pdf:   ".pdf",
};
const MAX_SIZES: Record<string, number> = {
  image: 2  * 1024 * 1024,
  video: 30 * 1024 * 1024,
  pdf:   5  * 1024 * 1024,
};
const MAX_LABELS: Record<string, string> = {
  image: "2 Mo",
  video: "30 Mo",
  pdf:   "5 Mo",
};

function ResourceIcon({ type }: { type: string }) {
  if (type === "pdf")   return <FileText size={20} style={{ color: "#ef4444" }} />;
  if (type === "video") return <Video    size={20} style={{ color: "#8b5cf6" }} />;
  if (type === "image") return <Image    size={20} style={{ color: "#f59e0b" }} />;
  return <Link2 size={20} style={{ color: "#0ea5e9" }} />;
}

function typeLabel(type: string) {
  return { pdf: "PDF", link: "Lien", video: "Vidéo", image: "Image" }[type] ?? type;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export default function TeacherResourcesPage() {
  const [sessions, setSessions]                   = useState<TeacherSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [courseDays, setCourseDays]               = useState<CourseDay[]>([]);
  const [selectedCourseDayId, setSelectedCourseDayId] = useState<number | null>(null);
  const [resources, setResources]                 = useState<ResourceView[]>([]);
  const [isLoading, setIsLoading]                 = useState(true);
  const [showForm, setShowForm]                   = useState(false);
  const [saving, setSaving]                       = useState(false);
  const { success, error: toastError } = useToast();

  // form state
  const [title, setTitle]               = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("link");
  const [url, setUrl]                   = useState("");
  const [publishedAt, setPublishedAt]   = useState("");

  // upload state
  const [uploadState, setUploadState]   = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl]   = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTeacherOverview()
      .then((o) => {
        setSessions(o.sessions);
        if (o.sessions.length > 0) setSelectedSessionId(o.sessions[0].id);
      })
      .catch((e) => toastError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    setResources([]);
    setCourseDays([]);
    setSelectedCourseDayId(null);
    Promise.all([
      fetchSessionResources(selectedSessionId),
      fetchSessionCourseDays(selectedSessionId),
    ])
      .then(([resourceRows, dayRows]) => {
        setResources(resourceRows);
        setCourseDays(dayRows);
        setSelectedCourseDayId(dayRows[0]?.id ?? null);
      })
      .catch(() => {});
  }, [selectedSessionId]);

  function resetForm() {
    setTitle(""); setUrl(""); setPublishedAt(""); setResourceType("link");
    setUploadState("idle"); setUploadedUrl(""); setUploadedName("");
  }

  function handleTypeChange(t: ResourceType) {
    setResourceType(t);
    setUrl(""); setUploadedUrl(""); setUploadedName(""); setUploadState("idle");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = MAX_SIZES[resourceType] ?? 0;
    if (file.size > maxBytes) {
      toastError(`Fichier trop volumineux. Limite : ${MAX_LABELS[resourceType]}.`);
      e.target.value = "";
      return;
    }

    setUploadState("uploading");
    setUploadProgress(0);

    // simulate progress while uploading (XHR would be needed for real progress)
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 10, 85));
    }, 150);

    try {
      const asset = await uploadTeacherAsset(file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedUrl(asset.public_url);
      setUploadedName(file.name);
      setUploadState("done");
    } catch (err) {
      clearInterval(progressInterval);
      setUploadState("error");
      toastError(err instanceof Error ? err.message : "Erreur lors de l'upload.");
    }

    e.target.value = "";
  }

  async function handleCreate() {
    if (!selectedSessionId || !title.trim()) {
      toastError("Titre requis.");
      return;
    }

    const finalUrl = resourceType === "link" ? url.trim() : uploadedUrl;
    if (!finalUrl) {
      toastError(resourceType === "link" ? "URL requise." : "Veuillez uploader un fichier.");
      return;
    }

    setSaving(true);
    try {
      const resource = await createResource(selectedSessionId, {
        title: title.trim(),
        course_day_id: selectedCourseDayId,
        resource_type: resourceType,
        url: finalUrl,
        published_at: publishedAt || null,
      });
      setResources((prev) => [resource, ...prev]);
      setShowForm(false);
      resetForm();
      success("Ressource ajoutée.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Erreur lors de l'ajout de la ressource.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resourceId: number) {
    if (!confirm("Supprimer cette ressource ?")) return;
    await deleteResource(resourceId);
    setResources((prev) => prev.filter((r) => r.id !== resourceId));
  }

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;

  const needsUpload = resourceType !== "link";

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Ressources pédagogiques</h1>
        <p className="dsh-page__subtitle">
          Partagez des images, PDF, vidéos et liens avec vos étudiants.
        </p>
      </div>

      {sessions.length > 0 && (
        <div className="dsh-section-bar">
          <label className="dsh-select-label">
            Session :
            <select
              className="dsh-select"
              value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.formation_title} — {s.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="dsh-btn dsh-btn--primary"
            onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Annuler" : "Ajouter une ressource"}
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="dsh-form-card">
          <h3>Nouvelle ressource</h3>

          {/* Type selector */}
          <div className="res-type-picker">
            {(["link", "image", "pdf", "video"] as ResourceType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`res-type-btn${resourceType === t ? " is-active" : ""}`}
                onClick={() => handleTypeChange(t)}
              >
                <ResourceIcon type={t} />
                <span>{typeLabel(t)}</span>
              </button>
            ))}
          </div>

          <div className="dsh-form-row">
            <label className="dsh-form-field">
              <span>Journée de cours <small>(optionnel)</small></span>
              <select
                className="dsh-select"
                value={selectedCourseDayId ?? ""}
                onChange={(e) => setSelectedCourseDayId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Non lié</option>
                {courseDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.title} · {new Date(day.scheduled_at).toLocaleDateString("fr-FR")}
                  </option>
                ))}
              </select>
            </label>
            <label className="dsh-form-field">
              <span>Titre de la ressource</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Cours chapitre 3"
              />
            </label>
            <label className="dsh-form-field">
              <span>Publication différée (optionnel)</span>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </label>
          </div>

          {/* URL input for links */}
          {resourceType === "link" && (
            <label className="dsh-form-field">
              <span>URL du lien</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
          )}

          {/* File uploader for image / pdf / video */}
          {needsUpload && (
            <div className="res-upload-zone">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED[resourceType]}
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              {uploadState === "idle" && (
                <button
                  type="button"
                  className="res-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={22} />
                  <span>
                    Cliquer pour uploader{" "}
                    <strong>
                      {resourceType === "image" ? "une image (JPG, PNG, WebP)"
                        : resourceType === "pdf" ? "un PDF"
                        : "une vidéo (MP4, WebM, MOV)"}
                    </strong>
                  </span>
                  <span className="res-upload-limit">
                    Taille max : {MAX_LABELS[resourceType]}
                  </span>
                </button>
              )}

              {uploadState === "uploading" && (
                <div className="res-upload-progress">
                  <span>Upload en cours…</span>
                  <div className="res-progress-bar">
                    <div
                      className="res-progress-bar__fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="res-progress-pct">{uploadProgress}%</span>
                </div>
              )}

              {uploadState === "done" && (
                <div className="res-upload-done">
                  <ResourceIcon type={resourceType} />
                  <span className="res-upload-done__name">{uploadedName}</span>
                  <button
                    type="button"
                    className="dsh-icon-btn dsh-icon-btn--danger"
                    title="Changer de fichier"
                    onClick={() => { setUploadState("idle"); setUploadedUrl(""); setUploadedName(""); }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {uploadState === "error" && (
                <button
                  type="button"
                  className="res-upload-btn res-upload-btn--error"
                  onClick={() => { setUploadState("idle"); fileInputRef.current?.click(); }}
                >
                  <Upload size={22} />
                  <span>Réessayer l'upload</span>
                </button>
              )}
            </div>
          )}

          <div className="dsh-form-actions">
            <button
              type="button"
              className="dsh-btn dsh-btn--ghost"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="dsh-btn dsh-btn--primary"
              disabled={saving || uploadState === "uploading"}
              onClick={handleCreate}
            >
              {saving ? "Envoi…" : "Enregistrer la ressource"}
            </button>
          </div>
        </div>
      )}

      {/* ── Resources list ── */}
      {resources.length === 0 && !showForm ? (
        <div className="dsh-empty">
          <p>Aucune ressource pour cette session. Ajoutez-en une ci-dessus.</p>
        </div>
      ) : (
        <div className="res-grid">
          {resources.map((r) => {
            const day = courseDays.find((item) => item.id === r.course_day_id);
            return (
              <div className="res-card" key={r.id}>
                <div className="res-card__icon-wrap">
                  <ResourceIcon type={r.resource_type} />
                </div>
                <div className="res-card__body">
                  <strong className="res-card__title">{r.title}</strong>
                  <span className="res-card__meta">
                    {typeLabel(r.resource_type)}
                    {r.published_at
                      ? ` · Publié le ${new Date(r.published_at).toLocaleDateString("fr-FR")}`
                      : " · Publié immédiatement"}
                    {day ? ` · ${day.title}` : ""}
                  </span>
                </div>
                <div className="res-card__actions">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dsh-icon-btn"
                    title="Ouvrir"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button
                    type="button"
                    className="dsh-icon-btn dsh-icon-btn--danger"
                    title="Supprimer"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
