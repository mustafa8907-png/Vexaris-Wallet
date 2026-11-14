import type { Locale } from "./locales";
import { EN } from "./en";

export type Params = (string | number)[] | Record<string, string | number>;

/**
 * Kaynak dil Türkçe: arayüzdeki metinler olduğu gibi yazılır, İngilizce
 * seçiliyken sözlükten geçirilir. Sözlükte olmayan metin Türkçe kalır, böylece
 * çevirisi eksik bir satır asla boş görünmez.
 *
 * Dili parametre olarak alır ve store'a dokunmaz; store kendi varsayılan
 * değerlerini üretirken de kullanılabilir.
 */
export function translate(locale: Locale, text: string, params?: Params): string {
  const out = locale === "en" ? (EN[text] ?? text) : text;
  if (!params) return out;
  if (Array.isArray(params)) {
    let i = 0;
    return out.replace(/\{\d+\}/g, () => String(params[i++] ?? ""));
  }
  return out.replace(/\{(\w+)\}/g, (match: string, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
