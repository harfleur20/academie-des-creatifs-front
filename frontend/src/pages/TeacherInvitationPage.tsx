import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BriefcaseBusiness,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useAuth } from "../auth/AuthContext";
import { CountryCombobox } from "../components/CountryCombobox";
import { apiRequest } from "../lib/apiClient";
import {
  OTHER_TEACHER_SPECIALTY,
  TEACHER_SPECIALTY_OPTIONS,
  resolveTeacherSubject,
  splitTeacherSubject,
} from "../lib/teacherSpecialties";

type InviteInfo = {
  token: string;
  email: string;
  full_name: string;
  whatsapp: string | null;
  nationality: string | null;
  subject: string | null;
  experience_years: number | null;
  portfolio_url: string | null;
  bio: string | null;
  status: string;
};

type FormData = {
  password: string;
  confirmPassword: string;
  whatsapp: string;
  nationality: string;
  subject: string;
  custom_subject: string;
  experience_years: string;
  portfolio_url: string;
  bio: string;
};

export default function TeacherInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isLoading: isAuthLoading, logout, user } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState<FormData>({
    password: "",
    confirmPassword: "",
    whatsapp: "",
    nationality: "",
    subject: "",
    custom_subject: "",
    experience_years: "",
    portfolio_url: "",
    bio: "",
  });

  useEffect(() => {
    if (!token) return;
    apiRequest<InviteInfo>(`/invitations/teacher/${token}`)
      .then((inviteInfo) => {
        const subject = splitTeacherSubject(inviteInfo.subject);
        setInfo(inviteInfo);
        setForm((prev) => ({
          ...prev,
          whatsapp: inviteInfo.whatsapp ?? "",
          nationality: inviteInfo.nationality ?? "",
          subject: subject.selectedSubject,
          custom_subject: subject.customSubject,
          experience_years:
            inviteInfo.experience_years !== null
              ? String(inviteInfo.experience_years)
              : "",
          portfolio_url: inviteInfo.portfolio_url ?? "",
          bio: inviteInfo.bio ?? "",
        }));
      })
      .catch(() => setLoadError("Cette invitation est invalide, expirée ou déjà utilisée."))
      .finally(() => setIsLoading(false));
  }, [token]);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const phoneInvalid = Boolean(form.whatsapp && !isValidPhoneNumber(form.whatsapp));
  const customSubjectInvalid =
    form.subject === OTHER_TEACHER_SPECIALTY && !form.custom_subject.trim();

  async function handleLogoutAndContinue() {
    setFormError("");
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // The logout request clears the local session even if the server call fails.
    } finally {
      setIsLoggingOut(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (user) {
      setFormError("Déconnectez-vous du compte actuel avant d’accepter cette invitation.");
      return;
    }

    if (form.password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (phoneInvalid) {
      setFormError("Le numéro WhatsApp n’est pas valide. Choisissez le pays puis saisissez le numéro complet.");
      return;
    }
    if (customSubjectInvalid) {
      setFormError("Précisez votre spécialité dans le champ Autre.");
      return;
    }

    setIsSaving(true);
    try {
      const subject = resolveTeacherSubject(form.subject, form.custom_subject);
      await apiRequest(`/invitations/teacher/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          password: form.password,
          whatsapp: form.whatsapp.trim() || null,
          nationality: form.nationality.trim() || null,
          subject: subject || null,
          experience_years: form.experience_years ? parseInt(form.experience_years, 10) : null,
          portfolio_url: form.portfolio_url.trim() || null,
          bio: form.bio.trim() || null,
        }),
      });
      if (user) {
        await logout().catch(() => undefined);
      }
      setSuccess(true);
      setTimeout(
        () =>
          navigate("/login", {
            replace: true,
            state: { from: "/espace/enseignant" },
          }),
        3000,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="teacher-invite-shell">
        <section className="teacher-invite-card teacher-invite-state">
          <span className="teacher-invite-state__icon"><ShieldCheck size={22} /></span>
          <p className="teacher-invite-eyebrow">Invitation enseignant</p>
          <h1>Vérification de votre invitation…</h1>
          <p>Nous contrôlons la validité du lien avant l’activation du compte.</p>
        </section>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="teacher-invite-shell">
        <section className="teacher-invite-card teacher-invite-state teacher-invite-state--error">
          <span className="teacher-invite-state__icon"><LockKeyhole size={22} /></span>
          <p className="teacher-invite-eyebrow">Invitation invalide</p>
          <h1>Lien expiré ou déjà utilisé</h1>
          <p>{loadError}</p>
        </section>
      </div>
    );
  }

  if (user) {
    return (
      <div className="teacher-invite-shell">
        <section className="teacher-invite-card teacher-invite-state">
          <span className="teacher-invite-state__icon"><LogOut size={22} /></span>
          <p className="teacher-invite-eyebrow">Session déjà ouverte</p>
          <h1>Déconnectez-vous avant de continuer</h1>
          <p>
            Vous êtes connecté avec <strong>{user.full_name}</strong> ({user.email}).
            Cette invitation est destinée à <strong>{info.full_name}</strong> ({info.email}).
          </p>
          <p>
            Pour éviter de mélanger les comptes, fermez d’abord la session actuelle puis
            complétez l’invitation enseignant.
          </p>
          {formError && <p className="auth-error">{formError}</p>}
          <button
            className="button button--primary button--full"
            disabled={isLoggingOut}
            onClick={handleLogoutAndContinue}
            type="button"
          >
            {isLoggingOut ? "Déconnexion…" : "Me déconnecter et continuer"}
          </button>
        </section>
      </div>
    );
  }

  if (success) {
    return (
      <div className="teacher-invite-shell">
        <section className="teacher-invite-card teacher-invite-state teacher-invite-state--success">
          <span className="teacher-invite-state__icon"><CheckCircle2 size={22} /></span>
          <p className="teacher-invite-eyebrow">Bienvenue</p>
          <h1>Compte créé avec succès</h1>
          <p>Votre espace enseignant est prêt. Redirection vers la connexion…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="teacher-invite-shell">
      <section className="teacher-invite-card">
        <div className="teacher-invite-intro">
          <p className="teacher-invite-eyebrow">Académie des Créatifs</p>
          <h1>Créez votre accès enseignant</h1>
          <p>
            Bienvenue <strong>{info.full_name}</strong>. Complétez votre profil pour activer votre espace.
          </p>

          <div className="teacher-invite-profile">
            <div>
              <span><UserRoundCheck size={15} /> Enseignant invité</span>
              <strong>{info.full_name}</strong>
            </div>
            <div>
              <span><Mail size={15} /> Email</span>
              <strong>{info.email}</strong>
            </div>
            <div>
              <span><BriefcaseBusiness size={15} /> Profil prévu</span>
              <strong>{info.subject || "Spécialité à compléter"}</strong>
              <small>{[info.nationality, info.whatsapp].filter(Boolean).join(" · ") || "Coordonnées à compléter"}</small>
            </div>
          </div>

          <ul className="teacher-invite-assurance">
            <li><ShieldCheck size={16} /> Votre accès sera activé après validation du formulaire.</li>
            <li><LockKeyhole size={16} /> Le mot de passe reste personnel et sécurisé.</li>
          </ul>
        </div>

        <form className="teacher-invite-form" onSubmit={handleSubmit}>
          <fieldset className="teacher-invite-fieldset">
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

          <fieldset className="teacher-invite-fieldset">
            <legend>Profil professionnel</legend>

            <label className="auth-field">
              <span>WhatsApp</span>
              <PhoneInput
                className={`adm-phone-input${phoneInvalid ? " is-invalid" : ""}`}
                international
                defaultCountry="CM"
                countryCallingCodeEditable={false}
                placeholder="Numéro WhatsApp"
                value={form.whatsapp}
                onChange={(value) => set("whatsapp", value ?? "")}
                aria-invalid={phoneInvalid}
              />
              {phoneInvalid && (
                <p className="adm-field-error">
                  Numéro invalide pour le pays sélectionné. Exemple Cameroun : +237600000000.
                </p>
              )}
            </label>

            <CountryCombobox
              fieldClassName="auth-field"
              label="Nationalité"
              onClear={() => set("nationality", "")}
              onSelect={(country) => set("nationality", country.name)}
              placeholder="Saisir ou rechercher un pays"
              value={form.nationality}
            />

            <label className="auth-field">
              <span>Matière enseignée</span>
              <select
                className="adm-select"
                value={form.subject}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    custom_subject:
                      e.target.value === OTHER_TEACHER_SPECIALTY ? prev.custom_subject : "",
                    subject: e.target.value,
                  }))
                }
              >
                <option value="">Sélectionner une spécialité</option>
                {TEACHER_SPECIALTY_OPTIONS.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
            </label>
            {form.subject === OTHER_TEACHER_SPECIALTY && (
              <label className="auth-field">
                <span>Préciser la spécialité</span>
                <input
                  className="adm-input"
                  type="text"
                  placeholder="Entrer votre spécialité"
                  value={form.custom_subject}
                  onChange={(e) => set("custom_subject", e.target.value)}
                  required
                />
              </label>
            )}

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
            disabled={isSaving || phoneInvalid || customSubjectInvalid}
          >
            {isSaving ? "Création en cours…" : "Créer mon accès"}
          </button>
        </form>
      </section>
    </div>
  );
}
