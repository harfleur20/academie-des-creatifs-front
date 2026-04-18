import { type FormEvent, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../lib/authApi";
import { useToast } from "../toast/ToastContext";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!password) next.password = "Le mot de passe est requis.";
    else if (password.length < 8) next.password = "Au moins 8 caractères requis.";
    if (password && confirm && password !== confirm) next.confirm = "Les mots de passe ne correspondent pas.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    if (!token) {
      showError("Lien invalide. Veuillez recommencer la procédure.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      success("Mot de passe mis à jour ! Vous pouvez maintenant vous connecter.");
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Lien invalide ou expiré. Veuillez recommencer.";
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <section className="page auth-experience">
        <div className="auth-split auth-split--editorial">
          <div
            className="auth-visual auth-visual--editorial"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(9, 14, 34, 0.5), rgba(9, 14, 34, 0.66)), url('/bg-ac-1.jpg')",
            }}
          >
            <div className="auth-visual__overlay">
              <p className="auth-visual__eyebrow">Académie des Créatifs</p>
              <h2>Lien{"\n"}invalide</h2>
            </div>
          </div>
          <div className="auth-panel auth-card auth-panel--editorial">
            <div className="auth-panel__heading">
              <h1>Lien invalide</h1>
            </div>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Ce lien de réinitialisation est invalide ou a déjà été utilisé.
            </p>
            <Link className="auth-panel__cta auth-panel__cta--inline" to="/forgot-password">
              Faire une nouvelle demande
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page auth-experience">
      <div className="auth-split auth-split--editorial">
        <div
          className="auth-visual auth-visual--editorial"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(9, 14, 34, 0.5), rgba(9, 14, 34, 0.66)), url('/bg-ac-1.jpg')",
          }}
        >
          <div className="auth-visual__overlay">
            <p className="auth-visual__eyebrow">Académie des Créatifs</p>
            <h2>Nouveau{"\n"}mot de passe</h2>
            <p className="auth-visual__summary">
              Choisissez un mot de passe sécurisé d'au moins 8 caractères.
            </p>
          </div>
        </div>

        <div className="auth-panel auth-card auth-panel--editorial">
          <div className="auth-panel__heading">
            <h1>Nouveau mot de passe</h1>
            <p className="auth-panel__meta">
              <Link to="/login">Retour à la connexion</Link>
            </p>
          </div>

          <form className="auth-form auth-form--lined" noValidate onSubmit={handleSubmit}>
            <label className="field field--lined" htmlFor="reset-password">
              <span>Nouveau mot de passe</span>
              <div className="field__control field__control--lined field__control--with-action">
                <input
                  autoComplete="new-password"
                  id="reset-password"
                  maxLength={72}
                  onChange={(e) => {
                    setErrors((p) => ({ ...p, password: undefined }));
                    setPassword(e.target.value.slice(0, 72));
                  }}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                  className="field__action"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.password && (
                <p className="field__message field__message--error">{errors.password}</p>
              )}
            </label>

            <label className="field field--lined" htmlFor="reset-confirm">
              <span>Confirmer le mot de passe</span>
              <div className="field__control field__control--lined">
                <input
                  autoComplete="new-password"
                  id="reset-confirm"
                  maxLength={72}
                  onChange={(e) => {
                    setErrors((p) => ({ ...p, confirm: undefined }));
                    setConfirm(e.target.value.slice(0, 72));
                  }}
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                />
              </div>
              {errors.confirm && (
                <p className="field__message field__message--error">{errors.confirm}</p>
              )}
            </label>

            <button className="auth-panel__cta" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enregistrement..." : "ENREGISTRER LE MOT DE PASSE"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
