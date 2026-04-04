import { clearAccessToken, getAccessToken } from "./authSession";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export class ApiRequestError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

function getResponseErrorMessage(status: number, detail: unknown): string {
  if (
    typeof detail === "object" &&
    detail !== null &&
    "detail" in detail &&
    typeof detail.detail === "string"
  ) {
    return detail.detail;
  }

  if (status >= 500) {
    return "Service indisponible pour le moment. Reessayez.";
  }

  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail.trim();
  }

  if (status === 404) {
    return "La ressource demandee est introuvable.";
  }

  if (status === 403) {
    return "Vous n'avez pas l'autorisation d'effectuer cette action.";
  }

  if (status === 400) {
    return "La requete est invalide. Verifiez les informations saisies.";
  }

  return `HTTP ${status}`;
}

export async function apiRequest<T>(
  path: string,
  init?: ApiRequestOptions,
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const token = getAccessToken();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const parentSignal = init?.signal;
  let didTimeout = false;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  const abortFromParentSignal = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", abortFromParentSignal, { once: true });
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      let detail: unknown = null;

      try {
        detail = await response.json();
      } catch {
        detail = await response.text();
      }

      if (response.status === 401) {
        clearAccessToken();
      }

      throw new ApiRequestError(
        getResponseErrorMessage(response.status, detail),
        response.status,
        detail,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }

    if (didTimeout) {
      throw new ApiRequestError(
        "Connexion impossible pour le moment. Reessayez.",
        0,
        { reason: "timeout" },
      );
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        "Connexion interrompue. Reessayez.",
        0,
        { reason: "aborted" },
      );
    }

    throw new ApiRequestError(
      "Connexion impossible pour le moment. Reessayez.",
      0,
      error,
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", abortFromParentSignal);
    }
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
