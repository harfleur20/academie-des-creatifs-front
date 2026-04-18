import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../lib/authApi";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!emailPattern.test(normalized)) {
      setError("Entrez une adresse e-mail valide.");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(normalized);
      setSent(true);
    } catch {
      // Always show success to avoid user enumeration
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
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
            <h2>Mot de passe{"\n"}oublié ?</h2>
            <p className="auth-visual__summary">
              Pas de panique — entrez votre adresse e-mail et nous vous enverrons un lien de réinitialisation.
            </p>
          </div>
        </div>

        <div className="auth-panel auth-card auth-panel--editorial">
          <div className="auth-panel__heading">
            <h1>Réinitialisation</h1>
            <p className="auth-panel__meta">
              Vous vous souvenez ?{" "}
              <Link to="/login">Se connecter</Link>
            </p>
          </div>

          {sent ? (
            <div className="auth-reset-sent">
              <div className="auth-reset-sent__icon">✉</div>
              <h2>E-mail envoyé !</h2>
              <p>
                Si un compte correspond à cette adresse, vous recevrez un lien valable
                30 minutes pour réinitialiser votre mot de passe.
              </p>
              <p className="auth-reset-sent__hint">
                Pensez à vérifier vos spams si vous ne voyez rien dans votre boîte de réception.
              </p>
              <Link className="auth-panel__cta auth-panel__cta--inline" to="/login">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form className="auth-form auth-form--lined" noValidate onSubmit={handleSubmit}>
              <label className="field field--lined" htmlFor="forgot-email">
                <span>Adresse e-mail</span>
                <div className="field__control field__control--lined">
                  <input
                    autoCapitalize="none"
                    autoComplete="email"
                    id="forgot-email"
                    inputMode="email"
                    maxLength={120}
                    onChange={(e) => {
                      setError("");
                      setEmail(e.target.value.replace(/\s+/g, "").slice(0, 120).toLowerCase());
                    }}
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </div>
                {error && (
                  <p className="field__message field__message--error">{error}</p>
                )}
              </label>

              <button className="auth-panel__cta" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Envoi en cours..." : "ENVOYER LE LIEN"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
