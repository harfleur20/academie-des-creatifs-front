import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import NotifBell from "../components/NotifBell";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Globe,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Search,
  Settings,
  ShoppingBag,
  UserCog,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

type SubItem = { to: string; label: string };
type NavItem =
  | {
      to: string;
      label: string;
      icon: React.ReactNode;
      end?: boolean;
      children?: never;
    }
  | { to?: never; label: string; icon: React.ReactNode; children: SubItem[] };

const navItems: NavItem[] = [
  {
    to: "/admin",
    label: "Vue d'ensemble",
    icon: <LayoutDashboard size={16} />,
    end: true,
  },
  { to: "/admin/catalogue", label: "Catalogue", icon: <BookOpen size={16} /> },
  {
    to: "/admin/sessions",
    label: "Sessions",
    icon: <CalendarDays size={16} />,
  },
  {
    to: "/admin/enseignants",
    label: "Gestion des enseignants",
    icon: <UserCog size={16} />,
  },
  {
    to: "/admin/etudiants",
    label: "Gestion des étudiants",
    icon: <GraduationCap size={16} />,
  },
  {
    to: "/admin/inscriptions",
    label: "Inscriptions",
    icon: <BadgeCheck size={16} />,
  },
  {
    to: "/admin/commandes",
    label: "Commandes",
    icon: <ShoppingBag size={16} />,
  },
  {
    to: "/admin/paiements",
    label: "Paiements",
    icon: <CreditCard size={16} />,
  },
  {
    to: "/admin/blog",
    label: "Blog",
    icon: <Newspaper size={16} />,
  },
  {
    label: "Paramètres",
    icon: <Globe size={16} />,
    children: [
      { to: "/admin/site/general", label: "Général" },
      { to: "/admin/site/banniere", label: "Bannière" },
      { to: "/admin/site/theme", label: "Thème & couleurs" },
      { to: "/admin/roles", label: "Administrateurs & rôles" },
    ],
  },
];

/* Couleur d'avatar déterministe par initiales */
const AVATAR_PALETTE = [
  ["#4f46e5", "#7c3aed"],
  ["#0ea5e9", "#0284c7"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0d9488"],
];
function avatarGradient(name: string) {
  const i =
    (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_PALETTE.length;
  return `linear-gradient(135deg, ${AVATAR_PALETTE[i][0]}, ${AVATAR_PALETTE[i][1]})`;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [openGroup, setOpenGroup] = useState<string | null>(
    location.pathname.startsWith("/admin/site") ? "Paramètres site" : null,
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fullName = user?.full_name ?? "Administrateur";
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const gradient = avatarGradient(fullName);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    navigate("/login");
  }

  return (
    <div className="adm-shell">
      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar__logo-block">
          <img src="/logo_academie_hd.png" alt="Académie des Créatifs" />
        </div>

        <div className="adm-sidebar__divider" />

        <nav className="adm-sidebar__nav">
          {navItems.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some((c) =>
                location.pathname.startsWith(c.to),
              );
              const isOpen = openGroup === item.label;
              return (
                <div className="adm-nav-group" key={item.label}>
                  <button
                    className={`adm-nav-item adm-nav-item--group${isGroupActive ? " is-active-group" : ""}`}
                    type="button"
                    onClick={() => setOpenGroup(isOpen ? null : item.label)}
                  >
                    <span className="adm-nav-item__icon">{item.icon}</span>
                    <span className="adm-nav-item__label">{item.label}</span>
                    <ChevronDown
                      size={13}
                      className={`adm-nav-item__chevron${isOpen ? " is-open" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="adm-nav-sub">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `adm-nav-sub__item${isActive ? " is-active" : ""}`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `adm-nav-item${isActive ? " is-active" : ""}`
                }
              >
                <span className="adm-nav-item__icon">{item.icon}</span>
                <span className="adm-nav-item__label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="adm-sidebar__bottom">
          <div className="adm-sidebar__user-pill">
            <span
              className="adm-sidebar__user-avatar"
              style={{ background: gradient }}
            >
              {initials}
            </span>
            <div className="adm-sidebar__user-info">
              <strong>{fullName}</strong>
              <span>Admin</span>
            </div>
          </div>
          <NavLink className="adm-sidebar__back" to="/">
            <ArrowLeft size={14} />
            Retour au site
          </NavLink>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <label className="adm-topbar__search">
            <Search size={15} strokeWidth={2} />
            <input type="search" placeholder="Rechercher dans le dashboard…" />
          </label>

          <div className="adm-topbar__right">
            {/* Notification bell */}
            <NotifBell allNotifPath="/admin/notifications" className="adm-topbar__notif-btn" />

            {/* User menu */}
            <div className="adm-topbar__user-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="adm-topbar__user"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
              >
                {/* Avatar with gradient */}
                <span
                  className="adm-topbar__avatar"
                  style={{ background: gradient }}
                >
                  {initials}
                </span>
                <div className="adm-topbar__user-info">
                  <strong>{fullName}</strong>
                  <span>Espace Admin</span>
                </div>
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className={`adm-topbar__caret${userMenuOpen ? " is-open" : ""}`}
                />
              </button>

              {userMenuOpen && (
                <div className="adm-user-menu">
                  {/* Header */}
                  <div className="adm-user-menu__header">
                    <span
                      className="adm-topbar__avatar adm-topbar__avatar--lg"
                      style={{ background: gradient }}
                    >
                      {initials}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong>{fullName}</strong>
                      <span className="adm-user-menu__email">{user?.email ?? ""}</span>
                      <span className="adm-user-menu__role-badge">Administrateur</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="adm-user-menu__items">
                    <button type="button" className="adm-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/admin/profil"); }}>
                      <span className="adm-user-menu__item-icon"><Settings size={15} /></span>
                      Paramètres
                    </button>
                    <button type="button" className="adm-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/admin/aide"); }}>
                      <span className="adm-user-menu__item-icon"><HelpCircle size={15} /></span>
                      Aide & support
                    </button>
                    <div className="adm-user-menu__divider" style={{ margin: "0.25rem 0" }} />
                    <button
                      type="button"
                      className="adm-user-menu__item adm-user-menu__item--danger"
                      onClick={handleLogout}
                    >
                      <span className="adm-user-menu__item-icon"><LogOut size={15} /></span>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
