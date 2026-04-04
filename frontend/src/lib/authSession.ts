const ACCESS_TOKEN_STORAGE_KEY = "ac_access_token";
const AUTH_SESSION_EVENT = "ac-auth-session-cleared";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
}

export function subscribeToAuthSessionClear(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => {
    listener();
  };

  window.addEventListener(AUTH_SESSION_EVENT, handler);
  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, handler);
  };
}
