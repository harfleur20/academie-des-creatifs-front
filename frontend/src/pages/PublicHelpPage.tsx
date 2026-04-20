import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBook,
  FaChevronDown,
  FaCreditCard,
  FaEnvelope,
  FaGraduationCap,
  FaHeadset,
  FaPhone,
  FaSearch,
  FaUserCircle,
  FaWhatsapp,
} from "react-icons/fa";

/* ── Types ── */
type FaqItem = { q: string; a: string };
type Category = { id: string; label: string; icon: React.ReactNode; items: FaqItem[] };

/* ── Data ── */
const CATEGORIES: Category[] = [
  {
    id: "compte",
    label: "Mon compte",
    icon: <FaUserCircle />,
    items: [
      { q: "Comment créer un compte ?", a: "Cliquez sur « S'inscrire » en haut à droite. Renseignez votre nom, e-mail et un mot de passe. Un lien de confirmation sera envoyé à votre adresse." },
      { q: "J'ai oublié mon mot de passe, que faire ?", a: "Sur la page de connexion, cliquez sur « Mot de passe oublié ». Entrez votre e-mail et vous recevrez un lien de réinitialisation valable 24 heures." },
      { q: "Comment modifier mes informations personnelles ?", a: "Dans votre espace étudiant, cliquez sur votre avatar en haut à droite puis « Paramètres ». Vous pouvez y modifier votre nom, téléphone et photo de profil." },
      { q: "Puis-je changer mon adresse e-mail ?", a: "L'adresse e-mail est liée à votre identifiant de connexion et ne peut pas être modifiée pour des raisons de sécurité. Contactez le support si vous avez un cas particulier." },
    ],
  },
  {
    id: "formations",
    label: "Formations",
    icon: <FaGraduationCap />,
    items: [
      { q: "Comment m'inscrire à une formation ?", a: "Rendez-vous dans le catalogue, choisissez votre formation, puis cliquez sur « S'inscrire ». Après paiement, vous accédez immédiatement à votre espace étudiant." },
      { q: "Les formations sont-elles accessibles à vie ?", a: "Oui. Une fois achetée, une formation reste accessible indéfiniment, y compris les mises à jour de contenu réalisées ultérieurement." },
      { q: "Y a-t-il des prérequis pour suivre une formation ?", a: "Chaque fiche de formation précise les prérequis nécessaires. La plupart de nos parcours d'entrée de gamme sont accessibles sans aucun prérequis." },
      { q: "Comment obtenir mon certificat ?", a: "À la fin de votre parcours, rendez-vous dans « Mes résultats » puis cliquez sur « Télécharger le certificat ». Il est disponible dès que le formateur valide votre projet final." },
      { q: "Puis-je suivre plusieurs formations en même temps ?", a: "Oui, il n'y a aucune limite. Vous pouvez être inscrit à plusieurs formations simultanément et progresser à votre propre rythme." },
    ],
  },
  {
    id: "paiement",
    label: "Paiement",
    icon: <FaCreditCard />,
    items: [
      { q: "Quels moyens de paiement sont acceptés ?", a: "Nous acceptons Mobile Money (Orange Money, MTN MoMo), les cartes bancaires Visa/Mastercard et les virements selon les régions." },
      { q: "Le paiement en plusieurs fois est-il possible ?", a: "Oui, pour les formations dont le montant dépasse 100 000 FCFA, un paiement en plusieurs tranches peut être proposé selon la durée de la session." },
      { q: "Mon paiement n'est pas passé, que faire ?", a: "Vérifiez d'abord votre solde et la connexion réseau. Si le problème persiste, contactez-nous via WhatsApp en indiquant votre numéro de transaction et nous réglerons ça rapidement." },
      { q: "Puis-je obtenir un remboursement ?", a: "Les remboursements sont étudiés au cas par cas dans les 48 heures suivant l'achat, si aucun contenu n'a été consulté. Contactez le support avec votre numéro de commande." },
    ],
  },
  {
    id: "cours",
    label: "Cours & contenu",
    icon: <FaBook />,
    items: [
      { q: "Les cours sont-ils en direct ou en replay ?", a: "Les deux. Certains parcours incluent des sessions live avec le formateur, et tous les cours sont disponibles en replay pour être consultés à tout moment." },
      { q: "Que faire si je bloque sur un exercice ?", a: "Vous pouvez poser vos questions directement dans l'espace de devoirs ou lors des sessions live. Le formateur répond en général sous 24 heures." },
      { q: "Les ressources (fichiers, templates) sont-elles incluses ?", a: "Oui. Chaque cours inclut les fichiers sources et ressources utilisés par le formateur, téléchargeables depuis la section « Ressources » de votre espace." },
      { q: "Puis-je télécharger les vidéos ?", a: "Les vidéos sont accessibles en streaming depuis votre espace. Le téléchargement hors ligne n'est pas disponible pour protéger le contenu des formateurs." },
    ],
  },
];

/* ── FAQ Accordion ── */
function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="ph-faq-list">
      {items.map((item, i) => (
        <div key={i} className={`ph-faq-item${open === i ? " is-open" : ""}`}>
          <button type="button" className="ph-faq-item__q" onClick={() => setOpen(open === i ? null : i)}>
            <span>{item.q}</span>
            <FaChevronDown className={`ph-faq-item__caret${open === i ? " is-open" : ""}`} />
          </button>
          {open === i && <p className="ph-faq-item__a">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function PublicHelpPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("compte");

  const currentCat = CATEGORIES.find((c) => c.id === activeCategory)!;
  const filteredItems = search.trim()
    ? CATEGORIES.flatMap((c) => c.items).filter(
        (item) =>
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
      )
    : currentCat.items;

  return (
    <div className="ph-page">
      {/* ── Hero ── */}
      <section className="ph-hero">
        <div className="ph-hero__overlay" />
        <div className="ph-hero__content">
          <span className="blog-eyebrow">Centre d'aide</span>
          <h1>Comment pouvons-nous <span>vous aider ?</span></h1>
          <p>Trouvez rapidement une réponse à vos questions</p>
          <div className="ph-hero__search">
            <FaSearch className="ph-hero__search-icon" />
            <input
              type="search"
              placeholder="Rechercher dans l'aide…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="ph-body">
        {search.trim() ? (
          /* Search results */
          <section className="ph-section">
            <div className="ph-section__inner">
              <p className="ph-search-count">
                {filteredItems.length} résultat{filteredItems.length !== 1 ? "s" : ""} pour « {search} »
              </p>
              {filteredItems.length > 0 ? (
                <FaqAccordion items={filteredItems} />
              ) : (
                <div className="ph-empty">
                  <p>Aucune question ne correspond à votre recherche.</p>
                  <button type="button" className="ph-btn ph-btn--outline" onClick={() => setSearch("")}>
                    Réinitialiser
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          /* Category browser */
          <section className="ph-section">
            <div className="ph-section__inner ph-section__inner--browse">
              {/* Sidebar categories */}
              <nav className="ph-cat-nav">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`ph-cat-nav__item${activeCategory === cat.id ? " is-active" : ""}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className="ph-cat-nav__icon">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </nav>

              {/* FAQ list */}
              <div className="ph-cat-content">
                <div className="ph-cat-content__header">
                  <span className="ph-cat-content__icon">{currentCat.icon}</span>
                  <h2>{currentCat.label}</h2>
                </div>
                <FaqAccordion items={currentCat.items} />
              </div>
            </div>
          </section>
        )}

        {/* ── Contact section ── */}
        <section className="ph-contact">
          <div className="ph-contact__inner">
            <span className="blog-eyebrow">Vous n'avez pas trouvé votre réponse ?</span>
            <h2>Notre équipe est là pour vous</h2>
            <p>Une question spécifique ? Contactez-nous directement, nous répondons en général sous quelques heures.</p>

            <div className="ph-contact-cards">
              <a href="https://wa.me/237600000000" target="_blank" rel="noreferrer" className="ph-contact-card ph-contact-card--whatsapp">
                <span className="ph-contact-card__badge">Recommandé</span>
                <div className="ph-contact-card__icon-wrap ph-contact-card__icon-wrap--wa">
                  <FaWhatsapp />
                </div>
                <strong>WhatsApp</strong>
                <span>Réponse rapide · Lun–Sam 8h–20h</span>
                <div className="ph-contact-card__cta">Nous écrire →</div>
              </a>

              <a href="mailto:support@academiedescreatifs.fr" className="ph-contact-card">
                <div className="ph-contact-card__icon-wrap">
                  <FaEnvelope />
                </div>
                <strong>E-mail</strong>
                <span>support@academiedescreatifs.fr</span>
                <div className="ph-contact-card__cta">Envoyer un e-mail →</div>
              </a>

              <div className="ph-contact-card ph-contact-card--muted">
                <span className="ph-contact-card__soon">Bientôt disponible</span>
                <div className="ph-contact-card__icon-wrap">
                  <FaHeadset />
                </div>
                <strong>Chat en direct</strong>
                <span>Disponible en heures ouvrées</span>
                <div className="ph-contact-card__cta ph-contact-card__cta--disabled">Pas encore disponible</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="ph-cta">
          <div className="ph-cta__overlay" />
          <div className="ph-cta__inner">
            <h2>Pas encore inscrit ?</h2>
            <p>Rejoignez l'Académie des Créatifs et démarrez votre formation dès aujourd'hui.</p>
            <div className="ph-cta__btns">
              <Link to="/formations" className="ph-btn ph-btn--primary">Voir les formations</Link>
              <Link to="/a-propos" className="ph-btn ph-btn--outline-light">En savoir plus</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
