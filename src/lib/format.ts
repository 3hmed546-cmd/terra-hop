// Deterministic "EGP 1,100" format. Intl "en-EG" output varies by browser and would risk hydration mismatches.
export function formatPrice(amount: number): string {
  return `EGP ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
