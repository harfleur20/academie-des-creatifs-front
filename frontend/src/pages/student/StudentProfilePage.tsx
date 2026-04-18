import { useEffect, useRef, useState } from "react";
import { Camera, Check, Eye, EyeOff, Lock, Mail, Phone, Shield, User } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { changePassword, updateProfile, uploadAvatar } from "../../lib/authApi";
import { fetchStudentDashboardSummary } from "../../lib/commerceApi";

const AVATAR_PALETTE = [
  ["#6366f1", "#4f46e5"],
  ["#0ea5e9", "#0284c7"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0d9488"],
];
function avatarGradient(name: string) {
  const i = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_PALETTE.length;
  return `linear-gradient(135deg, ${AVATAR_PALETTE[i][0]}, ${AVATAR_PALETTE[i][1]})`;
}

type Feedback = { type: "success" | "error"; message: string };

function FeedbackBanner({ fb, onClose }: { fb: Feedback; onClose: () => void }) {
  return (
    <div className={`sprof-feedback sprof-feedback--${fb.type}`}>
      {fb.type === "success" ? <Check size={15} /> : <Shield size={15} />}
      <span>{fb.message}</span>
      <button type="button" className="sprof-feedback__close" onClick={onClose}>×</button>
    </div>
  );
}

export default function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const fullName = user?.full_name ?? "";
  const initials = fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const gradient = avatarGradient(fullName);

  /* ── Student code ── */
  const [studentCode, setStudentCode] = useState<string | null>(null);
  useEffect(() => {
    fetchStudentDashboardSummary().then((s) => setStudentCode(s.student_code)).catch(() => {});
  }, []);

  /* ── Info form ── */
  const [infoName, setInfoName] = useState(fullName);
  const [infoPhone, setInfoPhone] = useState(user?.phone ?? "");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoFb, setInfoFb] = useState<Feedback | null>(null);

  /* ── Password form ── */
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwFb, setPwFb] = useState<Feedback | null>(null);

  /* ── Avatar ── */
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarFb, setAvatarFb] = useState<Feedback | null>(null);

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!infoName.trim()) return;
    setInfoLoading(true);
    setInfoFb(null);
    try {
      await updateProfile({ full_name: infoName.trim(), phone: infoPhone.trim() || null });
      await refreshUser();
      setInfoFb({ type: "success", message: "Informations mises à jour avec succès." });
    } catch {
      setInfoFb({ type: "error", message: "Une erreur est survenue. Réessayez." });
    } finally {
      setInfoLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwFb(null);
    if (pwNew.length < 8) {
      setPwFb({ type: "error", message: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwFb({ type: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwCurrent, pwNew);
      setPwFb({ type: "success", message: "Mot de passe modifié avec succès." });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? "Mot de passe actuel incorrect.";
      setPwFb({ type: "error", message: msg });
    } finally {
      setPwLoading(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarFb(null);
    try {
      await uploadAvatar(file);
      await refreshUser();
      setAvatarFb({ type: "success", message: "Photo de profil mise à jour." });
    } catch {
      setAvatarFb({ type: "error", message: "Impossible de charger l'image. Format accepté : PNG, JPG, WebP (max 2 Mo)." });
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const pwStrength = pwNew.length === 0 ? null : pwNew.length < 8 ? "weak" : pwNew.length < 12 ? "medium" : "strong";

  return (
    <div className="sprof-page">
      <div className="sprof-header">
        <h1 className="sprof-header__title">Mon profil</h1>
        <p className="sprof-header__sub">Gérez vos informations personnelles et votre sécurité</p>
      </div>

      <div className="sprof-grid">
        {/* ── LEFT: Avatar + compte ── */}
        <aside className="sprof-aside">
          {/* Avatar card */}
          <div className="sprof-card sprof-avatar-card">
            <div className="sprof-avatar-wrap">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={fullName} className="sprof-avatar-img" />
              ) : (
                <span className="sprof-avatar-initials" style={{ background: gradient }}>{initials}</span>
              )}
              <button
                type="button"
                className="sprof-avatar-btn"
                onClick={() => fileRef.current?.click()}
                disabled={avatarLoading}
                aria-label="Changer la photo"
              >
                {avatarLoading ? <span className="sprof-spinner" /> : <Camera size={14} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>
            <strong className="sprof-avatar-name">{fullName}</strong>
            <span className="sprof-avatar-role">Étudiant</span>
            {avatarFb && <FeedbackBanner fb={avatarFb} onClose={() => setAvatarFb(null)} />}
            <p className="sprof-avatar-hint">PNG, JPG ou WebP · Max 2 Mo</p>
          </div>

          {/* Compte card */}
          <div className="sprof-card sprof-info-card">
            <h3 className="sprof-card__title">Informations du compte</h3>
            <div className="sprof-info-row">
              <span className="sprof-info-row__label">Code étudiant</span>
              <span className="sprof-info-row__value sprof-info-row__value--mono">
                {studentCode ?? "—"}
              </span>
            </div>
            <div className="sprof-info-row">
              <span className="sprof-info-row__label">Rôle</span>
              <span className="sprof-info-row__value">Étudiant</span>
            </div>
            <div className="sprof-info-row">
              <span className="sprof-info-row__label">Statut</span>
              <span className="sprof-badge sprof-badge--active">Actif</span>
            </div>
          </div>
        </aside>

        {/* ── RIGHT: Forms ── */}
        <div className="sprof-main">
          {/* Informations personnelles */}
          <div className="sprof-card">
            <h3 className="sprof-card__title"><User size={16} /> Informations personnelles</h3>
            {infoFb && <FeedbackBanner fb={infoFb} onClose={() => setInfoFb(null)} />}
            <form className="sprof-form" onSubmit={handleInfoSubmit}>
              <div className="sprof-field">
                <label className="sprof-label">Nom complet</label>
                <div className="sprof-input-wrap">
                  <User size={15} className="sprof-input-icon" />
                  <input
                    type="text"
                    className="sprof-input"
                    value={infoName}
                    onChange={(e) => setInfoName(e.target.value)}
                    required
                    placeholder="Votre nom complet"
                  />
                </div>
              </div>

              <div className="sprof-field">
                <label className="sprof-label">Adresse e-mail <span className="sprof-field__readonly">(non modifiable)</span></label>
                <div className="sprof-input-wrap sprof-input-wrap--readonly">
                  <Mail size={15} className="sprof-input-icon" />
                  <input type="email" className="sprof-input" value={user?.email ?? ""} readOnly />
                </div>
              </div>

              <div className="sprof-field">
                <label className="sprof-label">Téléphone</label>
                <div className="sprof-input-wrap">
                  <Phone size={15} className="sprof-input-icon" />
                  <input
                    type="tel"
                    className="sprof-input"
                    value={infoPhone}
                    onChange={(e) => setInfoPhone(e.target.value)}
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
              </div>

              <div className="sprof-form__footer">
                <button type="submit" className="sprof-btn sprof-btn--primary" disabled={infoLoading}>
                  {infoLoading ? <span className="sprof-spinner" /> : <Check size={15} />}
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>

          {/* Sécurité */}
          <div className="sprof-card">
            <h3 className="sprof-card__title"><Lock size={16} /> Sécurité — Changer le mot de passe</h3>
            {pwFb && <FeedbackBanner fb={pwFb} onClose={() => setPwFb(null)} />}
            <form className="sprof-form" onSubmit={handlePasswordSubmit}>
              <div className="sprof-field">
                <label className="sprof-label">Mot de passe actuel</label>
                <div className="sprof-input-wrap">
                  <Lock size={15} className="sprof-input-icon" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    className="sprof-input"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  <button type="button" className="sprof-input-toggle" onClick={() => setShowCurrent((v) => !v)}>
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="sprof-field">
                <label className="sprof-label">Nouveau mot de passe</label>
                <div className="sprof-input-wrap">
                  <Lock size={15} className="sprof-input-icon" />
                  <input
                    type={showNew ? "text" : "password"}
                    className="sprof-input"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    required
                    placeholder="Minimum 8 caractères"
                  />
                  <button type="button" className="sprof-input-toggle" onClick={() => setShowNew((v) => !v)}>
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {pwStrength && (
                  <div className="sprof-pw-strength">
                    <div className={`sprof-pw-bar sprof-pw-bar--${pwStrength}`} />
                    <span className={`sprof-pw-label sprof-pw-label--${pwStrength}`}>
                      {pwStrength === "weak" ? "Faible" : pwStrength === "medium" ? "Moyen" : "Fort"}
                    </span>
                  </div>
                )}
              </div>

              <div className="sprof-field">
                <label className="sprof-label">Confirmer le nouveau mot de passe</label>
                <div className="sprof-input-wrap">
                  <Lock size={15} className="sprof-input-icon" />
                  <input
                    type="password"
                    className="sprof-input"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  {pwConfirm && (
                    <span className={`sprof-input-match ${pwNew === pwConfirm ? "sprof-input-match--ok" : "sprof-input-match--no"}`}>
                      {pwNew === pwConfirm ? <Check size={13} /> : "✕"}
                    </span>
                  )}
                </div>
              </div>

              <div className="sprof-form__footer">
                <button type="submit" className="sprof-btn sprof-btn--primary" disabled={pwLoading}>
                  {pwLoading ? <span className="sprof-spinner" /> : <Shield size={15} />}
                  Modifier le mot de passe
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
