import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaChalkboardTeacher,
  FaCheckCircle,
  FaChevronDown,
  FaGlobe,
  FaHeart,
  FaLaptop,
  FaLightbulb,
  FaMinus,
  FaPlus,
  FaUsers,
} from "react-icons/fa";

const STEPS = [
  {
    id: 1,
    label: "Rejoindre",
    title: "Étape 1 — Rejoindre la communauté",
    desc: "Tu arrives sur la plateforme, tu crées ton compte et tu accèdes à l'espace étudiant. Dès ce moment, tu n'es plus seul(e) — tu intègres une communauté de créatifs qui avancent ensemble.",
    accent: "La communauté, c'est ton premier outil.",
    items: [
      {
        title: "Accès immédiat à l'espace étudiant",
        detail: "Dès la validation de ton inscription, tu accèdes à ton tableau de bord personnel avec tes formations, ta progression et tes ressources.",
      },
      {
        title: "Présentation de la communauté et des formateurs",
        detail: "Tu découvres les formateurs assignés à tes formations, leur parcours et leurs spécialités. Tu rejoins aussi les espaces communautaires dédiés.",
      },
      {
        title: "Exploration du catalogue de formations",
        detail: "Parcours l'ensemble du catalogue, filtre par domaine ou niveau, et consulte les fiches détaillées pour trouver la formation qui te correspond.",
      },
      {
        title: "Orientation vers la formation adaptée à ton profil",
        detail: "Tu peux nous contacter sur WhatsApp pour un conseil d'orientation personnalisé avant de t'inscrire.",
      },
    ],
  },
  {
    id: 2,
    label: "Choisir",
    title: "Étape 2 — Choisir ta formation",
    desc: "Chaque formation est conçue autour d'un domaine précis : graphisme, motion, web design, community management... Tu choisis selon tes objectifs, ton niveau et ce que tu veux créer.",
    accent: "On ne forme pas des généralistes. On forme des spécialistes.",
    items: [
      {
        title: "Catalogue structuré par domaine et niveau",
        detail: "Les formations sont classées par catégorie (graphisme, vidéo, web, business…) et par niveau (débutant, intermédiaire, avancé) pour une navigation intuitive.",
      },
      {
        title: "Fiches de formation détaillées avec programme complet",
        detail: "Chaque fiche liste les modules, les leçons, les projets pratiques, le formateur, la durée et les prérequis — tout ce dont tu as besoin pour décider.",
      },
      {
        title: "Accès au profil du formateur assigné",
        detail: "Tu peux consulter le parcours, les certifications et les spécialités du formateur avant de t'inscrire pour t'assurer de la qualité de l'enseignement.",
      },
      {
        title: "Tarification claire avec options de paiement flexibles",
        detail: "Le prix est affiché clairement sur chaque fiche. Des options de paiement en plusieurs tranches sont proposées à partir de 100 000 FCFA de commande quand la durée de session le permet.",
      },
    ],
  },
  {
    id: 3,
    label: "Apprendre",
    title: "Étape 3 — Apprendre par la pratique",
    desc: "Chaque module est structuré autour d'un projet réel. Tu regardes, tu reproduis, tu crées. Les feedbacks sont directs et les formateurs sont disponibles pour guider chaque étape.",
    accent: "On apprend en faisant, pas en mémorisant.",
    items: [
      {
        title: "Cours vidéo structurés en modules et leçons",
        detail: "Les formations sont découpées en modules thématiques, eux-mêmes divisés en leçons courtes et progressives pour faciliter l'apprentissage à ton rythme.",
      },
      {
        title: "Exercices pratiques à chaque module",
        detail: "Chaque module se termine par un exercice pratique à réaliser. C'est en reproduisant puis en créant que les compétences se consolident vraiment.",
      },
      {
        title: "Feedback personnalisé du formateur",
        detail: "Le formateur est disponible pour corriger tes travaux, répondre à tes questions et t'orienter lorsque tu bloques sur une étape.",
      },
      {
        title: "Replays disponibles à vie",
        detail: "Toutes les vidéos restent accessibles une fois la formation achetée. Tu peux revoir n'importe quelle leçon autant de fois que nécessaire.",
      },
    ],
  },
  {
    id: 4,
    label: "Portfolio",
    title: "Étape 4 — Construire ton portfolio",
    desc: "À la fin de chaque formation, tu repartis avec des projets concrets, réalisés par toi. Ce sont ces projets qui parleront pour toi auprès de clients, d'employeurs ou de collaborateurs.",
    accent: "Un portfolio réel vaut mieux que dix diplômes.",
    items: [
      {
        title: "Projets finaux encadrés par le formateur",
        detail: "Chaque formation inclut un ou plusieurs projets de fin de parcours à réaliser depuis zéro, guidé par les consignes et les retours du formateur.",
      },
      {
        title: "Correction et validation des livrables",
        detail: "Le formateur examine tes livrables, te donne un retour détaillé et valide la qualité avant de te délivrer ton certificat.",
      },
      {
        title: "Conseils sur la mise en valeur des projets",
        detail: "On t'accompagne sur la présentation de tes projets : format Behance, PDF, site portfolio — pour que ton travail soit visible et professionnel.",
      },
      {
        title: "Certificat Académie des Créatifs à l'obtention",
        detail: "À la validation de ta formation, tu reçois un certificat numérique signé par ton formateur, que tu peux partager sur LinkedIn ou ton portfolio.",
      },
    ],
  },
  {
    id: 5,
    label: "Monétiser",
    title: "Étape 5 — Monétiser ton talent",
    desc: "L'objectif final n'est pas juste d'apprendre — c'est de vivre de ton talent. On t'accompagne sur le positionnement, la tarification, la prospection et la construction d'une activité freelance solide.",
    accent: "Un créatif sans mindset business restera toujours sous-payé.",
    items: [
      {
        title: "Module « Graphiste Businessman » intégré",
        detail: "Inspiré du livre de Francis Kenne, ce module t'enseigne comment positionner ton offre, fixer tes tarifs et communiquer ta valeur à tes clients.",
      },
      {
        title: "Stratégies de tarification et positionnement",
        detail: "On t'apprend à sortir de la guerre des prix, à valoriser ton expertise et à facturer en fonction de la valeur que tu apportes — pas du temps que tu passes.",
      },
      {
        title: "Outils pour trouver ses premiers clients",
        detail: "Prospection sur LinkedIn, réseaux créatifs, plateformes freelance… on te donne les méthodes concrètes pour décrocher tes premières missions.",
      },
      {
        title: "Accès à la communauté d'entraide alumni",
        detail: "En fin de parcours, tu rejoins le réseau des anciens étudiants de l'Académie — une communauté active qui partage des opportunités et des collaborations.",
      },
    ],
  },
];

const FAQS = [
  {
    q: "Les formations sont-elles accessibles depuis n'importe quel pays ?",
    a: "Oui, toutes nos formations en ligne sont accessibles depuis n'importe quel pays francophone. Tu as besoin d'une connexion internet et d'un appareil (ordinateur recommandé).",
  },
  {
    q: "Faut-il avoir un niveau avancé pour s'inscrire ?",
    a: "Non. Chaque formation indique clairement le niveau requis (débutant, intermédiaire, avancé). Certaines formations partent de zéro et t'amènent jusqu'au niveau professionnel.",
  },
  {
    q: "Les formations sont-elles en direct ou en replay ?",
    a: "Selon le format : les formations « en ligne » sont accessibles à ton propre rythme avec des vidéos pré-enregistrées. Les formations « live » se déroulent en direct avec sessions en groupe, mais les replays sont disponibles.",
  },
  {
    q: "Comment fonctionne le certificat de fin de formation ?",
    a: "À la validation de ta formation — modules complétés et projet final soumis — tu reçois un certificat numérique Académie des Créatifs signé par le formateur.",
  },
  {
    q: "Peut-on payer en plusieurs fois ?",
    a: "Oui, un plan de paiement en plusieurs tranches peut être proposé dès 100 000 FCFA de commande, selon la durée de la session et le calendrier d'échéances.",
  },
];

/* ── Accordion item avec animation fluide ── */
function StepAccordionItem({ title, detail }: { title: string; detail: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`step-accordion-item${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="step-accordion-item__header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <FaCheckCircle className="step-accordion-item__check" />
        <span>{title}</span>
        <span className="step-accordion-item__toggle">
          {open ? <FaMinus /> : <FaPlus />}
        </span>
      </button>
      <div
        ref={bodyRef}
        className="step-accordion-item__body"
        style={{
          maxHeight: open ? `${bodyRef.current?.scrollHeight ?? 200}px` : "0px",
        }}
      >
        <p>{detail}</p>
      </div>
    </div>
  );
}

/* ── FAQ accordion ── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`about-faq-item${open ? " is-open" : ""}`}>
      <button type="button" className="about-faq-item__q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <FaChevronDown className="about-faq-item__icon" />
      </button>
      <div
        ref={bodyRef}
        className="about-faq-item__body"
        style={{
          maxHeight: open ? `${bodyRef.current?.scrollHeight ?? 200}px` : "0px",
        }}
      >
        <p className="about-faq-item__a">{a}</p>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <div className="about-page">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero__overlay" />
        <div className="about-hero__content">
          <p className="about-eyebrow">À propos de l'Académie</p>
          <h1>
            Une académie. Un seul objectif :{" "}
            <span>faire de toi un créatif qui vit de son talent.</span>
          </h1>
          <p className="about-hero__lead">
            L'Académie des Créatifs accompagne les créatifs francophones à travers
            un parcours structuré, pratique et communautaire — de l'apprentissage
            jusqu'à la génération de revenus réels.
          </p>
        </div>
      </section>

      {/* ── NOTRE APPROCHE (steps) ────────────────────────── */}
      <section className="about-steps">
        <div className="about-steps__inner">
          <p className="about-eyebrow">Notre approche</p>
          <h2>
            5 étapes. Un seul résultat :{" "}
            <span>vivre de ta créativité.</span>
          </h2>

          <div className="about-steps__tabs" role="tablist">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeStep === i}
                className={`about-steps__tab${activeStep === i ? " is-active" : ""}`}
                onClick={() => setActiveStep(i)}
              >
                <span className="about-steps__tab-num">{s.id}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="about-steps__body">
            <div className="about-steps__card">
              <p className="about-steps__card-tag">ÉTAPE {step.id} SUR 5</p>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <p className="about-steps__card-accent">— {step.accent}</p>
            </div>
            <div className="about-steps__accordions">
              {step.items.map((item) => (
                <StepAccordionItem key={item.title} title={item.title} detail={item.detail} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DIFFÉRENCIATEURS ──────────────────────────────── */}
      <section className="about-why">
        <div className="about-why__inner">
          <p className="about-eyebrow">Pourquoi nous choisir</p>
          <h2>
            Ce qui rend l'Académie <span>différente</span>
          </h2>
          <div className="about-why__grid">
            {[
              { icon: FaLaptop,            title: "100 % pratique",           body: "Chaque cours est structuré autour de projets concrets. On n'enseigne pas la théorie pour la théorie." },
              { icon: FaUsers,             title: "Communauté vivante",       body: "Tu rejoins une communauté active de créatifs qui partagent, s'entraident et progressent ensemble." },
              { icon: FaChalkboardTeacher, title: "Formateurs certifiés",     body: "Tous nos formateurs sont des professionnels actifs dans leur domaine, pas uniquement des enseignants." },
              { icon: FaCheckCircle,       title: "Certificat reconnu",       body: "À la fin de chaque parcours, tu reçois un certificat Académie des Créatifs validé par ton formateur." },
              { icon: FaHeart,             title: "Accès à vie",              body: "Une fois inscrit(e), tu accèdes aux contenus à vie, y compris les mises à jour futures de la formation." },
              { icon: FaLightbulb,         title: "Mindset business intégré", body: "On ne forme pas que des techniciens. On forme des créatifs capables de se vendre et de facturer." },
              { icon: FaGlobe,             title: "Accessible partout",       body: "Depuis le Cameroun, la Côte d'Ivoire, le Sénégal ou la diaspora — nos formations sont 100 % en ligne." },
              { icon: FaArrowRight,        title: "Résultats mesurables",     body: "Nos étudiants repartent avec un portfolio réel, des clients et les outils pour générer des revenus." },
            ].map(({ icon: Icon, title, body }) => (
              <div className="about-why-card" key={title}>
                <div className="about-why-card__icon"><Icon /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="about-faq">
        <div className="about-faq__inner">
          <div className="about-faq__left">
            <p className="about-eyebrow">FAQ</p>
            <h2>
              Les questions <span>les plus fréquentes</span>
            </h2>
            <p>
              Tu ne trouves pas ta réponse ? Écris-nous directement sur WhatsApp,
              on te répond dans la journée.
            </p>
            <a
              href="https://wa.me/237000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="about-faq__whatsapp"
            >
              <FaArrowRight /> Écrire sur WhatsApp
            </a>
          </div>
          <div className="about-faq__list">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="about-cta">
        <div className="about-cta__overlay" />
        <div className="about-cta__inner">
          <p className="about-eyebrow about-eyebrow--light">Académie des Créatifs</p>
          <h2>
            Prêt(e) à démarrer <span>ton parcours ?</span>
          </h2>
          <p>
            La première étape, c'est de choisir ta formation. On s'occupe du reste.
          </p>
          <div className="about-cta__actions">
            <Link to="/formations" className="about-cta__btn about-cta__btn--primary">
              <FaChalkboardTeacher /> Voir les formations
            </Link>
            <a
              href="https://wa.me/237000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="about-cta__btn about-cta__btn--outline"
            >
              <FaArrowRight /> Nous contacter
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
