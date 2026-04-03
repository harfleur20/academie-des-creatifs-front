import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaTrashAlt } from "react-icons/fa";

import { useCart } from "../cart/CartContext";

function getFormatLabel(formatType: "live" | "ligne" | "presentiel") {
  if (formatType === "ligne") {
    return "Formation en ligne";
  }

  if (formatType === "presentiel") {
    return "Formation en presentiel";
  }

  return "Formation live";
}

export default function CartPage() {
  const { cart, isLoading, addToCart, removeFromCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isResolvingIntent, setIsResolvingIntent] = useState(false);
  const [intentError, setIntentError] = useState("");
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
          navigate("/panier", { replace: true });
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setIntentError(
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter cette formation au panier.",
        );
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

      {intentError ? <p className="dashboard-notice dashboard-notice--error">{intentError}</p> : null}

      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <article className="cart-item-card" key={item.id}>
              <img src={item.image} alt={item.title} />
              <div className="cart-item-card__body">
                <span className="cart-item-card__mode">
                  {getFormatLabel(item.format_type)}
                </span>
                <h2>{item.title}</h2>
                <p>{item.session_label}</p>
                <div className="cart-item-card__footer">
                  <strong>{item.current_price_label}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      void removeFromCart(item.formation_slug);
                    }}
                  >
                    <FaTrashAlt />
                    Retirer
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="cart-summary">
          <div className="cart-summary__card">
            <h2>Resume du panier</h2>
            <div className="cart-summary__row">
              <span>Formations live</span>
              <strong>{cart.live_items_count}</strong>
            </div>
            <div className="cart-summary__row">
              <span>Formations en ligne</span>
              <strong>{cart.ligne_items_count}</strong>
            </div>
            <div className="cart-summary__row">
              <span>Formations presentiel</span>
              <strong>{cart.presentiel_items_count}</strong>
            </div>
            <div className="cart-summary__row cart-summary__row--total">
              <span>Total</span>
              <strong>{cart.total_amount_label}</strong>
            </div>
            <Link className="button button--primary button--full" to="/checkout">
              Passer au checkout
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
