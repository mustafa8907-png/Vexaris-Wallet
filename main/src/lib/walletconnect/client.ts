import SignClient from "@walletconnect/sign-client";
import type { CoreTypes, SignClientTypes } from "@walletconnect/types";
import { t as $t } from "@/lib/i18n";

const RELAY_URL = "wss://relay.walletconnect.com";

const projectId = String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();

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

export function walletProjectId(): string {
  return projectId;
}

export function hasProjectId(): boolean {
  return /^[a-f0-9]{32}$/i.test(projectId);
}

export function resetSignClient() {
  client = null;
  opening = null;
}

export async function getSignClient(): Promise<SignClient> {
  if (client) return client;
  if (!opening) {
    if (!hasProjectId()) {
      throw new Error($t("WalletConnect proje kimliği yapılandırılmamış."));
    }
    opening = SignClient.init({
      projectId,
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
  if (instance.core.relayer.connected) return true;
  try {
    await instance.core.relayer.transportOpen();
  } catch {
    return false;
  }
  return instance.core.relayer.connected || !instance.core.relayer.subscriber.hasAnyTopics;
}

export function normalizePairingUri(value: string): string {
  const uri = value.trim();
  if (!uri.startsWith("wc:")) throw new Error($t("Bağlantı adresi `wc:` ile başlamalı."));
  if (!uri.includes("@") || !/[?&]relay-protocol=/.test(uri)) {
    throw new Error($t("Bağlantı adresi eksik veya bozuk görünüyor."));
  }
  return uri;
}
