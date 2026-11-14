import SignClient from "@walletconnect/sign-client";
import type { CoreTypes, SignClientTypes } from "@walletconnect/types";
import { t as $t } from "@/lib/i18n";

const RELAY_URL = "wss://relay.walletconnect.com";

export const WALLET_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export const WALLET_METADATA: SignClientTypes.Metadata = {
  name: "Vexaris Wallet",
  description: "Self-custodial multi-chain wallet",
  url: "https://vexaris.app",
  icons: [],
};

const storage: CoreTypes.Options["storage"] = {
  getItem: async <T>(key: string): Promise<T | undefined> =>
    (window.localStorage.getItem(key) ?? undefined) as T | undefined,
  setItem: async <T>(key: string, value: T): Promise<void> => {
    window.localStorage.setItem(key, String(value));
  },
  removeItem: async (key: string): Promise<void> => {
    window.localStorage.removeItem(key);
  },
  getKeys: async (): Promise<string[]> => Object.keys(window.localStorage),
  getEntries: async <T>(): Promise<[string, T][]> =>
    Object.entries(window.localStorage) as [string, T][],
};

let client: SignClient | null = null;
let opening: Promise<SignClient> | null = null;

export async function getSignClient(): Promise<SignClient> {
  if (client) return client;
  if (!opening) {
    opening = SignClient.init({
      projectId: WALLET_PROJECT_ID,
      relayUrl: RELAY_URL,
      metadata: WALLET_METADATA,
      storage,
    })
      .then((instance) => {
        client = instance;
        opening = null;
        return instance;
      })
      .catch((error: unknown) => {
        opening = null;
        throw error;
      });
  }
  return opening;
}

export function peekSignClient(): SignClient | null {
  return client;
}

export async function openRelay(instance: SignClient): Promise<boolean> {
  try {
    if (!instance.core.relayer.connected) await instance.core.relayer.transportOpen(RELAY_URL);
  } catch (error) {
    console.warn($t("WalletConnect relay bağlantısı kurulamadı"), error);
  }
  return instance.core.relayer.connected;
}

export function normalizePairingUri(value: string): string {
  const uri = value.trim();
  if (!uri.startsWith("wc:")) throw new Error($t("Bağlantı adresi `wc:` ile başlamalı."));
  if (!uri.includes("@") || !/[?&]relay-protocol=/.test(uri)) {
    throw new Error($t("Bağlantı adresi eksik veya bozuk görünüyor."));
  }
  return uri;
}
