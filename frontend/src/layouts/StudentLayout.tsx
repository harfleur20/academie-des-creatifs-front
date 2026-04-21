import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FolderOpen,
  GraduationCap,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import NotifBell from "../components/NotifBell";


type NavItem = { to: string; label: string; icon: React.ReactNode; end?: boolean };

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navDashboard: NavItem = {
  to: "/espace/etudiant",
  label: "Vue d'ensemble",
  icon: <LayoutDashboard size={16} />,
  end: true,
};

const navGroups: NavGroup[] = [
  {
    label: "Ma formation",
    items: [
      { to: "/espace/etudiant/formations",  label: "Mes parcours", icon: <BookOpen size={15} /> },
      { to: "/espace/etudiant/cours",       label: "Mes cours",           icon: <GraduationCap size={15} /> },
      { to: "/espace/etudiant/classe",      label: "Ma classe",           icon: <Users size={15} /> },
      { to: "/espace/etudiant/quizz",       label: "Quizz",               icon: <HelpCircle size={15} /> },
      { to: "/espace/etudiant/ressources",  label: "Ressources",          icon: <FolderOpen size={15} /> },
      { to: "/espace/etudiant/devoirs",     label: "Devoirs",             icon: <ClipboardList size={15} /> },
      { to: "/espace/etudiant/resultats",   label: "Mes résultats",       icon: <Award size={15} /> },
    ],
  },
  {
    label: "Mon compte",
    items: [
      { to: "/espace/etudiant/paiements", label: "Mes paiements", icon: <CreditCard size={15} /> },
    ],
  },
];

// All items flat for topbar title lookup
const allNavItems: NavItem[] = [
  navDashboard,
  ...navGroups.flatMap((g) => g.items),
];

const AVATAR_PALETTE = [
  ["#6366f1", "#4f46e5"],
  ["#0ea5e9", "#0284c7"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0d9488"],
];
function avatarGradient(name: string) {
  const i = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_PALETTE.length;
  return `linear-gradient(135deg, ${AVATAR_PALETTE[i][0]}, ${AVATAR_PALETTE[i][1]})`;
}

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navGroups.map((g) => g.label))   // all open by default
  );
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fullName = user?.full_name ?? "Étudiant";
  const initials = fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const gradient = avatarGradient(fullName);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    navigate("/login");
  }

  const currentLabel =
    allNavItems.find(
      (n) => location.pathname === n.to || (!n.end && location.pathname.startsWith(n.to))
    )?.label ?? "Espace Étudiant";

  return (
    <div className="dsh-shell dsh-shell--student">
      {/* ── Sidebar ── */}
      <aside className="dsh-sidebar">
        <div className="dsh-sidebar__logo-block">
          <img src="/logo_academie_hd.png" alt="Académie des Créatifs" />
        </div>

        <div className="dsh-sidebar__role-badge">
          <span>Espace Étudiant</span>
        </div>

        <div className="dsh-sidebar__divider" />

        <nav className="dsh-sidebar__nav">
          {/* Standalone dashboard link */}
          <NavLink
            to={navDashboard.to}
            end={navDashboard.end}
            className={({ isActive }) => `dsh-nav-item${isActive ? " is-active" : ""}`}
          >
            <span className="dsh-nav-item__icon">{navDashboard.icon}</span>
            <span className="dsh-nav-item__label">{navDashboard.label}</span>
          </NavLink>

          {/* Grouped items */}
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            const hasActive = group.items.some(
              (item) => location.pathname === item.to || location.pathname.startsWith(item.to)
            );
            return (
              <div className="dsh-nav-group" key={group.label}>
                <button
                  type="button"
                  className={`dsh-nav-group__header${hasActive ? " has-active" : ""}`}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="dsh-nav-group__label">{group.label}</span>
                  <ChevronDown
                    size={13}
                    className={`dsh-nav-group__caret${isOpen ? " is-open" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="dsh-nav-group__items">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `dsh-nav-item dsh-nav-item--sub${isActive ? " is-active" : ""}`
                        }
                      >
                        <span className="dsh-nav-item__icon">{item.icon}</span>
                        <span className="dsh-nav-item__label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="dsh-sidebar__bottom">
          <div className="dsh-sidebar__user-pill">
            <span className="dsh-sidebar__user-avatar" style={{ background: user?.avatar_url ? "transparent" : gradient }}>
              {user?.avatar_url ? <img src={user.avatar_url} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
            </span>
            <div className="dsh-sidebar__user-info">
              <strong>{fullName}</strong>
              <span>Étudiant</span>
            </div>
          </div>
          <NavLink className="dsh-sidebar__back" to="/">
            <ArrowLeft size={14} />
            Retour au site
          </NavLink>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="dsh-main">
        <header className="dsh-topbar">
          <div className="dsh-topbar__title">{currentLabel}</div>

          {/* Search bar */}
          <label className="dsh-topbar__search">
            <Search size={14} strokeWidth={2} />
            <input type="search" placeholder="Rechercher…" />
          </label>

          <div className="dsh-topbar__right" ref={userMenuRef}>
            {/* Favoris */}
            <Link
              to="/espace/etudiant/favoris"
              className="dsh-topbar__icon-btn"
              aria-label="Mes favoris"
            >
              <Heart size={17} strokeWidth={2} />
            </Link>

            {/* Notifications */}
            <NotifBell allNotifPath="/espace/etudiant/notifications" />
            <button
              type="button"
              className="dsh-topbar__user"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
            >
              <span className="dsh-topbar__avatar" style={{ background: user?.avatar_url ? "transparent" : gradient }}>
                {user?.avatar_url ? <img src={user.avatar_url} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
              </span>
              <div className="dsh-topbar__user-info">
                <strong>{fullName}</strong>
                <span>Étudiant</span>
              </div>
              <ChevronDown size={14} className={`dsh-topbar__caret${userMenuOpen ? " is-open" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="dsh-user-menu">
                <div className="dsh-user-menu__header">
                  <span className="dsh-topbar__avatar dsh-topbar__avatar--lg" style={{ background: user?.avatar_url ? "transparent" : gradient }}>
                    {user?.avatar_url ? <img src={user.avatar_url} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{fullName}</strong>
                    <span className="dsh-user-menu__email">{user?.email ?? ""}</span>
                    <span className="dsh-user-menu__role-badge">Étudiant</span>
                  </div>
                </div>
                <div className="dsh-user-menu__items">
                  <button type="button" className="dsh-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/espace/etudiant/favoris"); }}>
                    <span className="dsh-user-menu__item-icon"><Heart size={15} /></span>
                    Mes favoris
                  </button>
                  <button type="button" className="dsh-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/espace/etudiant/profil"); }}>
                    <span className="dsh-user-menu__item-icon"><Settings size={15} /></span>
                    Paramètres
                  </button>
                  <button type="button" className="dsh-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/espace/etudiant/aide"); }}>
                    <span className="dsh-user-menu__item-icon"><HelpCircle size={15} /></span>
                    Aide & support
                  </button>
                  <div className="dsh-user-menu__divider" />
                  <button type="button" className="dsh-user-menu__item dsh-user-menu__item--danger" onClick={handleLogout}>
                    <span className="dsh-user-menu__item-icon"><LogOut size={15} /></span>
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="dsh-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
