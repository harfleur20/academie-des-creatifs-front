import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../lib/apiClient";

type InviteInfo = {
  token: string;
  email: string;
  full_name: string;
  status: string;
};

type FormData = {
  password: string;
  confirmPassword: string;
  whatsapp: string;
  subject: string;
  experience_years: string;
  portfolio_url: string;
  bio: string;
};

export default function TeacherInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState<FormData>({
    password: "",
    confirmPassword: "",
    whatsapp: "",
    subject: "",
    experience_years: "",
    portfolio_url: "",
    bio: "",
  });

  useEffect(() => {
    if (!token) return;
    apiRequest<InviteInfo>(`/invitations/teacher/${token}`)
      .then(setInfo)
      .catch(() => setLoadError("Cette invitation est invalide, expirée ou déjà utilisée."))
      .finally(() => setIsLoading(false));
  }, [token]);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (form.password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest(`/invitations/teacher/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          password: form.password,
          whatsapp: form.whatsapp.trim() || null,
          subject: form.subject.trim() || null,
          experience_years: form.experience_years ? parseInt(form.experience_years, 10) : null,
          portfolio_url: form.portfolio_url.trim() || null,
          bio: form.bio.trim() || null,
        }),
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Invitation</p>
          <h1>Vérification de votre invitation…</h1>
        </section>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Invitation invalide</p>
          <h1>Lien expiré ou déjà utilisé</h1>
          <p>{loadError}</p>
        </section>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Bienvenue !</p>
          <h1>Compte créé avec succès</h1>
          <p>Votre espace enseignant est prêt. Redirection vers la connexion…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <section className="auth-card">
        <div className="auth-card__header">
          <p className="eyebrow">Académie des Créatifs</p>
          <h1>Créez votre accès enseignant</h1>
          <p className="page-intro">
            Bienvenue <strong>{info.full_name}</strong> ! Complétez votre profil pour accéder à votre espace.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <fieldset className="invite-fieldset">
            <legend>Informations de connexion</legend>

            <label className="auth-field">
              <span>Email</span>
              <input type="email" value={info.email} disabled readOnly />
            </label>

            <label className="auth-field">
              <span>Mot de passe <em>*</em></span>
              <input
                type="password"
                placeholder="Minimum 8 caractères"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Confirmer le mot de passe <em>*</em></span>
              <input
                type="password"
                placeholder="Répétez votre mot de passe"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                required
              />
            </label>
          </fieldset>

          <fieldset className="invite-fieldset">
            <legend>Profil professionnel</legend>

            <label className="auth-field">
              <span>WhatsApp</span>
              <input
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Matière enseignée</span>
              <input
                type="text"
                placeholder="ex. Design UI/UX, Motion Design…"
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Années d'expérience</span>
              <input
                type="number"
                min="0"
                max="60"
                placeholder="ex. 5"
                value={form.experience_years}
                onChange={(e) => set("experience_years", e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Portfolio (URL ou PDF)</span>
              <input
                type="url"
                placeholder="https://mon-portfolio.com"
                value={form.portfolio_url}
                onChange={(e) => set("portfolio_url", e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Courte biographie</span>
              <textarea
                rows={3}
                placeholder="Présentez-vous en quelques mots…"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
              />
            </label>
          </fieldset>

          {formError && (
            <p className="auth-error">{formError}</p>
          )}

          <button
            className="button button--primary button--full"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "Création en cours…" : "Créer mon accès"}
          </button>
        </form>
      </section>
    </div>
  );
}
