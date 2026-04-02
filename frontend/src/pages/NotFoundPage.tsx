import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page page--narrow">
      <section className="auth-card auth-card--centered">
        <p className="eyebrow">404</p>
        <h1>Cette page n'existe pas encore dans le socle actuel.</h1>
        <p className="page-intro">
          Le routage principal est prêt, mais seules les surfaces structurantes ont
          été posées pour la phase technique.
        </p>
        <Link className="button button--primary" to="/">
          Revenir à l'accueil
        </Link>
      </section>
    </div>
  );
}
