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
  avatar_url: string | null;
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

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function uploadAvatar(file: File): Promise<string> {
  const res = await apiRequest<{ avatar_url: string }>(`/me/avatar?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return res.avatar_url;
}

export type UpdateProfilePayload = {
  full_name: string;
  phone?: string | null;
};

export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  const updated = await apiRequest<{ id: number; full_name: string; email: string; phone: string | null }>(
    "/me/profile",
    { method: "PATCH", body: JSON.stringify(payload) }
  );
  const current = await fetchCurrentUser();
  return { ...current, full_name: updated.full_name, phone: updated.phone };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest<void>("/me/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}
