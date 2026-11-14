export type Locale = "tr" | "en";

export const LOCALES: Locale[] = ["tr", "en"];

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

/**
 * Kaynak dil Türkçe: arayüzdeki metinler Türkçe yazılır, İngilizce için
 * sözlükten çevrilir. Sözlükte olmayan metin Türkçe kalır.
 */
export const SOURCE_LOCALE: Locale = "tr";

/** Sistem dili Türkçe değilse uygulama İngilizce ile açılır. */
export const DEFAULT_LOCALE: Locale =
  typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("tr")
    ? "tr"
    : "en";
