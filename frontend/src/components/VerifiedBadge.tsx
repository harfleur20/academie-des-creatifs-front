import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <BadgeCheck
      aria-label="Certification Académie des Créatifs"
      className="verified-badge"
      size={size}
      strokeWidth={2.4}
      title="Certification Académie des Créatifs"
    />
  );
}
