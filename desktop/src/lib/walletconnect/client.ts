/**
 * WalletConnect v2 (Reown) istemci.
 *
 * Vexaris burada *cüzdan* tarafıdır: AppKit kullanılmaz, doğrudan
 * `sign-client` çalışır. Relay'e WS el sıkışması SDK'nın imzaladığı
 * `auth=<jwt>` parametresiyle geçer; bu yüzden ham fetch denemeleri
 * anlamsızdır — tek yol bu istemci.
 */
import SignClient from "@walletconnect/sign-client";
import type { CoreTypes, SignClientTypes } from "@walletconnect/types";
import { t as $t } from "@/lib/i18n";

const RELAY_URL = "wss://relay.walletconnect.com";

/**
 * Reown Proje kimliği. `.env`'de durur (`VITE_WALLETCONNECT_PROJECT_ID`);
 * build sırasında pakete gömülür, çünkü relay el sıkışması bu kimlikle
 * imzalanır. Panelde Android uygulama kimliği `com.vexaris.wallet` olarak
 * whitelist'e eklendi.
 */
export const WALLET_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

/** dApp ekranlarında görünen kimlik bilgileri. */
export const WALLET_METADATA: SignClientTypes.Metadata = {
  name: "Vexaris Wallet",
  description: "Self-custodial multi-chain wallet",
  url: "https://vexaris.app",
  icons: [],
};

/**
 * Çekirdeğin depolama sözleşmesi: bulunmayan anahtar `null` değil
 * `undefined` dönmeli, yoksa anahtar deposu yüklenirken patlıyor.
 */
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

/** İstemci tek örnektir; tekrar tekrar kurulursa relay çift oturum açar. */
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

/** Kurulumu beklemek istemeyen yollar (olay temizliği vb.) için. */
export function peekSignClient(): SignClient | null {
  return client;
}

/**
 * Relay soketini açar ve açık olup olmadığını döner.
 *
 * `SignClient.init` soketi AÇMIYOR (ölçüldü: `connected` yanlış kalıyor, hiçbir
 * relay olayı gelmiyor); soket ancak ilk protokolsel işlemde tembel açılıyor.
 * Uygulama yeniden başlatıldığında bekleyen dApp taleplerini yakalamak için
 * bağlantıyı baştan kurmak gerekiyor. Tip sözleşmesinde `connect()` yok;
 * aynı işi yapan tipli çağrı `transportOpen`.
 */
export async function openRelay(instance: SignClient): Promise<boolean> {
  try {
    if (!instance.core.relayer.connected) await instance.core.relayer.transportOpen(RELAY_URL);
  } catch (error) {
    console.warn($t("WalletConnect relay bağlantısı kurulamadı"), error);
  }
  return instance.core.relayer.connected;
}

/** Yapıştırılan/okutulan metni pairing URI'si olarak doğrular. */
export function normalizePairingUri(value: string): string {
  const uri = value.trim();
  if (!uri.startsWith("wc:")) throw new Error($t("Bağlantı adresi `wc:` ile başlamalı."));
  if (!uri.includes("@") || !/[?&]relay-protocol=/.test(uri)) {
    throw new Error($t("Bağlantı adresi eksik veya bozuk görünüyor."));
  }
  return uri;
}
