import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaBolt,
  FaBoxOpen,
  FaChalkboardTeacher,
  FaChevronDown,
  FaClock,
  FaCrown,
  FaFire,
  FaLaptop,
  FaLock,
  FaMapMarkerAlt,
  FaRegHeart,
  FaRegStar,
  FaShoppingCart,
  FaStar,
  FaTags,
  FaVideo,
} from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { useFavorites } from "../favorites/FavoritesContext";
import {
  getFormationPath,
  fetchPublicFormations,
  type CourseBadge,
  type CatalogFormation,
} from "../lib/catalogApi";
import { canUseCommerce } from "../lib/commerceAccess";
import {
  getCommerceRoleRestrictedMessage,
  getUserActionErrorMessage,
  USER_MESSAGES,
} from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";

type CatalogFormat = "all" | "live" | "ligne" | "presentiel";
type SortKey = "popularite" | "prix-asc" | "prix-desc" | "rating";

type CatalogFaq = {
  question: string;
  answer: string;
};

const catalogFaqs: CatalogFaq[] = [
  {
    question: "Puis-je payer une formation en plusieurs fois ?",
    answer:
      "Le paiement en tranches est disponible dès 100 000 FCFA de commande lorsque la durée de session permet un calendrier d'échéances cohérent.",
  },
  {
    question: "Est-ce que je garde acces au contenu apres les lives ?",
    answer:
      "Oui. Quand le programme le prevoit, les replays et les supports restent disponibles dans l'espace etudiant apres les sessions live.",
  },
  {
    question: "Quelle formule choisir entre live, ligne et presentiel ?",
    answer:
      "Le live favorise l'accompagnement en direct, la ligne convient mieux a l'autonomie, et le presentiel apporte un encadrement academique sur site.",
  },
  {
    question: "Comment fonctionne l'acces au presentiel apres paiement ?",
    answer:
      "Une fois le paiement valide, vous obtenez votre inscription, votre cohorte et, pour le presentiel, votre code etudiant unique.",
  },
  {
    question: "Puis-je changer de modalite apres achat ?",
    answer:
      "Un changement de formule n'est pas automatique. Il depend de la disponibilite, du calendrier et de l'etat de votre dossier.",
  },
];

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;

    if (rating >= starValue) {
      return <FaStar key={starValue} className="filled" />;
    }

    return <FaRegStar key={starValue} />;
  });
}

function badgeContent(badge: CourseBadge) {
  if (badge === "premium") {
    return (
      <span className="catalogue-product-card__badge catalogue-product-card__badge--premium">
        <FaCrown />
        Premium
      </span>
    );
  }

  if (badge === "populaire") {
    return (
      <span className="catalogue-product-card__badge catalogue-product-card__badge--populaire">
        <FaFire />
        Populaire
      </span>
    );
  }

  return (
    <span className="catalogue-product-card__badge catalogue-product-card__badge--promo">
      <FaTags />
      Promo
    </span>
  );
}

function getFormatTag(formation: CatalogFormation): Exclude<CatalogFormat, "all"> {
  return formation.format_type;
}

function getFormatLabel(format: Exclude<CatalogFormat, "all">) {
  if (format === "presentiel") {
    return "Présentiel";
  }

  if (format === "ligne") {
    return "En ligne";
  }

  return "Live";
}

function getFormatIcon(format: Exclude<CatalogFormat, "all">) {
  if (format === "presentiel") {
    return <FaMapMarkerAlt />;
  }

  if (format === "ligne") {
    return <FaLaptop />;
  }

  return <FaVideo />;
}

function getFormatAccessLabel(formation: CatalogFormation) {
  if (formation.format_type === "presentiel") {
    return formation.campus_label?.trim() || "Campus à confirmer";
  }

  if (formation.format_type === "live") {
    return "Live en ligne";
  }

  return "Vidéo en ligne";
}

export default function FormationsPage() {
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const { toggleFavorite, hasFavorite } = useFavorites();
  const { success, error, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<CatalogFormation[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [formatFilter, setFormatFilter] = useState<CatalogFormat>("all");
  const [maxPrice, setMaxPrice] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("popularite");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isPriceFilterDirty, setIsPriceFilterDirty] = useState(false);
  const [workingCartSlug, setWorkingCartSlug] = useState<string | null>(null);
  const [workingFavoriteSlug, setWorkingFavoriteSlug] = useState<string | null>(null);
  const cardsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchPublicFormations()
      .then((formations) => {
        if (isMounted) {
          setCourses(formations);
          setCatalogError("");
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setCourses([]);
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

  const minPrice = useMemo(() => {
    if (courses.length === 0) {
      return 0;
    }

    return Math.min(...courses.map((course) => course.current_price_amount));
  }, [courses]);

  const highestPrice = useMemo(() => {
    if (courses.length === 0) {
      return 0;
    }

    return Math.max(...courses.map((course) => course.current_price_amount));
  }, [courses]);

  useEffect(() => {
    if (highestPrice === 0) {
      return;
    }

    setMaxPrice((current) => {
      if (!isPriceFilterDirty || current === 0 || current > highestPrice) {
        return highestPrice;
      }

      return current;
    });
  }, [highestPrice, isPriceFilterDirty]);

  const formatCounts = useMemo(
    () => ({
      live: courses.filter((course) => getFormatTag(course) === "live").length,
      ligne: courses.filter((course) => getFormatTag(course) === "ligne").length,
      presentiel: courses.filter((course) => getFormatTag(course) === "presentiel").length,
    }),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const visibleCourses = courses.filter((course) => {
      const matchesFormat =
        formatFilter === "all" || getFormatTag(course) === formatFilter;
      const matchesPrice =
        maxPrice === 0 || course.current_price_amount <= maxPrice;

      return matchesFormat && matchesPrice;
    });

    return [...visibleCourses].sort((left, right) => {
      if (sortKey === "prix-asc") {
        return left.current_price_amount - right.current_price_amount;
      }

      if (sortKey === "prix-desc") {
        return right.current_price_amount - left.current_price_amount;
      }

      if (sortKey === "rating") {
        return right.rating - left.rating;
      }

      return right.reviews - left.reviews;
    });
  }, [courses, formatFilter, maxPrice, sortKey]);

  const scrollToCards = () => {
    cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closeMobileFiltersAndScroll = () => {
    setIsMobileFiltersOpen(false);
    window.setTimeout(() => {
      scrollToCards();
    }, 120);
  };

  const handleFormatChange = (nextFormat: CatalogFormat) => {
    setFormatFilter(nextFormat);

    if (window.matchMedia("(max-width: 980px)").matches) {
      closeMobileFiltersAndScroll();
    }
  };

  const handlePriceCommit = () => {
    if (window.matchMedia("(max-width: 980px)").matches) {
      closeMobileFiltersAndScroll();
    }
  };

  const handleProtectedAction = (slug: string, action: "cart" | "favorite") => {
    if (!user) {
      error(USER_MESSAGES.authRequired);
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}${location.hash}` },
      });
      return false;
    }

    if (action === "cart" && !canUseCommerce(user)) {
      error(getCommerceRoleRestrictedMessage(user));
      return false;
    }

    if (action === "cart") {
      setWorkingCartSlug(slug);
    } else {
      setWorkingFavoriteSlug(slug);
    }

    return true;
  };

  const handleAddToCart = async (course: CatalogFormation) => {
    if (user && !canUseCommerce(user)) {
      error(getCommerceRoleRestrictedMessage(user));
      return;
    }

    if (!course.can_purchase) {
      error(course.purchase_message ?? "Inscriptions closes pour cette formation.");
      return;
    }

    if (cart.items.some((item) => item.formation_slug === course.slug)) {
      info(USER_MESSAGES.cartAlreadyInCart);
      return;
    }

    if (!handleProtectedAction(course.slug, "cart")) {
      return;
    }

    try {
      await addToCart(course.slug);
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

  const renderSidebarBlocks = (isMobile = false) => (
    <>
      <div className="catalogue-sidebar__block">
        <p className="catalogue-sidebar__eyebrow">Par format</p>
        <div className="catalogue-sidebar__list">
          <button
            className={formatFilter === "all" ? "is-active" : ""}
            type="button"
            onClick={() => handleFormatChange("all")}
          >
            <span>Tous les cours</span>
            <strong>{courses.length}</strong>
          </button>
          <button
            className={formatFilter === "live" ? "is-active" : ""}
            type="button"
            onClick={() => handleFormatChange("live")}
          >
            <span>Live</span>
            <strong>{formatCounts.live}</strong>
          </button>
          <button
            className={formatFilter === "ligne" ? "is-active" : ""}
            type="button"
            onClick={() => handleFormatChange("ligne")}
          >
            <span>Ligne</span>
            <strong>{formatCounts.ligne}</strong>
          </button>
          <button
            className={formatFilter === "presentiel" ? "is-active" : ""}
            type="button"
            onClick={() => handleFormatChange("presentiel")}
          >
            <span>Presentiel</span>
            <strong>{formatCounts.presentiel}</strong>
          </button>
        </div>
      </div>

      <div className="catalogue-sidebar__block">
        <div className="catalogue-sidebar__block-head">
          <p className="catalogue-sidebar__eyebrow">Filtrer par prix</p>
          <strong>{formatFcfa(maxPrice)}</strong>
        </div>
        <input
          className="catalogue-sidebar__range"
          type="range"
          min={minPrice}
          max={highestPrice}
          step={5000}
          value={maxPrice}
          onChange={(event) => {
            setIsPriceFilterDirty(true);
            setMaxPrice(Number(event.target.value));
          }}
          onPointerUp={handlePriceCommit}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              handlePriceCommit();
            }
          }}
        />
        <div className="catalogue-sidebar__range-scale">
          <span>{formatFcfa(minPrice)}</span>
          <span>{formatFcfa(highestPrice)}</span>
        </div>

        {isMobile ? (
          <button
            className="catalogue-mobile-filters__apply"
            type="button"
            onClick={closeMobileFiltersAndScroll}
          >
            Voir les resultats
          </button>
        ) : null}
      </div>

      <div className="catalogue-sidebar__block catalogue-sidebar__block--guide">
        <p className="catalogue-sidebar__eyebrow">Aide au choix</p>
        <div className="catalogue-sidebar__guide-item">
          <FaVideo />
          <div>
            <strong>Live</strong>
            <p>Pour un accompagnement direct et des sessions guidees.</p>
          </div>
        </div>
        <div className="catalogue-sidebar__guide-item">
          <FaLaptop />
          <div>
            <strong>Ligne</strong>
            <p>Pour avancer a votre rythme avec plus d'autonomie.</p>
          </div>
        </div>
        <div className="catalogue-sidebar__guide-item">
          <FaMapMarkerAlt />
          <div>
            <strong>Presentiel</strong>
            <p>Pour un suivi sur site et un cadre academique fort.</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="formation-index-page formation-index-page--catalogue-v2">
      <div className="catalogue-layout">
        <aside className="catalogue-sidebar catalogue-sidebar--desktop">
          {renderSidebarBlocks()}
        </aside>

        <div className="catalogue-main">
          <div className="catalogue-mobile-filters">
            <button
              aria-expanded={isMobileFiltersOpen}
              className={`catalogue-mobile-filters__trigger ${
                isMobileFiltersOpen ? "is-open" : ""
              }`}
              type="button"
              onClick={() => {
                setIsMobileFiltersOpen((current) => !current);
              }}
            >
              <span>Filtres du catalogue</span>
              <FaChevronDown />
            </button>

            <div
              className={`catalogue-mobile-filters__panel ${
                isMobileFiltersOpen ? "is-open" : ""
              }`}
            >
              <div className="catalogue-mobile-filters__bubble">
                {renderSidebarBlocks(true)}
              </div>
            </div>
          </div>

          <section className="catalogue-main__hero">
            <div className="catalogue-main__hero-copy">
              <p className="catalogue-main__eyebrow">Catalogue des formations</p>
              <h1>Choisissez la formule qui colle a votre rythme de progression.</h1>
              <p>
                Comparez nos parcours, filtrez par budget et choisissez la
                meilleure porte d'entree vers votre prochain niveau creatif.
              </p>
              <a className="button button--primary" href="#catalogue-grid">
                <FaBolt />
                Voir les offres
              </a>
            </div>

            <div className="catalogue-main__hero-visual">
              <img
                src="/banner_catalogue_formation.jpg"
                alt="Banniere catalogue des formations Academie des Creatifs"
              />
            </div>
          </section>

          <section className="catalogue-main__toolbar">
            <div className="catalogue-main__toolbar-copy">
              <span>{filteredCourses.length} formation(s) disponibles</span>
              <p>Un catalogue pense pour comparer vite, sans perdre le fil.</p>
            </div>

            <label className="catalogue-main__sorter">
              <span>Trier par</span>
              <select
                value={sortKey}
                onChange={(event) => {
                  setSortKey(event.target.value as SortKey);
                }}
              >
                <option value="popularite">Popularite</option>
                <option value="rating">Note</option>
                <option value="prix-asc">Prix croissant</option>
                <option value="prix-desc">Prix decroissant</option>
              </select>
            </label>
          </section>

          <section className="catalogue-product-grid" id="catalogue-grid" ref={cardsRef}>
            {catalogLoading ? (
              <div className="catalogue-empty-state">
                <FaBoxOpen />
                <h3>Chargement du catalogue...</h3>
                <p>Les formations sont en cours de recuperation.</p>
              </div>
            ) : filteredCourses.length > 0 ? (
              filteredCourses.map((course) => {
                const formatTag = getFormatTag(course);
                const isCourseInCart = cart.items.some(
                  (item) => item.formation_slug === course.slug,
                );
                const hasPromo =
                  Boolean(course.original_price_label) &&
                  course.original_price_label !== course.current_price_label;

                return (
                  <article className="catalogue-product-card" key={course.slug}>
                    <div className="catalogue-product-card__media">
                      <img src={course.image} alt={course.title} />
                      <button
                        aria-label={`Ajouter ${course.title} aux favoris`}
                        className={`catalogue-product-card__wish ${hasFavorite(course.slug) ? "is-active" : ""}`}
                        type="button"
                        disabled={workingFavoriteSlug === course.slug}
                        onClick={() => {
                          void handleToggleFavorite(course.slug);
                        }}
                      >
                        <FaRegHeart />
                      </button>
                      <div className="catalogue-product-card__badges">
                        <span className={`catalogue-product-card__format catalogue-product-card__format--${formatTag}`}>
                          {getFormatIcon(formatTag)}
                          {getFormatLabel(formatTag)}
                        </span>
                        {course.badges.map((badge) => (
                          <span key={badge}>{badgeContent(badge)}</span>
                        ))}
                      </div>
                    </div>

                    <div className="catalogue-product-card__body">
                      <p className="catalogue-product-card__category">{course.category}</p>
                      <h2>{course.title}</h2>

                      <div className="catalogue-product-card__meta">
                        <span>
                          <FaChalkboardTeacher />
                          {course.level}
                        </span>
                        <span className="catalogue-product-card__meta-access">
                          {getFormatIcon(formatTag)}
                          {getFormatAccessLabel(course)}
                        </span>
                        {course.card_session_label ? (
                          <span>
                            <FaClock />
                            {course.card_session_label}
                          </span>
                        ) : null}
                      </div>

                      <div className="catalogue-product-card__rating">
                        <div className="catalogue-product-card__stars">
                          {renderStars(course.rating)}
                        </div>
                        <span>{course.reviews} avis</span>
                      </div>

                      <div className="catalogue-product-card__footer">
                        <div className="catalogue-product-card__price">
                          <span className="catalogue-product-card__price-old">
                            {course.original_price_label ?? ""}
                          </span>
                          <strong className={hasPromo ? "is-promo" : ""}>
                            {course.current_price_label}
                          </strong>
                        </div>

                        <div className="catalogue-product-card__actions">
                          {course.can_purchase ? (
                            <button
                              aria-label={
                                isCourseInCart
                                  ? `${course.title} est deja dans le panier`
                                  : `Ajouter ${course.title} au panier`
                              }
                              className={`catalogue-product-card__cart${
                                isCourseInCart ? " catalogue-product-card__cart--locked" : ""
                              }`}
                              type="button"
                              disabled={workingCartSlug === course.slug}
                              onClick={() => { void handleAddToCart(course); }}
                            >
                              <FaShoppingCart />
                            </button>
                          ) : (
                            <button
                              aria-label={`Inscriptions closes pour ${course.title}`}
                              className="catalogue-product-card__cart catalogue-product-card__cart--closed"
                              type="button"
                              onClick={() => {
                                error(course.purchase_message ?? "Inscriptions closes pour cette formation.");
                              }}
                            >
                              <FaLock />
                            </button>
                          )}
                          <Link className="catalogue-product-card__cta" to={getFormationPath(course.slug)}>
                            <FaArrowRight />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="catalogue-empty-state">
                <FaBoxOpen />
                <h3>
                  {catalogError
                    ? "Catalogue indisponible pour le moment."
                    : "Aucune formation ne correspond a ce filtre."}
                </h3>
                <p>
                  {catalogError
                    ? "Impossible de recuperer les formations pour le moment. Reessayez plus tard."
                    : "Elargissez votre budget ou changez de format pour voir d'autres offres."}
                </p>
              </div>
            )}
          </section>

          <section className="catalogue-reassurance">
            <div className="catalogue-reassurance__heading">
              <p className="catalogue-main__eyebrow">Bien choisir sa formule</p>
              <h2>Comprendre vite les differences entre les formats</h2>
            </div>

            <div className="catalogue-reassurance__grid">
              <article className="catalogue-reassurance__card">
                <div className="catalogue-reassurance__icon">
                  <FaVideo />
                </div>
                <h3>Live</h3>
                <p>
                  Pour les apprenants qui veulent des rendez-vous en direct, du
                  feedback regulier et un cadre plus soutenu.
                </p>
              </article>

              <article className="catalogue-reassurance__card">
                <div className="catalogue-reassurance__icon">
                  <FaLaptop />
                </div>
                <h3>Ligne</h3>
                <p>
                  Pour ceux qui preferent avancer en autonomie, consulter les
                  contenus au calme et organiser eux-memes leur progression.
                </p>
              </article>

              <article className="catalogue-reassurance__card">
                <div className="catalogue-reassurance__icon">
                  <FaMapMarkerAlt />
                </div>
                <h3>Presentiel</h3>
                <p>
                  Pour une immersion plus encadree, un suivi scolaire et un
                  accompagnement academique sur site.
                </p>
              </article>
            </div>
          </section>

          <section className="catalogue-faq">
            <div className="catalogue-reassurance__heading">
              <p className="catalogue-main__eyebrow">Questions frequentes</p>
              <h2>Ce qu'il faut savoir avant de vous engager</h2>
            </div>

            <div className="catalogue-faq__list">
              {catalogFaqs.map((item, index) => {
                const isOpen = openFaqIndex === index;

                return (
                  <article
                    className={`catalogue-faq__item ${isOpen ? "is-open" : ""}`}
                    key={item.question}
                  >
                    <button
                      aria-expanded={isOpen}
                      className="catalogue-faq__trigger"
                      type="button"
                      onClick={() => {
                        setOpenFaqIndex((current) => (current === index ? null : index));
                      }}
                    >
                      <span>{item.question}</span>
                      <FaChevronDown />
                    </button>
                    <div className="catalogue-faq__panel">
                      <div className="catalogue-faq__panel-inner">
                        <p>{item.answer}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
