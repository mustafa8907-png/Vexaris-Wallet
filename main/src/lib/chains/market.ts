import { t as $t } from "@/lib/i18n";
import { getChain } from "./registry";
import { coinId } from "@/lib/api/defillama";

/**
 * Piyasa listesi — cüzdanda olsun olmasın gösterilen standart coinler.
 *
 * Kullanıcı yalnızca kendi varlıklarını değil, en çok kullanılan coinleri de
 * fiyat ve değişimiyle görür. Sahip olunanlar portföyden eşleştirilir.
 *
 * Fiyat kimliği detay sayfasıyla aynı yoldan (`coinId`) türetilir; böylece
 * listedeki fiyat ile detaydaki fiyat asla ayrışmaz.
 */

export type MarketCategory = "major" | "stable" | "layer2" | "defi" | "meme";

export interface MarketCoin {
  key: string;
  symbol: string;
  name: string;
  /** Kayıttaki zincir kimliği; salt-okunur zincirler de olabilir. */
  chainId: string;
  /** ERC-20 sözleşmesi. Boşsa zincirin yerel coinidir. */
  address?: string;
  coingeckoId: string;
  category: MarketCategory;
}

export const MARKET_CATEGORY_LABELS: Record<MarketCategory | "all", string> = {
  all: $t("Tümü"),
  major: $t("Ana coinler"),
  stable: $t("Stabil"),
  layer2: $t("Katman 2"),
  defi: "DeFi",
  meme: "Meme",
};

export const MARKET_COINS: MarketCoin[] = [
  { key: "btc", symbol: "BTC", name: "Bitcoin", chainId: "bitcoin", coingeckoId: "bitcoin", category: "major" },
  { key: "eth", symbol: "ETH", name: "Ethereum", chainId: "ethereum", coingeckoId: "ethereum", category: "major" },
  { key: "usdt", symbol: "USDT", name: "Tether USD", chainId: "ethereum", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", coingeckoId: "tether", category: "stable" },
  { key: "usdc", symbol: "USDC", name: "USD Coin", chainId: "ethereum", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", coingeckoId: "usd-coin", category: "stable" },
  { key: "bnb", symbol: "BNB", name: "BNB Smart Chain", chainId: "bsc", coingeckoId: "binancecoin", category: "major" },
  { key: "sol", symbol: "SOL", name: "Solana", chainId: "solana", coingeckoId: "solana", category: "major" },
  { key: "xrp", symbol: "XRP", name: "XRP", chainId: "ripple", coingeckoId: "ripple", category: "major" },
  { key: "trx", symbol: "TRX", name: "Tron", chainId: "tron", coingeckoId: "tron", category: "major" },
  { key: "pol", symbol: "POL", name: "Polygon", chainId: "polygon", coingeckoId: "polygon-ecosystem-token", category: "major" },
  { key: "avax", symbol: "AVAX", name: "Avalanche", chainId: "avalanche", coingeckoId: "avalanche-2", category: "major" },
  { key: "ton", symbol: "TON", name: "Ton", chainId: "ton", coingeckoId: "the-open-network", category: "major" },
  { key: "doge", symbol: "DOGE", name: "Dogecoin", chainId: "dogecoin", coingeckoId: "dogecoin", category: "meme" },
  { key: "ltc", symbol: "LTC", name: "Litecoin", chainId: "litecoin", coingeckoId: "litecoin", category: "major" },
  { key: "bch", symbol: "BCH", name: "Bitcoin Cash", chainId: "bitcoincash", coingeckoId: "bitcoin-cash", category: "major" },
  { key: "ada", symbol: "ADA", name: "Cardano", chainId: "cardano", coingeckoId: "cardano", category: "major" },
  { key: "near", symbol: "NEAR", name: "NEAR Protocol", chainId: "near", coingeckoId: "near", category: "major" },
  { key: "apt", symbol: "APT", name: "Aptos", chainId: "aptos", coingeckoId: "aptos", category: "major" },
  { key: "sui", symbol: "SUI", name: "Sui", chainId: "sui", coingeckoId: "sui", category: "major" },
  { key: "xlm", symbol: "XLM", name: "Stellar", chainId: "stellar", coingeckoId: "stellar", category: "major" },
  { key: "s", symbol: "S", name: "Sonic", chainId: "sonic", coingeckoId: "sonic-3", category: "major" },
  { key: "mon", symbol: "MON", name: "Monad", chainId: "monad", coingeckoId: "monad", category: "major" },
  { key: "dai", symbol: "DAI", name: "Dai", chainId: "ethereum", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", coingeckoId: "dai", category: "stable" },
  { key: "link", symbol: "LINK", name: "Chainlink", chainId: "ethereum", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", coingeckoId: "chainlink", category: "defi" },
  { key: "arb", symbol: "ARB", name: "Arbitrum", chainId: "arbitrum", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", coingeckoId: "arbitrum", category: "layer2" },
  { key: "op", symbol: "OP", name: "Optimism", chainId: "optimism", address: "0x4200000000000000000000000000000000000042", coingeckoId: "optimism", category: "layer2" },
  { key: "uni", symbol: "UNI", name: "Uniswap", chainId: "ethereum", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", coingeckoId: "uniswap", category: "defi" },
  { key: "aave", symbol: "AAVE", name: "Aave", chainId: "ethereum", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", coingeckoId: "aave", category: "defi" },
  { key: "ldo", symbol: "LDO", name: "Lido DAO", chainId: "ethereum", address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", coingeckoId: "lido-dao", category: "defi" },
  { key: "shib", symbol: "SHIB", name: "Shiba Inu", chainId: "ethereum", address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", coingeckoId: "shiba-inu", category: "meme" },
  { key: "pepe", symbol: "PEPE", name: "Pepe", chainId: "ethereum", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", coingeckoId: "pepe", category: "meme" },
];

/** Coinin DefiLlama kimliği — detay sayfasıyla birebir aynı. */
export function marketCoinId(coin: MarketCoin): string {
  return coinId(getChain(coin.chainId), coin.address) ?? `coingecko:${coin.coingeckoId}`;
}

/** Coinin detay sayfası yolu. */
export function marketCoinPath(coin: MarketCoin): string {
  return `/token/${coin.chainId}/${coin.address ?? "native"}`;
}

/** Portföyde bu coine denk gelen varlığın anahtarı. */
export function marketHoldingKey(coin: MarketCoin): string {
  return `${coin.chainId}:${coin.address ? coin.address.toLowerCase() : "native"}`;
}