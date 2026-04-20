import type { CSSProperties } from "react";
import type { AuthUser } from "../lib/authApi";

type UserAvatarProps = {
  user: Pick<AuthUser, "avatar_initials" | "avatar_url" | "full_name"> | null | undefined;
  className: string;
  photoClassName?: string;
  fallbackStyle?: CSSProperties;
};

function initialsFromName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function UserAvatar({
  user,
  className,
  photoClassName = "user-avatar--photo",
  fallbackStyle,
}: UserAvatarProps) {
  const initials = user?.avatar_initials ?? initialsFromName(user?.full_name ?? "");

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name || initials}
        className={`${className} ${photoClassName}`.trim()}
      />
    );
  }

  return (
    <span className={className} style={fallbackStyle}>
      {initials}
    </span>
  );
}
