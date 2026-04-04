import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaHeartBroken, FaShoppingCart, FaStar } from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { useFavorites } from "../favorites/FavoritesContext";
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

export default function FavoritesPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { favorites, isLoading, removeFromFavorites } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: showErrorToast } = useToast();
  const [actionError, setActionError] = useState("");
  const [workingSlug, setWorkingSlug] = useState<string | null>(null);
  const [workingMode, setWorkingMode] = useState<"cart" | "remove" | null>(
    null,
  );

  async function handleAddToCart(slug: string) {
    if (!user) {
      showErrorToast(USER_MESSAGES.authRequired);
      navigate("/login", {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      return;
    }

    setActionError("");
    setWorkingSlug(slug);
    setWorkingMode("cart");

    try {
      await addToCart(slug);
      success(USER_MESSAGES.cartAdded);
    } catch (error) {
      const message = getUserActionErrorMessage(error, "cart.add");
      setActionError(message);
      showErrorToast(message);
    } finally {
      setWorkingSlug(null);
      setWorkingMode(null);
    }
  }

  async function handleRemove(slug: string) {
    setActionError("");
    setWorkingSlug(slug);
    setWorkingMode("remove");

    try {
      await removeFromFavorites(slug);
      success(USER_MESSAGES.favoriteRemoved);
    } catch (error) {
      const message = getUserActionErrorMessage(error, "favorites.toggle");
      setActionError(message);
      showErrorToast(message);
    } finally {
      setWorkingSlug(null);
      setWorkingMode(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered protected-placeholder-card">
          <p className="eyebrow">Favoris</p>
          <h1>Chargement de vos favoris...</h1>
        </section>
      </div>
    );
  }

  if (favorites.items.length === 0) {
    return (
      <div className="formation-detail-page">
        <section className="formation-detail-empty">
          <p className="formation-detail-empty__eyebrow">Favoris</p>
          <h1>Vous n'avez encore aucune formation favorite.</h1>
          <p>
            Ajoutez vos coups de coeur depuis l'accueil, le catalogue ou les
            fiches formation pour les retrouver ici.
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
        <p className="eyebrow">Favoris</p>
        <h1>Retrouvez vos formations enregistrees au meme endroit</h1>
        <p className="page-intro">
          Gardez vos options sous la main avant de les ajouter au panier.
        </p>
      </section>

      {actionError ? (
        <p className="dashboard-notice dashboard-notice--error">
          {actionError}
        </p>
      ) : null}

      <div className="cart-items">
        {favorites.items.map((item) => (
          <article className="cart-item-card" key={item.id}>
            {/* Thumbnail Image */}
            <div className="cart-item-card__thumbnail">
              <img src={item.image} alt={item.title} />
            </div>

            {/* Main Content */}
            <div className="cart-item-card__content">
              {/* Header: Mode badge + Ratings */}
              <div className="cart-item-card__header">
                <span className="cart-item-card__mode">
                  {getFormatLabel(item.format_type)}
                </span>
                {item.reviews > 0 && (
                  <span className="cart-item-card__rating">
                    ⭐ {item.rating.toFixed(1)} ({item.reviews})
                  </span>
                )}
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
              </div>
            </div>

            {/* Price & Actions */}
            <div className="cart-item-card__footer">
              <div className="cart-item-card__price">
                <strong>{item.current_price_label}</strong>
              </div>

              {/* Action Buttons */}
              <div className="favorites-actions">
                <button
                  type="button"
                  className="favorites-btn favorites-btn--add"
                  onClick={() => {
                    void handleAddToCart(item.formation_slug);
                  }}
                  disabled={
                    workingSlug === item.formation_slug &&
                    workingMode === "cart"
                  }
                >
                  <FaShoppingCart />
                  {workingSlug === item.formation_slug && workingMode === "cart"
                    ? "Ajout..."
                    : "Ajouter"}
                </button>
                <button
                  type="button"
                  className="favorites-btn favorites-btn--remove"
                  aria-label="Retirer des favoris"
                  onClick={() => {
                    void handleRemove(item.formation_slug);
                  }}
                  disabled={
                    workingSlug === item.formation_slug &&
                    workingMode === "remove"
                  }
                >
                  <FaHeartBroken />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
