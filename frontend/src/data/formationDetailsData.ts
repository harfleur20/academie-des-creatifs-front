import { onlineCourses, type EcommerceCourse } from "./ecommerceHomeData";

export type FormationProject = {
  title: string;
  image: string;
  kind?: "image" | "video";
  poster?: string;
};

export type FormationModule = {
  title: string;
  summary: string;
  duration: string;
  lessons?: string[];
};

export type FormationFaq = {
  question: string;
  answer: string;
};

type FormationDetailContent = {
  category: string;
  intro: string;
  mentor: string;
  mentorLabel: string;
  mentorImage: string;
  included: string[];
  objectives: string[];
  projects: FormationProject[];
  audienceText: string;
  certificateCopy: string;
  certificateImage: string;
  modules: FormationModule[];
  faqs: FormationFaq[];
};

export type FormationDetail = EcommerceCourse &
  FormationDetailContent & {
    heroImage: string;
    canPurchase?: boolean;
    purchaseMessage?: string | null;
    sessionState?: string;
  };

const formationContentBySlug: Record<string, FormationDetailContent> = {
  "maitrisez-design-packaging-a-z": {
    category: "Packaging design",
    intro:
      "Apprenez a construire des emballages credibles, attractifs et techniquement exploitables, depuis la reflexion produit jusqu'au fichier final pret pour l'impression.",
    mentor: "Francis Kenne",
    mentorLabel: "Responsable academique et formateur principal",
    mentorImage: "/Teams/photo-fk.jpg",
    included: [
      "Acces aux lives guides et aux replays du programme",
      "Exercices pratiques orientes branding et impression",
      "Suivi des rendus et corrections de projet",
      "Support via Microsoft Teams et WhatsApp",
      "Certificat numerique de fin de formation",
    ],
    objectives: [
      "Construire la structure complete d'un packaging professionnel",
      "Passer du croquis a la maquette prete pour la production",
      "Maitriser la hierarchie visuelle sur les faces de l'emballage",
      "Choisir des codes graphiques coherents avec le positionnement produit",
      "Preparer un fichier fiable pour la decoupe et l'impression",
      "Presenter une proposition packaging defendable devant un client",
    ],
    projects: [
      {
        title: "Systeme de packaging cosmétique",
        image: "/Flyers/Formation-Packaging-academie-creatifs.png",
      },
      {
        title: "Maquette 3D de boite produit",
        image: "/Flyers/model-packaging.avif",
      },
      {
        title: "Travail de structure et découpe",
        image: "/Flyers/packaging.jpg",
      },
      {
        title: "Direction artistique d'emballage",
        image: "/Flyers/emballage-boite-coupe-epreuve_1396481-223.avif",
      },
      {
        title: "Simulation de rendu packaging en mouvement",
        image: "/Flyers/packaging.mp4",
        kind: "video",
        poster: "/Flyers/packaging.jpg",
      },
    ],
    audienceText:
      "Ce cours s'adresse aux graphistes, designers produit, freelances et creatifs qui veulent proposer des emballages solides, plus rentables et plus convaincants a leurs clients.",
    certificateCopy:
      "A la fin de la formation, vous recevez un certificat d'achevement pour attester votre montee en competence et valoriser votre profil professionnel.",
    certificateImage: "/certicate.jpg",
    modules: [
      {
        title: "Module 1 - Strategie produit et analyse du packaging",
        summary:
          "Comprendre la promesse produit, la concurrence et les contraintes reelles qui structurent un bon emballage.",
        duration: "2h 40",
        lessons: [
          "Lecture du positionnement produit et des usages cibles",
          "Analyse des codes visuels de la concurrence",
          "Choix de l'angle de marque et du ton graphique",
          "Definition du cahier de contraintes pour le packaging",
        ],
      },
      {
        title: "Module 2 - Architecture, gabarits et zones de decoupe",
        summary:
          "Construire les faces du packaging, definir les zones utiles et eviter les erreurs de production.",
        duration: "3h 20",
        lessons: [
          "Construction d'un gabarit exploitable",
          "Zones de coupe, fonds perdus et marges de securite",
          "Organisation des faces et des informations obligatoires",
          "Preparation du fichier pour le montage et l'impression",
        ],
      },
      {
        title: "Module 3 - Composition graphique et argumentaire visuel",
        summary:
          "Travailler la hierarchie, la lisibilite et la valeur percue de l'offre sur le support final.",
        duration: "4h 05",
        lessons: [
          "Hierarchie visuelle et lecture rapide en rayon",
          "Typographie, contrastes et mise en avant des benefices",
          "Systeme d'images, motifs et codes de confiance",
          "Argumentaire visuel coherent avec la cible produit",
        ],
      },
      {
        title: "Module 4 - Mockup, presentation client et variantes",
        summary:
          "Mettre en scene le packaging, presenter vos choix et decliner un systeme graphique complet.",
        duration: "2h 55",
        lessons: [
          "Creation de mockups et rendus de presentation",
          "Structuration d'une presentation client defendable",
          "Declinaisons de gamme et variantes visuelles",
          "Validation finale et export des livrables",
        ],
      },
    ],
    faqs: [
      {
        question: "Faut-il deja savoir faire du packaging avant de commencer ?",
        answer:
          "Non. Le parcours repart des bases de structure et de hierarchie visuelle avant de monter progressivement vers les rendus client.",
      },
      {
        question: "Le programme est-il utile pour un freelance ?",
        answer:
          "Oui. La formation est pensee pour aider les graphistes a transformer une competence technique en offre claire et vendable.",
      },
      {
        question: "Recoit-on les fichiers et ressources de travail ?",
        answer:
          "Oui. Les fichiers de demonstration, references visuelles et supports utilises pendant les lives sont fournis dans l'espace du cours.",
      },
      {
        question: "Le certificat est-il remis a tous les apprenants ?",
        answer:
          "Il est delivre apres validation du projet final et completion des modules obligatoires.",
      },
    ],
  },
  "deviens-un-brand-designer": {
    category: "Brand designer",
    intro:
      "Developpez une methode claire pour concevoir des identites visuelles fortes, coherentes et defendables, depuis la strategie jusqu'aux declinaisons utiles au client.",
    mentor: "Francis Kenne",
    mentorLabel: "Responsable academique et directeur de creation",
    mentorImage: "/Teams/photo-fk.jpg",
    included: [
      "Acces aux sessions live de formation et aux replays",
      "Corrections sur les concepts, logos et systemes visuels",
      "Templates de presentation client et fichiers de travail",
      "Suivi de progression dans votre espace de formation",
      "Certificat numerique d'achevement du parcours",
    ],
    objectives: [
      "Trouver un positionnement de marque plus juste avant de designer",
      "Concevoir un logo defendable au-dela de l'effet visuel",
      "Construire un systeme visuel coherent et exploitable",
      "Developper des presentations client plus convaincantes",
      "Passer du brief a une identite visuelle complete et rentable",
      "Structurer un process de brand designer applicable sur de vrais projets",
    ],
    projects: [
      {
        title: "Construction de logo a partir d'une grille",
        image: "/Flyers/logo-grille.jpg",
      },
      {
        title: "Etude de symbole et proportions",
        image: "/Flyers/logo-twitter-nombre-dor-golden-ratio.jpg",
      },
      {
        title: "Croquis et exploration de concepts",
        image: "/Flyers/croquis-logo.png",
      },
      {
        title: "Systeme complet d'identite visuelle",
        image: "/Flyers/identité-visuelle.jpg",
      },
    ],
    audienceText:
      "Cette formation s'adresse aux graphistes, brand designers debutants, infographistes et entrepreneurs creatifs qui veulent proposer des identites visuelles plus solides et mieux facturees.",
    certificateCopy:
      "A la fin du parcours, vous recevez un certificat d'achevement attestant votre progression sur la strategie de marque, la conception de logo et les declinaisons visuelles.",
    certificateImage: "/certicate.jpg",
    modules: [
      {
        title: "Module 1 - Strategie de marque et lecture du brief",
        summary:
          "Transformer un brief flou en direction de marque claire, utile et directement exploitable dans le design.",
        duration: "2h 15",
        lessons: [
          "Lecture d'un brief et extraction des vrais enjeux",
          "Clarification de la promesse et de la personnalite de marque",
          "Recherche de direction creative utile au business",
          "Definition du cadre strategique avant dessin",
        ],
      },
      {
        title: "Module 2 - Recherche, moodboard et territoire visuel",
        summary:
          "Explorer la concurrence, les references et les codes pour cadrer un territoire de marque pertinent.",
        duration: "3h 10",
        lessons: [
          "Audit concurrentiel et references visuelles",
          "Construction d'un moodboard solide",
          "Selection de pistes et cadrage du territoire visuel",
          "Verification de la coherence marque-marche",
        ],
      },
      {
        title: "Module 3 - Logo, symbole et systeme typographique",
        summary:
          "Concevoir un logo defendable, une signature visuelle et les regles typographiques de la marque.",
        duration: "4h 25",
        lessons: [
          "Croquis, simplification et symbole",
          "Construction du logo et choix typographiques",
          "Tests de lisibilite et variantes d'usage",
          "Definition des regles de systeme visuel",
        ],
      },
      {
        title: "Module 4 - Palette, applications et brand board",
        summary:
          "Construire les couleurs, applications cles et livrables de presentation pour un client reel.",
        duration: "3h 05",
        lessons: [
          "Selection de la palette et logique chromatique",
          "Applications papeterie, reseaux et supports essentiels",
          "Mise en place d'une brand board claire",
          "Systeme de declinaison et coherence multi-supports",
        ],
      },
      {
        title: "Module 5 - Presentation client et mise en valeur du projet",
        summary:
          "Apprendre a raconter la logique du projet, justifier ses choix et livrer une fiche convaincante.",
        duration: "2h 45",
        lessons: [
          "Narration de projet et mise en page de presentation",
          "Justification des choix graphiques",
          "Preparation du livrable client final",
          "Valorisation du projet dans un portfolio",
        ],
      },
    ],
    faqs: [
      {
        question: "A qui s'adresse cette formation ?",
        answer:
          "Elle cible les graphistes qui veulent sortir du simple logo decoratif pour proposer une vraie logique de marque a leurs clients.",
      },
      {
        question: "Dois-je maitriser Illustrator avant de commencer ?",
        answer:
          "Une base est recommandee, mais le cours reste guide et montre le raisonnement autant que l'execution.",
      },
      {
        question: "Y a-t-il un projet final a realiser ?",
        answer:
          "Oui. Vous developpez une identite complete avec direction visuelle, logo, palette et planches de presentation.",
      },
      {
        question: "Le certificat est-il reconnu ?",
        answer:
          "Le certificat est delivre par l'Academie des Creatifs et atteste votre participation et la validation des livrables du parcours.",
      },
      {
        question: "Puis-je suivre la formation a mon rythme ?",
        answer:
          "Oui. Les replays restent accessibles, ce qui vous permet de revoir les modules et d'avancer avec plus de flexibilite.",
      },
    ],
  },
  "motion-design-par-la-pratique": {
    category: "Motion design",
    intro:
      "Entrez dans une pratique concrete du motion design en apprenant a animer des visuels, des logos et des compositions qui servent vraiment une marque ou une campagne.",
    mentor: "Bihee Alex",
    mentorLabel: "Formateur motion et direction visuelle",
    mentorImage: "/Teams/photo-Alex-Bihee.jpg",
    included: [
      "Acces aux lives, replays et demonstrations pas a pas",
      "Fichiers source pour reproduire les animations",
      "Exercices d'animation de logo et de visuels sociaux",
      "Retours sur vos compositions et votre rythme",
      "Certificat de fin de parcours",
    ],
    objectives: [
      "Comprendre les principes de base de l'animation graphique",
      "Animer un logo et un message publicitaire court",
      "Travailler le rythme, les transitions et la lisibilite",
      "Structurer un workflow motion plus rapide et plus propre",
      "Preparer des sorties adaptees aux reseaux sociaux",
      "Presenter un mini reel motion design convaincant",
    ],
    projects: [
      {
        title: "Animation d'identite visuelle",
        image: "/Flyers/anim-logo.mp4",
        kind: "video",
        poster: "/Flyers/anim-logo.png",
      },
      {
        title: "Flyer anime pour campagne sociale",
        image: "/Flyers/animate-flyer.mp4",
        kind: "video",
        poster: "/Flyers/flyer-anime.png",
      },
      {
        title: "Composition motion publicitaire",
        image: "/Flyers/anim-perso.mp4",
        kind: "video",
        poster: "/Flyers/flyer-anime2.png",
      },
      {
        title: "Storyboard motion pour reel",
        image: "/Flyers/motion-design-scaled.png",
      },
    ],
    audienceText:
      "Le cours est pense pour les graphistes, community managers et motion beginners qui veulent ajouter une competence motion immediately exploitable a leur offre.",
    certificateCopy:
      "Une fois le parcours complete et le projet final valide, un certificat d'achevement est mis a votre disposition dans votre espace personnel.",
    certificateImage: "/certicate.jpg",
    modules: [
      {
        title: "Module 1 - Bases du motion et rythme visuel",
        summary:
          "Comprendre les principes d'animation qui donnent du relief a une composition graphique.",
        duration: "2h 30",
        lessons: [
          "Usages du motion design et debouches reels",
          "Decouverte de l'interface et des outils de base",
          "Transformations, keyframes et rythme visuel",
          "Organisation d'un projet motion propre",
        ],
      },
      {
        title: "Module 2 - Animation de logo et transitions",
        summary:
          "Construire des entrees, sorties et reveals efficaces pour les identites visuelles.",
        duration: "3h 15",
        lessons: [
          "Animation de formes et reveal de logo",
          "Transitions fluides entre plans et messages",
          "Gestion du timing et du easing",
          "Mise en valeur d'une identite animee",
        ],
      },
      {
        title: "Module 3 - Publicites courtes et reels",
        summary:
          "Passer d'un visuel fixe a un format court adapte aux usages reseaux sociaux.",
        duration: "4h 00",
        lessons: [
          "Storyboard court pour pub ou reel",
          "Animation de texte et hierarchie de message",
          "Rythme, cuts et transitions pour les reseaux",
          "Assemblage d'une sequence motion convaincante",
        ],
      },
      {
        title: "Module 4 - Export, variantes et optimisation",
        summary:
          "Exporter proprement, gerer les formats et produire des rendus exploitables par les clients.",
        duration: "2h 10",
        lessons: [
          "Choix des formats d'export et compression",
          "Adaptation aux reseaux et aux differents usages",
          "Optimisation du poids et de la nettete",
          "Livraison client et variantes de rendu",
        ],
      },
    ],
    faqs: [
      {
        question: "Faut-il deja savoir animer ?",
        answer:
          "Non. Le cours commence par les principes fondamentaux et montre une progression realiste pour un graphiste qui debute en motion.",
      },
      {
        question: "Le programme est-il axe pub et reseaux sociaux ?",
        answer:
          "Oui. Une partie importante des exercices vise des contenus courts et utiles pour les campagnes digitales.",
      },
      {
        question: "Les fichiers de demonstration sont-ils fournis ?",
        answer:
          "Oui. Vous recevez les ressources utiles pour refaire les exercices et vous entrainer entre les sessions.",
      },
      {
        question: "Combien de temps ai-je acces au contenu ?",
        answer:
          "L'acces se fait via votre espace de formation et les replays restent consultables pendant la duree indiquee par la session.",
      },
    ],
  },
  "monetisation-audience-tiktok": {
    category: "TikTok et monetisation",
    intro:
      "Passez d'une production de contenu dispersee a une strategie claire pour faire grandir une audience TikTok, structurer votre offre et amorcer une monetisation durable.",
    mentor: "Natchi Dylan",
    mentorLabel: "Responsable des formations et community manager",
    mentorImage: "/Teams/photo-natchi.jpg",
    included: [
      "Lives strategiques et demonstrations sur cas reels",
      "Templates de scripts et structure de contenus courts",
      "Suivi sur la ligne editoriale et la monetisation",
      "Acces a la communaute d'apprenants",
      "Certificat de fin de programme",
    ],
    objectives: [
      "Clarifier votre niche et votre promesse de contenu",
      "Construire des scripts plus performants pour TikTok",
      "Ameliorer la retention et la frequence de publication",
      "Transformer une audience en opportunites de revenus",
      "Structurer une offre autour de votre expertise",
      "Mesurer les bons indicateurs pour iterer plus vite",
    ],
    projects: [
      {
        title: "Strategie de positionnement TikTok",
        image: "/Flyers/tiktok-flyer.png",
      },
      {
        title: "Validation de contenu monetable",
        image: "/Flyers/validationTiktok.png",
      },
      {
        title: "Activation de la monetisation",
        image: "/Flyers/activermonetisation.jpg",
      },
      {
        title: "Structure de compte a 10 000 abonnes",
        image: "/Flyers/10000abonnes.jpg",
      },
      {
        title: "Presentation video pour contenu court",
        image: "/Flyers/anim-logo.mp4",
        kind: "video",
        poster: "/Flyers/validationTiktok.png",
      },
    ],
    audienceText:
      "Cette formation vise les createurs, freelances, personal brands et entrepreneurs qui veulent faire de TikTok un canal de visibilite et de conversion plus serieux.",
    certificateCopy:
      "Le certificat de fin de formation vient reconnaitre la completion du parcours et la validation de votre plan d'action de monetisation.",
    certificateImage: "/certicate.jpg",
    modules: [
      {
        title: "Module 1 - Positionnement et ligne editoriale",
        summary:
          "Definir votre angle, votre promesse et les formats de contenu les plus coherents avec votre objectif.",
        duration: "2h 05",
        lessons: [
          "Clarification de niche et de promesse",
          "Construction d'une ligne editoriale soutenable",
          "Formats de contenu alignes avec l'objectif business",
          "Positionnement de profil et message de compte",
        ],
      },
      {
        title: "Module 2 - Scripts, hooks et storytelling court",
        summary:
          "Structurer des videos plus accrocheuses avec de meilleurs debuts, meilleurs enchainements et meilleurs calls to action.",
        duration: "3h 10",
        lessons: [
          "Hooks qui retiennent l'attention",
          "Structures de scripts courtes et efficaces",
          "Storytelling adapte au scroll rapide",
          "Calls to action utiles a la conversion",
        ],
      },
      {
        title: "Module 3 - Systeme de publication et analyse",
        summary:
          "Mettre en place une cadence soutenable, suivre les indicateurs et corriger rapidement votre trajectoire.",
        duration: "2h 40",
        lessons: [
          "Calendrier de publication intelligent",
          "Lecture des performances utiles",
          "Correction rapide des contenus faibles",
          "Systeme de repetition et d'optimisation",
        ],
      },
      {
        title: "Module 4 - Monetisation et offres",
        summary:
          "Relier audience, autorite et opportunites de revenus a travers des offres plus lisibles et plus vendables.",
        duration: "3h 00",
        lessons: [
          "Passage de l'audience a l'offre",
          "Types de monetisation adaptes a votre profil",
          "Construction d'une offre simple a vendre",
          "Tunnel de conversion depuis le contenu",
        ],
      },
    ],
    faqs: [
      {
        question: "Dois-je deja avoir une grosse audience pour suivre la formation ?",
        answer:
          "Non. Le programme est utile aussi bien pour lancer un compte avec de bonnes bases que pour restructurer une audience existante.",
      },
      {
        question: "Parle-t-on seulement de vues ou aussi de revenus ?",
        answer:
          "La formation traite des deux, avec un accent clair sur la monetisation et la transformation de l'audience en opportunites concretes.",
      },
      {
        question: "Les exemples sont-ils adaptes aux freelances et marques personnelles ?",
        answer:
          "Oui. Les cas traites visent justement des profils qui vendent une expertise, un service ou un produit digital.",
      },
      {
        question: "Puis-je revoir les sessions apres les lives ?",
        answer:
          "Oui. Les replays vous permettent de revoir les strategies, noter les frameworks et avancer a votre rythme.",
      },
    ],
  },
};

export function getAllFormationDetails(): FormationDetail[] {
  return onlineCourses
    .map((course) => {
      const detail = formationContentBySlug[course.slug];

      if (!detail) {
        return null;
      }

      return {
        ...course,
        ...detail,
        heroImage: course.image,
      };
    })
    .filter((course): course is FormationDetail => course !== null);
}

export function getFormationDetailBySlug(slug: string) {
  return getAllFormationDetails().find((course) => course.slug === slug);
}
