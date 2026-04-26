import { useEffect, useId, useState } from "react";

type Props = {
  url: string;
  thumbnail?: string;
};

function getYouTubeId(videoUrl: string): string {
  try {
    const parsedUrl = new URL(videoUrl);
    const host = parsedUrl.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const watchId = parsedUrl.searchParams.get("v");
      if (watchId) return watchId;

      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
        return parts[1] ?? "";
      }
    }
  } catch {
    const match = videoUrl.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : "";
  }

  return "";
}

function isNativeVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

function getYouTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function getPreviewUrl(url: string, thumbnail?: string): string {
  const customThumbnail = thumbnail?.trim();
  if (customThumbnail) return customThumbnail;

  const youtubeId = getYouTubeId(url);
  return youtubeId ? getYouTubeThumbnail(youtubeId) : "";
}

function getEmbedUrl(url: string): string {
  const youtubeId = getYouTubeId(url);
  if (youtubeId) return getYouTubeEmbedUrl(youtubeId);

  return url;
}

export default function VideoCard({ url, thumbnail }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const nativeVideo = isNativeVideo(url);
  const previewUrl = getPreviewUrl(url, thumbnail);
  const embedUrl = getEmbedUrl(url);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.classList.add("vid-modal-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("vid-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const preview = nativeVideo ? (
    <video
      src={url}
      poster={previewUrl || undefined}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      className="vid-card__media"
    />
  ) : previewUrl ? (
    <img src={previewUrl} alt="" className="vid-card__media" loading="lazy" />
  ) : (
    <div className="vid-card__media vid-card__media--empty" aria-hidden="true" />
  );

  return (
    <>
      <button
        className="vid-card"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Lire la vidéo"
      >
        <span className="vid-card__frame">
          {preview}
          <span className="vid-card__shade" aria-hidden="true" />
          <span className="vid-card__play" aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="28" cy="28" r="28" fill="rgba(255,255,255,0.94)" />
              <polygon points="23,17 43,28 23,39" fill="#0f1e3d" />
            </svg>
          </span>
        </span>
      </button>

      {isOpen && (
        <div
          className="vid-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            className="vid-modal__backdrop"
            type="button"
            aria-label="Fermer la vidéo"
            onClick={() => setIsOpen(false)}
          />
          <div className="vid-modal__panel">
            <div className="vid-modal__header">
              <h3 id={titleId}>Vidéo Académie des Créatifs</h3>
              <button
                className="vid-modal__close"
                type="button"
                aria-label="Fermer la vidéo"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="vid-modal__player">
              {nativeVideo ? (
                <video src={url} controls autoPlay className="vid-modal__video" />
              ) : (
                <iframe
                  src={embedUrl}
                  title="Vidéo Académie des Créatifs"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
