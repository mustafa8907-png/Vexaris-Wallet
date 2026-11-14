import { formatAmount } from "@/lib/utils";

export function tokenAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  const digits = abs >= 10_000 ? 2 : abs >= 100 ? 3 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : abs >= 0.0001 ? 8 : 10;
  return formatAmount(value, digits);
}

export function tokenAmountShort(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return formatAmount(value / 1_000_000, 2) + " Mn";
  return tokenAmount(value);
}

export function etaRange(low: number, high: number, format: (s: number) => string): string {
  const a = format(low);
  const b = format(high);
  return a === b ? a : `${a} – ${b}`;
}