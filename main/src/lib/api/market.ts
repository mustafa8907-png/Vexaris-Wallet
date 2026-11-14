import { fetchJson } from "./http";

/**
 * Coin künyesi ve piyasa istatistikleri — CoinGecko.
 *
 * Fiyat hesabı DefiLlama'dan gelir; buradaki veriler detay sayfasındaki
 * tamamlayıcı istatistiklerdir (piyasa değeri, hacim, arz, ATH/ATL, künye).
 * Sözleşme adresiyle sorgu, listede olmayan tokenları da bulur.
 */

const BASE = "https://api.coingecko.com/api/v3";
const TTL_MS = 5 * 60_000;

/** Uygulama zincir kimliği → CoinGecko platform kimliği. */
export const CG_PLATFORMS: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum-one",
  base: "base",
  polygon: "polygon-pos",
  optimism: "optimistic-ethereum",
  bsc: "binance-smart-chain",
  avalanche: "avalanche",
  scroll: "scroll",
  linea: "linea",
  zksync: "zksync",
  gnosis: "xdai",
  fantom: "fantom",
  blast: "blast",
  mantle: "mantle",
  celo: "celo",
  cronos: "cronos",
  solana: "solana",
};

export interface CoinMeta {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image?: string;
  homepage?: string;
  twitter?: string;
  telegram?: string;
  github?: string;
  explorer?: string;
  categories: string[];
  genesisDate?: string;
  rank?: number;
  marketCap?: number;
  fdv?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number;
  athChangePct?: number;
  athDate?: string;
  atl?: number;
  atlChangePct?: number;
  atlDate?: string;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  change1y?: number;
  sentimentUp?: number;
  watchlists?: number;
  platforms: Record<string, string>;
  updatedAt: number;
}

interface RawCoin {
  id?: string;
  name?: string;
  symbol?: string;
  description?: Record<string, string>;
  image?: { large?: string; small?: string };
  links?: {
    homepage?: string[];
    twitter_screen_name?: string;
    telegram_channel_identifier?: string;
    repos_url?: { github?: string[] };
    blockchain_site?: string[];
  };
  categories?: (string | null)[];
  genesis_date?: string | null;
  market_cap_rank?: number | null;
  sentiment_votes_up_percentage?: number;
  watchlist_portfolio_users?: number;
  platforms?: Record<string, string>;
  market_data?: {
    market_cap?: Record<string, number>;
    fully_diluted_valuation?: Record<string, number>;
    total_volume?: Record<string, number>;
    high_24h?: Record<string, number>;
    low_24h?: Record<string, number>;
    circulating_supply?: number;
    total_supply?: number;
    max_supply?: number;
    ath?: Record<string, number>;
    ath_change_percentage?: Record<string, number>;
    ath_date?: Record<string, string>;
    atl?: Record<string, number>;
    atl_change_percentage?: Record<string, number>;
    atl_date?: Record<string, string>;
    price_change_percentage_1h_in_currency?: Record<string, number>;
    price_change_percentage_24h_in_currency?: Record<string, number>;
    price_change_percentage_7d_in_currency?: Record<string, number>;
    price_change_percentage_30d_in_currency?: Record<string, number>;
    price_change_percentage_1y_in_currency?: Record<string, number>;
  };
}

const cache = new Map<string, { ts: number; meta: CoinMeta | null }>();

export interface CoinLookup {
  chainId: string;
  address?: string;
  coingeckoId?: string;
}

export async function fetchCoinMeta(lookup: CoinLookup): Promise<CoinMeta | null> {
  const platform = CG_PLATFORMS[lookup.chainId];
  const key = lookup.address
    ? `${platform ?? lookup.chainId}:${lookup.address.toLowerCase()}`
    : `id:${lookup.coingeckoId ?? ""}`;
  if (!lookup.address && !lookup.coingeckoId) return null;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.meta;

  const urls: string[] = [];
  if (lookup.address && platform) {
    urls.push(`${BASE}/coins/${platform}/contract/${lookup.address.toLowerCase()}`);
  }
  if (lookup.coingeckoId) {
    urls.push(
      `${BASE}/coins/${lookup.coingeckoId}?localization=false&tickers=false` +
        `&market_data=true&community_data=false&developer_data=false&sparkline=false`,
    );
  }

  let meta: CoinMeta | null = null;
  for (const url of urls) {
    try {
      const raw = await fetchJson<RawCoin>(url, {}, 15_000);
      meta = normalize(raw);
      if (meta) break;
    } catch {
      /* sıradaki kaynak denenir */
    }
  }

  cache.set(key, { ts: Date.now(), meta });
  return meta;
}

function normalize(raw: RawCoin): CoinMeta | null {
  if (!raw?.id) return null;
  const md = raw.market_data ?? {};
  const usd = (row?: Record<string, number>) => {
    const value = row?.usd;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };

  const description = (raw.description?.en ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    symbol: (raw.symbol ?? "").toUpperCase(),
    description,
    image: raw.image?.large ?? raw.image?.small,
    homepage: raw.links?.homepage?.find((u) => Boolean(u)),
    twitter: raw.links?.twitter_screen_name || undefined,
    telegram: raw.links?.telegram_channel_identifier || undefined,
    github: raw.links?.repos_url?.github?.find((u) => Boolean(u)),
    explorer: raw.links?.blockchain_site?.find((u) => Boolean(u)),
    categories: (raw.categories ?? []).filter((c): c is string => Boolean(c)).slice(0, 6),
    genesisDate: raw.genesis_date ?? undefined,
    rank: raw.market_cap_rank ?? undefined,
    marketCap: usd(md.market_cap),
    fdv: usd(md.fully_diluted_valuation),
    volume24h: usd(md.total_volume),
    high24h: usd(md.high_24h),
    low24h: usd(md.low_24h),
    circulatingSupply: md.circulating_supply,
    totalSupply: md.total_supply,
    maxSupply: md.max_supply,
    ath: usd(md.ath),
    athChangePct: usd(md.ath_change_percentage),
    athDate: md.ath_date?.usd,
    atl: usd(md.atl),
    atlChangePct: usd(md.atl_change_percentage),
    atlDate: md.atl_date?.usd,
    change1h: usd(md.price_change_percentage_1h_in_currency),
    change24h: usd(md.price_change_percentage_24h_in_currency),
    change7d: usd(md.price_change_percentage_7d_in_currency),
    change30d: usd(md.price_change_percentage_30d_in_currency),
    change1y: usd(md.price_change_percentage_1y_in_currency),
    sentimentUp: raw.sentiment_votes_up_percentage,
    watchlists: raw.watchlist_portfolio_users,
    platforms: raw.platforms ?? {},
    updatedAt: Date.now(),
  };
}
