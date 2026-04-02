import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaBolt, FaShoppingCart, FaTimes } from "react-icons/fa";

import { scrollToPageSection } from "../utils/scroll";

const navItems = [
  { sectionId: "hero", label: "Accueil" },
  { sectionId: "apropos", label: "À propos" },
  { sectionId: "form-en-ligne", label: "Formation en ligne" },
  { sectionId: "form-en-presentiel", label: "Formation en présentiel" },
  { sectionId: "formateur", label: "Notre équipe" },
  { sectionId: "instant-video", label: "Vidéos" },
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <>
      <div
        className={isMenuOpen ? "menu-overlay active" : "menu-overlay"}
        onClick={closeMenu}
      />

      <header className={isScrolled ? "scrolled" : ""} id="navbar">
        <Link aria-label="Retour à l'accueil" to="/" onClick={closeMenu}>
          <img src="/logo_academie_hd.png" alt="Logo Académie des Créatifs" />
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

            <li>
              <Link className="btn-link cart-btn mobile-cart-btn" to="/panier" onClick={closeMenu}>
                <span className="icon">
                  <FaShoppingCart />
                  Panier
                </span>
              </Link>
            </li>

            <li>
              <Link className="btn-link mobile-btn" to="/login" onClick={closeMenu}>
                <span className="icon">
                  <FaBolt />
                  Se connecter
                </span>
              </Link>
            </li>
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
          </Link>

          <Link className="btn-link desktop-btn" to="/login" onClick={closeMenu}>
            <span className="icon">
              <FaBolt />
              Se connecter
            </span>
          </Link>

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
