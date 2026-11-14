import { t as $t } from "@/lib/i18n";

export const FEE_BPS = 35;
export const FEE_PERCENT = FEE_BPS / 100;

export const FEE_RECIPIENT_EVM = "0x683f7Dd4332ead95D9F4ba9a66922Ffca8Cc728e";
export const FEE_RECIPIENT_BTC = "bc1qgmlh8dj34r62hxk2hsq0wvcm2mw0lfus8tkhyd";

export const KYBER_BASE = "https://aggregator-api.kyberswap.com";
export const KYBER_CLIENT_ID = "vexariswallet";
export const INTENTS_BASE = "https://1click.chaindefuser.com";

export const INTENTS_FEE_REQUEST_BPS = FEE_BPS * 2;

export const KYBER_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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

export const INTENTS_TO_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(INTENTS_CHAINS).map(([chain, slug]) => [slug, chain]),
);

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