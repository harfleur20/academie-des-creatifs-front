import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import NotifBell from "../components/NotifBell";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

type NavItem = { to: string; label: string; icon: React.ReactNode; end?: boolean };

const navItems: NavItem[] = [
  { to: "/espace/enseignant",           label: "Vue d'ensemble",  icon: <LayoutDashboard size={16} />, end: true },
  { to: "/espace/enseignant/sessions",  label: "Mes sessions",    icon: <CalendarDays size={16} /> },
  { to: "/espace/enseignant/cours",     label: "Cours",           icon: <GraduationCap size={16} /> },
  { to: "/espace/enseignant/quizz",     label: "Quizz & Examens", icon: <BookOpen size={16} /> },
  { to: "/espace/enseignant/ressources",label: "Ressources",      icon: <FolderOpen size={16} /> },
  { to: "/espace/enseignant/devoirs",   label: "Devoirs",         icon: <ClipboardList size={16} /> },
];

const AVATAR_PALETTE = [
  ["#059669", "#047857"],
  ["#0ea5e9", "#0284c7"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#6366f1", "#4f46e5"],
  ["#14b8a6", "#0d9488"],
];
function avatarGradient(name: string) {
  const i = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_PALETTE.length;
  return `linear-gradient(135deg, ${AVATAR_PALETTE[i][0]}, ${AVATAR_PALETTE[i][1]})`;
}

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fullName = user?.full_name ?? "Enseignant";
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

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    navigate("/login");
  }

  return (
    <div className="dsh-shell dsh-shell--teacher">
      {/* ── Sidebar ── */}
      <aside className="dsh-sidebar">
        <div className="dsh-sidebar__logo-block">
          <img src="/logo_academie_hd.png" alt="Académie des Créatifs" />
        </div>

        <div className="dsh-sidebar__role-badge">
          <span>Espace Enseignant</span>
        </div>

        <div className="dsh-sidebar__divider" />

        <nav className="dsh-sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `dsh-nav-item${isActive ? " is-active" : ""}`}
            >
              <span className="dsh-nav-item__icon">{item.icon}</span>
              <span className="dsh-nav-item__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dsh-sidebar__bottom">
          <div className="dsh-sidebar__user-pill">
            <span className="dsh-sidebar__user-avatar" style={{ background: user?.avatar_url ? "transparent" : gradient }}>
              {user?.avatar_url ? <img src={user.avatar_url} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
            </span>
            <div className="dsh-sidebar__user-info">
              <strong>{fullName}</strong>
              <span>Enseignant</span>
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
          <div className="dsh-topbar__title">
            {navItems.find((n) => location.pathname === n.to || (!n.end && location.pathname.startsWith(n.to)))?.label ?? "Espace Enseignant"}
          </div>

          <div className="dsh-topbar__right" ref={userMenuRef}>
            <NotifBell allNotifPath="/espace/enseignant/notifications" />
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
                <span>Enseignant</span>
              </div>
              <ChevronDown size={14} className={`dsh-topbar__caret${userMenuOpen ? " is-open" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="dsh-user-menu">
                <div className="dsh-user-menu__header">
                  <span className="dsh-topbar__avatar dsh-topbar__avatar--lg" style={{ background: gradient }}>
                    {initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{fullName}</strong>
                    <span className="dsh-user-menu__email">{user?.email ?? ""}</span>
                    <span className="dsh-user-menu__role-badge">Enseignant</span>
                  </div>
                </div>
                <div className="dsh-user-menu__items">
                  <button type="button" className="dsh-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/espace/enseignant/profil"); }}>
                    <span className="dsh-user-menu__item-icon"><Settings size={15} /></span>
                    Paramètres
                  </button>
                  <button type="button" className="dsh-user-menu__item" onClick={() => { setUserMenuOpen(false); navigate("/espace/enseignant/aide"); }}>
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
