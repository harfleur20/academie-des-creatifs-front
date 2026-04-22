import type { AuthUser } from "./authApi";

type CommerceUser = Pick<AuthUser, "role"> | null | undefined;

export function canUseCommerce(user: CommerceUser): boolean {
  return user?.role === "student" || user?.role === "guest";
}

export function getPostAuthRedirect(user: Pick<AuthUser, "role" | "dashboard_path">, fallback: string): string {
  if (user.role === "admin" || user.role === "teacher") {
    return user.dashboard_path;
  }

  return fallback;
}
