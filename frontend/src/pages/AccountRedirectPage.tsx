import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export default function AccountRedirectPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <Navigate replace to={user.dashboard_path} />;
}
