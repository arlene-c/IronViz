export function formatCompactUsd(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  const num = Number(value ?? 0);
  return `${(num * 100).toFixed(digits)}%`;
}

export function formatSigned(value: number | null | undefined, digits = 4): string {
  const num = Number(value ?? 0);
  return `${num >= 0 ? "+" : ""}${num.toFixed(digits)}`;
}
