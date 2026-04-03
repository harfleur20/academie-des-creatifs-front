import { Link } from "react-router-dom";

type ProtectedPlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function ProtectedPlaceholderPage({
  eyebrow,
  title,
  description,
}: ProtectedPlaceholderPageProps) {
  return (
    <div className="page page--narrow">
      <section className="auth-card auth-card--centered protected-placeholder-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro">{description}</p>
        <Link className="button button--primary" to="/">
          Retour au site
        </Link>
      </section>
    </div>
  );
}
