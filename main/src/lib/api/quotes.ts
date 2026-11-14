import { MARKET_COINS, marketCoinId, type MarketCoin } from "@/lib/chains/market";
import {
  llamaChart,
  llamaCurrentPrices,
  llamaHistoricalPrices,
  percentChange,
  type LlamaPriceMap,
  type SeriesPoint,
} from "./defillama";


export interface MarketQuote {
  price: number;
  change24h?: number;
  timestamp: number;
  confidence: number;
}

export type MarketQuotes = Record<string, MarketQuote>;
export type MarketSparks = Record<string, SeriesPoint[]>;

const TTL_MS = 60_000;
let cache: { ts: number; quotes: MarketQuotes } | null = null;
let inflight: Promise<MarketQuotes> | null = null;

export function cachedMarketQuotes(): MarketQuotes | null {
  return cache && Date.now() - cache.ts < TTL_MS ? cache.quotes : null;
}

export async function fetchMarketQuotes(force = false): Promise<MarketQuotes> {
  if (!force) {
    const hit = cachedMarketQuotes();
    if (hit) return hit;
    if (inflight) return inflight;
  }

  const task = loadQuotes(MARKET_COINS).finally(() => {
    inflight = null;
  });
  inflight = task;
  return task;
}

async function loadQuotes(coins: MarketCoin[]): Promise<MarketQuotes> {
  const ids = coins.map(marketCoinId);
  const since = Math.floor(Date.now() / 1000) - 86_400;

  const [current, past] = await Promise.all([
    llamaCurrentPrices(ids),
    llamaHistoricalPrices(ids, since, "1h").catch(() => ({}) as LlamaPriceMap),
  ]);
  const change = percentChange(current, past);

  const quotes: MarketQuotes = {};
  for (const coin of coins) {
    const id = marketCoinId(coin);
    const row = current[id];
    if (!row) continue;
    quotes[coin.key] = {
      price: row.price,
      change24h: change[id],
      timestamp: row.timestamp,
      confidence: row.confidence,
    };
  }

  cache = { ts: Date.now(), quotes };
  return quotes;
}

export async function fetchMarketSparks(): Promise<MarketSparks> {
  const byId = await llamaChart(MARKET_COINS.map(marketCoinId), "24h");
  const out: MarketSparks = {};
  for (const coin of MARKET_COINS) {
    const series = byId[marketCoinId(coin)];
    if (series) out[coin.key] = series;
  }
  return out;
}