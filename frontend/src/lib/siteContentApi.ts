import { apiRequest } from "./apiClient";

export type AlbumItem = {
  image: string;
  title: string;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
  detail: string;
  image: string;
};

export type BadgeLevelItem = {
  name: string;
  image: string;
  className: string;
};

export type TrainerProfile = {
  name: string;
  image: string;
  role: string;
  label: string;
};

export type HeroSlideItem = {
  eyebrow: string;
  navLabel: string;
  title: string;
  titleEmphasis: string;
  description: string;
  image: string;
  imagePosition: string;
  cta1Label: string;
  cta1Url: string;
  cta1External: boolean;
  cta2Label: string;
  cta2Url: string;
  cta2External: boolean;
};

export type HeroCounterItem = {
  value: string;
  copy: string;
  icon: string;
};

export type ProgrammeHighlightConfig = {
  title: string;
  text: string;
};

export type ProgrammeConfig = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logoColored: string;
  logoWhite: string;
  heroImage: string;
  primary: string;
  primaryDark: string;
  accent: string;
  accentText: string;
  highlights: ProgrammeHighlightConfig[];
  photos: string[];
  ctaLabel: string;
  ctaPath: string;
};

export type VideoItem = {
  url: string;
  thumbnail?: string;
};

export type SiteContent = {
  hero_slides: HeroSlideItem[];
  hero_counters: HeroCounterItem[];
  album_items: AlbumItem[];
  videos: VideoItem[];
  testimonials: TestimonialItem[];
  badge_levels: BadgeLevelItem[];
  trainers: TrainerProfile[];
  programmes: ProgrammeConfig[];
};

export const DEFAULT_HERO_SLIDE_ITEMS: HeroSlideItem[] = [
  {
    eyebrow: "Académie des Créatifs",
    navLabel: "Formations",
    title: "Apprends les métiers du digital par",
    titleEmphasis: "la pratique",
    description: "Des projets concrets, des retours précis et un accompagnement pensé pour faire monter ton niveau rapidement.",
    image: "/bg-ac-1.jpg",
    imagePosition: "center center",
    cta1Label: "Demarrer mon diagnostic",
    cta1Url: "/diagnostic",
    cta1External: false,
    cta2Label: "Écrire sur WhatsApp",
    cta2Url: "https://wa.me/message/DMISDTO4HCUDC1",
    cta2External: true,
  },
  {
    eyebrow: "Parcours en ligne et en présentiel",
    navLabel: "Formats",
    title: "Choisis un parcours",
    titleEmphasis: "adapté à ton rythme.",
    description: "Sessions live, accompagnement terrain et programmes intensifs pour progresser avec un cadre clair.",
    image: "/Album/album-7.jpg",
    imagePosition: "center center",
    cta1Label: "Formations en ligne",
    cta1Url: "/#form-en-ligne",
    cta1External: false,
    cta2Label: "Présentiel certifiant",
    cta2Url: "/#form-en-presentiel",
    cta2External: false,
  },
  {
    eyebrow: "Portfolio et employabilité",
    navLabel: "Portfolio",
    title: "Construis un portfolio",
    titleEmphasis: "qui vend tes compétences.",
    description: "Branding, packaging, motion, UI et web design: tu avances avec des livrables solides à montrer à tes clients.",
    image: "/Album/album-9.jpg",
    imagePosition: "center 28%",
    cta1Label: "Créer mon compte",
    cta1Url: "/register",
    cta1External: false,
    cta2Label: "Voir les témoignages",
    cta2Url: "/#temoignage",
    cta2External: false,
  },
  {
    eyebrow: "Mentorat terrain",
    navLabel: "Mentorat",
    title: "Progresse avec des mentors",
    titleEmphasis: "qui pratiquent vraiment.",
    description: "Tu progresses avec des intervenants du terrain, des retours utiles et une communauté créative vraiment active.",
    image: "/Album/album-1.jpg",
    imagePosition: "center 32%",
    cta1Label: "Découvrir l'équipe",
    cta1Url: "/notre-equipe",
    cta1External: false,
    cta2Label: "Moments en image",
    cta2Url: "/#album",
    cta2External: false,
  },
];

export const DEFAULT_HERO_COUNTER_ITEMS: HeroCounterItem[] = [
  { value: "+2000", copy: "apprenants accompagnés sur des parcours créatifs et digitaux.", icon: "graduation" },
  { value: "+20", copy: "bootcamps, ateliers et masterclasses menés avec la communauté.", icon: "lightning" },
  { value: "24h", copy: "pour donner une première orientation claire et exploitable.", icon: "gauge" },
  { value: "5", copy: "étapes pour cadrer un parcours de progression utile et concret.", icon: "check" },
];

export function normalizeVideos(raw: unknown[]): VideoItem[] {
  return raw.map((v) =>
    typeof v === "string" ? { url: v } : (v as VideoItem),
  );
}

export const EMPTY_SITE_CONTENT: SiteContent = {
  hero_slides: [],
  hero_counters: [],
  album_items: [],
  videos: [],
  testimonials: [],
  badge_levels: [],
  trainers: [],
  programmes: [],
};

export async function fetchPublicSiteContent(): Promise<SiteContent> {
  const data = await apiRequest<SiteContent & { videos: unknown[] }>("/site-content");
  return { ...data, videos: normalizeVideos(data.videos ?? []) };
}
