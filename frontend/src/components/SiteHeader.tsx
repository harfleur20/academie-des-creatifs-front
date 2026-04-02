import { NavLink } from "react-router-dom";

import logoAcademie from "../assets/brand/logo-academie-hd.png";

const navItems = [
  { to: "/", label: "Accueil" },
  { to: "/formations", label: "Formations" },
  { to: "/dashboard", label: "Dashboards" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink className="site-brand" to="/">
          <img
            src={logoAcademie}
            alt="Académie des Créatifs"
            className="site-brand__logo"
          />
        </NavLink>

        <nav aria-label="Navigation principale" className="site-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "site-nav__link site-nav__link--active" : "site-nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header__actions">
          <NavLink className="button button--ghost" to="/login">
            Connexion
          </NavLink>
          <NavLink className="button button--primary" to="/register">
            Créer un compte
          </NavLink>
        </div>
      </div>
    </header>
  );
}
