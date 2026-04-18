import { Outlet, useLocation } from "react-router-dom";

import RouteScrollManager from "../components/RouteScrollManager";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function PublicLayout() {
  const location = useLocation();
  const isDiagnostic = location.pathname === "/diagnostic";

  if (isDiagnostic) {
    return <Outlet />;
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="app-main">
        <RouteScrollManager />
        <div className="app-main__transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
