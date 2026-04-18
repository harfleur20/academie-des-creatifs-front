import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBookOpen,
  FaBriefcase,
  FaChalkboardTeacher,
  FaCheckCircle,
  FaGlobe,
  FaHeart,
  FaLightbulb,
  FaQuoteLeft,
  FaStar,
  FaUsers,
} from "react-icons/fa";
import { trainers } from "../data/ecommerceHomeData";
import VerifiedBadge from "../components/VerifiedBadge";
import { FaBookmark } from "react-icons/fa6";
import { FaArrowRight } from "react-icons/fa";
import { ArrowBigLeft } from "lucide-react";

const VALUES = [
  {
    icon: FaHeart,
    title: "La passion avant tout",
    body: "La créativité ne s'enseigne pas, elle se réveille. Notre rôle est d'allumer cette flamme chez chaque étudiant.",
  },
  {
    icon: FaLightbulb,
    title: "La pratique plutôt que la théorie",
    body: "Chaque formation est construite autour de projets concrets. On apprend en faisant, pas en mémorisant.",
  },
  {
    icon: FaGlobe,
    title: "L'Afrique créative, le monde comme scène",
    body: "Nous formons des créatifs africains capables de rivaliser et de briller sur la scène internationale.",
  },
  {
    icon: FaUsers,
    title: "La communauté au centre",
    body: "Chaque étudiant intègre une communauté de créatifs soudés qui avancent et progressent ensemble.",
  },
  {
    icon: FaStar,
    title: "L'excellence accessible",
    body: "Des formations de qualité professionnelle, pensées pour être accessibles à tous les créatifs francophones.",
  },
  {
    icon: FaCheckCircle,
    title: "Des résultats concrets",
    body: "Nos étudiants repartent avec un portfolio réel, des compétences vendables et la confiance pour se lancer.",
  },
];

const STATS = [
  { value: "+500", label: "Étudiants formés" },
  { value: "+20", label: "Formations disponibles" },
  { value: "+10", label: "Formateurs experts" },
  { value: "3", label: "Pays représentés" },
];

const FOUNDER_POINTS = [
  "Graphiste polyvalent & développeur fullstack MERN/Django/CLOUD",
  "Certifié Adobe & IBM FullStack Developper",
  "Auteur du livre « Le Mindset du graphiste Businessman »",
  "Fondateur de la coupe des créatifs",
  "Formateur et mentor auprès de centaines de créatifs",
  "Entrepreneur digital",
];

function getCounterParts(value: string) {
  const match = value.trim().match(/^([^\d]*)(\d+)(.*)$/);
  if (!match) return { prefix: "", suffix: "", target: 0 };
  return { prefix: match[1], suffix: match[3].trim(), target: parseInt(match[2], 10) || 0 };
}

function AnimatedCounter({ start, value }: { start: boolean; value: string }) {
  const [display, setDisplay] = useState(0);
  const { prefix, suffix, target } = getCounterParts(value);

  useEffect(() => {
    if (!start) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) {
      setDisplay(target);
      return;
    }
    let frameId = 0;
    let startTime: number | null = null;
    const duration = 1400;
    const tick = (ts: number) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setDisplay(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [start, target]);

  return <span>{prefix}{display.toLocaleString("fr-FR")}{suffix}</span>;
}

export default function TeamPage() {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="team-page">
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="team-hero">
        <div className="team-hero__overlay" />
        <div className="team-hero__content">
          <p className="team-hero__eyebrow">Notre histoire</p>
          <h1>
            L'Académie des Créatifs n'est pas née dans un bureau.{" "}
            <span>Elle est née d'une vision.</span>
          </h1>
          <p className="team-hero__lead">
            Derrière chaque formation, il y a une conviction profonde : les
            créatifs africains méritent des outils professionnels, un
            accompagnement sérieux et une communauté qui pousse vers le haut.
          </p>
        </div>
      </section>

      {/* ── FOUNDER ────────────────────────────────────────────── */}
      <section className="team-founder">
        <div className="team-founder__inner">
          <div className="team-founder__story">
            <p className="team-section-eyebrow">Le fondateur</p>
            <h2>Francis Kenne</h2>

            <div className="team-founder__block">
              <h3>Le graphiste qui est devenu businessman.</h3>
              <p>
                Tout commence avec un stylo, une tablette graphique et une
                question lancinante : pourquoi tant de créatifs africains
                talentueux peinent-ils à vivre de leur art ? Francis Kenne
                refuse d'accepter cette réalité.
              </p>
            </div>
            <div className="trait-coupe"></div>
            <div className="team-founder__block">
              <h3>Le Mindset, une philosophie.</h3>
              <p>
                En écrivant <em>« Le Mindset du graphiste Businessman »</em>,
                Francis ne livre pas seulement un guide — il partage un
                changement de paradigme. La créativité ne suffit pas ; il faut
                la stratégie, le positionnement et l'état d'esprit du
                professionnel qui sait se vendre.
              </p>
            </div>
            <div className="trait-coupe"></div>
            <div className="team-founder__block">
              <h3>L'Académie, une réponse concrète.</h3>
              <p>
                C'est de cette conviction qu'est née l'Académie des Créatifs :
                une plateforme de formations en ligne pensée pour les créatifs
                francophones qui veulent passer au niveau supérieur — de
                l'apprentissage à la génération de revenus réels.
              </p>
            </div>
            <div className="trait-coupe"></div>
            <div className="team-founder__block">
              <h3>Aujourd'hui, bâtisseur de talents.</h3>
              <p>
                Graphiste polyvalent & développeur fullstack et entrepreneur
                digital, Francis forme et accompagne aujourd'hui des centaines
                d'étudiants à travers des formations pratiques, des projets
                réels et une communauté vivante.
              </p>
            </div>
          </div>

          <aside className="team-founder__card">
            <div className="team-founder__photo-wrap">
              <img
                src="/Teams/photo-fk.jpg"
                alt="Francis Kenne"
                className="team-founder__photo"
              />
            </div>
            <div className="team-founder__card-body">
              <div className="certif">
                <strong className="team-founder__card-name">Francis Kenne</strong>
                <VerifiedBadge size={18} />
              </div>
              <span className="team-founder__card-role">
                Fondateur Académie des Créatifs
              </span>
              <ul className="team-founder__card-points">
                {FOUNDER_POINTS.map((pt) => (
                  <li key={pt}>
                    <FaCheckCircle className="team-founder__card-check" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <blockquote className="team-founder__quote">
                <FaQuoteLeft className="team-founder__quote-icon" />
                <p>
                  « Un créatif sans mindset business restera toujours sous-payé.
                  Mon but ? Changer ça, une formation à la fois. »
                </p>
              </blockquote>
              <a
                href="https://mindset.academiecreatif.com"
                target="_blank"
                rel="noopener noreferrer"
                className="team-founder__book-link"
              >
                <FaBookmark />
                Découvrir le livre
              </a>
            </div>
          </aside>
        </div>
      </section>

      {/* ── MISSION ────────────────────────────────────────────── */}
      <section className="team-mission">
        <div className="team-mission__inner">
          <h2>
            Ce que l'Académie des Créatifs <span>veut changer</span>
          </h2>
          <p>
            Trop de créatifs africains vivent dans la précarité malgré leur
            talent. L'Académie existe pour changer ça — en fournissant des
            formations pro-grade, un accompagnement personnalisé et une
            communauté qui propulse chaque membre vers l'excellence et
            l'indépendance financière.
          </p>
          <Link to="/formations" className="team-mission__cta">
            <FaArrowRight /> Voir nos formations
          </Link>
        </div>
      </section>

      {/* ── VALUES ─────────────────────────────────────────────── */}
      <section className="team-values">
        <div className="team-values__inner">
          <p className="team-section-eyebrow">Nos valeurs</p>
          <h2>
            Ce qui nous <span>guide au quotidien</span>
          </h2>
          <div className="team-values__grid">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div className="team-value-card" key={title}>
                <div className="team-value-card__icon">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ───────────────────────────────────────────────── */}
      <section className="team-members">
        <div className="team-members__inner">
          <p className="team-section-eyebrow">L'équipe</p>
          <h2>
            Les personnes derrière <span>l'Académie</span>
          </h2>
          <p className="team-members__lead">
            Des profils complémentaires. Une même conviction.
          </p>
          <div className="team-members__grid">
            {trainers.map((t) => (
              <div className="team-member-card" key={t.name}>
                <div className="team-member-card__avatar-wrap">
                  <img src={t.image} alt={t.name} />
                </div>
                <div className="team-member-card__body">
                  <strong className="team-member-card__name">
                    {t.name} <VerifiedBadge size={13} />
                  </strong>
                  <span className="team-member-card__label">{t.label}</span>
                  <p className="team-member-card__role">{t.role}</p>
                </div>
                <div className="team-member-card__stars" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <FaStar key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section className="team-stats" ref={statsRef as React.RefObject<HTMLDivElement>}>
        <div className="team-stats__inner">
          {STATS.map(({ value, label }) => (
            <div className="team-stat" key={label}>
              <strong><AnimatedCounter start={statsVisible} value={value} /></strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="team-cta">
        <div className="team-cta__inner">
          <p className="team-section-eyebrow team-section-eyebrow--light">
            Académie des Créatifs
          </p>
          <h2>
            Notre histoire te parle ?{" "}
            <span>La tienne peut lui ressembler.</span>
          </h2>
          <p>
            Quelle que soit ta situation de départ, l'Académie est là pour
            t'accompagner et te donner les outils pour réussir.
          </p>
          <div className="team-cta__actions">
            <Link
              to="/formations"
              className="team-cta__btn team-cta__btn--primary"
            >
              <FaChalkboardTeacher /> Voir les formations
            </Link>
            <a
              href="https://wa.me/237000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="team-cta__btn team-cta__btn--outline"
            >
              <FaArrowRight /> Nous contacter
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
