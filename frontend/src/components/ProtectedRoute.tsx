import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../lib/authApi";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Chargement</p>
          <h1>Verification de votre session...</h1>
        </section>
      </div>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate replace to="/login" state={{ from }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "guest") {
      const searchParams = new URLSearchParams(location.search);
      if (
        location.pathname.startsWith("/espace/etudiant")
        && (
          (searchParams.get("source") === "stripe" && searchParams.get("session_id"))
          || searchParams.get("gateway") === "tara"
        )
      ) {
        return <Navigate replace to={`/espace${location.search}${location.hash}`} />;
      }
      return <Navigate replace to="/formations?acces=invite" />;
    }
    return <Navigate replace to={user.dashboard_path} />;
  }

  return <Outlet />;
}
