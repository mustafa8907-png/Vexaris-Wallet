export type Locale = "tr" | "en";

export const LOCALES: Locale[] = ["tr", "en"];

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

export const SOURCE_LOCALE: Locale = "tr";

export const DEFAULT_LOCALE: Locale =
  typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("tr")
    ? "tr"
    : "en";
