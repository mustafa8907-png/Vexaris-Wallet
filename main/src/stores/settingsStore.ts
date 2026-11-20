import { translate } from "@/lib/i18n/translate";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

export type Theme = "dark" | "light" | "system";
export type Currency = "USD" | "EUR" | "TRY";

interface SettingsState {
  theme: Theme;
  radius: number;
  currency: Currency;
  locale: Locale;
  walletName: string;
  isSetUp: boolean;
  hideBalance: boolean;
}

interface SettingsActions {
  setTheme: (t: Theme) => void;
  setRadius: (r: number) => void;
  setCurrency: (c: Currency) => void;
  setLocale: (l: Locale) => void;
  setWalletName: (n: string) => void;
  setSetUp: (v: boolean) => void;
  setHideBalance: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      theme: "dark",
      radius: 16,
      currency: "USD",
      locale: DEFAULT_LOCALE,
      walletName: translate(DEFAULT_LOCALE, "Ana Cüzdan"),
      isSetUp: false,
      hideBalance: false,
      setTheme: (theme) => set({ theme }),
      setRadius: (radius) => set({ radius: Math.max(0, Math.min(999, Math.round(radius))) }),
      setCurrency: (currency) => set({ currency }),
      setLocale: (locale) => set({ locale }),
      setWalletName: (walletName) => set({ walletName }),
      setSetUp: (isSetUp) => set({ isSetUp }),
      setHideBalance: (hideBalance) => set({ hideBalance }),
    }),
    {
      name: "vexaris-settings",
      version: 3,
      migrate: (state, from) => {
        const { autoLockMinutes: _drop, ...rest } = state as SettingsState & Record<string, unknown>;
        if (from < 2 && rest.radius === 999) rest.radius = 16;
        if (from < 3) {
          rest.locale = DEFAULT_LOCALE;
          if (!rest.walletName || rest.walletName === "Ana Cüzdan") {
            rest.walletName = translate(DEFAULT_LOCALE, "Ana Cüzdan");
          }
        }
        return rest as SettingsState;
      },
    },
  ),
);
