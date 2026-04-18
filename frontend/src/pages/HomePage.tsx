import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FaClipboardCheck,
  FaBolt,
  FaBoxOpen,
  FaChalkboardTeacher,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaCrown,
  FaFileAlt,
  FaFire,
  FaGraduationCap,
  FaImage,
  FaPlayCircle,
  FaQuoteLeft,
  FaRegHeart,
  FaRegStar,
  FaRocket,
  FaShoppingCart,
  FaStar,
  FaTags,
  FaUserPlus,
  FaUsers,
  FaWhatsapp,
} from "react-icons/fa";
import { MdOutlineGroup } from "react-icons/md";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { FaArrowRight } from "react-icons/fa";
import { HiTrophy } from "react-icons/hi2";


import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import {
  getFormationPath,
  albumItems,
  badgeLevels,
  testimonials,
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
import { fetchFeaturedPosts, type BlogPost } from "../lib/blogApi";

function catClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("freelance")) return "blog-cat-badge--freelance";
  if (c.includes("design")) return "blog-cat-badge--design";
  if (c.includes("découv") || c.includes("decouv")) return "blog-cat-badge--decouverte";
  if (c.includes("marketing")) return "blog-cat-badge--marketing";
  if (c.includes("vidéo") || c.includes("video") || c.includes("motion")) return "blog-cat-badge--video";
  if (c.includes("no-code") || c.includes("nocode")) return "blog-cat-badge--nocode";
  if (c.includes("ia") || c.includes("intelligence") || c.includes("artificielle")) return "blog-cat-badge--ia";
  return "blog-cat-badge--default";
}

function getCounterParts(value: string) {
  const match = value.trim().match(/^([^\d]*)(\d+)(.*)$/);

  if (!match) {
    return {
      prefix: "",
      suffix: "",
      target: 0,
    };
  }

  return {
    prefix: match[1],
    suffix: match[3].trim(),
    target: Number.parseInt(match[2], 10) || 0,
  };
}

function AnimatedCounter({
  start,
  value,
}: {
  start: boolean;
  value: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const { prefix, suffix, target } = getCounterParts(value);

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
      {suffix}
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

type HeroAction = {
  label: string;
  to: string;
  variant: "primary" | "secondary";
  external?: boolean;
  icon?: IconType;
};

type HeroSlide = {
  eyebrow: string;
  navLabel: string;
  title: ReactNode;
  description: string;
  image: string;
  imagePosition?: string;
  actions: HeroAction[];
};

const heroSlides: HeroSlide[] = [
  {
    eyebrow: "Académie des Créatifs",
    navLabel: "Formations",
    title: (
      <>
        Apprends le design par <span>la pratique guidée.</span>
      </>
    ),
    description:
      "Des projets concrets, des retours précis et un accompagnement pensé pour faire monter ton niveau rapidement.",
    image: "/bg-ac-1.jpg",
    imagePosition: "center center",
    actions: [
      {
        label: "Demarrer mon diagnostic",
        to: "/diagnostic",
        variant: "primary",
        icon: FaRegArrowAltCircleRight,
      },
      {
        label: "Écrire sur WhatsApp",
        to: "https://wa.me/message/DMISDTO4HCUDC1",
        variant: "secondary",
        external: true,
        icon: FaWhatsapp,
      },
    ],
  },
  {
    eyebrow: "Parcours en ligne et en présentiel",
    navLabel: "Formats",
    title: (
      <>
        Choisis un parcours <span>adapté à ton rythme.</span>
      </>
    ),
    description:
      "Sessions live, accompagnement terrain et programmes intensifs pour progresser avec un cadre clair.",
    image: "/Album/album-7.jpg",
    imagePosition: "center center",
    actions: [
      {
        label: "Formations en ligne",
        to: "/#form-en-ligne",
        variant: "primary",
        icon: FaGraduationCap,
      },
      {
        label: "Présentiel certifiant",
        to: "/#form-en-presentiel",
        variant: "secondary",
        icon: FaArrowRight,
      },
    ],
  },
  {
    eyebrow: "Portfolio et employabilité",
    navLabel: "Portfolio",
    title: (
      <>
        Construis un portfolio <span>qui vend tes compétences.</span>
      </>
    ),
    description:
      "Branding, packaging, motion, UI et web design: tu avances avec des livrables solides à montrer à tes clients.",
    image: "/Album/album-9.jpg",
    imagePosition: "center 28%",
    actions: [
      {
        label: "Créer mon compte",
        to: "/register",
        variant: "primary",
        icon: FaUserPlus,
      },
      {
        label: "Voir les témoignages",
        to: "/#temoignage",
        variant: "secondary",
        icon: FaQuoteLeft,
      },
    ],
  },
  {
    eyebrow: "Mentorat terrain",
    navLabel: "Mentorat",
    title: (
      <>
        Progresse avec des mentors <span>qui pratiquent vraiment.</span>
      </>
    ),
    description:
      "Tu progresses avec des intervenants du terrain, des retours utiles et une communauté créative vraiment active.",
    image: "/Album/album-1.jpg",
    imagePosition: "center 32%",
    actions: [
      {
        label: "Découvrir l'équipe",
        to: "/#formateur",
        variant: "primary",
        icon: MdOutlineGroup,
      },
      {
        label: "Moments en image",
        to: "/#album",
        variant: "secondary",
        icon: FaImage,
      },
    ],
  },
];

const heroCounters = [
  {
    value: "+2000",
    copy: "apprenants accompagnés sur des parcours créatifs et digitaux.",
    icon: FaGraduationCap,
  },
  {
    value: "+20",
    copy: "bootcamps, ateliers et masterclasses menés avec la communauté.",
    icon: FaBolt,
  },
  {
    value: "24h",
    copy: "pour donner une première orientation claire et exploitable.",
    icon: FaClock,
  },
  {
    value: "5",
    copy: "étapes pour cadrer un parcours de progression utile et concret.",
    icon: HiTrophy,
  },
];

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
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogError, setBlogError] = useState("");
  const [workingCartSlug, setWorkingCartSlug] = useState<string | null>(null);
  const [workingFavoriteSlug, setWorkingFavoriteSlug] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [albumItemsPerPage, setAlbumItemsPerPage] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches ? 1 : 3,
  );
  const [activeAlbumPage, setActiveAlbumPage] = useState(0);

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
  const activeSlide = heroSlides[activeSlideIndex];
  const albumPageCount = Math.ceil(albumItems.length / albumItemsPerPage);
  const visibleAlbumItems = albumItems.slice(
    activeAlbumPage * albumItemsPerPage,
    activeAlbumPage * albumItemsPerPage + albumItemsPerPage,
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

  useEffect(() => {
    fetchFeaturedPosts()
      .then(setBlogPosts)
      .catch(() => setBlogError("Erreur lors du chargement des articles."));
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const slideInterval = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => {
      window.clearInterval(slideInterval);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 600px)");

    const syncAlbumLayout = () => {
      setAlbumItemsPerPage(mediaQuery.matches ? 1 : 3);
    };

    syncAlbumLayout();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncAlbumLayout);
      return () => mediaQuery.removeEventListener("change", syncAlbumLayout);
    }

    mediaQuery.addListener(syncAlbumLayout);
    return () => mediaQuery.removeListener(syncAlbumLayout);
  }, []);

  useEffect(() => {
    setActiveAlbumPage((current) =>
      Math.min(current, Math.max(0, Math.ceil(albumItems.length / albumItemsPerPage) - 1)),
    );
  }, [albumItemsPerPage]);

  const goToPreviousSlide = () => {
    setActiveSlideIndex((current) =>
      current === 0 ? heroSlides.length - 1 : current - 1,
    );
  };

  const goToNextSlide = () => {
    setActiveSlideIndex((current) => (current + 1) % heroSlides.length);
  };

  const goToPreviousAlbum = () => {
    setActiveAlbumPage((current) =>
      current === 0 ? albumPageCount - 1 : current - 1,
    );
  };

  const goToNextAlbum = () => {
    setActiveAlbumPage((current) => (current + 1) % albumPageCount);
  };

  return (
    <div className="ecommerce-home">
      <section id="hero" aria-label="Présentation de l'Académie des Créatifs">
        <div className="hero-slider__backdrop" aria-hidden="true">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.navLabel}
              className={`hero-slider__image ${index === activeSlideIndex ? "is-active" : ""}`}
              style={{
                backgroundImage: `url(${slide.image})`,
                backgroundPosition: slide.imagePosition ?? "center center",
              }}
            />
          ))}
        </div>
        <div className="hero-slider__shade" aria-hidden="true" />

        <div className="hero-slider__shell">
          <div className="hero-slider__main">
            <div className="hero-slider__rail" aria-label="Navigation du slider">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.navLabel}
                  aria-label={`Afficher le slide ${index + 1}: ${slide.navLabel}`}
                  aria-pressed={index === activeSlideIndex}
                  className={index === activeSlideIndex ? "is-active" : ""}
                  type="button"
                  onClick={() => setActiveSlideIndex(index)}
                >
                  <span className="hero-slider__rail-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="hero-slider__rail-label">{slide.navLabel}</span>
                </button>
              ))}
            </div>

            <div className="hero-slider__copy" aria-live="polite" key={activeSlide.navLabel}>
              <p className="hero-slider__eyebrow"><img src="assets/logo_ico_hd.png" alt="" className="ico-logo" /> {activeSlide.eyebrow}</p>
              <h1>{activeSlide.title}</h1>
              <p className="hero-slider__description">{activeSlide.description}</p>

              <div className="hero-slider__actions">
                {activeSlide.actions.map((action) => {
                  const ActionIcon = action.icon;

                  if (action.external) {
                    return (
                      <a
                        key={action.label}
                        className={`hero-slider__action hero-slider__action--${action.variant}`}
                        href={action.to}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {ActionIcon ? <ActionIcon /> : null}
                        <span>{action.label}</span>
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={action.label}
                      className={`hero-slider__action hero-slider__action--${action.variant}`}
                      to={action.to}
                    >
                      {ActionIcon ? <ActionIcon /> : null}
                      <span>{action.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="hero-slider__controls">
            <button
              aria-label="Slide précédent"
              type="button"
              onClick={goToPreviousSlide}
            >
              <FaChevronLeft />
            </button>
            <button aria-label="Slide suivant" type="button" onClick={goToNextSlide}>
              <FaChevronRight />
            </button>
          </div>
        </div>
      </section>

      <section id="hero-counters" aria-label="Quelques chiffres clés">
        <div className="hero-counters__container" ref={statsRef}>
          {heroCounters.map((stat) => {
            const Icon = stat.icon;

            return (
              <article className="hero-counter" key={stat.value}>
                <div className="hero-counter__icon" aria-hidden="true">
                  <Icon />
                </div>
                <h2>
                  <AnimatedCounter start={statsVisible} value={stat.value} />
                </h2>
                <p>{stat.copy}</p>
              </article>
            );
          })}
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
                          {course.canPurchase === false ? null : (
                            <button
                              aria-label={`Ajouter ${course.title} au panier`}
                              className="btn-card-icon"
                              type="button"
                              disabled={
                                workingCartSlug === course.slug ||
                                cart.items.some((item) => item.formation_slug === course.slug)
                              }
                              onClick={() => {
                                void handleAddToCart(course.slug, course.canPurchase, course.purchaseMessage);
                              }}
                            >
                              <FaShoppingCart />
                            </button>
                          )}
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
                          {course.canPurchase === false ? null : (
                            <button
                              aria-label={`Ajouter ${course.title} au panier`}
                              className="btn-card-icon"
                              type="button"
                              disabled={
                                workingCartSlug === course.slug ||
                                cart.items.some((item) => item.formation_slug === course.slug)
                              }
                              onClick={() => {
                                void handleAddToCart(course.slug, course.canPurchase, course.purchaseMessage);
                              }}
                            >
                              <FaShoppingCart />
                            </button>
                          )}
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
        <div className="home-formations-cta">
          <Link to="/formations" className="home-formations-cta__btn">
            Voir toutes nos formations
            <FaArrowRight />
          </Link>
        </div>
      </section>

      <section id="note-info">
        <div className="note-info-contenair">
          <p className="note-info__eyebrow">
            <FaGraduationCap />
            <span>Académie des Créatifs</span>
          </p>
          <h2>
            Nous formons la prochaine génération <span>de créatifs du numérique.</span>
          </h2>
          <p className="note-info__lead">
            Design graphique, marketing digital, réseaux sociaux et projets concrets:
            tu progresses avec un cadre clair, des retours utiles et un accompagnement
            pensé pour le terrain.
          </p>
          <a className="note-info__cta" href="/diagnostic">
            <span>Démarrer mon diagnostic</span>
            <FaArrowRight />
          </a>
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

          <div className="album-carousel" aria-label="Galerie photo de l'Académie des Créatifs">
            <div className="album-carousel__shell">
              <button
                aria-label="Photo précédente"
                className="album-carousel__nav album-carousel__nav--prev"
                type="button"
                onClick={goToPreviousAlbum}
              >
                <FaChevronLeft />
              </button>

              <div
                className={`album-carousel__viewport album-carousel__viewport--${albumItemsPerPage}`}
                key={`${albumItemsPerPage}-${activeAlbumPage}`}
              >
                {visibleAlbumItems.map((item) => (
                  <article className="album-carousel__card" key={item.title}>
                    <img src={item.image} alt={item.title} />
                    <div className="album-carousel__overlay" />
                    <div className="album-carousel__caption">
                      <h3>{item.title}</h3>
                    </div>
                  </article>
                ))}
              </div>

              <button
                aria-label="Photo suivante"
                className="album-carousel__nav album-carousel__nav--next"
                type="button"
                onClick={goToNextAlbum}
              >
                <FaChevronRight />
              </button>
            </div>

            <div className="album-carousel__dots" aria-label="Pages de la galerie">
              {Array.from({ length: albumPageCount }, (_, index) => (
                <button
                  key={index}
                  aria-label={`Afficher la page ${index + 1} de la galerie`}
                  aria-pressed={index === activeAlbumPage}
                  className={index === activeAlbumPage ? "is-active" : ""}
                  type="button"
                  onClick={() => setActiveAlbumPage(index)}
                />
              ))}
            </div>
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

      {/* ── BLOG SECTION ─────────────────────────────────── */}
      <section className="home-blog">
        <div className="home-blog__inner">
          <div className="home-blog__header">
            <p className="home-blog__eyebrow">Le Blog</p>
            <h2>Nos Articles Populaires</h2>
            <p>Découvrez les sujets qui passionnent notre communauté de créatifs.</p>
          </div>

          {blogError ? (
            <p className="home-blog__error">{blogError}</p>
          ) : blogPosts.length === 0 ? (
            <div className="home-blog__grid home-blog__grid--skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="home-blog-card home-blog-card--skeleton" />
              ))}
            </div>
          ) : (
            <div className="home-blog__grid">
              {blogPosts.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.slug} className="home-blog-card">
                  <div className="home-blog-card__cover">
                    <img src={post.cover_image} alt={post.title} />
                    <span className={`home-blog-card__cat blog-cat-badge ${catClass(post.category)}`}>{post.category}</span>
                  </div>
                  <div className="home-blog-card__body">
                    <span className="home-blog-card__date">{post.published_at}</span>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="home-blog-card__footer">
                      {post.reviews_count > 0 && (
                        <span className="home-blog-card__rating">
                          <FaStar /> {post.rating.toFixed(1)} <em>({post.reviews_count})</em>
                        </span>
                      )}
                      <span className="home-blog-card__read">Lire la suite →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="home-blog__footer">
            <Link to="/blog" className="home-blog__cta">
              Explorer tout le blog
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
