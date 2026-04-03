import { Link, Outlet, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChartPie,
  FaCreditCard,
  FaFolderOpen,
  FaShoppingBag,
  FaUsers,
} from "react-icons/fa";

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

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
