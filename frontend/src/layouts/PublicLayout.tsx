import { Outlet, useLocation } from "react-router-dom";

import AiChatWidget from "../components/AiChatWidget";
import RouteScrollManager from "../components/RouteScrollManager";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function PublicLayout() {
  const location = useLocation();
  const isDiagnostic = location.pathname === "/diagnostic";
  const isAuthFlow =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";
  const isInvitationFlow = location.pathname.startsWith("/invitation/enseignant/");
  const showPublicAssistant = !isDiagnostic && !isAuthFlow && !isInvitationFlow;

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
      {showPublicAssistant ? (
        <AiChatWidget
          formationTitle="Académie des Créatifs"
          assistantMode="ecommerce_support"
          assistantTitle="Emily Toukam"
          panelSubtitle="Assistante Virtuelle"
          introTitle="Bonjour ! Je suis Emily l'assistante virtuelle de l'Académie des Créatifs."
          introText="Je peux vous orienter sur les formations, les inscriptions, les paiements et l'accès à la plateforme."
          placeholder="Posez une question..."
          dialogLabel="Assistante virtuelle"
          suggestions={[
            "Quelle formation choisir pour debuter ?",
            // "Comment payer en plusieurs fois ?",
            // "Comment acceder aux cours après inscription ?",
          ]}
        />
      ) : null}
    </div>
  );
}
