import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaBell,
  FaBolt,
  FaChevronDown,
  FaChevronRight,
  FaRegHeart,
  FaShoppingCart,
  FaTimes,
} from "react-icons/fa";
import {
  LayoutDashboard,
  ShoppingCart,
  Heart,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { useFavorites } from "../favorites/FavoritesContext";
import { useToast } from "../toast/ToastContext";
import { scrollToPageSection } from "../utils/scroll";
import AvatarUpload from "./AvatarUpload";

const HOME_SECTION_ORDER = [
  "hero",
  "hero-counters",
  "apropos",
  "banniere-prog",
  "form-en-ligne",
  "form-en-presentiel",
  "note-info",
  "album",
  "instant-video",
  "temoignage",
  "bg-progres",
] as const;

type SectionNavItem = { label: string; sectionId: string; activeSectionIds?: string[] };
type LinkNavItem    = { label: string; to: string };
type NavItem        = SectionNavItem | LinkNavItem;

const navItems: NavItem[] = [
  { label: "Accueil", sectionId: "hero", activeSectionIds: ["hero"] },
  { label: "A propos", to: "/a-propos" },
  {
    label: "Nos formations",
    sectionId: "form-en-ligne",
    activeSectionIds: ["form-en-ligne", "form-en-presentiel"],
  },
  { label: "Boutique", to: "/boutique" },
  { label: "Notre equipe", to: "/notre-equipe" },
  { label: "Blog", to: "/blog" },
  { label: "Video", sectionId: "instant-video", activeSectionIds: ["instant-video"] },
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeHomeSectionId, setActiveHomeSectionId] = useState<string>("hero");
  const profileRef = useRef<HTMLDivElement | null>(null);
  const { user, logout, refreshUser } = useAuth();
  const { cart } = useCart();
  const { favorites } = useFavorites();
  const { success } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = cart.items.length;
  const favoritesCount = favorites.total_count;

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

  const syncActiveHomeSection = () => {
    if (location.pathname !== "/") {
      return;
    }

    const navbar = document.getElementById("navbar");
    const navbarHeight = navbar?.getBoundingClientRect().height ?? 0;
    const probeY = window.scrollY + navbarHeight + 40;
    let currentSectionId: string = HOME_SECTION_ORDER[0];

    for (const sectionId of HOME_SECTION_ORDER) {
      const section = document.getElementById(sectionId);

      if (!section) {
        continue;
      }

      if (section.offsetTop <= probeY) {
        currentSectionId = sectionId;
        continue;
      }

      break;
    }

    setActiveHomeSectionId(currentSectionId);
  };

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }

    const handleScrollOrResize = () => {
      syncActiveHomeSection();
    };

    const timer = window.setTimeout(syncActiveHomeSection, 60);

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [location.pathname, location.hash]);

  const handleSectionNavigation = (sectionId: string) => {
    const targetHash = sectionId === "hero" ? "" : `#${sectionId}`;

    closeMenu();
    setActiveHomeSectionId(sectionId);

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
    success("Vous etes deconnecte.");
    navigate("/", { replace: true });
  };

  const isNavItemActive = (item: (typeof navItems)[number]) => {
    if ("to" in item) {
      if (item.to === "/formations") {
        return location.pathname === "/formations" || location.pathname.startsWith("/formations/");
      }

      return location.pathname === item.to;
    }

    if (location.pathname !== "/") {
      return false;
    }

    const activeSectionIds = item.activeSectionIds ?? [item.sectionId];
    return activeSectionIds.includes(activeHomeSectionId);
  };

  if (location.pathname === "/diagnostic") return null;

  return (
    <>
      <div
        className={isMenuOpen ? "menu-overlay active" : "menu-overlay"}
        onClick={closeMenu}
      />

      <header className={isScrolled ? "scrolled" : ""} id="navbar">
        <Link className="navbar-brand" aria-label="Retour a l'accueil" to="/" onClick={closeMenu}>
          <img src="/logo_academie_hd.png" alt="Logo Academie des Creatifs" />
        </Link>

        <nav
          aria-label="Navigation principale"
          className={isMenuOpen ? "nav-links active" : "nav-links"}
        >
          <div className="nav-links__panel">
            <div className="nav-links__intro">
              <p className="nav-links__eyebrow">Navigation</p>
              <span>Choisis une rubrique</span>
            </div>

            <ul>
              {navItems.map((item, index) => (
                <li key={item.label}>
                  {"sectionId" in item ? (
                    <button
                      className={isNavItemActive(item) ? "is-active" : ""}
                      type="button"
                      onClick={() => handleSectionNavigation(item.sectionId)}
                    >
                      <span className="nav-links__item-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="nav-links__item-label">{item.label}</span>
                      <span className="nav-links__item-arrow" aria-hidden="true">
                        <FaChevronRight />
                      </span>
                    </button>
                  ) : (
                    <Link
                      className={isNavItemActive(item) ? "is-active" : ""}
                      to={item.to}
                      onClick={closeMenu}
                    >
                      <span className="nav-links__item-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="nav-links__item-label">{item.label}</span>
                      <span className="nav-links__item-arrow" aria-hidden="true">
                        <FaChevronRight />
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <div className="nav-links__footer">
              {user ? (
                <>
                  {user.role !== "guest" && (
                    <Link className="nav-links__action nav-links__action--primary" to={user.dashboard_path} onClick={closeMenu}>
                      Mon espace
                    </Link>
                  )}
                  <button
                    className="nav-links__action nav-links__action--ghost"
                    type="button"
                    onClick={() => void handleLogout()}
                  >
                    Deconnexion
                  </button>
                </>
              ) : (
                <Link className="nav-links__action nav-links__action--primary" to="/login" onClick={closeMenu}>
                  <span className="icon">
                    <FaBolt />
                    Se connecter
                  </span>
                </Link>
              )}
            </div>
          </div>
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
                {favoritesCount > 0 ? (
                  <span className="icon-action-btn__count">{favoritesCount}</span>
                ) : null}
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
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.avatar_initials} className="profile-menu__avatar profile-menu__avatar--photo" />
                  ) : (
                    <span className="profile-menu__avatar">{user.avatar_initials}</span>
                  )}
                  <FaChevronDown />
                </button>

                <div className={isProfileOpen ? "profile-menu__panel is-open" : "profile-menu__panel"}>
                  {/* Profile header with avatar */}
                  <div className="profile-menu__profile">
                    <AvatarUpload
                      currentUrl={user.avatar_url ?? null}
                      initials={user.avatar_initials}
                      onUploaded={() => refreshUser()}
                    />
                    <div className="profile-menu__profile-info">
                      <strong className="profile-menu__name">{user.full_name}</strong>
                      <span className="profile-menu__email">{user.email}</span>
                      <span className={`profile-menu__role-badge profile-menu__role-badge--${user.role}`}>
                        {user.role === "admin" ? "Administrateur" : user.role === "teacher" ? "Enseignant" : user.role === "guest" ? "Invité" : "Étudiant"}
                      </span>
                    </div>
                  </div>

                  <div className="profile-menu__divider" />

                  {user.role !== "guest" && (
                    <Link className="profile-menu__link" to={user.dashboard_path} onClick={() => setIsProfileOpen(false)}>
                      <span className="profile-menu__link-icon"><LayoutDashboard size={15} /></span>
                      {user.role === "admin" ? "Administration" : user.role === "teacher" ? "Espace enseignant" : "Mon espace"}
                    </Link>
                  )}
                  {user.role === "student" && (
                    <Link className="profile-menu__link" to="/panier" onClick={() => setIsProfileOpen(false)}>
                      <span className="profile-menu__link-icon"><ShoppingCart size={15} /></span>
                      Mon panier
                    </Link>
                  )}
                  {user.role === "student" && (
                    <Link className="profile-menu__link" to="/favoris" onClick={() => setIsProfileOpen(false)}>
                      <span className="profile-menu__link-icon"><Heart size={15} /></span>
                      Mes favoris
                    </Link>
                  )}
                  <Link className="profile-menu__link" to="/parametres" onClick={() => setIsProfileOpen(false)}>
                    <span className="profile-menu__link-icon"><Settings size={15} /></span>
                    Paramètres
                  </Link>
                  <Link className="profile-menu__link" to="/aide" onClick={() => setIsProfileOpen(false)}>
                    <span className="profile-menu__link-icon"><HelpCircle size={15} /></span>
                    Aide & support
                  </Link>

                  <div className="profile-menu__divider" />

                  <button className="profile-menu__link profile-menu__link--danger" type="button" onClick={() => void handleLogout()}>
                    <span className="profile-menu__link-icon"><LogOut size={15} /></span>
                    Se déconnecter
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
