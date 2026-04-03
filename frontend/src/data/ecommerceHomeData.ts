export type CourseBadge = "premium" | "populaire" | "promo";
export type FormationFormat = "live" | "ligne" | "presentiel";

export type EcommerceCourse = {
  id: number;
  slug: string;
  title: string;
  level: string;
  rating: number;
  reviews: number;
  image: string;
  currentPrice: string;
  originalPrice?: string;
  badges?: CourseBadge[];
  sessionLabel: string;
  formatType?: FormationFormat;
};

export const stats = [
  {
    value: "+600",
    copy: "étudiants formés et propulsés vers des carrières créatives réussies.",
  },
  {
    value: "+50",
    copy: "formateurs qualifiés disponibles et prêts à transmettre leur expertise.",
  },
  {
    value: "+5000",
    copy: "créatifs sur nos réseaux sociaux prêts à partager et à s'inspirer mutuellement.",
  },
];

export const onlineCourses: EcommerceCourse[] = [
  {
    id: 1,
    slug: "maitrisez-design-packaging-a-z",
    title: "Maîtrisez le Design de Packaging de A à Z - De la découpe à l'impression",
    level: "Niveau intermédiaire",
    rating: 3,
    reviews: 65,
    image: "/Flyers/packaging.jpg",
    currentPrice: "50 000 FCFA",
    sessionLabel: "Prochaine session : 15 avril 2026",
    formatType: "ligne",
  },
  {
    id: 2,
    slug: "deviens-un-brand-designer",
    title: "Démarque-toi des autres graphistes, deviens un Brand Designer",
    level: "Niveau intermédiaire",
    rating: 4,
    reviews: 205,
    image: "/Flyers/brand-identity.jpg",
    currentPrice: "65 000 FCFA",
    badges: ["premium"],
    sessionLabel: "Prochaine session : 06 mai 2026",
    formatType: "live",
  },
  {
    id: 3,
    slug: "motion-design-par-la-pratique",
    title: "Apprendre le motion design par la pratique (+40h de formation)",
    level: "Niveau intermédiaire",
    rating: 3,
    reviews: 895,
    image: "/Flyers/Motion-design.jpg",
    currentPrice: "70 000 FCFA",
    originalPrice: "95 000 FCFA",
    badges: ["populaire", "promo"],
    sessionLabel: "Prochaine session : 17 avril 2026",
    formatType: "live",
  },
  {
    id: 4,
    slug: "monetisation-audience-tiktok",
    title: "De la création à la monétisation : la méthode complète pour vivre de votre audience TikTok",
    level: "Tous niveaux",
    rating: 4.5,
    reviews: 104,
    image: "/Flyers/Flyer_TIKTOK_Academie.jpg",
    currentPrice: "50 000 FCFA",
    badges: ["premium"],
    sessionLabel: "Prochaine session : 09 mai 2026",
    formatType: "ligne",
  },
];

export function getFormationPath(slug: string) {
  return `/formations/${slug}`;
}

export const albumItems = [
  {
    image: "/img-bg-4.jpg",
    title: "Soutenance de Vanel à l'Académie des Créatifs",
  },
  {
    image: "/Album/album-1.jpg",
    title: "Séance de travaux pratiques sur Illustrator",
  },
  {
    image: "/Album/album-2.jpg",
    title: "Les bases du dessin pour les logos croquis",
  },
  {
    image: "/Album/album-3.jpg",
    title: "Séance de travaux pratiques sur Photoshop",
  },
  {
    image: "/Album/album-9.jpg",
    title: "Atelier pratique sur la conception de packaging",
  },
  {
    image: "/Album/album-6.jpg",
    title: "La toute première promotion de l'Académie des Créatifs",
  },
  {
    image: "/Album/album-7.jpg",
    title: "Présentation projet en présentiel par nos étudiants",
  },
  {
    image: "/Album/album-8.jpg",
    title: "Melvine, gagnante de la coupe des Créatifs",
  },
];

export const videos = [
  "https://www.youtube.com/embed/dKrZ6tPL_wU",
  "https://www.youtube.com/embed/fHsVZ_qQ4ac",
  "https://www.youtube.com/embed/veXfXR9vgQM",
  "https://www.youtube.com/embed/HeIauv3DSs8",
];

export const testimonials = [
  {
    quote:
      "Graphiste et bientôt développeur fullstack, grâce à l'Académie des Créatifs. Ils m'ont appris à saisir les opportunités et à vendre mes services.",
    name: "Melvine Possi",
    role: "Graphiste & développeur, freelance",
    detail: "Ancienne étudiante de l'Académie des Créatifs",
    image: "/T%C3%A9moignages/Melvine-Possi.jpg",
  },
  {
    quote:
      "Je recommande fortement cette page à tous les amateurs en design graphique pour gagner en savoir-faire et acquérir de l'expérience.",
    name: "Monsieur Bënguiste",
    role: "Responsable des projets graphiques, Vacom Agency",
    detail: "Partenaire de l'Académie des Créatifs",
    image: "/T%C3%A9moignages/mr-benguiste.jpg",
  },
  {
    quote:
      "L'Académie des Créatifs ne transmet pas seulement la compétence, mais également la passion pour le design graphique.",
    name: "Loic Djitouo",
    role: "Graphiste, freelance",
    detail: "Gagnant 2e édition de la coupe des Créatifs",
    image: "/T%C3%A9moignages/loic-djitcho.jpg",
  },
];

export const badgeLevels = [
  {
    name: "Aventurier",
    image: "/Badges/bg-avanturier.svg",
    className: "prog-carte-cercle-1",
  },
  {
    name: "Débutant",
    image: "/Badges/bg-debutant.svg",
    className: "prog-carte-cercle-2",
  },
  {
    name: "Intermédiaire",
    image: "/Badges/bg-interm%C3%A9diare.svg",
    className: "prog-carte-cercle-3",
  },
  {
    name: "Semi-pro",
    image: "/Badges/bg-semi-pro.svg",
    className: "prog-carte-cercle-4",
  },
  {
    name: "Professionnel",
    image: "/Badges/bg-professionnel.svg",
    className: "prog-carte-cercle-5",
  },
];

export const trainers = [
  {
    name: "Francis Kenne",
    image: "/Teams/photo-fk.jpg",
    role: "Graphiste, motion graphics, développeur fullstack",
    label: "Responsable académique",
  },
  {
    name: "Bihee Alex",
    image: "/Teams/photo-Alex-Bihee.jpg",
    role: "Brand Identity, web designer, développeur front-end",
    label: "Formateur",
  },
  {
    name: "Natchi Dylan",
    image: "/Teams/photo-natchi.jpg",
    role: "Community manager, Canva Designer",
    label: "Responsable des formations",
  },
  {
    name: "Kouakam Lary",
    image: "/Teams/laryadd.jpg",
    role: "Graphiste, freelancer, développeur web",
    label: "Formateur",
  },
];
