import { translate } from "@/lib/i18n/translate";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

export type Theme = "dark" | "light";
export type Currency = "USD" | "EUR" | "TRY";

interface SettingsState {
  theme: Theme;
  currency: Currency;
  locale: Locale;
  walletName: string;
  /** Kullanıcı create/import akışını tamamladı mı (ilk açılış yönlendirmesi için). */
  isSetUp: boolean;
}

interface SettingsActions {
  setTheme: (t: Theme) => void;
  setCurrency: (c: Currency) => void;
  setLocale: (l: Locale) => void;
  setWalletName: (n: string) => void;
  setSetUp: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      theme: "dark",
      currency: "USD",
      locale: DEFAULT_LOCALE,
      walletName: translate(DEFAULT_LOCALE, "Ana Cüzdan"),
      isSetUp: false,
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setLocale: (locale) => set({ locale }),
      setWalletName: (walletName) => set({ walletName }),
      setSetUp: (isSetUp) => set({ isSetUp }),
    }),
    {
      name: "vexaris-settings",
      // Kaldırılan otomatik kilit ayarı eski kayıtlarda durmaya devam edebilir.
      migrate: (state) => {
        const { autoLockMinutes: _drop, ...rest } = state as SettingsState & Record<string, unknown>;
        return rest as SettingsState;
      },
    },
  ),
);
