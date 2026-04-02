const formations = [
  {
    title: "Design Graphique Fondamental",
    mode: "Online",
    price: "60 000 FCFA",
    access: "Accès immédiat après paiement",
    summary:
      "Parcours vidéo structuré en modules, quiz de validation et suivi de progression type e-learning.",
  },
  {
    title: "Brand Identity Intensive",
    mode: "Présentiel",
    price: "120 000 FCFA",
    access: "Dashboard scolaire + paiement en tranches",
    summary:
      "Suivi pédagogique en cohorte, notes, exercices, badge de progression et échéancier.",
  },
  {
    title: "Motion Design Bootcamp",
    mode: "Présentiel",
    price: "150 000 FCFA",
    access: "Session présentielle avec code étudiant",
    summary:
      "Formation orientée production avec sessions encadrées, évaluations et pilotage enseignant.",
  },
];

export default function FormationsPage() {
  return (
    <div className="page">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Catalogue cible</p>
        <h1>Le catalogue réunit les parcours online et les formations en présentiel</h1>
        <p className="page-intro">
          Le filtre principal du futur catalogue doit distinguer clairement le mode
          d'apprentissage tout en gardant un tunnel d'achat commun.
        </p>
      </section>

      <div className="catalog-grid">
        {formations.map((formation) => (
          <article className="catalog-card" key={formation.title}>
            <div className="catalog-card__header">
              <span className="catalog-card__mode">{formation.mode}</span>
              <span className="catalog-card__price">{formation.price}</span>
            </div>
            <h2>{formation.title}</h2>
            <p>{formation.summary}</p>
            <p className="catalog-card__access">{formation.access}</p>
            <button className="button button--primary" type="button">
              Préparer la fiche formation
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
