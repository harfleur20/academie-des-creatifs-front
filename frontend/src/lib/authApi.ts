import { apiRequest, ApiRequestError } from "./apiClient";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./authSession";

export { ApiRequestError } from "./apiClient";

export type UserRole = "admin" | "teacher" | "student";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: string;
  avatar_initials: string;
  dashboard_path: string;
};

export type RegisterPayload = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  remember_me: boolean;
};

type AuthResponse = {
  message: string;
  user: AuthUser;
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
};

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(response.access_token);
  return response.user;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(response.access_token);
  return response.user;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  if (!getAccessToken()) {
    throw new ApiRequestError("Authentification requise.", 401, null);
  }

  const response = await apiRequest<AuthResponse>("/auth/me");
  setAccessToken(response.access_token);
  return response.user;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}
