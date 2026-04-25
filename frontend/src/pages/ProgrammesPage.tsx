import { type ComponentType, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicSiteContent, type ProgrammeConfig } from "../lib/siteContentApi";
import {
  Award,
  CheckSquare,
  FileText,
  Mic,
  Pencil,
  Play,
  Radio,
  Star,
  Trophy,
  Users,
  Video,
  Zap,
} from "lucide-react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

type ProgrammeHighlight = {
  icon: Icon;
  title: string;
  text: string;
};

type Programme = {
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
  highlights: ProgrammeHighlight[];
  photos: string[];
  ctaLabel: string;
  ctaPath: string;
};

const PROGRAMMES: Programme[] = [
  {
    id: "focus-talklive",
    name: "Focus TalkLive",
    tagline: "Des conférences live pour s'inspirer et progresser",
    description:
      "Focus TalkLive rassemble des créatifs et professionnels du digital autour de sessions de talks en direct. Des échanges concrets, des invités du terrain et une communauté active qui débat et grandit ensemble.",
    logoColored: "/logos-programme/logos-focus-TalkLive.png",
    logoWhite: "/logos-programme/1.png",
    heroImage: "/Album/album-7.jpg",
    primary: "#1c2a5e",
    primaryDark: "#0f1a3d",
    accent: "#f97316",
    accentText: "#fff",
    highlights: [
      { icon: Mic,   title: "Speakers du terrain",   text: "Des intervenants actifs qui partagent leur vécu professionnel sans filtre." },
      { icon: Radio, title: "Sessions en direct",     text: "Des lives interactifs avec Q&A en temps réel pour apprendre en communauté." },
      { icon: Play,  title: "Replays accessibles",    text: "Retrouve chaque session dans ton espace personnel après le live." },
    ],
    photos: [
      "/Album/album-1.jpg",
      "/Album/album-2.jpg",
      "/Album/album-3.jpg",
      "/Album/album-7.jpg",
    ],
    ctaLabel: "Voir les sessions à venir",
    ctaPath: "/formations",
  },
  {
    id: "graphic-talent",
    name: "Graphic Talent Insider",
    tagline: "La compétition qui révèle les talents créatifs",
    description:
      "Graphic Talent Insider est le programme phare pour les designers en devenir. Chaque session soumet des créatifs à des briefs réels évalués par un jury de professionnels — un tremplin concret pour ton portfolio et ta carrière.",
    logoColored: "/logos-programme/2.png",
    logoWhite: "/logos-programme/2.png",
    heroImage: "/Album/album-5.jpg",
    primary: "#1a1a2e",
    primaryDark: "#0d0d1a",
    accent: "#eab308",
    accentText: "#1a1a2e",
    highlights: [
      { icon: FileText, title: "Briefs réels",          text: "Relève des challenges inspirés du vrai marché et forge ton style en conditions réelles." },
      { icon: Star,     title: "Jury de pros",           text: "Ton travail évalué par des professionnels actifs du design et de la communication." },
      { icon: Award,    title: "Portfolio & palmarès",   text: "Intègre tes meilleurs rendus dans ton portfolio et accède au classement public." },
    ],
    photos: [
      "/Album/album-4.jpg",
      "/Album/album-5.jpg",
      "/Album/album-6.jpg",
      "/Album/album-9.jpg",
    ],
    ctaLabel: "Rejoindre la compétition",
    ctaPath: "/formations",
  },
  {
    id: "tuto-en-ligne",
    name: "Tuto en Ligne",
    tagline: "Apprends à ton rythme, avance par la pratique",
    description:
      "Tuto en Ligne propose des formations vidéo guidées en design, motion et digital. Un parcours pensé pour progresser de manière autonome, avec des projets concrets à chaque module et des retours de la communauté.",
    logoColored: "/logos-programme/logoChat.png",
    logoWhite: "/logos-programme/3.png",
    heroImage: "/Album/album-8.jpg",
    primary: "#c2410c",
    primaryDark: "#7c2d12",
    accent: "#fb923c",
    accentText: "#fff",
    highlights: [
      { icon: Video,  title: "Vidéos guidées",      text: "Des tutos pas à pas sur Illustrator, After Effects, Figma et bien plus." },
      { icon: Pencil, title: "Projets pratiques",   text: "Chaque module se termine par un rendu concret à créer et à soumettre." },
      { icon: Users,  title: "Communauté active",   text: "Partage tes créations, commente celles des autres et grandis ensemble." },
    ],
    photos: [
      "/Album/album-8.jpg",
      "/Album/album-3.jpg",
      "/Album/album-6.jpg",
      "/Album/album-1.jpg",
    ],
    ctaLabel: "Découvrir les formations",
    ctaPath: "/formations",
  },
  {
    id: "coupe-des-creatifs",
    name: "Coupe des Créatifs",
    tagline: "L'ultime défi pour les créatifs de la communauté",
    description:
      "La Coupe des Créatifs est le challenge annuel ouvert à tous les membres de l'Académie. Présente ton meilleur projet, défie tes pairs et gagne une place au classement de la communauté créative.",
    logoColored: "/logos-programme/logo_coupe des créatifs.png",
    logoWhite: "/logos-programme/logo_coupe des créatifs.png",
    heroImage: "/Album/coupecreatif.jpg",
    primary: "#1565c0",
    primaryDark: "#0d47a1",
    accent: "#38bdf8",
    accentText: "#0d47a1",
    highlights: [
      { icon: Zap,         title: "Défi ouvert à tous",         text: "Soumets ton projet et entre en compétition avec toute la communauté créative." },
      { icon: CheckSquare, title: "Vote & jury",                 text: "Les participants et un jury de pros évaluent chaque création soumise." },
      { icon: Trophy,      title: "Trophée & reconnaissance",    text: "Les gagnants rejoignent le hall of fame de l'Académie des Créatifs." },
    ],
    photos: [
      "/Album/coupecreatif.jpg",
      "/Album/album-2.jpg",
      "/Album/album-4.jpg",
      "/Album/album-9.jpg",
    ],
    ctaLabel: "Participer à la prochaine édition",
    ctaPath: "/formations",
  },
];

function mergeApiData(base: Programme[], api: ProgrammeConfig[]): Programme[] {
  if (!api?.length) return base;
  return base.map((p) => {
    const a = api.find((x) => x.id === p.id);
    if (!a) return p;
    return {
      ...p,
      tagline: a.tagline || p.tagline,
      description: a.description || p.description,
      heroImage: a.heroImage || p.heroImage,
      logoColored: a.logoColored || p.logoColored,
      logoWhite: a.logoWhite || p.logoWhite,
      primary: a.primary || p.primary,
      primaryDark: a.primaryDark || p.primaryDark,
      accent: a.accent || p.accent,
      accentText: a.accentText || p.accentText,
      highlights: a.highlights?.length
        ? p.highlights.map((h, i) => ({
            ...h,
            title: a.highlights[i]?.title || h.title,
            text: a.highlights[i]?.text || h.text,
          }))
        : p.highlights,
      photos: a.photos?.length ? a.photos : p.photos,
      ctaLabel: a.ctaLabel || p.ctaLabel,
      ctaPath: a.ctaPath || p.ctaPath,
    };
  });
}

export default function ProgrammesPage() {
  const [active, setActive] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [programmes, setProgs] = useState<Programme[]>(PROGRAMMES);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const prog = programmes[active];

  useEffect(() => {
    fetchPublicSiteContent()
      .then((data) => {
        if (data.programmes?.length) setProgs(mergeApiData(PROGRAMMES, data.programmes));
      })
      .catch(() => {});
  }, []);

  // Cache le footer principal sur cette page uniquement
  useEffect(() => {
    const footer = document.getElementById("footer-droit") as HTMLElement | null;
    if (footer) footer.style.display = "none";
    return () => { if (footer) footer.style.display = ""; };
  }, []);

  function selectProg(idx: number) {
    if (idx === active) return;
    setActive(idx);
    setAnimKey((k) => k + 1);
  }

  return (
    <div className="prog-page">

      {/* ─── TABS ─── */}
      <div className="prog-tabs-wrapper">
        <div className="prog-tabs">
          {programmes.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`prog-tab${i === active ? " prog-tab--active" : ""}`}
              onClick={() => selectProg(i)}
            >
              <span className="prog-tab__badge">{i + 1}</span>
              <span className="prog-tab__name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── HERO — image en fond ─── */}
      <section
        key={`hero-${animKey}`}
        className="prog-hero"
        style={{ backgroundImage: `url(${prog.heroImage})` }}
      >
        {/* overlay coloré par-dessus la photo */}
        <div
          className="prog-hero__overlay"
          style={{
            background: prog.id === "tuto-en-ligne"
              ? "linear-gradient(140deg, rgba(0,0,0,0.82) 0%, rgba(30,30,30,0.65) 55%, rgba(60,60,60,0.35) 100%)"
              : prog.id === "coupe-des-creatifs"
              ? "linear-gradient(140deg, rgba(10,25,70,0.95) 0%, rgba(15,40,100,0.80) 50%, rgba(20,55,130,0.55) 100%)"
              : `linear-gradient(140deg, ${prog.primaryDark}f2 0%, ${prog.primary}dd 50%, ${prog.primary}99 100%)`,
          }}
        />

        <div className="prog-hero__inner">
          <img src={prog.logoColored} alt={prog.name} className="prog-hero__logo" />
          <h1 className="prog-hero__tagline">{prog.tagline}</h1>
          <p className="prog-hero__desc">{prog.description}</p>
          <Link
            to={prog.ctaPath}
            className="prog-hero__cta"
            style={{
              background: prog.id === "tuto-en-ligne" ? "#c0392b" : prog.accent,
              color: prog.id === "tuto-en-ligne" ? "#fff" : prog.accentText,
              marginBottom: "1.5rem",
            }}
          >
            {prog.ctaLabel}
            <span className="prog-hero__cta-arrow">→</span>
          </Link>
        </div>

        <div className="prog-hero__wave">
          <svg viewBox="0 0 1440 56" preserveAspectRatio="none" fill="#fff">
            <path d="M0,28 C360,56 1080,0 1440,28 L1440,56 L0,56 Z" />
          </svg>
        </div>
      </section>

      {/* ─── HIGHLIGHTS ─── */}
      <section className="prog-highlights">
        <div className="prog-highlights__inner" key={`hl-${animKey}`}>
          {prog.highlights.map((h) => (
            <div key={h.title} className="prog-highlight" style={{ alignItems: "center", textAlign: "center" }}>
              <span
                className="prog-highlight__icon"
                style={{ background: prog.accent + "22", color: prog.primary, margin: "0 auto" }}
              >
                <h.icon size={20} strokeWidth={1.75} />
              </span>
              <strong className="prog-highlight__title">{h.title}</strong>
              <p className="prog-highlight__text">{h.text}</p>
              <span className="prog-highlight__line" style={{ background: prog.accent, margin: "0 auto" }} />
            </div>
          ))}
        </div>
      </section>

      {/* ─── GALERIE PHOTOS ─── */}
      <section className="prog-gallery" style={{ background: prog.primary + "0d" }}>
        <div className="prog-gallery__inner" key={`gal-${animKey}`}>
          {prog.photos.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className={`prog-gallery__item prog-gallery__item--${i}`}
              onClick={() => setLightbox(src)}
              style={{ cursor: "zoom-in" }}
            >
              <img src={src} alt="" />
              <div className="prog-gallery__overlay" style={{ background: prog.primary + "55" }} />
            </div>
          ))}
        </div>
      </section>

      {/* ─── LIGHTBOX ─── */}
      {lightbox && (
        <div className="prog-lightbox" onClick={() => setLightbox(null)}>
          <button type="button" className="prog-lightbox__close" onClick={() => setLightbox(null)}>✕</button>
          <img
            src={lightbox}
            alt=""
            className="prog-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ─── BANDE CTA ─── */}
      <section
        className="prog-cta-band"
        style={{
          background: prog.id === "tuto-en-ligne"
            ? "linear-gradient(100deg, #0a0a0a 0%, #1c1c1c 100%)"
            : `linear-gradient(100deg, ${prog.primaryDark} 0%, ${prog.primary} 100%)`,
        }}
      >
        <div className="prog-cta-band__inner">
          <h2 className="prog-cta-band__title">
            Prêt à rejoindre{" "}
            <span style={{ color: prog.id === "tuto-en-ligne" ? "#c0392b" : prog.accent }}>{prog.name}</span> ?
          </h2>
          <p className="prog-cta-band__sub">
            Explore le catalogue et inscris-toi dès maintenant.
          </p>
          <Link
            to={prog.ctaPath}
            className="prog-cta-band__btn"
            style={{
              background: prog.id === "tuto-en-ligne" ? "#c0392b" : prog.accent,
              color: prog.id === "tuto-en-ligne" ? "#fff" : prog.accentText,
            }}
          >
            {prog.ctaLabel}
          </Link>
        </div>
      </section>

      {/* ─── FOOTER DÉDIÉ ─── */}
      <footer className="prog-footer">
        <div className="prog-footer__inner">
          <div className="prog-footer__brand">
            <img src="/logo_academie_hd.png" alt="Académie des Créatifs" className="prog-footer__logo" />
            <p>Depuis 2023, au service des créatifs africains.</p>
            <p>Un réseau pour révéler les talents créatifs.</p>
          </div>

          <div className="prog-footer__nav">
            <h3>Nos programmes</h3>
            <ul>
              {programmes.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { selectProg(i); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="prog-footer__nav">
            <h3>Liens utiles</h3>
            <ul>
              <li><Link to="/formations">Catalogue formations</Link></li>
              <li><Link to="/notre-equipe">Notre équipe</Link></li>
              <li><Link to="/a-propos">À propos</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/aide">Aide & support</Link></li>
            </ul>
          </div>

          <div className="prog-footer__contact">
            <h3>Contact</h3>
            <p>Douala : 680 95 03 19</p>
            <p>Campus Douala — Ndokotti</p>
            <p>contact@academiecreatif.com</p>
            <a
              href="https://wa.me/message/DMISDTO4HCUDC1"
              target="_blank"
              rel="noopener noreferrer"
              className="prog-footer__whatsapp"
            >
              Écrire sur WhatsApp →
            </a>
          </div>
        </div>

        <div className="prog-footer__bottom">
          <p>© 2026 L'Académie des Créatifs. Tous droits réservés.</p>
          <p>By <span>Five Design Group SARL</span></p>
        </div>
      </footer>
    </div>
  );
}
