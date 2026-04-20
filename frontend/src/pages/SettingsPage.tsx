import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Shield,
  Trash2,
  User,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { changePassword, updateProfile, uploadAvatar } from "../lib/authApi";

type Tab = "profil" | "securite" | "notifications" | "confidentialite";
type Feedback = { type: "success" | "error"; message: string };

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

function FeedbackBanner({ fb, onClose }: { fb: Feedback; onClose: () => void }) {
  return (
    <div className={`stg-feedback stg-feedback--${fb.type}`}>
      {fb.type === "success" ? <Check size={14} /> : <Shield size={14} />}
      <span>{fb.message}</span>
      <button type="button" onClick={onClose}>×</button>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="stg-card">
      <div className="stg-card__head">
        <span className="stg-card__icon">{icon}</span>
        <h3 className="stg-card__title">{title}</h3>
      </div>
      <div className="stg-card__body">{children}</div>
    </div>
  );
}

/* ══ Profil Tab ══════════════════════════════════════════════════════════════ */
function ProfilTab() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const fullName = user?.full_name ?? "";
  const initials = fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const gradient = avatarGradient(fullName);

  const [name, setName] = useState(fullName);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null);

  useEffect(() => {
    setName(user?.full_name ?? "");
    setPhone(user?.phone ?? "");
    setAvatarPreview(user?.avatar_url ?? null);
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setFb(null);
    try {
      await updateProfile({ full_name: name.trim(), phone: phone.trim() || null });
      await refreshUser();
      setFb({ type: "success", message: "Profil mis à jour avec succès." });
    } catch {
      setFb({ type: "error", message: "Erreur lors de la mise à jour." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch {
      setAvatarPreview(user?.avatar_url ?? null);
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <>
      <SectionCard title="Photo de profil" icon={<UserCircle size={18} />}>
        <div className="stg-avatar-row">
          <div className="stg-avatar-wrap" onClick={() => fileRef.current?.click()}>
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" className="stg-avatar-img" />
              : <span className="stg-avatar-initials" style={{ background: gradient }}>{initials}</span>
            }
            <div className="stg-avatar-overlay">
              <Camera size={18} />
              {avatarLoading ? "Envoi…" : "Modifier"}
            </div>
          </div>
          <div className="stg-avatar-info">
            <p>Cliquez sur la photo pour la modifier.</p>
            <p className="stg-muted">JPG, PNG, WEBP — max 5 Mo</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
        </div>
      </SectionCard>

      <SectionCard title="Informations personnelles" icon={<User size={18} />}>
        {fb && <FeedbackBanner fb={fb} onClose={() => setFb(null)} />}
        <form className="stg-form" onSubmit={handleSubmit}>
          <div className="stg-form__row">
            <label className="stg-label">
              <span>Nom complet</span>
              <div className="stg-input-wrap">
                <User size={14} className="stg-input-icon" />
                <input
                  className="stg-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom complet"
                  required
                />
              </div>
            </label>
            <label className="stg-label">
              <span>Email</span>
              <div className="stg-input-wrap">
                <Mail size={14} className="stg-input-icon" />
                <input className="stg-input stg-input--disabled" value={user?.email ?? ""} disabled />
              </div>
              <span className="stg-hint">L'email ne peut pas être modifié ici.</span>
            </label>
          </div>
          <label className="stg-label">
            <span>Téléphone</span>
            <div className="stg-input-wrap">
              <Phone size={14} className="stg-input-icon" />
              <input
                className="stg-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 00 00 00 00 00"
              />
            </div>
          </label>
          <div className="stg-form__footer">
            <button type="submit" className="stg-btn stg-btn--primary" disabled={loading}>
              {loading ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Rôle & compte" icon={<Shield size={18} />}>
        <div className="stg-info-grid">
          <div className="stg-info-item">
            <span className="stg-info-item__label">Rôle</span>
            <span className={`stg-info-item__value stg-badge stg-badge--${user?.role === "guest" ? "gray" : "green"}`}>
              {user?.role === "admin" ? "Administrateur" : user?.role === "teacher" ? "Enseignant" : user?.role === "guest" ? "Invité" : "Étudiant"}
            </span>
          </div>
          <div className="stg-info-item">
            <span className="stg-info-item__label">Statut</span>
            <span className={`stg-badge stg-badge--${user?.status === "active" ? "green" : "red"}`}>
              {user?.status === "active" ? "Actif" : "Suspendu"}
            </span>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

/* ══ Sécurité Tab ═══════════════════════════════════════════════════════════ */
function SecuriteTab() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);

  const strength = newPw.length === 0 ? 0 : newPw.length < 6 ? 1 : newPw.length < 10 ? 2 : /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) ? 4 : 3;
  const strengthLabel = ["", "Faible", "Moyen", "Bon", "Fort"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#22c55e", "#1c8480"][strength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFb(null);
    if (newPw.length < 8) return setFb({ type: "error", message: "Au moins 8 caractères requis." });
    if (newPw !== confirm) return setFb({ type: "error", message: "Les mots de passe ne correspondent pas." });
    setLoading(true);
    try {
      await changePassword(current, newPw);
      setFb({ type: "success", message: "Mot de passe modifié avec succès." });
      setCurrent(""); setNewPw(""); setConfirm("");
    } catch {
      setFb({ type: "error", message: "Mot de passe actuel incorrect." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SectionCard title="Changer le mot de passe" icon={<KeyRound size={18} />}>
        {fb && <FeedbackBanner fb={fb} onClose={() => setFb(null)} />}
        <form className="stg-form" onSubmit={handleSubmit}>
          <label className="stg-label">
            <span>Mot de passe actuel</span>
            <div className="stg-input-wrap">
              <Lock size={14} className="stg-input-icon" />
              <input
                className="stg-input"
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
              <button type="button" className="stg-eye-btn" onClick={() => setShowCurrent(v => !v)}>
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>
          <label className="stg-label">
            <span>Nouveau mot de passe</span>
            <div className="stg-input-wrap">
              <Lock size={14} className="stg-input-icon" />
              <input
                className="stg-input"
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
              <button type="button" className="stg-eye-btn" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {newPw.length > 0 && (
              <div className="stg-strength">
                <div className="stg-strength__bar">
                  {[1,2,3,4].map(i => (
                    <span key={i} className="stg-strength__seg" style={{ background: i <= strength ? strengthColor : "#e5e7eb" }} />
                  ))}
                </div>
                <span style={{ color: strengthColor, fontSize: "0.72rem", fontWeight: 700 }}>{strengthLabel}</span>
              </div>
            )}
          </label>
          <label className="stg-label">
            <span>Confirmer le nouveau mot de passe</span>
            <div className="stg-input-wrap">
              <Lock size={14} className="stg-input-icon" />
              <input
                className="stg-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {confirm.length > 0 && (
                <span style={{ position: "absolute", right: "0.75rem", color: confirm === newPw ? "#1c8480" : "#ef4444" }}>
                  {confirm === newPw ? <Check size={14} /> : "✗"}
                </span>
              )}
            </div>
          </label>
          <div className="stg-form__footer">
            <button type="submit" className="stg-btn stg-btn--primary" disabled={loading}>
              {loading ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Sécurité du compte" icon={<Shield size={18} />}>
        <div className="stg-security-items">
          <div className="stg-security-item">
            <div className="stg-security-item__icon stg-security-item__icon--green"><Check size={16} /></div>
            <div className="stg-security-item__info">
              <strong>Email vérifié</strong>
              <span>Votre adresse email est confirmée.</span>
            </div>
            <span className="stg-badge stg-badge--green">Actif</span>
          </div>
          <div className="stg-security-item">
            <div className="stg-security-item__icon stg-security-item__icon--gray"><Shield size={16} /></div>
            <div className="stg-security-item__info">
              <strong>Authentification à deux facteurs</strong>
              <span>Ajoutez une couche de sécurité supplémentaire.</span>
            </div>
            <span className="stg-badge stg-badge--gray">Bientôt</span>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

/* ══ Notifications Tab ══════════════════════════════════════════════════════ */
type NotifPrefs = {
  email_new_course: boolean;
  email_session_reminder: boolean;
  email_grade: boolean;
  email_payment: boolean;
  push_messages: boolean;
  push_live: boolean;
};

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>({
    email_new_course: true,
    email_session_reminder: true,
    email_grade: true,
    email_payment: true,
    push_messages: false,
    push_live: true,
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <SectionCard title="Notifications par email" icon={<Mail size={18} />}>
        <div className="stg-notif-list">
          {([
            ["email_new_course",       "Nouveau cours disponible",    "Quand un nouveau cours est ajouté à votre formation"],
            ["email_session_reminder", "Rappel de session",           "24h avant le début d'une session"],
            ["email_grade",            "Nouvelle note",               "Quand une note vous est attribuée"],
            ["email_payment",          "Rappel de paiement",          "Quand une échéance de paiement approche"],
          ] as [keyof NotifPrefs, string, string][]).map(([key, label, desc]) => (
            <div key={key} className="stg-notif-item">
              <div className="stg-notif-item__text">
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
              <button
                type="button"
                className={`stg-toggle${prefs[key] ? " is-on" : ""}`}
                onClick={() => toggle(key)}
                aria-label={label}
              >
                <span className="stg-toggle__knob" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Notifications push" icon={<Bell size={18} />}>
        <div className="stg-notif-list">
          {([
            ["push_messages", "Nouveaux messages",    "Notifications de messagerie instantanée"],
            ["push_live",     "Cours live en direct", "Quand un cours en live démarre"],
          ] as [keyof NotifPrefs, string, string][]).map(([key, label, desc]) => (
            <div key={key} className="stg-notif-item">
              <div className="stg-notif-item__text">
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
              <button
                type="button"
                className={`stg-toggle${prefs[key] ? " is-on" : ""}`}
                onClick={() => toggle(key)}
                aria-label={label}
              >
                <span className="stg-toggle__knob" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="stg-form__footer" style={{ marginTop: 0 }}>
        <button type="button" className="stg-btn stg-btn--primary" onClick={handleSave}>
          {saved ? <><Check size={14} /> Enregistré</> : "Enregistrer les préférences"}
        </button>
      </div>
    </>
  );
}

/* ══ Confidentialité Tab ═════════════════════════════════════════════════ */
function ConfidentialiteTab() {
  const [visibility, setVisibility] = useState("members");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  return (
    <>
      <SectionCard title="Visibilité du profil" icon={<Globe size={18} />}>
        <div className="stg-radio-group">
          {([
            ["everyone", "Tout le monde",    "Votre profil est visible par tous les visiteurs"],
            ["members",  "Membres seulement","Seuls les membres connectés peuvent voir votre profil"],
            ["private",  "Privé",            "Seul vous pouvez voir votre profil"],
          ] as [string, string, string][]).map(([val, label, desc]) => (
            <label key={val} className={`stg-radio-card${visibility === val ? " is-selected" : ""}`}>
              <input type="radio" name="visibility" value={val} checked={visibility === val} onChange={() => setVisibility(val)} />
              <div className="stg-radio-card__content">
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
              {visibility === val && <Check size={16} className="stg-radio-card__check" />}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Données personnelles" icon={<Shield size={18} />}>
        <div className="stg-data-actions">
          <div className="stg-data-action">
            <div className="stg-data-action__info">
              <strong>Exporter mes données</strong>
              <span>Téléchargez une copie de toutes vos données (profil, résultats, paiements).</span>
            </div>
            <button type="button" className="stg-btn stg-btn--secondary">Demander l'export</button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Zone de danger" icon={<Trash2 size={18} />}>
        <div className="stg-danger-zone">
          <div className="stg-danger-info">
            <strong>Supprimer mon compte</strong>
            <p>Cette action est irréversible. Toutes vos données (inscriptions, résultats, paiements) seront définitivement supprimées.</p>
          </div>
          {!showDelete ? (
            <button type="button" className="stg-btn stg-btn--danger" onClick={() => setShowDelete(true)}>
              Supprimer mon compte
            </button>
          ) : (
            <div className="stg-delete-confirm">
              <p>Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
              <input
                className="stg-input"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="stg-btn stg-btn--danger" disabled={deleteConfirm !== "SUPPRIMER"}>
                  Confirmer la suppression
                </button>
                <button type="button" className="stg-btn stg-btn--secondary" onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
}

/* ══ MAIN PAGE ═══════════════════════════════════════════════════════════════ */
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profil",          label: "Profil",          icon: <User size={16} /> },
  { id: "securite",        label: "Sécurité",        icon: <KeyRound size={16} /> },
  { id: "notifications",   label: "Notifications",   icon: <Bell size={16} /> },
  { id: "confidentialite", label: "Confidentialité", icon: <Globe size={16} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profil");
  const { user } = useAuth();

  return (
    <div className="stg-page">
      <div className="stg-page__header">
        <h1 className="stg-page__title">Paramètres</h1>
        <p className="stg-page__sub">Gérez votre profil, sécurité et préférences.</p>
      </div>

      <div className="stg-layout">
        {/* Sidebar nav */}
        <aside className="stg-sidebar">
          {/* User snapshot */}
          <div className="stg-sidebar__user">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="stg-sidebar__avatar-img" />
              : <span className="stg-sidebar__avatar-initials" style={{ background: avatarGradient(user?.full_name ?? "") }}>
                  {(user?.full_name ?? "").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                </span>
            }
            <div>
              <strong className="stg-sidebar__name">{user?.full_name}</strong>
              <span className="stg-sidebar__email">{user?.email}</span>
            </div>
          </div>

          <nav className="stg-nav">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`stg-nav__item${tab === t.id ? " is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="stg-nav__icon">{t.icon}</span>
                <span>{t.label}</span>
                <ChevronRight size={14} className="stg-nav__arrow" />
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="stg-content">
          {tab === "profil"          && <ProfilTab />}
          {tab === "securite"        && <SecuriteTab />}
          {tab === "notifications"   && <NotificationsTab />}
          {tab === "confidentialite" && <ConfidentialiteTab />}
        </div>
      </div>
    </div>
  );
}
