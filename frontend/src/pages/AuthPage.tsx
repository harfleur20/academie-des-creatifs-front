type AuthPageProps = {
  mode: "login" | "register";
};

export default function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";

  return (
    <div className="page page--narrow">
      <section className="auth-card">
        <p className="eyebrow">{isLogin ? "Connexion" : "Inscription"}</p>
        <h1>{isLogin ? "Accéder à son espace" : "Créer un compte plateforme"}</h1>
        <p className="page-intro">
          Ce module sera branché à FastAPI avec gestion des rôles, puis redirection
          contextuelle vers le bon dashboard.
        </p>

        <form className="auth-form">
          {!isLogin && (
            <label className="field">
              <span>Nom complet</span>
              <input placeholder="Nom et prénom" type="text" />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input placeholder="vous@academie.com" type="email" />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input placeholder="••••••••" type="password" />
          </label>

          <button className="button button--primary button--full" type="button">
            {isLogin ? "Simuler la connexion" : "Préparer l'inscription"}
          </button>
        </form>
      </section>
    </div>
  );
}
