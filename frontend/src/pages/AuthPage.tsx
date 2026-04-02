import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import { isValidPhoneNumber } from "libphonenumber-js";

type AuthPageProps = {
  mode: "login" | "register";
};

type AuthFieldName = "name" | "email" | "phone" | "password" | "policy";

type AuthValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  policy: boolean;
};

type AuthErrors = Partial<Record<AuthFieldName, string>>;

const initialValues: AuthValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  policy: false,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeValue(field: Exclude<AuthFieldName, "policy">, value: string) {
  if (field === "name") {
    return value
      .replace(/[^\p{L}\p{M}\s'-]/gu, "")
      .replace(/\s{2,}/g, " ")
      .slice(0, 80);
  }

  if (field === "email") {
    return value.replace(/\s+/g, "").slice(0, 120);
  }

  if (field === "phone") {
    return value.replace(/[^\d+\s()-]/g, "").slice(0, 24);
  }

  return value.slice(0, 72);
}

function validateAuth(values: AuthValues, isLogin: boolean): AuthErrors {
  const errors: AuthErrors = {};

  if (!isLogin) {
    const normalizedName = values.name.trim();

    if (!normalizedName) {
      errors.name = "Le nom complet est requis.";
    } else if (normalizedName.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caracteres.";
    }
  }

  const normalizedEmail = values.email.trim().toLowerCase();

  if (!normalizedEmail) {
    errors.email = "L'adresse e-mail est requise.";
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = "Entrez une adresse e-mail valide.";
  }

  if (!isLogin) {
    const normalizedPhone = values.phone.trim();

    if (!normalizedPhone) {
      errors.phone = "Le numero de telephone est requis.";
    } else if (!normalizedPhone.startsWith("+")) {
      errors.phone = "Ajoutez l'indicatif international, par exemple +237.";
    } else if (!isValidPhoneNumber(normalizedPhone)) {
      errors.phone = "Entrez un numero de telephone valide.";
    }
  }

  if (!values.password) {
    errors.password = "Le mot de passe est requis.";
  } else {
    if (values.password.length < 8) {
      errors.password = "Le mot de passe doit contenir au moins 8 caracteres.";
    } else if (!/[A-Z]/.test(values.password)) {
      errors.password = "Ajoutez au moins une lettre majuscule.";
    } else if (!/[a-z]/.test(values.password)) {
      errors.password = "Ajoutez au moins une lettre minuscule.";
    } else if (!/\d/.test(values.password)) {
      errors.password = "Ajoutez au moins un chiffre.";
    }
  }

  if (!isLogin && !values.policy) {
    errors.policy = "Vous devez accepter les conditions pour continuer.";
  }

  return errors;
}

export default function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";
  const [values, setValues] = useState<AuthValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<AuthFieldName, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const errors = validateAuth(values, isLogin);
  const activeFields: AuthFieldName[] = isLogin
    ? ["email", "password"]
    : ["name", "email", "phone", "password", "policy"];
  const isFormValid = activeFields.every((field) => !errors[field]);

  const setFieldTouched = (field: AuthFieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const handleInputChange =
    (field: Exclude<AuthFieldName, "policy">) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setSubmitMessage("");

      const nextValue = sanitizeValue(field, event.target.value);

      setValues((current) => ({
        ...current,
        [field]: field === "email" ? nextValue.toLowerCase() : nextValue,
      }));
    };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSubmitMessage("");
    setValues((current) => ({ ...current, policy: event.target.checked }));
  };

  const handleBlur =
    (field: AuthFieldName) =>
    () => {
      setFieldTouched(field);
    };

  const getControlState = (field: Exclude<AuthFieldName, "policy">) => {
    const hasBeenInteractedWith = touched[field] || submitAttempted;
    const hasValue = values[field].trim().length > 0;

    if (hasBeenInteractedWith && errors[field]) {
      return "field__control--invalid";
    }

    if (hasValue && !errors[field]) {
      return "field__control--valid";
    }

    return "";
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched((current) => {
      const nextTouched = { ...current };

      activeFields.forEach((field) => {
        nextTouched[field] = true;
      });

      return nextTouched;
    });

    if (!isFormValid) {
      setSubmitMessage("Corrigez les champs signales avant de continuer.");
      return;
    }

    setSubmitMessage(
      isLogin
        ? "Les informations de connexion sont valides."
        : "Les informations d'inscription sont valides."
    );
  };

  const policyState =
    (touched.policy || submitAttempted) && errors.policy
      ? "auth-checkbox--invalid"
      : values.policy
        ? "auth-checkbox--valid"
        : "";

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
            <p className="auth-visual__eyebrow">Academie des Creatifs</p>
            <h2>{isLogin ? "Creez.\nEvoluez." : "Inscrivez-\nvous."}</h2>
            <p className="auth-visual__summary">
              {isLogin
                ? "Retrouvez vos formations, votre progression et votre espace personnel."
                : "Rejoignez la plateforme pour acceder aux parcours, aux paniers et aux dashboards."}
            </p>
          </div>
        </div>

        <div className="auth-panel auth-card auth-panel--editorial">
          <div className="auth-panel__heading">
            <h1>{isLogin ? "Connexion" : "Inscription"}</h1>
            <p className="auth-panel__meta">
              {isLogin ? (
                <>
                  Vous n'avez pas de compte ? <Link to="/register">Creer votre compte</Link>
                </>
              ) : (
                <>
                  Vous avez deja un compte ? <Link to="/login">Se connecter</Link>
                </>
              )}
            </p>
          </div>

          <form className="auth-form auth-form--lined" noValidate onSubmit={handleSubmit}>
            {!isLogin ? (
              <label className="field field--lined" htmlFor="auth-name">
                <span>Nom complet</span>
                <div className={`field__control field__control--lined ${getControlState("name")}`.trim()}>
                  <input
                    autoComplete="name"
                    id="auth-name"
                    maxLength={80}
                    name="name"
                    onBlur={handleBlur("name")}
                    onChange={handleInputChange("name")}
                    spellCheck={false}
                    type="text"
                    value={values.name}
                    aria-describedby="auth-name-message"
                    aria-invalid={Boolean((touched.name || submitAttempted) && errors.name)}
                  />
                </div>
                {(touched.name || submitAttempted) && errors.name ? (
                  <p aria-live="polite" className="field__message field__message--error" id="auth-name-message">
                    {errors.name}
                  </p>
                ) : null}
              </label>
            ) : null}

            <label className="field field--lined" htmlFor="auth-email">
              <span>Adresse e-mail</span>
              <div className={`field__control field__control--lined ${getControlState("email")}`.trim()}>
                <input
                  autoCapitalize="none"
                  autoComplete="email"
                  id="auth-email"
                  inputMode="email"
                  maxLength={120}
                  name="email"
                  onBlur={handleBlur("email")}
                  onChange={handleInputChange("email")}
                  spellCheck={false}
                  type="email"
                  value={values.email}
                  aria-describedby="auth-email-message"
                  aria-invalid={Boolean((touched.email || submitAttempted) && errors.email)}
                />
              </div>
              {(touched.email || submitAttempted) && errors.email ? (
                <p aria-live="polite" className="field__message field__message--error" id="auth-email-message">
                  {errors.email}
                </p>
              ) : null}
            </label>

            {!isLogin ? (
              <label className="field field--lined" htmlFor="auth-phone">
                <span>Telephone avec indicatif</span>
                <div className={`field__control field__control--lined ${getControlState("phone")}`.trim()}>
                  <input
                    autoComplete="tel"
                    id="auth-phone"
                    inputMode="tel"
                    maxLength={24}
                    name="phone"
                    onBlur={handleBlur("phone")}
                    onChange={handleInputChange("phone")}
                    type="tel"
                    value={values.phone}
                    aria-describedby="auth-phone-message"
                    aria-invalid={Boolean((touched.phone || submitAttempted) && errors.phone)}
                  />
                </div>
                {(touched.phone || submitAttempted) && errors.phone ? (
                  <p aria-live="polite" className="field__message field__message--error" id="auth-phone-message">
                    {errors.phone}
                  </p>
                ) : null}
              </label>
            ) : null}

            <label className="field field--lined" htmlFor="auth-password">
              <span>Mot de passe</span>
              <div
                className={`field__control field__control--lined field__control--with-action ${getControlState("password")}`.trim()}
              >
                <input
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  id="auth-password"
                  maxLength={72}
                  name="password"
                  onBlur={handleBlur("password")}
                  onChange={handleInputChange("password")}
                  type={showPassword ? "text" : "password"}
                  value={values.password}
                  aria-describedby="auth-password-message"
                  aria-invalid={Boolean((touched.password || submitAttempted) && errors.password)}
                />
                <button
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="field__action"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {(touched.password || submitAttempted) && errors.password ? (
                <p
                  aria-live="polite"
                  className="field__message field__message--error"
                  id="auth-password-message"
                >
                  {errors.password}
                </p>
              ) : null}
            </label>

            <label className={`auth-checkbox ${policyState}`.trim()} htmlFor="auth-policy">
              <input
                checked={values.policy}
                id="auth-policy"
                name="policy"
                onBlur={handleBlur("policy")}
                onChange={handleCheckboxChange}
                type="checkbox"
              />
              <span>
                {isLogin
                  ? "Se souvenir de moi sur cet appareil"
                  : "J'accepte les conditions d'utilisation et la politique de confidentialite"}
              </span>
            </label>
            {!isLogin && (touched.policy || submitAttempted) && errors.policy ? (
              <p
                aria-live="polite"
                className="field__message field__message--error"
                id="auth-policy-message"
              >
                {errors.policy}
              </p>
            ) : null}

            <button className="auth-panel__cta" type="submit">
              {isLogin ? "SE CONNECTER" : "S'INSCRIRE"}
            </button>

            {submitMessage ? (
              <p
                aria-live="polite"
                className={`auth-form__notice ${isFormValid ? "auth-form__notice--success" : "auth-form__notice--error"}`}
              >
                {submitMessage}
              </p>
            ) : null}
          </form>

          <div className="auth-panel__social-block">
            <p className="auth-panel__social-label">Connexion avec votre compte Google</p>

            <div className="auth-panel__social">
              <button className="auth-social-button auth-social-button--google" type="button">
                <FaGoogle />
                Continuer avec Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
