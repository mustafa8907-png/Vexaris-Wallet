import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale } from "./locales";
import { translate, type Params } from "./translate";

export { translate, type Params };

/**
 * Her çağrıda etkin dili store'dan okur; bileşen içinde de dışında da
 * kullanılabilir.
 *
 * Mağaza bu modülün ilk bağımlısıdır, böylece modül seviyesindeki sabitler
 * (sekme ve etiket listeleri) içe aktarma anında doğru dille değerlendirilir.
 * Dil değişimi uygulamayı yeniden yükleterek uygulanır.
 *
 * Store kendi varsayılanlarını üretirken `t` değil, dile bağımlı olmayan
 * `translate` kullanılır; aksi halde store henüz tanımlanmamışken okunmaya çalışır.
 */
export function t(text: string, params?: Params): string {
  return translate(useSettingsStore.getState().locale, text, params);
}

/** Sayı ve tarih biçimleri dilin kendi yerelini kullanır. */
export function localeTag(locale: Locale): string {
  return locale === "en" ? "en-US" : "tr-TR";
}
