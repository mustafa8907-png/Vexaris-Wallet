import { t as $t } from "@/lib/i18n";
/**
 * Takas motoru sabitleri.
 *
 * Komisyon her iki motorda da çıkış varlığından kesilir ve doğrudan Vexaris
 * adresine gider; uygulama hiçbir zaman kullanıcı fonuna aracılık etmez.
 */

/** Uygulama komisyonu — baz puan (1 bp = %0,01). */
export const FEE_BPS = 35;
export const FEE_PERCENT = FEE_BPS / 100;

/** EVM ve EVM dışı (Solana, Tron, TON…) hedefler için komisyon adresi. */
export const FEE_RECIPIENT_EVM = "0x683f7Dd4332ead95D9F4ba9a66922Ffca8Cc728e";
/** Bitcoin hedefli takaslarda komisyonun düşeceği adres. */
export const FEE_RECIPIENT_BTC = "bc1qgmlh8dj34r62hxk2hsq0wvcm2mw0lfus8tkhyd";

export const KYBER_BASE = "https://aggregator-api.kyberswap.com";
export const KYBER_CLIENT_ID = "vexariswallet";
export const INTENTS_BASE = "https://1click.chaindefuser.com";

/**
 * 1Click, JWT'siz isteklerde gönderilen komisyonu ikiye bölüp kendi payını
 * ekler. Bizim adresimize net 35 bp düşmesi için 70 bp istenir; ekranda
 * gösterilen değer daima API'nin döndürdüğü gerçek paydır.
 */
export const INTENTS_FEE_REQUEST_BPS = FEE_BPS * 2;

/** Kyber'in yerel coin için kullandığı sözleşme adresi. */
export const KYBER_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** Kayıt kimliği → Kyber yol adı. Yalnızca desteklenen ağlar listelenir. */
export const KYBER_CHAINS: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  base: "base",
  polygon: "polygon",
  optimism: "optimism",
  bsc: "bsc",
  avalanche: "avalanche",
  linea: "linea",
  sonic: "sonic",
  monad: "monad",
  arc: "arc",
  unichain: "unichain",
};

/** Kayıt kimliği → 1Click `blockchain` alanı. */
export const INTENTS_CHAINS: Record<string, string> = {
  ethereum: "eth",
  arbitrum: "arb",
  base: "base",
  polygon: "pol",
  optimism: "op",
  bsc: "bsc",
  avalanche: "avax",
  gnosis: "gnosis",
  scroll: "scroll",
  solana: "sol",
  bitcoin: "btc",
  litecoin: "ltc",
  bitcoincash: "bch",
  dogecoin: "doge",
  near: "near",
  aptos: "aptos",
  sui: "sui",
  cardano: "cardano",
  stellar: "stellar",
  tron: "tron",
  ton: "ton",
  ripple: "xrp",
};

/** 1Click zincir adı → kayıt kimliği (token listesini eşlemek için). */
export const INTENTS_TO_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(INTENTS_CHAINS).map(([chain, slug]) => [slug, chain]),
);

/** Ortalama blok süresi (saniye) — EVM takaslarının hız tahmini. */
export const BLOCK_SECONDS: Record<string, number> = {
  ethereum: 12,
  arbitrum: 1,
  base: 2,
  polygon: 2,
  optimism: 2,
  bsc: 3,
  avalanche: 2,
  linea: 3,
  sonic: 1,
  monad: 1,
  arc: 1,
  unichain: 1,
};

export const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 3] as const;
export const DEADLINE_PRESETS = [10, 20, 30, 60] as const;

/** Kotasyonun geçerlilik süresi; sayaç sıfırlanınca yeniden istenir. */
export const QUOTE_TTL_MS = 25_000;

export type EngineId = "kyber" | "intents";

export const ENGINE_META: Record<
  EngineId,
  { name: string; short: string; tint: string; text: string; ring: string; blurb: string }
> = {
  kyber: {
    name: "KyberSwap Aggregator",
    short: "KyberSwap",
    tint: "bg-teal/[0.10]",
    text: "text-teal",
    ring: "border-teal/30",
    blurb: $t("Aynı ağda 100+ DEX'ten en iyi rota"),
  },
  intents: {
    name: "NEAR Intents · 1Click",
    short: "NEAR Intents",
    tint: "bg-violet/[0.10]",
    text: "text-violet",
    ring: "border-violet/30",
    blurb: $t("Zincirler arası ve BTC takası"),
  },
};