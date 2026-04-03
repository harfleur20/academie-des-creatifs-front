import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaBell,
  FaBolt,
  FaChevronDown,
  FaRegHeart,
  FaShoppingCart,
  FaTimes,
} from "react-icons/fa";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { scrollToPageSection } from "../utils/scroll";

const navItems = [
  { sectionId: "hero", label: "Accueil" },
  { sectionId: "apropos", label: "A propos" },
  { sectionId: "form-en-ligne", label: "Formation en ligne" },
  { sectionId: "form-en-presentiel", label: "Formation en presentiel" },
  { sectionId: "formateur", label: "Notre equipe" },
  { sectionId: "instant-video", label: "Videos" },
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = cart.items.length;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", isMenuOpen);

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  const handleSectionNavigation = (sectionId: string) => {
    const targetHash = sectionId === "hero" ? "" : `#${sectionId}`;

    closeMenu();

    if (location.pathname === "/") {
      if (location.hash !== targetHash) {
        navigate(targetHash ? `/${targetHash}` : "/");
      }

      window.setTimeout(() => {
        scrollToPageSection(sectionId, "smooth");
      }, 24);

      return;
    }

    navigate(targetHash ? `/${targetHash}` : "/");
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      <div
        className={isMenuOpen ? "menu-overlay active" : "menu-overlay"}
        onClick={closeMenu}
      />

      <header className={isScrolled ? "scrolled" : ""} id="navbar">
        <Link aria-label="Retour a l'accueil" to="/" onClick={closeMenu}>
          <img src="/logo_academie_hd.png" alt="Logo Academie des Creatifs" />
        </Link>

        <nav
          aria-label="Navigation principale"
          className={isMenuOpen ? "nav-links active" : "nav-links"}
        >
          <ul>
            {navItems.map((item) => (
              <li key={item.sectionId}>
                <button
                  type="button"
                  onClick={() => handleSectionNavigation(item.sectionId)}
                >
                  {item.label}
                </button>
              </li>
            ))}

            {user ? (
              <>
                <li>
                  <Link
                    className="mobile-profile-link nav-links__mobile-only"
                    to={user.dashboard_path}
                    onClick={closeMenu}
                  >
                    Mon espace
                  </Link>
                </li>
                <li className="nav-links__mobile-only">
                  <button type="button" onClick={() => void handleLogout()}>
                    Deconnexion
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link className="btn-link mobile-btn" to="/login" onClick={closeMenu}>
                  <span className="icon">
                    <FaBolt />
                    Se connecter
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="header-actions">
          <Link
            aria-label="Voir le panier"
            className="btn-link cart-btn"
            to="/panier"
            onClick={closeMenu}
          >
            <span className="icon">
              <FaShoppingCart />
            </span>
            {user && cartCount > 0 ? (
              <span className="cart-btn__count">{cartCount}</span>
            ) : null}
          </Link>

          {user ? (
            <>
              <Link aria-label="Voir les favoris" className="icon-action-btn" to="/favoris">
                <FaRegHeart />
              </Link>
              <Link aria-label="Voir les notifications" className="icon-action-btn" to="/notifications">
                <FaBell />
              </Link>

              <div className="profile-menu" ref={profileRef}>
                <button
                  aria-expanded={isProfileOpen}
                  className="profile-menu__trigger"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  type="button"
                >
                  <span className="profile-menu__avatar">{user.avatar_initials}</span>
                  <FaChevronDown />
                </button>

                <div className={isProfileOpen ? "profile-menu__panel is-open" : "profile-menu__panel"}>
                  <div className="profile-menu__summary">
                    <strong>{user.full_name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <Link className="profile-menu__link" to={user.dashboard_path} onClick={() => setIsProfileOpen(false)}>
                    {user.role === "admin"
                      ? "Administration"
                      : user.role === "teacher"
                        ? "Espace enseignant"
                        : "Mon espace"}
                  </Link>
                  <Link className="profile-menu__link" to="/panier" onClick={() => setIsProfileOpen(false)}>
                    Mon panier
                  </Link>
                  <button className="profile-menu__link profile-menu__link--button" type="button" onClick={() => void handleLogout()}>
                    Deconnexion
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Link className="btn-link desktop-btn" to="/login" onClick={closeMenu}>
              <span className="icon">
                <FaBolt />
                Se connecter
              </span>
            </Link>
          )}

          <button
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className={isMenuOpen ? "menu-toggle active" : "menu-toggle"}
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <FaBars className="menu-icon-open" />
            <FaTimes className="close-icon" />
          </button>
        </div>
      </header>
    </>
  );
}
