import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { localeTag } from "@/lib/i18n";
import { SOURCE_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * Çevirinin sayı ve tarih biçimlerine de yansıması için etkin dil burada
 * tutulur; ayar değiştiğinde `applyLocale` yeniden biçimlendiricileri kurar.
 */
let currentLocale: Locale = SOURCE_LOCALE;

export function applyLocale(locale: Locale) {
  if (locale === currentLocale) return;
  currentLocale = locale;
  formatters.clear();
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/** Tailwind-uyumlu sınıf birleştirici. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Intl biçimlendiricileri önbelleklenir. Liste başına yüzlerce satır × birkaç
 * sayı çizildiğinde her çağrıda yeni biçimlendirici kurmak ölçülebilir maliyet.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let hit = formatters.get(key);
  if (!hit) {
    hit = new Intl.NumberFormat(localeTag(currentLocale), options);
    formatters.set(key, hit);
  }
  return hit;
}

/** 0x1234...abcd tarzı kısa adres gösterimi. */
export function shortAddress(addr: string, size = 4): string {
  if (addr.length <= size * 2 + 3) return addr;
  return `${addr.slice(0, size + 2)}...${addr.slice(-size)}`;
}

/** Decimal string veya sayı → gösterim bakiyesi. */
export function formatAmount(value: number, fractionDigits = 4): string {
  return formatter(`amount:${fractionDigits}`, { maximumFractionDigits: fractionDigits }).format(value);
}

export function formatUsd(value: number): string {
  return formatter("usd:2", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Birim fiyat. Küçük fiyatlarda anlamlı basamak korunur; aksi halde PEPE gibi
 * coinler "$0,00" görünür. Büyük fiyatlarda iki basamak yeter.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const digits = value === 0 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : value >= 0.0001 ? 6 : 10;
  return formatter(`price:${digits}`, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Yüzde değeri: `+2,81` / `-2,81` (Türkçe ondalık ayracı). */
export function formatPercent(value: number, fractionDigits = 2): string {
  return formatter(`percent:${fractionDigits}`, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: "exceptZero",
  }).format(value);
}

/** Büyük tutarlar için kısaltılmış USD: $1,2 Mr. */
export function compactUsd(value?: number): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  return formatter("usd:compact", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Büyük sayılar için kısaltma: 1,2 Mn. */
export function compactNumber(value?: number): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  return formatter("number:compact", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
/**
 * Panoya kopyalar.
 *
 * Yerel `navigator.clipboard` yüzeyi tanımlı olabilir ama güvenli olmayan
 * bağlamda çağrıldığında promise reddederek sessizce patlar; bu yüzden her
 * adımda klasik execCommand yöntemine düşülür.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* güvenli bağlam değil — yedek yönteme geç */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
