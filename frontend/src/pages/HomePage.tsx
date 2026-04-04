import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  FaRegHeart,
  FaRegStar,
  FaRocket,
  FaShoppingCart,
  FaStar,
  FaTags,
} from "react-icons/fa";

import HeroBubblesCanvas from "../components/HeroBubblesCanvas";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import {
  getFormationPath,
  albumItems,
  badgeLevels,
  stats,
  testimonials,
  trainers,
  videos,
  type CourseBadge,
} from "../data/ecommerceHomeData";
import { useFavorites } from "../favorites/FavoritesContext";
import {
  type CatalogFormation,
  fetchPublicFormations,
  mapCatalogFormationToCourse,
} from "../lib/catalogApi";
import {
  getUserActionErrorMessage,
  USER_MESSAGES,
} from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";

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
      <span className="catalogue-product-card__badge catalogue-product-card__badge--premium home-course-badge">
        <FaCrown />
        Premium
      </span>
    );
  }

  if (badge === "populaire") {
    return (
      <span className="catalogue-product-card__badge catalogue-product-card__badge--populaire home-course-badge">
        <FaFire />
        Populaire
      </span>
    );
  }

  return (
    <span className="catalogue-product-card__badge catalogue-product-card__badge--promo home-course-badge">
      <FaTags />
      Promo
    </span>
  );
}

function sortFeaturedCourses<T extends { homeFeatureRank?: number }>(courses: T[]) {
  return [...courses].sort(
    (left, right) =>
      (left.homeFeatureRank ?? 100) - (right.homeFeatureRank ?? 100),
  );
}

function getHomeCatalogueMessage(
  catalogError: string,
  format: "online" | "presentiel",
) {
  if (catalogError) {
    return catalogError;
  }

  if (format === "presentiel") {
    return "Aucune formation en presentiel n'est encore mise en avant.";
  }

  return "Aucune formation n'est encore mise en avant dans cette section.";
}

export default function HomePage() {
  const statsRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const { toggleFavorite, hasFavorite } = useFavorites();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [statsVisible, setStatsVisible] = useState(false);
  const [catalogFormations, setCatalogFormations] = useState<CatalogFormation[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [workingCartSlug, setWorkingCartSlug] = useState<string | null>(null);
  const [workingFavoriteSlug, setWorkingFavoriteSlug] = useState<string | null>(null);

  const featuredCourses = (
    sortFeaturedCourses(
      catalogFormations
        .filter((formation) => formation.is_featured_home)
        .map((formation) => mapCatalogFormationToCourse(formation)),
    )
  );

  const featuredOnlineCourses = featuredCourses.filter(
    (course) => course.formatType !== "presentiel",
  );
  const featuredPresentielCourses = featuredCourses.filter(
    (course) => course.formatType === "presentiel",
  );

  const handleProtectedAction = (slug: string, action: "cart" | "favorite") => {
    if (!user) {
      error(USER_MESSAGES.authRequired);
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}${location.hash}` },
      });
      return false;
    }

    if (action === "cart") {
      setWorkingCartSlug(slug);
    } else {
      setWorkingFavoriteSlug(slug);
    }

    return true;
  };

  const handleAddToCart = async (slug: string, canPurchase = true, purchaseMessage?: string | null) => {
    if (!canPurchase) {
      error(purchaseMessage ?? "Inscriptions closes pour cette formation.");
      return;
    }

    if (!handleProtectedAction(slug, "cart")) {
      return;
    }

    try {
      await addToCart(slug);
      success(USER_MESSAGES.cartAdded);
    } catch (actionError) {
      error(getUserActionErrorMessage(actionError, "cart.add"));
    } finally {
      setWorkingCartSlug(null);
    }
  };

  const handleToggleFavorite = async (slug: string) => {
    if (!handleProtectedAction(slug, "favorite")) {
      return;
    }

    try {
      const wasFavorite = hasFavorite(slug);
      await toggleFavorite(slug);
      success(
        wasFavorite
          ? USER_MESSAGES.favoriteRemoved
          : USER_MESSAGES.favoriteAdded,
      );
    } catch (actionError) {
      error(getUserActionErrorMessage(actionError, "favorites.toggle"));
    } finally {
      setWorkingFavoriteSlug(null);
    }
  };

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

  useEffect(() => {
    let isMounted = true;

    fetchPublicFormations()
      .then((formations) => {
        if (!isMounted) {
          return;
        }

        setCatalogFormations(formations);
        setCatalogError("");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setCatalogFormations([]);
        setCatalogError("Catalogue indisponible pour le moment.");
      })
      .finally(() => {
        if (isMounted) {
          setCatalogLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
            <FaGraduationCap className="FaGraduation"/>
            Consulter les formations
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
            {featuredOnlineCourses.length > 0 ? (
              featuredOnlineCourses.map((course) => {
                const hasPromo =
                  Boolean(course.originalPrice) &&
                  course.originalPrice !== course.currentPrice;

                return (
                  <article className="card-bloc new-design" key={course.id}>
                    <div className="card-image">
                      <img src={course.image} alt={course.title} />
                      <button
                        aria-label={`Ajouter ${course.title} aux favoris`}
                        className={`home-card-wish ${hasFavorite(course.slug) ? "is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          void handleToggleFavorite(course.slug);
                        }}
                      >
                        <FaRegHeart />
                      </button>
                      {course.sessionLabel ? (
                        <div className="session-badge">
                          <FaClock />
                          <span>{course.sessionLabel}</span>
                        </div>
                      ) : null}
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
                        <div className="card-footer-actions">
                          <button
                            aria-label={`Ajouter ${course.title} au panier`}
                            className="btn-card-icon"
                            type="button"
                            disabled={
                              course.canPurchase === false ||
                              workingCartSlug === course.slug ||
                              cart.items.some((item) => item.formation_slug === course.slug)
                            }
                            onClick={() => {
                              void handleAddToCart(course.slug, course.canPurchase, course.purchaseMessage);
                            }}
                          >
                            <FaShoppingCart />
                          </button>
                          <Link className="btn-card-action" to={getFormationPath(course.slug)}>
                            Voir
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="aucune-formation">
                <FaBoxOpen />
                <p>
                  {catalogLoading
                    ? "Chargement des formations..."
                    : getHomeCatalogueMessage(catalogError, "online")}
                </p>
              </div>
            )}
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
            {featuredPresentielCourses.length > 0 ? (
              featuredPresentielCourses.map((course) => {
                const hasPromo =
                  Boolean(course.originalPrice) &&
                  course.originalPrice !== course.currentPrice;

                return (
                  <article className="card-bloc new-design" key={course.id}>
                    <div className="card-image">
                      <img src={course.image} alt={course.title} />
                      <button
                        aria-label={`Ajouter ${course.title} aux favoris`}
                        className={`home-card-wish ${hasFavorite(course.slug) ? "is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          void handleToggleFavorite(course.slug);
                        }}
                      >
                        <FaRegHeart />
                      </button>
                      {course.sessionLabel ? (
                        <div className="session-badge">
                          <FaClock />
                          <span>{course.sessionLabel}</span>
                        </div>
                      ) : null}
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
                        <div className="card-footer-actions">
                          <button
                            aria-label={`Ajouter ${course.title} au panier`}
                            className="btn-card-icon"
                            type="button"
                            disabled={
                              course.canPurchase === false ||
                              workingCartSlug === course.slug ||
                              cart.items.some((item) => item.formation_slug === course.slug)
                            }
                            onClick={() => {
                              void handleAddToCart(course.slug, course.canPurchase, course.purchaseMessage);
                            }}
                          >
                            <FaShoppingCart />
                          </button>
                          <Link className="btn-card-action" to={getFormationPath(course.slug)}>
                            Voir
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="aucune-formation">
                <FaBoxOpen />
                <p>
                  {catalogLoading
                    ? "Chargement des formations..."
                    : getHomeCatalogueMessage(catalogError, "presentiel")}
                </p>
              </div>
            )}
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

      {/* revert temporary album editorial variant
        <div className="album-container">
          <div className="album-editorial-head">
            <div className="album-editorial-copy">
              <span className="album-editorial-eyebrow">Galerie immersive</span>
              <h2>L'AcadÃ©mie des CrÃ©atifs en image</h2>
              <p>
                Ateliers, travaux pratiques, coaching et soutenances: une lecture
                plus Ã©ditoriale de la vie Ã  l'AcadÃ©mie, pensÃ©e comme un carnet
                visuel plutÃ´t qu'une simple galerie de photos.
              </p>
            </div>

            <div className="album-editorial-note">
              <span>90% pratique</span>
              <p>
                Une formation oÃ¹ les projets, les restitutions et les temps
                d'atelier occupent le coeur de l'expÃ©rience.
              </p>
            </div>
          </div>

          <div className="album-editorial-layout">
            {albumFeature ? (
              <article className="album-editorial-feature">
                <img src={albumFeature.image} alt={albumFeature.title} />
                <div className="album-editorial-feature__overlay" />
                <div className="album-editorial-feature__content">
                  <span className="album-editorial-chip">Temps fort</span>
                  <h3>{albumFeature.title}</h3>
                  <p>
                    Un aperÃ§u des moments qui donnent du relief Ã 
                    l'apprentissage: accompagnement, immersion et restitution.
                  </p>
                </div>
              </article>
            ) : null}

            <div className="album-editorial-grid">
              {albumGridItems.map((item) => (
                <article className="album-editorial-card" key={item.title}>
                  <img src={item.image} alt={item.title} />
                  <div className="album-editorial-card__overlay" />
                  <div className="album-editorial-card__content">
                    <h3>{item.title}</h3>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="album-editorial-strip">
            {albumStripItems.map((item) => (
              <article className="album-editorial-strip__item" key={item.title}>
                <img src={item.image} alt={item.title} />
                <div className="album-editorial-strip__overlay" />
                <div className="album-editorial-strip__content">
                  <h3>{item.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section> */}

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
