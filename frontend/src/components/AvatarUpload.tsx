import { useRef, useState } from "react";
import { uploadAvatar } from "../lib/authApi";

interface Props {
  currentUrl: string | null;
  initials: string;
  onUploaded: (newUrl: string) => void;
}

export default function AvatarUpload({ currentUrl, initials, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format invalide. Utilisez JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 2 Mo).");
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const url = await uploadAvatar(file);
      onUploaded(url);
    } catch {
      setError("Échec de l'upload. Réessayez.");
      setPreview(currentUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="avatar-upload">
      <button
        type="button"
        className="avatar-upload__trigger"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title="Changer la photo de profil"
      >
        {preview ? (
          <img src={preview} alt="Avatar" className="avatar-upload__img" />
        ) : (
          <span className="avatar-upload__initials">{initials}</span>
        )}
        <span className="avatar-upload__overlay">
          {loading ? "..." : "Modifier"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="avatar-upload__error">{error}</p>}
    </div>
  );
}
