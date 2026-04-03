import { useEffect, useMemo, useState } from "react";
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
  FaInstagram,
  FaRegStar,
  FaShoppingCart,
  FaStar,
  FaStarHalfAlt,
  FaTag,
  FaWhatsapp,
} from "react-icons/fa";

import {
  getFormationDetailBySlug,
  type FormationDetail,
  type FormationFaq,
  type FormationModule,
} from "../data/formationDetailsData";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import {
  fetchPublicFormation,
  mapCatalogFormationToCourse,
} from "../lib/catalogApi";

type AccordionItem = FormationModule | FormationFaq;

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
        const body = "summary" in item ? item.summary : item.answer;
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

export default function FormationDetailPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const staticFormation = useMemo(() => getFormationDetailBySlug(slug), [slug]);
  const [formation, setFormation] = useState<FormationDetail | null>(
    staticFormation ?? null,
  );
  const [openModuleIndex, setOpenModuleIndex] = useState<number | null>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    setFormation(staticFormation ?? null);

    if (!staticFormation) {
      return;
    }

    let isMounted = true;

    fetchPublicFormation(slug)
      .then((remoteFormation) => {
        if (!isMounted) {
          return;
        }

        const mapped = mapCatalogFormationToCourse(remoteFormation);

        setFormation({
          ...staticFormation,
          ...mapped,
          category: remoteFormation.category,
          heroImage: mapped.image,
        });
      })
      .catch(() => {
        if (isMounted) {
          setFormation(staticFormation);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug, staticFormation]);

  if (!formation) {
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

  const handleEnrollmentAction = async (target: "cart" | "checkout") => {
    setActionMessage("");

    if (!user) {
      const destination =
        target === "checkout"
          ? `/checkout?add=${formation.slug}`
          : `/panier?add=${formation.slug}`;

      navigate("/login", {
        state: {
          from: destination,
          fallbackFrom: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      return;
    }

    if (target === "cart") {
      setIsAddingToCart(true);
    } else {
      setIsPreparingCheckout(true);
    }

    try {
      await addToCart(formation.slug);
      navigate(target === "checkout" ? "/checkout" : "/panier");
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter cette formation au panier.",
      );
    } finally {
      if (target === "cart") {
        setIsAddingToCart(false);
      } else {
        setIsPreparingCheckout(false);
      }
    }
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
              <span>
                <FaClock />
                {formation.sessionLabel}
              </span>
            </div>

            <div className="formation-detail-cover">
              <img src={formation.heroImage} alt={formation.title} />
            </div>

            <div className="formation-detail-mentor">
              <p className="formation-detail-mentor__eyebrow">
                Sous la supervision de
              </p>
              <div className="formation-detail-mentor__card">
                <img src={formation.mentorImage} alt={formation.mentor} />
                <div className="formation-detail-mentor__body">
                  <strong>{formation.mentor}</strong>
                  <span>{formation.mentorLabel}</span>
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
                <button
                  className="formation-detail-card__primary"
                  disabled={isAddingToCart || isPreparingCheckout}
                  type="button"
                  onClick={() => {
                    void handleEnrollmentAction("cart");
                  }}
                >
                  <FaShoppingCart />
                  {isAddingToCart ? "Ajout en cours..." : "Ajouter au panier"}
                </button>
                <button
                  className="formation-detail-card__secondary"
                  disabled={isAddingToCart || isPreparingCheckout}
                  type="button"
                  onClick={() => {
                    void handleEnrollmentAction("checkout");
                  }}
                >
                  {isPreparingCheckout
                    ? "Preparation du checkout..."
                    : "S'inscrire a cette formation"}
                </button>
              </div>

              {actionMessage ? (
                <p className="formation-detail-card__notice">{actionMessage}</p>
              ) : null}

              <div className="formation-detail-card__share">
                <span>Partager</span>
                <div className="formation-detail-card__socials">
                  <button type="button" aria-label="Partager sur Facebook">
                    <FaFacebookF />
                  </button>
                  <button type="button" aria-label="Partager sur WhatsApp">
                    <FaWhatsapp />
                  </button>
                  <button type="button" aria-label="Partager sur Instagram">
                    <FaInstagram />
                  </button>
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
                    poster={project.poster}
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
