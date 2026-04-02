import { Outlet } from "react-router-dom";

import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function PublicLayout() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
