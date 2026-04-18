export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <img
      src="/verification-badge.png"
      alt="Formateur vérifié"
      className="verified-badge"
      style={{ width: size, height: size, flexShrink: 0 }}
      title="Formateur vérifié Académie des Créatifs"
    />
  );
}
