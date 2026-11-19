import { create } from "zustand";
import type { CredentialKind, WalletInfo, WalletStatus } from "@/types/wallet";
import { walletApi } from "@/lib/tauri/wallet";
import { useSettingsStore } from "@/stores/settingsStore";

interface WalletState {
  wallet: WalletInfo | null;
  wallets: WalletInfo[];
  missingCredential: CredentialKind | null;
  unlocked: boolean;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  init: () => Promise<void>;
  createWallet: (name: string, password: string, pin: string) => Promise<void>;
  addWallet: (name: string) => Promise<WalletInfo>;
  importWallet: (name: string, mnemonic: string, password: string, pin: string) => Promise<void>;
  unlock: (password: string, walletId?: string) => Promise<boolean>;
  lock: () => Promise<void>;
  switchWallet: (walletId: string) => Promise<void>;
  rename: (name: string, walletId?: string) => Promise<void>;
  deleteWallet: (walletId: string, password: string) => Promise<void>;
  addCredential: (secret: string, kind: CredentialKind) => Promise<void>;
}

function fromStatus(status: WalletStatus) {
  return {
    wallet: status.wallet,
    wallets: status.wallets ?? (status.wallet ? [status.wallet] : []),
    missingCredential: status.missingCredential ?? null,
    unlocked: status.unlocked,
  };
}

async function disconnectExternal() {
  try {
    const { useWalletConnectStore } = await import("@/stores/walletConnectStore");
    const wc = useWalletConnectStore.getState();
    if (wc.proposal) await wc.rejectProposal().catch(() => undefined);
    if (wc.request) await wc.rejectRequest().catch(() => undefined);
    for (const session of wc.sessions) {
      try {
        await wc.disconnect(session.topic);
      } catch {}
    }
  } catch {}
  try {
    const { useBrowserStore } = await import("@/stores/browserStore");
    const browser = useBrowserStore.getState();
    for (const origin of Object.keys(browser.connections)) {
      try {
        await browser.disconnect(origin);
      } catch {}
    }
  } catch {}
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  wallet: null,
  wallets: [],
  missingCredential: null,
  unlocked: false,
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    set({ loading: true });
    try {
      const status = await walletApi.status();
      if (status.exists) {
        useSettingsStore.getState().setSetUp(true);
        if (status.wallet?.name) useSettingsStore.getState().setWalletName(status.wallet.name);
      } else {
        useSettingsStore.getState().setSetUp(false);
      }
      set({ ...fromStatus(status), loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, initialized: true, error: String(e) });
    }
  },

  createWallet: async (name, password, pin) => {
    set({ loading: true, error: null });
    try {
      const wallet = await walletApi.createWallet(name, password, pin);
      const status = await walletApi.status().catch(() => null);
      set({
        wallet: status?.wallet ?? wallet,
        wallets: status?.wallets ?? [wallet],
        missingCredential: status?.missingCredential ?? null,
        unlocked: true,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
      throw e;
    }
  },

  addWallet: async (name) => {
    set({ loading: true, error: null });
    try {
      await disconnectExternal();
      const wallet = await walletApi.addWallet(name);
      const status = await walletApi.status().catch(() => null);
      set({
        wallet: status?.wallet ?? wallet,
        wallets: status?.wallets ?? [...get().wallets, wallet],
        missingCredential: status?.missingCredential ?? get().missingCredential,
        unlocked: true,
        loading: false,
      });
      useSettingsStore.getState().setWalletName(wallet.name);
      return wallet;
    } catch (e) {
      set({ loading: false, error: String(e) });
      throw e;
    }
  },

  importWallet: async (name, mnemonic, password, pin) => {
    set({ loading: true, error: null });
    try {
      const wallet = await walletApi.importWallet(name, mnemonic, password, pin);
      const status = await walletApi.status().catch(() => null);
      set({
        wallet: status?.wallet ?? wallet,
        wallets: status?.wallets ?? [wallet],
        missingCredential: status?.missingCredential ?? null,
        unlocked: true,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
      throw e;
    }
  },

  unlock: async (password, walletId) => {
    set({ error: null });
    try {
      const ok = await walletApi.unlock(password, walletId);
      if (!ok) return false;
      const status = await walletApi.status().catch(() => null);
      if (status) set({ ...fromStatus(status), unlocked: true });
      else set({ unlocked: true });
      const active = status?.wallet;
      if (active?.name) useSettingsStore.getState().setWalletName(active.name);
      return true;
    } catch (e) {
      set({ error: String(e) });
      return false;
    }
  },

  lock: async () => {
    await walletApi.lock();
    set({ unlocked: false });
  },

  switchWallet: async (walletId) => {
    await disconnectExternal();
    const wallet = await walletApi.switchWallet(walletId);
    set({
      wallet,
      wallets: get().wallets.map((item) => (item.id === wallet.id ? wallet : item)),
    });
    useSettingsStore.getState().setWalletName(wallet.name);
  },

  rename: async (name, walletId) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    try {
      const wallet = await walletApi.rename(trimmed, walletId);
      set((state) => ({
        wallet: state.wallet?.id === wallet.id ? wallet : state.wallet,
        wallets: state.wallets.map((item) => (item.id === wallet.id ? wallet : item)),
      }));
      if (get().wallet?.id === wallet.id) {
        useSettingsStore.getState().setWalletName(wallet.name);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteWallet: async (walletId, password) => {
    const active = get().wallet?.id === walletId;
    await walletApi.deleteWallet(walletId, password);
    if (active) await disconnectExternal();
    const status = await walletApi.status();
    set(fromStatus(status));
    if (status.wallet?.name) useSettingsStore.getState().setWalletName(status.wallet.name);
  },

  addCredential: async (secret, kind) => {
    const missing = await walletApi.addCredential(secret, kind);
    set({ missingCredential: missing ?? null });
  },
}));
