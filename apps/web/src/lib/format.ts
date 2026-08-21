const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}

export function formatCompactINR(amount: number): string {
  if (Math.abs(amount) >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(amount) >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return inrFormatter.format(amount);
}
