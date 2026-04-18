export function formatPrice(amount: number, currency = "XAF"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function getFormatLabel(formatType: "live" | "ligne" | "presentiel"): string {
  if (formatType === "ligne") return "Formation en ligne";
  if (formatType === "presentiel") return "Formation en présentiel";
  return "Formation live";
}
