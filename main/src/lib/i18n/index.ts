import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale } from "./locales";
import { translate, type Params } from "./translate";

export { translate, type Params };

export function t(text: string, params?: Params): string {
  return translate(useSettingsStore.getState().locale, text, params);
}

export function localeTag(locale: Locale): string {
  return locale === "en" ? "en-US" : "tr-TR";
}
