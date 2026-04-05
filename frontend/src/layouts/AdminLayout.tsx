import { Link, Outlet, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChartPie,
  FaCreditCard,
  FaFolderOpen,
  FaSearch,
  FaShoppingBag,
  FaUsers,
} from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";

const adminSections = [
  { href: "#admin-overview", label: "Vue d'ensemble", icon: <FaChartPie /> },
  { href: "#admin-catalogue", label: "Catalogue", icon: <FaFolderOpen /> },
  { href: "#admin-sessions", label: "Sessions", icon: <FaCalendarAlt /> },
  { href: "#admin-users", label: "Utilisateurs", icon: <FaUsers /> },
  { href: "#admin-orders", label: "Commandes", icon: <FaShoppingBag /> },
  { href: "#admin-payments", label: "Paiements", icon: <FaCreditCard /> },
];

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AD";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-sidebar__brand" to="/admin">
          <img src="/logo_academie_hd.png" alt="Académie des Créatifs" />
          <div>
            <strong>Admin dashboard</strong>
            <span>e-commerce & pilotage</span>
          </div>
        </Link>

        <nav className="admin-sidebar__nav" aria-label="Navigation admin">
          {adminSections.map((item) => (
            <a
              className={
                location.pathname.startsWith("/admin") &&
                (location.hash === item.href ||
                  (!location.hash && item.href === "#admin-overview"))
                  ? "admin-sidebar__link is-active"
                  : "admin-sidebar__link"
              }
              href={item.href}
              key={item.href}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <Link className="admin-sidebar__back" to="/">
          <FaArrowLeft />
          Retour au site
        </Link>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <label className="admin-topbar__search" aria-label="Recherche admin">
            <FaSearch />
            <input
              type="search"
              placeholder="Rechercher une formation, une session, un client..."
            />
          </label>

          <div className="admin-topbar__meta">
            <div className="admin-topbar__meta-copy">
              <strong>Back-office Academie des Creatifs</strong>
              <span>Catalogue, paiements, sessions et utilisateurs</span>
            </div>

            <div className="admin-topbar__user">
              <span className="admin-topbar__avatar">{initials}</span>
              <div>
                <strong>{user?.full_name ?? "Administrateur"}</strong>
                <span>{user?.role ?? "admin"}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
