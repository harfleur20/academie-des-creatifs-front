import badgeAventurier from "../assets/badges/badge-aventurier.svg";
import badgeDebutant from "../assets/badges/badge-debutant.svg";
import badgeIntermediaire from "../assets/badges/badge-intermediaire.svg";
import badgeProfessionnel from "../assets/badges/badge-professionnel.svg";
import badgeSemiPro from "../assets/badges/badge-semi-pro.svg";
import heroBanner from "../assets/marketing/hero-banner.jpg";

const learningModes = [
  {
    title: "Formation en ligne",
    label: "Style Udemy",
    description:
      "Catalogue, achat immédiat, vidéos, chapitres, quiz, progression, badges et factures.",
    points: ["Accès instantané", "Progression par modules", "Expérience orientée autonomie"],
  },
  {
    title: "Formation en présentiel",
    label: "Gestion scolaire",
    description:
      "Notes, exercices, suivi pédagogique, rappels de scolarité, code étudiant et paiement en tranches.",
    points: [
      "Code étudiant unique",
      "Dashboard académique",
      "Échéancier au-delà de 90 000 FCFA",
    ],
  },
];

const roleCards = [
  {
    title: "Étudiant",
    description:
      "Accède à ses formations, à sa progression, à ses badges, à ses factures et à son statut de paiement.",
  },
  {
    title: "Enseignant",
    description:
      "Gère les cohortes, les cours, les exercices, les notes et le suivi des apprenants qui lui sont affectés.",
  },
  {
    title: "Admin",
    description:
      "Pilote l'ensemble de la plateforme : catalogue, utilisateurs, paiements, relances, sessions et reporting.",
  },
];

const badges = [
  { name: "Aventurier", asset: badgeAventurier },
  { name: "Débutant", asset: badgeDebutant },
  { name: "Intermédiaire", asset: badgeIntermediaire },
  { name: "Semi-pro", asset: badgeSemiPro },
  { name: "Professionnel", asset: badgeProfessionnel },
];

export default function HomePage() {
  return (
    <div className="page page--home">
      <section className="hero">
        <div className="hero__content">
          <p className="eyebrow">Socle produit validé</p>
          <h1>
            Une seule plateforme pour vendre, apprendre et gérer les parcours
            online comme les formations en présentiel.
          </h1>
          <p className="hero__lead">
            Le site public reste le point d'entrée e-commerce, puis chaque achat
            ouvre le bon dashboard selon le type de formation et le rôle de
            l'utilisateur.
          </p>

          <div className="hero__actions">
            <a className="button button--primary" href="/formations">
              Voir le catalogue cible
            </a>
            <a className="button button--secondary" href="/dashboard">
              Explorer les dashboards
            </a>
          </div>

          <div className="hero__stats">
            <article className="stat-card">
              <span className="stat-card__value">2</span>
              <span className="stat-card__label">expériences post-achat</span>
            </article>
            <article className="stat-card">
              <span className="stat-card__value">5</span>
              <span className="stat-card__label">badges de progression</span>
            </article>
            <article className="stat-card">
              <span className="stat-card__value">3</span>
              <span className="stat-card__label">rôles pilotés</span>
            </article>
          </div>
        </div>

        <div className="hero__media">
          <img src={heroBanner} alt="Aperçu de l'univers visuel Académie des Créatifs" />
          <div className="hero__floating-card">
            <p className="hero__floating-label">Règle métier clé</p>
            <p className="hero__floating-copy">
              Le paiement en tranches reste réservé aux formations présentielles
              de plus de 90 000 FCFA.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Parcours</p>
          <h2>Deux modèles de formation, un catalogue unique</h2>
        </div>

        <div className="feature-grid">
          {learningModes.map((mode) => (
            <article className="feature-card" key={mode.title}>
              <p className="feature-card__tag">{mode.label}</p>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
              <ul className="feature-card__list">
                {mode.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--contrast">
        <div className="section-heading">
          <p className="eyebrow">Progression</p>
          <h2>Une montée en niveau commune aux deux parcours</h2>
        </div>

        <div className="badge-grid">
          {badges.map((badge) => (
            <article className="badge-card" key={badge.name}>
              <img src={badge.asset} alt={`Badge ${badge.name}`} />
              <h3>{badge.name}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Rôles</p>
          <h2>Un produit conçu pour les étudiants, les enseignants et l'admin</h2>
        </div>

        <div className="role-grid">
          {roleCards.map((role) => (
            <article className="role-card" key={role.title}>
              <h3>{role.title}</h3>
              <p>{role.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
