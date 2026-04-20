import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaTrashAlt, FaLock, FaHeadset, FaChalkboardTeacher, FaExclamationTriangle } from "react-icons/fa";

import { useCart } from "../cart/CartContext";
import { getUserActionErrorMessage, USER_MESSAGES } from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";
import { formatPrice, getFormatLabel } from "../lib/format";

export default function CartPage() {
  const { cart, isLoading, addToCart, removeFromCart } = useCart();
  const navigate = useNavigate();
  const { success, error: showErrorToast } = useToast();
  const [searchParams] = useSearchParams();
  const [isResolvingIntent, setIsResolvingIntent] = useState(false);
  const [intentError, setIntentError] = useState("");
  const requestedSlug = searchParams.get("add");
  const closedItems = cart.items.filter((item) => !item.can_purchase);
  const installmentCount = Math.max(
    0,
    ...Object.values(cart.installment_schedules_preview ?? {}).map((schedule) => schedule.length),
  );

  useEffect(() => {
    if (!requestedSlug || isLoading) return;

    if (cart.items.some((item) => item.formation_slug === requestedSlug)) {
      navigate("/panier", { replace: true });
      return;
    }

    let isMounted = true;
    setIsResolvingIntent(true);
    setIntentError("");

    addToCart(requestedSlug)
      .then(() => {
        if (isMounted) {
          success(USER_MESSAGES.cartAdded);
          navigate("/panier", { replace: true });
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        const message = getUserActionErrorMessage(error, "cart.add");
        setIntentError(message);
        showErrorToast(message);
      })
      .finally(() => {
        if (isMounted) setIsResolvingIntent(false);
      });

    return () => { isMounted = false; };
  }, [addToCart, cart.items, isLoading, navigate, requestedSlug]);

  if (isLoading || isResolvingIntent) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Panier</p>
          <h1>{requestedSlug ? "Préparation de votre panier…" : "Chargement de votre panier…"}</h1>
        </section>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="formation-detail-page">
        <section className="formation-detail-empty">
          <p className="formation-detail-empty__eyebrow">Panier</p>
          <h1>Votre panier est encore vide.</h1>
          <p>
            Ajoutez une formation depuis le catalogue pour préparer votre
            inscription et retrouver vos choix ici.
          </p>
          <Link className="button button--primary" to="/formations">
            Voir les formations
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page commerce-page">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Panier</p>
        <h1>Finalisez votre sélection avant paiement</h1>
        <p className="page-intro">
          {cart.items.length} formation{cart.items.length > 1 ? "s" : ""} dans votre panier.
          Retirez une formation ou passez au paiement sécurisé.
        </p>
      </section>

      {intentError && (
        <p className="dashboard-notice dashboard-notice--error">{intentError}</p>
      )}

      {closedItems.length > 0 && (
        <div className="cart-closed-banner">
          <FaExclamationTriangle className="cart-closed-banner__icon" />
          <div className="cart-closed-banner__body">
            <strong>
              {closedItems.length === 1
                ? "1 formation ne peut plus être achetée"
                : `${closedItems.length} formations ne peuvent plus être achetées`}
            </strong>
            <p>
              {closedItems.map((item) => item.title).join(", ")} —{" "}
              {closedItems[0].purchase_message ?? "Inscriptions closes."}
            </p>
          </div>
          <div className="cart-closed-banner__actions">
            {closedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cart-closed-banner__remove"
                onClick={() => {
                  void removeFromCart(item.formation_slug)
                    .then(() => success(`"${item.title}" retiré du panier.`))
                    .catch((e) => showErrorToast(getUserActionErrorMessage(e, "cart.remove")));
                }}
              >
                Retirer « {item.title.length > 30 ? `${item.title.slice(0, 28)}…` : item.title} »
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <article className={`cart-item-card${!item.can_purchase ? " cart-item-card--closed" : ""}`} key={item.id}>
              <div className="cart-item-card__thumbnail">
                <img src={item.image} alt={item.title} />
              </div>

              <div className="cart-item-card__content">
                <div className="cart-item-card__header">
                  <span className="cart-item-card__mode">{getFormatLabel(item.format_type)}</span>
                  <button
                    type="button"
                    className="cart-item-card__delete"
                    aria-label="Retirer cette formation"
                    onClick={() => {
                      void removeFromCart(item.formation_slug)
                        .then(() => success(USER_MESSAGES.cartRemoved))
                        .catch((error) => showErrorToast(getUserActionErrorMessage(error, "cart.remove")));
                    }}
                  >
                    <FaTrashAlt />
                  </button>
                </div>

                <h3>{item.title}</h3>
                {item.session_label && (
                  <p className="cart-item-card__description">{item.session_label}</p>
                )}

                <div className="cart-item-card__specs">
                  <span className="spec-item">
                    <svg className="spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    </svg>
                    {item.level}
                  </span>
                  <span className="spec-item">
                    <svg className="spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                    {item.dashboard_type === "guided" ? "Espace guidé" : "Espace classique"}
                  </span>
                </div>
              </div>

              <div className="cart-item-card__footer">
                <div className="cart-item-card__price">
                  <strong>{item.current_price_label}</strong>
                  {item.original_price_label && (
                    <s className="cart-item-card__original-price">{item.original_price_label}</s>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="cart-summary">
          <div className="cart-summary__card">
            <h2>Récapitulatif</h2>

            <div className="cart-summary__breakdown">
              {cart.items.map((item) => (
                <div className="cart-summary__row" key={item.id}>
                  <span className="cart-summary__item-name">{item.title}</span>
                  <strong>{item.current_price_label}</strong>
                </div>
              ))}
              <div className="cart-summary__divider" />
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total</span>
                <strong>{cart.total_amount_label}</strong>
              </div>
            </div>

            {cart.allow_installments && (
              <p className="cart-summary__installment-hint">
                Paiement en {installmentCount || 3} tranches disponible au checkout.
              </p>
            )}

            <Link
              className={`button button--full button--with-arrow${closedItems.length > 0 ? " button--secondary" : " button--primary"}`}
              to={closedItems.length > 0 ? "#" : "/checkout"}
              onClick={closedItems.length > 0 ? (e) => { e.preventDefault(); showErrorToast("Retirez d'abord les formations dont les inscriptions sont closes."); } : undefined}
              aria-disabled={closedItems.length > 0}
            >
              Finaliser l'inscription
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            <Link className="button button--secondary button--full" to="/formations">
              Continuer les achats
            </Link>

            <div className="cart-summary__features">
              <div className="feature-badge">
                <FaLock className="feature-badge__icon" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="feature-badge">
                <FaHeadset className="feature-badge__icon" />
                <span>Support client réactif</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
