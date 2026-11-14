import { create } from "zustand";
import type { WalletInfo } from "@/types/wallet";
import { walletApi } from "@/lib/tauri/wallet";
import { useSettingsStore } from "@/stores/settingsStore";

interface WalletState {
  wallet: WalletInfo | null;
  unlocked: boolean;
  loading: boolean;
  /** `init` tamamlandı mı — yönlendirme kararları bundan sonra verilir. */
  initialized: boolean;
  error: string | null;

  init: () => Promise<void>;
  createWallet: (name: string, password: string, pin: string) => Promise<void>;
  importWallet: (name: string, mnemonic: string, password: string, pin: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  rename: (name: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>()((set) => ({
  wallet: null,
  unlocked: false,
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    set({ loading: true });
    try {
      const status = await walletApi.status();
      // Keystore varsa onboarding tamamlanmış sayılır. Böylece localStorage
      // temizlense bile kullanıcı yeniden "cüzdan oluştur" ekranına düşmez.
      if (status.exists) {
        useSettingsStore.getState().setSetUp(true);
        if (status.wallet?.name) useSettingsStore.getState().setWalletName(status.wallet.name);
      } else {
        // Keystore silinmiş/taşınmışsa onboarding'e dön; yoksa var olmayan
        // bir cüzdanın kilit ekranı gösterilir.
        useSettingsStore.getState().setSetUp(false);
      }
      set({ wallet: status.wallet, unlocked: status.unlocked, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, initialized: true, error: String(e) });
    }
  },

  createWallet: async (name, password, pin) => {
    set({ loading: true, error: null });
    try {
      const wallet = await walletApi.createWallet(name, password, pin);
      set({ wallet, unlocked: true, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
      throw e;
    }
  },

  importWallet: async (name, mnemonic, password, pin) => {
    set({ loading: true, error: null });
    try {
      const wallet = await walletApi.importWallet(name, mnemonic, password, pin);
      set({ wallet, unlocked: true, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
      throw e;
    }
  },

  unlock: async (password) => {
    set({ error: null });
    try {
      const ok = await walletApi.unlock(password);
      if (ok) set({ unlocked: true });
      return ok;
    } catch (e) {
      set({ error: String(e) });
      return false;
    }
  },

  lock: async () => {
    await walletApi.lock();
    set({ unlocked: false });
  },

  rename: async (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    try {
      const wallet = await walletApi.rename(trimmed);
      set({ wallet });
      useSettingsStore.getState().setWalletName(wallet.name);
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
