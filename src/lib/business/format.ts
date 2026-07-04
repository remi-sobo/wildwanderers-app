// Client-safe money formatting for the business surfaces. Cents in, USD out.
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
