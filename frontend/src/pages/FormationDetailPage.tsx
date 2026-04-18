import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaChevronDown,
  FaClock,
  FaCrown,
  FaFacebookF,
  FaFire,
  FaGraduationCap,
  FaLink,
  FaInstagram,
  FaRegHeart,
  FaRegStar,
  FaHeadset,
  FaLock,
  FaShoppingCart,
  FaStar,
  FaStarHalfAlt,
  FaTag,
  FaWhatsapp,
} from "react-icons/fa";

import {
  fetchPublicFormation,
  type FormationDetailItem,
  type FormationFaq,
  type FormationModule,
  type FormationProject,
  mapCatalogFormationToCourse,
} from "../lib/catalogApi";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { useFavorites } from "../favorites/FavoritesContext";
import { ApiRequestError } from "../lib/apiClient";
import {
  getUserActionErrorMessage,
  USER_MESSAGES,
} from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";
import VerifiedBadge from "../components/VerifiedBadge";

type AccordionItem = FormationModule | FormationFaq;

type FormationDetailView = {
  slug: string;
  title: string;
  category: string;
  level: string;
  badges: string[];
  currentPrice: string;
  originalPrice?: string;
  rating: number;
  reviews: number;
  sessionLabel: string;
  heroImage: string;
  canPurchase: boolean;
  purchaseMessage: string | null;
  sessionState: FormationDetailItem["session_state"];
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

function mapFormationDetailToView(
  formation: FormationDetailItem,
): FormationDetailView {
  const mapped = mapCatalogFormationToCourse(formation);

  return {
    slug: formation.slug,
    title: formation.title,
    category: formation.category,
    level: formation.level,
    badges: formation.badges,
    currentPrice: mapped.currentPrice,
    originalPrice: mapped.originalPrice,
    rating: formation.rating,
    reviews: formation.reviews,
    sessionLabel: formation.session_label ?? formation.card_session_label ?? "",
    heroImage: formation.image,
    canPurchase: formation.can_purchase,
    purchaseMessage: formation.purchase_message,
    sessionState: formation.session_state,
    intro: formation.intro,
    mentor: formation.mentor_name,
    mentorLabel: formation.mentor_label,
    mentorImage: formation.mentor_image,
    included: formation.included,
    objectives: formation.objectives,
    projects: formation.projects,
    audienceText: formation.audience_text,
    certificateCopy: formation.certificate_copy,
    certificateImage: formation.certificate_image,
    modules: formation.modules,
    faqs: formation.faqs,
  };
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;

    if (rating >= starValue) {
      return <FaStar key={starValue} className="filled" />;
    }

    if (rating >= starValue - 0.5) {
      return <FaStarHalfAlt key={starValue} className="filled" />;
    }

    return <FaRegStar key={starValue} />;
  });
}

function renderCourseBadgeIcon(badge: string) {
  if (badge === "premium") {
    return <FaCrown />;
  }

  if (badge === "populaire") {
    return <FaFire />;
  }

  return <FaTag />;
}

function getCourseBadgeLabel(badge: string) {
  if (badge === "premium") {
    return "Premium";
  }

  if (badge === "populaire") {
    return "Populaire";
  }

  return "Promo";
}

function DetailAccordion({
  items,
  openIndex,
  onToggle,
}: {
  items: AccordionItem[];
  openIndex: number | null;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="detail-accordion">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const body = "question" in item ? item.answer : item.summary;
        const lessons = "lessons" in item ? item.lessons : null;
        const label =
          "question" in item ? item.question : item.title.replace(" - ", " : ");

        return (
          <article
            className={`detail-accordion__item ${isOpen ? "is-open" : ""}`}
            key={label}
          >
            <button
              className="detail-accordion__trigger"
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggle(index)}
            >
              <span>{label}</span>
              <span className="detail-accordion__trigger-icon">
                <FaChevronDown />
              </span>
            </button>

            <div className="detail-accordion__panel">
              <div className="detail-accordion__panel-inner">
                <div className="detail-accordion__content">
                  {lessons && lessons.length > 0 ? (
                    <ul className="detail-accordion__lessons">
                      {lessons.map((lesson) => (
                        <li key={lesson}>{lesson}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{body}</p>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FormationDetailSkeleton() {
  return (
    <div className="formation-detail-page">
      <section className="formation-detail-hero formation-detail-hero--loading" aria-busy="true">
        <div className="formation-detail-main">
          <div className="formation-detail-intro formation-detail-skeleton">
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--back" />
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--category" />
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--title" />
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--title formation-detail-skeleton__line--title-short" />
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--lead" />
            <span className="formation-detail-skeleton__line formation-detail-skeleton__line--lead formation-detail-skeleton__line--lead-short" />

            <div className="formation-detail-skeleton__meta">
              <span className="formation-detail-skeleton__chip" />
              <span className="formation-detail-skeleton__chip formation-detail-skeleton__chip--wide" />
            </div>

            <div className="formation-detail-skeleton__cover" />

            <div className="formation-detail-skeleton__mentor">
              <span className="formation-detail-skeleton__line formation-detail-skeleton__line--mentor-eyebrow" />
              <div className="formation-detail-skeleton__mentor-row">
                <div className="formation-detail-skeleton__mentor-card">
                  <span className="formation-detail-skeleton__avatar" />
                  <div className="formation-detail-skeleton__mentor-copy">
                    <span className="formation-detail-skeleton__line formation-detail-skeleton__line--mentor-name" />
                    <span className="formation-detail-skeleton__line formation-detail-skeleton__line--mentor-role" />
                  </div>
                </div>

                <div className="formation-detail-skeleton__mentor-actions">
                  <div className="formation-detail-skeleton__favorite" />
                  <div className="formation-detail-skeleton__share" />
                </div>
              </div>
            </div>
          </div>

          <aside className="formation-detail-card">
            <div className="formation-detail-card__panel formation-detail-card__panel--skeleton">
              <span className="formation-detail-skeleton__line formation-detail-skeleton__line--panel-title" />
              <div className="formation-detail-skeleton__list">
                <span className="formation-detail-skeleton__line formation-detail-skeleton__line--list-item" />
                <span className="formation-detail-skeleton__line formation-detail-skeleton__line--list-item" />
                <span className="formation-detail-skeleton__line formation-detail-skeleton__line--list-item formation-detail-skeleton__line--list-item-short" />
              </div>
              <div className="formation-detail-skeleton__price" />
              <div className="formation-detail-skeleton__rating" />
              <div className="formation-detail-skeleton__buttons">
                <span className="formation-detail-skeleton__button" />
                <span className="formation-detail-skeleton__button formation-detail-skeleton__button--secondary" />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function FormationDetailPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const { toggleFavorite, hasFavorite } = useFavorites();
  const { success, error: showErrorToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [formation, setFormation] = useState<FormationDetailView | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "unavailable">(
    "loading",
  );
  const [openModuleIndex, setOpenModuleIndex] = useState<number | null>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoadState("loading");
    setFormation(null);

    fetchPublicFormation(slug)
      .then((remoteFormation) => {
        if (!isMounted) {
          return;
        }

        setFormation(mapFormationDetailToView(remoteFormation));
        setLoadState("ready");
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }

        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setLoadState("not_found");
          return;
        }

        setLoadState("unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loadState === "loading") {
    return <FormationDetailSkeleton />;
  }

  if (loadState === "unavailable") {
    return (
      <div className="formation-detail-page">
        <section className="formation-detail-empty">
          <p className="formation-detail-empty__eyebrow">Catalogue indisponible</p>
          <h1>Impossible de charger cette fiche pour le moment.</h1>
          <p>
            Verifiez que le catalogue est bien disponible puis reessayez dans un
            instant.
          </p>
          <Link className="button button--primary" to="/formations">
            Revenir au catalogue
          </Link>
        </section>
      </div>
    );
  }

  if (loadState === "not_found" || !formation) {
    return (
      <div className="formation-detail-page">
        <section className="formation-detail-empty">
          <p className="formation-detail-empty__eyebrow">Formation introuvable</p>
          <h1>Cette fiche n'existe pas encore dans le catalogue.</h1>
          <p>
            Retournez au catalogue pour consulter les autres formations
            disponibles sur la plateforme.
          </p>
          <Link className="button button--primary" to="/formations">
            Revenir au catalogue
          </Link>
        </section>
      </div>
    );
  }

  if (!formation) {
    return null;
  }

  const isAlreadyInCart = cart.items.some(
    (item) => item.formation_slug === formation.slug,
  );
  const isFavorite = hasFavorite(formation.slug);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/formations/${formation.slug}`
      : `/formations/${formation.slug}`;
  const shareText = `${formation.title} - ${shareUrl}`;

  const redirectToLogin = (destination?: string) => {
    showErrorToast(USER_MESSAGES.authRequired);
    navigate("/login", {
      state: {
        from: destination ?? `${location.pathname}${location.search}${location.hash}`,
        fallbackFrom: `${location.pathname}${location.search}${location.hash}`,
      },
    });
  };

  const handleEnrollmentAction = async (target: "cart" | "checkout") => {
    setActionMessage("");

    if (!user) {
      const destination =
        target === "checkout"
          ? `/checkout?add=${formation.slug}`
          : `/panier?add=${formation.slug}`;

      redirectToLogin(destination);
      return;
    }

    if (target === "cart" && isAlreadyInCart) {
      navigate("/panier");
      return;
    }

    if (formation.canPurchase === false) {
      const message =
        formation.purchaseMessage ?? "Inscriptions closes pour cette formation.";
      setActionMessage(message);
      showErrorToast(message);
      return;
    }

    if (target === "cart") {
      setIsAddingToCart(true);
    } else {
      setIsPreparingCheckout(true);
    }

    try {
      await addToCart(formation.slug);
      success(
        target === "checkout"
          ? "Formation prete pour le paiement."
          : USER_MESSAGES.cartAdded,
      );
      navigate(target === "checkout" ? "/checkout" : "/panier");
    } catch (error) {
      const message = getUserActionErrorMessage(
        error,
        target === "checkout" ? "checkout.prepare" : "cart.add",
      );
      setActionMessage(message);
      showErrorToast(message);
    } finally {
      if (target === "cart") {
        setIsAddingToCart(false);
      } else {
        setIsPreparingCheckout(false);
      }
    }
  };

  const handleFavoriteToggle = async () => {
    setActionMessage("");

    if (!user) {
      redirectToLogin();
      return;
    }

    setIsUpdatingFavorite(true);

    try {
      const wasFavorite = hasFavorite(formation.slug);
      await toggleFavorite(formation.slug);
      success(
        wasFavorite
          ? USER_MESSAGES.favoriteRemoved
          : USER_MESSAGES.favoriteAdded,
      );
    } catch (error) {
      const message = getUserActionErrorMessage(error, "favorites.toggle");
      setActionMessage(message);
      showErrorToast(message);
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  const handleCopyLink = async (message: string = USER_MESSAGES.linkCopied) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      success(message);
    } catch {
      showErrorToast(getUserActionErrorMessage(null, "share.copy"));
    }
  };

  const handleShareAction = (platform: "facebook" | "whatsapp" | "instagram" | "copy") => {
    if (platform === "copy") {
      void handleCopyLink();
      return;
    }

    if (platform === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        "_blank",
        "noopener,noreferrer,width=640,height=600",
      );
      return;
    }

    if (platform === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    void handleCopyLink(USER_MESSAGES.instagramLinkCopied);
  };

  return (
    <div className="formation-detail-page">
      <section className="formation-detail-hero">
        <div className="formation-detail-main">
          <div className="formation-detail-intro">
            <Link className="formation-detail-back" to="/formations">
              <FaArrowLeft />
              Retour
            </Link>

            <div className="formation-detail-category-row">
              <p className="formation-detail-category">{formation.category}</p>
              {formation.badges && formation.badges.length > 0 ? (
                <div className="formation-detail-badges" aria-label="Badges de la formation">
                  {formation.badges.map((badge) => (
                    <span
                      className={`formation-detail-badge formation-detail-badge--${badge}`}
                      key={badge}
                      title={getCourseBadgeLabel(badge)}
                      aria-label={getCourseBadgeLabel(badge)}
                    >
                      {renderCourseBadgeIcon(badge)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <h1>{formation.title}</h1>
            <p className="formation-detail-lead">{formation.intro}</p>

            <div className="formation-detail-meta">
              <span>
                <FaGraduationCap />
                {formation.level}
              </span>
              {formation.sessionLabel ? (
                <span>
                  <FaClock />
                  {formation.sessionLabel}
                </span>
              ) : null}
            </div>

            <div className="formation-detail-cover">
              <img src={formation.heroImage} alt={formation.title} />
            </div>

            <div className="formation-detail-mentor">
              <p className="formation-detail-mentor__eyebrow">
                Cette formation est sous la supervision de :
              </p>
              <div className="formation-detail-mentor__bar">
                <div className="formation-detail-mentor__info">
                  <img src={formation.mentorImage} alt={formation.mentor} />
                  <div className="formation-detail-mentor__body">
                    <strong>
                      {formation.mentor}
                      <VerifiedBadge size={15} />
                    </strong>
                    <span>{formation.mentorLabel}</span>
                  </div>
                </div>

                <div className="formation-detail-mentor__controls">
                  <Link className="formation-detail-mentor__consult" to="/#notre-equipe">
                    Voir le profil
                  </Link>

                  <div className="formation-detail-mentor__divider" />

                  <button
                    className={`formation-detail-mentor__fav-btn${isFavorite ? " is-active" : ""}`}
                    disabled={isUpdatingFavorite}
                    type="button"
                    aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    onClick={() => { void handleFavoriteToggle(); }}
                  >
                    <FaRegHeart />
                  </button>

                  <div className="formation-detail-mentor__socials">
                    <button type="button" aria-label="Partager sur Facebook" onClick={() => handleShareAction("facebook")}><FaFacebookF /></button>
                    <button type="button" aria-label="Partager sur WhatsApp" onClick={() => handleShareAction("whatsapp")}><FaWhatsapp /></button>
                    <button type="button" aria-label="Partager sur Instagram" onClick={() => handleShareAction("instagram")}><FaInstagram /></button>
                    <button type="button" aria-label="Copier le lien" onClick={() => handleShareAction("copy")}><FaLink /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="formation-detail-card">
            <div className="formation-detail-card__panel">
              <h2>Les details de la formation</h2>
              <ul className="formation-detail-card__list">
                {formation.included.map((item) => (
                  <li key={item}>
                    <FaCheckCircle />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="formation-detail-card__price">
                <span>Tarif actuel</span>
                {formation.originalPrice ? (
                  <small>{formation.originalPrice}</small>
                ) : null}
                <strong>{formation.currentPrice}</strong>
              </div>

              <div className="formation-detail-card__rating">
                <div className="formation-detail-card__stars">
                  {renderStars(formation.rating)}
                </div>
                <p>
                  {formation.rating.toFixed(1)} sur 5
                  <span>({formation.reviews} avis)</span>
                </p>
              </div>

              <div className="formation-detail-card__actions">
                {formation.canPurchase === false ? (
                  <>
                    <button
                      className="formation-detail-card__primary is-closed"
                      type="button"
                      onClick={() => { void handleEnrollmentAction("cart"); }}
                    >
                      <FaLock /> Inscription close
                    </button>
                    <p className="formation-detail-card__closed-notice">
                      Les inscriptions pour cette formation sont closes.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      className="formation-detail-card__primary"
                      disabled={isAddingToCart || isPreparingCheckout}
                      type="button"
                      onClick={() => { void handleEnrollmentAction("cart"); }}
                    >
                      {isAlreadyInCart ? (
                        <><FaCheckCircle /> Deja dans le panier</>

                      ) : isAddingToCart ? (
                        "Ajout en cours..."
                      ) : (
                        <><FaShoppingCart /> Ajouter au panier</>
                      )}
                    </button>
                    <button
                      className="formation-detail-card__secondary"
                      disabled={isAddingToCart || isPreparingCheckout}
                      type="button"
                      onClick={() => { void handleEnrollmentAction("checkout"); }}
                    >
                      {isPreparingCheckout ? "Preparation du checkout..." : "S'inscrire a cette formation"}
                    </button>
                  </>
                )}
              </div>

              <div className="cart-summary__features">
                <div className="feature-badge">
                  <FaLock className="feature-badge__icon" />
                  <span>Paiement sécurisé</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="formation-detail-section">
        <div className="formation-detail-section__heading formation-detail-section__heading--with-top-space">
          <h2>A la fin de ce cours, vous serez capable de...</h2>
        </div>
        <div className="formation-detail-objectives">
          {formation.objectives.map((objective) => (
            <div className="formation-detail-objective" key={objective}>
              <FaCheckCircle />
              <span>{objective}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="formation-detail-section">
        <div className="formation-detail-section__heading formation-detail-section__heading--centered formation-detail-section__heading--projects">
          <h2>Quelques TP qui vous attendent.</h2>
        </div>
        <div className="formation-detail-projects">
          {formation.projects.map((project) => (
            <article className="formation-detail-project" key={project.title}>
              <div className="formation-detail-project__media">
                {project.kind === "video" ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={project.poster ?? undefined}
                    preload="metadata"
                  >
                    <source src={project.image} />
                  </video>
                ) : (
                  <img src={project.image} alt={project.title} />
                )}
              </div>
              <h3>{project.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="formation-detail-section formation-detail-section--narrow">
        <div className="formation-detail-section__heading formation-detail-section__heading--centered">
          <h2>A qui s'adresse ce cours ?</h2>
        </div>
        <p className="formation-detail-audience">{formation.audienceText}</p>
      </section>

      <section className="formation-detail-section">
        <div className="formation-detail-certificate">
          <div className="formation-detail-certificate__content">
            <h2>Certificat d'achevement</h2>
            <p>{formation.certificateCopy}</p>
          </div>
          <div className="formation-detail-certificate__media">
            <img
              src={formation.certificateImage}
              alt={`Certificat de fin de parcours ${formation.title}`}
            />
          </div>
        </div>
      </section>

      <section className="formation-detail-section formation-detail-section--narrow">
        <div className="formation-detail-section__heading formation-detail-section__heading--centered">
          <h2>Modules detailles du cours</h2>
        </div>
        <DetailAccordion
          items={formation.modules}
          openIndex={openModuleIndex}
          onToggle={(index) =>
            setOpenModuleIndex((current) => (current === index ? null : index))
          }
        />
      </section>

      <section className="formation-detail-section formation-detail-section--narrow">
        <div className="formation-detail-section__heading formation-detail-section__heading--centered">
          <h2>Questions frequentes</h2>
        </div>
        <DetailAccordion
          items={formation.faqs}
          openIndex={openFaqIndex}
          onToggle={(index) =>
            setOpenFaqIndex((current) => (current === index ? null : index))
          }
        />
      </section>
    </div>
  );
}
