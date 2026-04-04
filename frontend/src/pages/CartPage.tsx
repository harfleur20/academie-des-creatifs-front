import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaTrashAlt, FaLock, FaHeadset } from "react-icons/fa";

import { useCart } from "../cart/CartContext";
import { getUserActionErrorMessage, USER_MESSAGES } from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";

function getFormatLabel(formatType: "live" | "ligne" | "presentiel") {
  if (formatType === "ligne") {
    return "Formation en ligne";
  }

  if (formatType === "presentiel") {
    return "Formation en presentiel";
  }

  return "Formation live";
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function CartPage() {
  const { cart, isLoading, addToCart, removeFromCart } = useCart();
  const navigate = useNavigate();
  const { success, error: showErrorToast } = useToast();
  const [searchParams] = useSearchParams();
  const [isResolvingIntent, setIsResolvingIntent] = useState(false);
  const [intentError, setIntentError] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const requestedSlug = searchParams.get("add");

  useEffect(() => {
    if (!requestedSlug || isLoading) {
      return;
    }

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
        if (!isMounted) {
          return;
        }

        const message = getUserActionErrorMessage(error, "cart.add");
        setIntentError(message);
        showErrorToast(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsResolvingIntent(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [addToCart, cart.items, isLoading, navigate, requestedSlug]);

  // Initialize quantities & calculate totals
  useEffect(() => {
    const newQuantities: Record<number, number> = {};
    cart.items.forEach((item) => {
      if (!(item.id in quantities)) {
        newQuantities[item.id] = 1;
      }
    });
    if (Object.keys(newQuantities).length > 0) {
      setQuantities((prev) => ({ ...prev, ...newQuantities }));
    }
  }, [cart.items]);

  const handleQuantityChange = (itemId: number, delta: number) => {
    setQuantities((prev) => {
      const newQty = Math.max(1, (prev[itemId] || 1) + delta);
      return { ...prev, [itemId]: newQty };
    });
  };

  // Calculate totals
  const subtotal = cart.items.reduce((sum, item) => {
    const qty = quantities[item.id] || 1;
    return sum + item.current_price_amount * qty;
  }, 0);
  const taxRate = 0.19; // TVA 19%
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  if (isLoading || isResolvingIntent) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Panier</p>
          <h1>
            {requestedSlug
              ? "Preparation de votre panier..."
              : "Chargement de votre panier..."}
          </h1>
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
            Ajoutez une formation depuis le catalogue pour preparer votre
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
        <h1>Finalisez votre selection avant paiement</h1>
        <p className="page-intro">
          Vous pouvez encore retirer une formation avant de passer au checkout
          protege.
        </p>
      </section>

      {intentError ? (
        <p className="dashboard-notice dashboard-notice--error">
          {intentError}
        </p>
      ) : null}

      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <article className="cart-item-card" key={item.id}>
              {/* Thumbnail Image */}
              <div className="cart-item-card__thumbnail">
                <img src={item.image} alt={item.title} />
              </div>

              {/* Main Content */}
              <div className="cart-item-card__content">
                {/* Header: Mode badge + Delete button */}
                <div className="cart-item-card__header">
                  <span className="cart-item-card__mode">
                    {getFormatLabel(item.format_type)}
                  </span>
                  <button
                    type="button"
                    className="cart-item-card__delete"
                    aria-label="Retirer cette formation"
                    onClick={() => {
                      void removeFromCart(item.formation_slug)
                        .then(() => {
                          success(USER_MESSAGES.cartRemoved);
                        })
                        .catch((error) => {
                          showErrorToast(getUserActionErrorMessage(error, "cart.remove"));
                        });
                    }}
                  >
                    <FaTrashAlt />
                  </button>
                </div>

                {/* Title & Description */}
                <h3>{item.title}</h3>
                <p className="cart-item-card__description">
                  {item.session_label}
                </p>

                {/* Specs: Duration, Level, Instructor */}
                <div className="cart-item-card__specs">
                  <span className="spec-item">
                    <svg
                      className="spec-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    40h
                  </span>
                  <span className="spec-item">
                    <svg
                      className="spec-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
                    </svg>
                    {item.level}
                  </span>
                  <span className="spec-item">
                    <svg
                      className="spec-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Expert
                  </span>
                </div>
              </div>

              {/* Price & Quantity */}
              <div className="cart-item-card__footer">
                <div className="cart-item-card__price">
                  <strong>{item.current_price_label}</strong>
                </div>

                {/* Quantity Selector */}
                <div className="quantity-selector">
                  <button
                    type="button"
                    className="qty-btn qty-btn--minus"
                    onClick={() => handleQuantityChange(item.id, -1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="qty-input"
                    value={quantities[item.id] || 1}
                    readOnly
                  />
                  <button
                    type="button"
                    className="qty-btn qty-btn--plus"
                    onClick={() => handleQuantityChange(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="cart-summary">
          <div className="cart-summary__card">
            <h2>Récapitulatif</h2>

            {/* Breakdown */}
            <div className="cart-summary__breakdown">
              <div className="cart-summary__row">
                <span>Sous-total</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div className="cart-summary__row">
                <span>TVA (19%)</span>
                <strong>{formatPrice(tax)}</strong>
              </div>
              <div className="cart-summary__divider"></div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total</span>
                <strong>{formatPrice(total)}</strong>
              </div>
            </div>

            {/* CTA Primary */}
            <Link
              className="button button--primary button--full button--with-arrow"
              to="/checkout"
            >
              Finaliser l'inscription
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </Link>

            {/* CTA Secondary */}
            <Link
              className="button button--secondary button--full"
              to="/formations"
            >
              Continuer les achats
            </Link>

            {/* Feature Badges */}
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
