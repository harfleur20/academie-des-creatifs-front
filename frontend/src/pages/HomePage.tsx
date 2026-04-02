import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBolt,
  FaBoxOpen,
  FaChalkboardTeacher,
  FaClock,
  FaCrown,
  FaFire,
  FaGraduationCap,
  FaPlayCircle,
  FaQuoteLeft,
  FaRegStar,
  FaRocket,
  FaStar,
  FaTags,
} from "react-icons/fa";

import HeroBubblesCanvas from "../components/HeroBubblesCanvas";
import {
  getFormationPath,
  albumItems,
  badgeLevels,
  onlineCourses,
  stats,
  testimonials,
  trainers,
  videos,
  type CourseBadge,
} from "../data/ecommerceHomeData";

function getCounterTarget(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return Number.parseInt(digits, 10) || 0;
}

function getCounterPrefix(value: string) {
  return value.trim().startsWith("+") ? "+" : "";
}

function AnimatedCounter({
  start,
  value,
}: {
  start: boolean;
  value: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const target = getCounterTarget(value);
  const prefix = getCounterPrefix(value);

  useEffect(() => {
    if (!start) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches || target === 0) {
      setDisplayValue(target);
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    const duration = 1400;

    const tick = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(target * easedProgress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [start, target]);

  return (
    <span className="counter-value">
      {prefix}
      {displayValue.toLocaleString("fr-FR")}
    </span>
  );
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    if (rating >= starValue) {
      return <FaStar key={starValue} className="filled" />;
    }

    if (rating >= starValue - 0.5) {
      return <FaStar key={starValue} className="filled half" />;
    }

    return <FaRegStar key={starValue} />;
  });
}

function badgeContent(badge: CourseBadge) {
  if (badge === "premium") {
    return (
      <div className="special-badge badge-premium">
        <FaCrown />
        Premium
      </div>
    );
  }

  if (badge === "populaire") {
    return (
      <div className="special-badge badge-populaire">
        <FaFire />
        Populaire
      </div>
    );
  }

  return (
    <div className="special-badge badge-promo">
      <FaTags />
      Promo
    </div>
  );
}

export default function HomePage() {
  const statsRef = useRef<HTMLDivElement | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const node = statsRef.current;

    if (!node || statsVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        setStatsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.35,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [statsVisible]);

  return (
    <div className="ecommerce-home">
      <section id="hero">
        <HeroBubblesCanvas />

        <div className="hero-gauche">
          <img src="/SVG/text-bienvenue.svg" alt="Bienvenue à l'Académie des Créatifs" />
          <h2>
            <span>Meilleur Centre de Formation</span>
            <span>pour les graphistes et les</span>
            <span>Métiers du Digital</span>
          </h2>
          <p>
            Gagne en assurance et deviens un professionnel, très compétent et
            implacable.
          </p>
          <p className="mobil-text">
            L'école des designers graphiques et des métiers du digital.
          </p>
          <Link className="btn-hero" to="/formations">
            <FaGraduationCap />
            Se former maintenant
          </Link>
        </div>

        <div className="hero-droite">
          <img src="/girl-bg-2-min.webp" alt="Étudiante de l'Académie des Créatifs" />
        </div>
      </section>

      <section id="apropos">
        <div className="apropo-contenair">
          <div className="partie-haute">
            <div className="partie-gauche">
              <h3>Préparez-vous à développer</h3>
              <h2>votre potentiel créatif</h2>
              <p className="apropos-intro-text">
                L'Académie des Créatifs met l'accent sur une formation pratique et
                axée sur les compétences réelles du marché. Son approche
                pédagogique vise à transformer les passionnés en professionnels
                suivant un processus structuré et efficace.
              </p>
              <p>
                Notre approche de pépinière de talents offre un parcours
                interactif avec des projets concrets pour une évolution à votre
                rythme.
              </p>
              <p>
                Découvrez nos modules en graphisme, branding, UI/UX, packaging ou
                web design, conçus par des professionnels passionnés.
              </p>
              <p>
                Centralisez votre apprentissage et propulsez votre carrière via
                notre plateforme unique, pour révéler votre potentiel artistique.
              </p>
            </div>

            <div className="rext-mobile">
              <p>
                L'Académie des Créatifs met l'accent sur une formation pratique et
                axée sur les compétences réelles du marché.
              </p>
            </div>

            <div className="partie-droite">
              <img src="/simone-3x.png" alt="Étudiante sur la plateforme" />
            </div>
          </div>

          <div className="partie-basse" ref={statsRef}>
            {stats.map((stat) => (
              <div className="decompte-chiffre" key={stat.value}>
                <h1>
                  <AnimatedCounter start={statsVisible} value={stat.value} />
                </h1>
                <p>{stat.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="banniere-prog">
        <div className="banniere-contenair">
          <div className="banniere-cote-gauche">
            <img src="/SVG/text-bienvenue.svg" alt="Programmes Académie des Créatifs" />
            <p>
              Chaque année, plusieurs de nos programmes sont lancés pour vous aider
              à vous surpasser, apprendre avec les meilleurs et compétir avec les
              autres membres de la communauté créative.
            </p>
            <a className="btn-prog" href="/#form-en-ligne">
              <FaBolt />
              en savoir plus sur nos programmes
            </a>
          </div>

          <div className="banniere-cote-droite">
            <img src="/SVG/logo-prog-4.svg" alt="Programmes Académie des Créatifs" />
          </div>
        </div>
      </section>

      <section id="form-en-ligne">
        <div className="form-en-ligne-contenair">
          <div className="form-title-haut">
            <div className="bloc-de-gauche">
              <h3>FORMATIONS EN LIGNE</h3>
              <h2>Nos offres de formations accélérées en live</h2>
            </div>
            <div className="bloc-du-milieu" />
            <div className="bloc-avec-img">
              <img src="/logo_ico_hd.png" alt="Logo Académie des Créatifs" />
            </div>
          </div>

          <div className="bloc-list-card">
            {onlineCourses.map((course) => {
              const hasPromo =
                Boolean(course.originalPrice) &&
                course.originalPrice !== course.currentPrice;

              return (
                <article className="card-bloc new-design" key={course.id}>
                  <div className="card-image">
                    <img src={course.image} alt={course.title} />
                    <div className="session-badge">
                      <FaClock />
                      <span>{course.sessionLabel}</span>
                    </div>
                  </div>

                  <div className="card-content">
                    <h3 className="card-title">{course.title}</h3>
                    <div className="card-instructor">
                      <FaChalkboardTeacher />
                      <span>{course.level}</span>
                    </div>

                    <div className="card-rating">
                      <div className="stars">{renderStars(course.rating)}</div>
                      <span className="review-count">({course.reviews} avis)</span>
                    </div>

                    <div className="card-meta-row">
                      <div className="card-platforms">
                        <span className="platform-label">Plateforme :</span>
                        <img src="/Microsoft_Office_Teams.webp" alt="Microsoft Teams" />
                        <img src="/whatsapp.png" alt="WhatsApp" />
                      </div>

                      <div className="badges-column">
                        {course.badges?.map((badge) => (
                          <div key={badge}>{badgeContent(badge)}</div>
                        ))}
                      </div>
                    </div>

                    <div className="card-divider" />

                    <div className="card-footer">
                      <div className="price-block">
                        <span className="old-price">{course.originalPrice ?? ""}</span>
                        <span
                          className={
                            hasPromo ? "current-price price-promo" : "current-price"
                          }
                        >
                          {course.currentPrice}
                        </span>
                      </div>
                      <Link
                        className="btn-card-action"
                        to={getFormationPath(course.slug)}
                      >
                        Voir
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="form-en-presentiel">
        <div className="form-presen-contenair">
          <div className="presentiel-title-haut">
            <div className="presen-bloc-gauche">
              <h3>FORMATIONS EN PRESENTIEL</h3>
              <h2>Nos offres de formations certifiantes en présentiel</h2>
            </div>
            <div className="presen-bloc-milieu" />
            <div className="presen-bloc-img">
              <img src="/logo_ico_hd.png" alt="Logo Académie des Créatifs" />
            </div>
          </div>

          <div className="pre-list-card">
            <div className="aucune-formation">
              <FaBoxOpen />
              <p>Aucune formation en présentiel n'est encore disponible.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="note-info">
        <div className="note-info-contenair">
          <div className="note-info-gauche">
            <h3>L'Académie des Créatifs</h3>
            <h2>
              Nous formons et contribuons au perfectionnement de la prochaine
              génération de professionnels du numérique
            </h2>
            <p>
              Notre mission est de former les futurs professionnels du numérique
              en leur offrant des formations de qualité, adaptées aux besoins du
              marché.
            </p>
            <p>
              Rejoignez-nous pour découvrir comment nous pouvons vous aider à
              atteindre vos objectifs professionnels et à exceller dans votre
              carrière.
            </p>
            <Link className="solid-icon" to="/register">
              <FaGraduationCap />
              S'inscrire maintenant
            </Link>
          </div>

          <div className="note-info-droite">
            <img src="/bg-ac-1.jpg" alt="Locaux de l'Académie des Créatifs" />
          </div>
        </div>
      </section>

      <section id="album">
        <div className="album-container">
          <div className="part-haut-al">
            <h2>L'Académie des Créatifs en image</h2>
            <p>
              À l'Académie des Créatifs, les apprenants sont au centre du
              programme éducatif. Les formations dispensées sont à 90% pratiques
              pour une meilleure compréhension.
            </p>
          </div>

          <div className="part-bas-al">
            {albumItems.map((item) => (
              <div className="img-al" key={item.title}>
                <img src={item.image} alt={item.title} />
                <div className="img-al-overlay">
                  <h3>{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="instant-video">
        <div className="video-container">
          <div className="partie-haut-video">
            <div className="section-icon">
              <FaPlayCircle />
            </div>
            <h2>Quelques moments vidéo lors de formations en présentiel</h2>
            <p>
              Les formations dispensées sont à 90% pratiques pour une meilleure
              compréhension.
            </p>
          </div>

          <div className="partie-bas-video">
            {videos.map((videoUrl, index) => (
              <div className="video-item youtube-short" key={videoUrl}>
                <iframe
                  src={videoUrl}
                  title={`Vidéo ${index + 1} - Académie des Créatifs`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="temoignage">
        <div className="temoignage-container">
          <div className="temge-title">
            <h2>Ce qu'ils disent de nous</h2>
            <p>
              Découvrez les témoignages de nos apprenants qui ont suivi nos
              formations et comment cela a impacté leur carrière.
            </p>
          </div>

          <div className="t-list-container">
            <div className="tmg-list-card">
              {testimonials.map((testimonial) => (
                <article className="temoignage-carte" key={testimonial.name}>
                  <div className="quotation-marks">
                    <FaQuoteLeft />
                  </div>
                  <p>{testimonial.quote}</p>
                  <div className="details-auteur-container">
                    <div className="details-auteur-gauche">
                      <img src={testimonial.image} alt={testimonial.name} />
                    </div>
                    <div className="details-auteur-texte-droit">
                      <h4>{testimonial.name}</h4>
                      <p>{testimonial.role}</p>
                      <p>{testimonial.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="bg-progres">
        <div className="bg-progres-container">
          <div className="bg-progres-haut">
            <div className="section-icon">
              <FaRocket />
            </div>
            <h2>Nos badges de progression</h2>
            <p>
              À l'Académie des Créatifs, chaque étape de votre formation compte.
              Nos étudiants avancent pas à pas, débloquent des badges en fonction
              de leur progression, de leur implication et des compétences
              acquises.
            </p>
          </div>
          <div className="bg-prog-bas">
            <div className="prog-bas-container">
              {badgeLevels.map((badge) => (
                <div className="prog-card" key={badge.name}>
                  <div className={badge.className}>
                    <img src={badge.image} alt={`Badge ${badge.name}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="banner">
        <div className="banner-container">
          <div className="banner-right">
            <h2>
              Ton pouvoir, c'est ton talent.
              <br />
              Débloque-le !
            </h2>
            <Link to="/formations">
              <FaBolt />
              forme-toi dès maintenant
            </Link>
          </div>
        </div>
      </section>

      <section id="formateur">
        <div className="formateur-container">
          <div className="formateur-container-haut">
            <div className="section-icon">
              <FaFire />
            </div>
            <h2>Quelques formateurs & responsables académiques</h2>
            <p>
              Nos formateurs expérimentés accompagnent chaque apprenant avec
              passion. Experts dans leur domaine, ils partagent leur savoir-faire
              à travers une pédagogie pratique et adaptée au monde réel.
            </p>
          </div>
          <div className="formateur-contenair-bas">
            <div className="form-container">
              {trainers.map((trainer) => (
                <article className="formateur-carte" key={trainer.name}>
                  <div className="photo-img">
                    <img src={trainer.image} alt={trainer.name} />
                  </div>
                  <h3>{trainer.name}</h3>
                  <p>{trainer.role}</p>
                  <span className="high">{trainer.label}</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
