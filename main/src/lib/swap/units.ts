
export function parseUnits(value: string, decimals: number): bigint {
  const clean = value.trim().replace(",", ".");
  if (!clean || !/^\d*(\.\d*)?$/.test(clean)) return 0n;
  const [whole = "0", frac = ""] = clean.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole || "0") + padded);
}

export function formatUnits(value: bigint, decimals: number, maxFrac = decimals): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFrac);
  frac = frac.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function unitsToNumber(value: bigint, decimals: number): number {
  const n = Number(formatUnits(value, decimals, Math.min(decimals, 12)));
  return Number.isFinite(n) ? n : 0;
}

export function takeBps(value: bigint, bps: number): bigint {
  return (value * BigInt(Math.round(bps))) / 10_000n;
}

export function applySlippage(value: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * 100));
  return (value * (10_000n - bps)) / 10_000n;
}

export function sanitizeAmount(raw: string, decimals: number): string {
  let s = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const first = s.indexOf(".");
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, "");
  const [whole, frac] = s.split(".");
  if (frac === undefined) return whole.slice(0, 30);
  return `${whole.slice(0, 30)}.${frac.slice(0, decimals)}`;
}

export function plainNumber(value: number, maxFrac = 8): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(maxFrac);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}