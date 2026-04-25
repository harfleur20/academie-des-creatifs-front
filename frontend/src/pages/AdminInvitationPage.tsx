import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  acceptAdminInvitation,
  fetchAdminInvitationByToken,
  type AdminInvitation,
} from "../lib/catalogApi";

export default function AdminInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [invite, setInvite] = useState<AdminInvitation | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchAdminInvitationByToken(token)
      .then(setInvite)
      .catch(() => setLoadError("Invitation introuvable ou invalide."))
      .finally(() => setIsLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setFormError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      await acceptAdminInvitation(token!, password);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => navigate("/admin"), 2000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="adm-invite-page">
        <div className="adm-invite-card">
          <p style={{ color: "#64748b", textAlign: "center" }}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="adm-invite-page">
        <div className="adm-invite-card">
          <p className="adm-invite-card__error">{loadError || "Invitation introuvable."}</p>
        </div>
      </div>
    );
  }

  if (invite.status !== "pending") {
    const msg =
      invite.status === "accepted" ? "Cette invitation a déjà été utilisée." :
      invite.status === "expired"  ? "Cette invitation a expiré." :
      "Cette invitation a été révoquée.";
    return (
      <div className="adm-invite-page">
        <div className="adm-invite-card">
          <p className="adm-invite-card__error">{msg}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="adm-invite-page">
        <div className="adm-invite-card adm-invite-card--success">
          <CheckCircle2 size={48} color="#22c55e" />
          <h2>Compte créé !</h2>
          <p>Redirection vers l'espace admin…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-invite-page">
      <div className="adm-invite-card">
        <div className="adm-invite-card__icon">
          <ShieldCheck size={32} color="#0f172a" />
        </div>
        <h1 className="adm-invite-card__title">Rejoindre l'administration</h1>
        <p className="adm-invite-card__sub">
          Invitation pour <strong>{invite.full_name}</strong> ({invite.email})
        </p>
        <p className="adm-invite-card__expires">
          Expire le {new Date(invite.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <form className="adm-invite-form" onSubmit={handleSubmit}>
          <label className="adm-invite-form__label">
            <span><LockKeyhole size={14} /> Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              required
              autoFocus
            />
          </label>
          <label className="adm-invite-form__label">
            <span><LockKeyhole size={14} /> Confirmer le mot de passe</span>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Répétez le mot de passe"
              required
            />
          </label>

          {formError && <p className="adm-invite-form__error">{formError}</p>}

          <button type="submit" className="adm-invite-form__btn" disabled={submitting}>
            {submitting ? "Création du compte…" : "Créer mon compte administrateur"}
          </button>
        </form>
      </div>
    </div>
  );
}
