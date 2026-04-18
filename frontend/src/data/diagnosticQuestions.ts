export type DiagnosticCategory =
  | "Design graphique"
  | "Marketing digital"
  | "Reseaux sociaux"
  | "Academie";

export type DiagnosticQuestion = {
  id: number;
  category: DiagnosticCategory;
  text: string;
  options: string[];
  correctAnswer: number;
};

export const DIAGNOSTIC_DURATION_SECONDS = 15 * 60;
export const DIAGNOSTIC_PASSING_SCORE = 80;

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: 1,
    category: "Design graphique",
    text: "Quel est le role principal d'un logo dans une identite visuelle ?",
    options: [
      "Identifier rapidement une marque",
      "Remplacer tous les textes de presentation",
      "Faire augmenter automatiquement les ventes",
      "Servir uniquement sur les reseaux sociaux",
    ],
    correctAnswer: 0,
  },
  {
    id: 2,
    category: "Design graphique",
    text: "Quel mode colorimetrique est generalement utilise pour l'impression ?",
    options: ["RGB", "CMYK", "HEX", "HSL"],
    correctAnswer: 1,
  },
  {
    id: 3,
    category: "Design graphique",
    text: "A quoi sert l'espace blanc dans une composition ?",
    options: [
      "A remplir les zones vides au hasard",
      "A rendre le design plus lourd",
      "A ameliorer la lisibilite et la respiration visuelle",
      "A supprimer la hierarchie de l'information",
    ],
    correctAnswer: 2,
  },
  {
    id: 4,
    category: "Design graphique",
    text: "Pourquoi un logo est-il souvent cree en vectoriel ?",
    options: [
      "Parce qu'il se charge plus vite sur WhatsApp",
      "Parce qu'il peut etre agrandi sans perdre en nettete",
      "Parce qu'il ajoute automatiquement des effets 3D",
      "Parce qu'il remplace la charte graphique",
    ],
    correctAnswer: 1,
  },
  {
    id: 5,
    category: "Design graphique",
    text: "Quel est l'objectif d'un brief creatif ?",
    options: [
      "Donner uniquement les couleurs preferees du client",
      "Lister les logiciels du designer",
      "Aligner objectifs, cible, ton et contraintes du projet",
      "Eviter toute validation intermediaire",
    ],
    correctAnswer: 2,
  },
  {
    id: 6,
    category: "Marketing digital",
    text: "Une landing page performante cherche surtout a obtenir quoi ?",
    options: [
      "Une action precise de l'utilisateur",
      "Le plus grand nombre possible d'animations",
      "Un texte tres long sans bouton",
      "Plusieurs objectifs contradictoires",
    ],
    correctAnswer: 0,
  },
  {
    id: 7,
    category: "Marketing digital",
    text: "Que designe le trafic organique ?",
    options: [
      "Le trafic obtenu uniquement avec de la publicite payante",
      "Le trafic genere naturellement via moteurs de recherche et contenu",
      "Le trafic provenant uniquement d'Instagram",
      "Le trafic provenant des applications de messagerie",
    ],
    correctAnswer: 1,
  },
  {
    id: 8,
    category: "Marketing digital",
    text: "A quoi sert un call-to-action dans une campagne ?",
    options: [
      "A decorer la page",
      "A ralentir la lecture",
      "A remplacer la proposition de valeur",
      "A pousser l'utilisateur vers une action claire",
    ],
    correctAnswer: 3,
  },
  {
    id: 9,
    category: "Marketing digital",
    text: "Pourquoi definir une cible avant de lancer une campagne ?",
    options: [
      "Pour adapter le message au bon public",
      "Pour publier moins souvent",
      "Pour eviter toute mesure de performance",
      "Pour ne pas choisir de canal de diffusion",
    ],
    correctAnswer: 0,
  },
  {
    id: 10,
    category: "Marketing digital",
    text: "Quel indicateur est souvent utile pour evaluer une campagne email ?",
    options: [
      "Le poids du logo",
      "Le taux d'ouverture ou de clic",
      "Le nombre de couleurs utilisees",
      "La taille de l'ecran du destinataire",
    ],
    correctAnswer: 1,
  },
  {
    id: 11,
    category: "Reseaux sociaux",
    text: "Quel est l'avantage principal d'un calendrier editorial ?",
    options: [
      "Publier uniquement quand on y pense",
      "Garder une cadence et une ligne de contenu coherentes",
      "Supprimer toute phase d'analyse",
      "Poster le meme visuel partout sans adaptation",
    ],
    correctAnswer: 1,
  },
  {
    id: 12,
    category: "Reseaux sociaux",
    text: "Que mesure surtout le taux d'engagement ?",
    options: [
      "Le nombre d'applications installees sur un telephone",
      "Le prix d'une campagne",
      "Les interactions du public par rapport a l'audience",
      "La duree de fabrication d'un visuel",
    ],
    correctAnswer: 2,
  },
  {
    id: 13,
    category: "Reseaux sociaux",
    text: "Quel contenu est generalement adapte aux stories ?",
    options: [
      "Des contenus spontanes, courts et immediats",
      "Des catalogues PDF de 50 pages",
      "Des contenus obligatoirement sans texte",
      "Des videos longues de plusieurs heures",
    ],
    correctAnswer: 0,
  },
  {
    id: 14,
    category: "Reseaux sociaux",
    text: "Le community management consiste notamment a :",
    options: [
      "Repondre, moderer et animer la communaute",
      "Publier sans jamais lire les commentaires",
      "Choisir uniquement la police des posts",
      "Supprimer toutes les statistiques",
    ],
    correctAnswer: 0,
  },
  {
    id: 15,
    category: "Reseaux sociaux",
    text: "Pourquoi les formats courts comme les reels sont-ils efficaces ?",
    options: [
      "Ils captent vite l'attention si le message est clair",
      "Ils remplacent tous les autres formats",
      "Ils empechent de mesurer les performances",
      "Ils garantissent toujours la viralite",
    ],
    correctAnswer: 0,
  },
  {
    id: 16,
    category: "Academie",
    text: "Quelle approche pedagogique est mise en avant par l'Academie des Creatifs ?",
    options: [
      "Une approche essentiellement theorique",
      "Une approche pratique orientee competences reelles",
      "Une approche sans projet concret",
      "Une approche reservee au presentiel uniquement",
    ],
    correctAnswer: 1,
  },
  {
    id: 17,
    category: "Academie",
    text: "Quels formats de formation sont proposes sur le site ?",
    options: [
      "Uniquement le presentiel",
      "Uniquement les cours enregistrements",
      "En ligne et en presentiel",
      "Uniquement par email",
    ],
    correctAnswer: 2,
  },
  {
    id: 18,
    category: "Academie",
    text: "A quoi servent les badges de progression de l'Academie ?",
    options: [
      "A suivre l'evolution de l'apprenant",
      "A remplacer les projets pratiques",
      "A masquer les notes des etudiants",
      "A changer automatiquement de formation",
    ],
    correctAnswer: 0,
  },
  {
    id: 19,
    category: "Academie",
    text: "Que cherche a faire la plateforme de l'Academie pour l'apprenant ?",
    options: [
      "Centraliser l'apprentissage et les parcours de progression",
      "Supprimer tout accompagnement humain",
      "Remplacer totalement les formateurs",
      "Limiter l'acces aux projets concrets",
    ],
    correctAnswer: 0,
  },
  {
    id: 20,
    category: "Academie",
    text: "Quel est l'objectif general mis en avant sur la page d'accueil ?",
    options: [
      "Transformer les passionnes en professionnels du digital",
      "Former uniquement aux logiciels bureautiques",
      "Faire passer des examens sans accompagnement",
      "Se concentrer uniquement sur un seul metier",
    ],
    correctAnswer: 0,
  },
];
