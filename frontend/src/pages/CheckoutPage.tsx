import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useCart } from "../cart/CartContext";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, isLoading, addToCart, checkout } = useCart();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingIntent, setIsResolvingIntent] = useState(false);
  const [error, setError] = useState("");
  const requestedSlug = searchParams.get("add");

  useEffect(() => {
    if (!requestedSlug || isLoading) {
      return;
    }

    if (cart.items.some((item) => item.formation_slug === requestedSlug)) {
      navigate("/checkout", { replace: true });
      return;
    }

    let isMounted = true;
    setIsResolvingIntent(true);
    setError("");

    addToCart(requestedSlug)
      .then(() => {
        if (isMounted) {
          navigate("/checkout", { replace: true });
        }
      })
      .catch((intentError) => {
        if (!isMounted) {
          return;
        }

        setError(
          intentError instanceof Error
            ? intentError.message
            : "Impossible de preparer le checkout.",
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

  const handleCheckout = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const result = await checkout();
      navigate(result.redirect_path, {
        replace: true,
        state: { checkoutMessage: result.message },
      });
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Le checkout a echoue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isResolvingIntent && cart.items.length === 0 && !requestedSlug) {
      navigate("/panier", { replace: true });
    }
  }, [cart.items.length, isLoading, isResolvingIntent, navigate, requestedSlug]);

  if (isLoading || isResolvingIntent) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Checkout</p>
          <h1>
            {requestedSlug
              ? "Preparation du checkout..."
              : "Chargement du checkout..."}
          </h1>
        </section>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="page commerce-page commerce-page--narrower">
      <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Checkout</p>
        <h1>Paiement protege</h1>
        <p className="page-intro">
          Le paiement est simule pour l'instant. Les commandes, paiements et
          inscriptions sont cependant bien crees en base.
        </p>
      </section>

      <div className="checkout-card">
        <div className="checkout-card__list">
          {cart.items.map((item) => (
            <div className="checkout-card__row" key={item.id}>
              <span>{item.title}</span>
              <strong>{item.current_price_label}</strong>
            </div>
          ))}
        </div>

        <div className="checkout-card__row checkout-card__row--total">
          <span>Total a payer</span>
          <strong>{cart.total_amount_label}</strong>
        </div>

        {error ? <p className="checkout-card__error">{error}</p> : null}

        <button
          className="button button--primary button--full"
          disabled={isSubmitting}
          type="button"
          onClick={() => {
            void handleCheckout();
          }}
        >
          {isSubmitting ? "Paiement en cours..." : "Payer maintenant"}
        </button>
      </div>
    </div>
  );
}
