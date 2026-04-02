const dashboardCards = [
  {
    title: "Étudiant online",
    description:
      "Lecture vidéo, modules, quiz, progression, badge courant et historique de facturation.",
  },
  {
    title: "Étudiant présentiel",
    description:
      "Code étudiant, notes, exercices, échéancier, rappels de scolarité et suivi de progression.",
  },
  {
    title: "Enseignant",
    description:
      "Pilotage des cohortes, publication des travaux, saisie des notes et suivi des étudiants affectés.",
  },
  {
    title: "Admin",
    description:
      "Gestion du catalogue, des utilisateurs, des paiements, des relances et des indicateurs globaux.",
  },
];

export default function DashboardPage() {
  return (
    <div className="page">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Accès privés</p>
        <h1>Les dashboards sont distincts, mais pilotés depuis le même produit</h1>
        <p className="page-intro">
          Le frontend doit ensuite appliquer des guards par rôle et par type
          d'inscription. Le backend reste la source de vérité sur les permissions.
        </p>
      </section>

      <div className="role-grid role-grid--dashboard">
        {dashboardCards.map((card) => (
          <article className="role-card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
