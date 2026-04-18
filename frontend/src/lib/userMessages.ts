import { ApiRequestError } from "./apiClient";

export type UserActionMessageKey =
  | "auth.login"
  | "auth.register"
  | "cart.add"
  | "cart.remove"
  | "favorites.toggle"
  | "checkout.prepare"
  | "checkout.submit"
  | "share.copy";

const FALLBACK_MESSAGES: Record<UserActionMessageKey, string> = {
  "auth.login": "Connexion impossible pour le moment. Reessayez.",
  "auth.register": "Inscription impossible pour le moment. Reessayez.",
  "cart.add": "Impossible d'ajouter la formation au panier pour le moment.",
  "cart.remove": "Impossible de retirer la formation du panier pour le moment.",
  "favorites.toggle": "Impossible de mettre a jour les favoris pour le moment.",
  "checkout.prepare": "Impossible de preparer le paiement pour le moment.",
  "checkout.submit": "Impossible de finaliser le paiement pour le moment.",
  "share.copy": "Impossible de copier le lien pour le moment.",
};

export const USER_MESSAGES = {
  authRequired: "Connectez-vous pour continuer.",
  cartAdded: "Formation ajoutee au panier.",
  cartRemoved: "Formation retiree du panier.",
  favoriteAdded: "Formation ajoutee aux favoris.",
  favoriteRemoved: "Formation retiree des favoris.",
  loginSuccess: "Connexion reussie.",
  registerSuccess: "Compte cree avec succes.",
  linkCopied: "Lien copie.",
  instagramLinkCopied: "Lien copie pour le partage Instagram.",
} as const;

function isShortDisplayableMessage(message: string): boolean {
  return message.trim().length > 0 && message.trim().length <= 120;
}

export function getUserActionErrorMessage(
  error: unknown,
  action: UserActionMessageKey,
): string {
  const fallback = FALLBACK_MESSAGES[action];

  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      if (
        action === "auth.login" &&
        error.message === "Adresse e-mail ou mot de passe incorrect."
      ) {
        return error.message;
      }

      return USER_MESSAGES.authRequired;
    }

    if (
      (error.status === 400 || error.status === 404 || error.status === 409) &&
      isShortDisplayableMessage(error.message)
    ) {
      return error.message;
    }

    if (error.status === 0) {
      return fallback;
    }

    if (isShortDisplayableMessage(error.message)) {
      return error.message;
    }

    if (error.status >= 500) {
      return fallback;
    }

    return fallback;
  }

  if (error instanceof Error && isShortDisplayableMessage(error.message)) {
    return error.message;
  }

  return fallback;
}
