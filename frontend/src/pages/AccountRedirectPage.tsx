import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { confirmStripeCheckoutSession } from "../lib/commerceApi";
import { getUserActionErrorMessage } from "../lib/userMessages";

export default function AccountRedirectPage() {
  const { user, refreshUser } = useAuth();
  const { refreshCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Redirection vers votre espace...");
  const [detail, setDetail] = useState("");
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    const searchParams = new URLSearchParams(location.search);
    const source = searchParams.get("source");
    const gateway = searchParams.get("gateway");
    const sessionId = searchParams.get("session_id");
    let isCancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const finalizeTaraReturn = async () => {
      setMessage("Vérification de votre paiement Tara Money...");
      setDetail("Nous attendons la confirmation de Tara Money avant d'ouvrir vos acces.");

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const refreshedUser = await refreshUser();
        await refreshCart();

        if (isCancelled) {
          return;
        }

        if (refreshedUser && refreshedUser.role !== "guest") {
          const target =
            refreshedUser.role === "student"
              ? `/espace/etudiant/paiements${location.search}`
              : refreshedUser.dashboard_path;
          navigate(target, {
            replace: true,
            state: {
              checkoutMessage: "Retour Tara Money reçu. Votre commande est en cours de mise à jour.",
            },
          });
          return;
        }

        if (attempt < 5) {
          await wait(2000);
        }
      }

      if (isCancelled) {
        return;
      }

      setMessage("Retour Tara Money reçu.");
      setDetail(
        "La confirmation peut prendre quelques instants. Rechargez cette page dans un moment si vos acces n'apparaissent pas encore.",
      );
    };

    if (source !== "stripe") {
      if (gateway === "tara") {
        void finalizeTaraReturn();
        return () => {
          isCancelled = true;
        };
      }
      navigate(user.dashboard_path, { replace: true });
      return;
    }

    if (!sessionId) {
      navigate(user.dashboard_path, {
        replace: true,
        state: { checkoutMessage: "Retour Stripe incomplet. Impossible de confirmer le paiement." },
      });
      return;
    }

    setMessage("Finalisation de votre paiement Stripe...");

    confirmStripeCheckoutSession(sessionId)
      .then(async (result) => {
        const refreshedUser = await refreshUser();
        await refreshCart();
        navigate(refreshedUser?.dashboard_path ?? user.dashboard_path, {
          replace: true,
          state: { checkoutMessage: result.message },
        });
      })
      .catch(async (error) => {
        try {
          await refreshUser();
          await refreshCart();
        } catch {
          // Ignore refresh errors here and preserve the Stripe confirmation error.
        }
        const nextMessage = getUserActionErrorMessage(error, "checkout.submit");
        navigate(user.role === "guest" ? "/checkout" : user.dashboard_path, {
          replace: true,
          state: { checkoutMessage: nextMessage },
        });
      });
    return () => {
      isCancelled = true;
    };
  }, [location.search, navigate, refreshCart, refreshUser, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="page page--narrow">
      <section className="auth-card auth-card--centered">
        <p className="eyebrow">Paiement</p>
        <h1>Traitement en cours</h1>
        <p>{message}</p>
        {detail && <p>{detail}</p>}
      </section>
    </div>
  );
}
