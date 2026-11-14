import type { Holding } from "@/types/chain";
import { getChain } from "@/lib/chains/registry";
import { CHAIN_TOKENS, STABLE_SYMBOLS } from "@/lib/chains/tokens";
import { fetchJson } from "./http";
import {
  coinId,
  llamaCurrentPrices,
  llamaHistoricalPrices,
  percentChange,
  type LlamaPriceMap,
} from "./defillama";


export interface PriceInfo {
  usd: number;
  change24h: number;
  confidence: number;
  source: "defillama" | "coingecko" | "sabit";
}

export type PriceMap = Record<string, PriceInfo>;

export interface PriceTarget {
  coinId: string;
  symbol: string;
  stable?: boolean;
  coingeckoId?: string;
}

export interface PriceSnapshot {
  byCoin: LlamaPriceMap;
  change: Record<string, number>;
  bySymbol: PriceMap;
  updatedAt: number;
}

const CACHE_KEY = "vexaris:prices:v4";
const CACHE_TTL_MS = 45_000;

let memory: { ts: number; snapshot: PriceSnapshot } | null = null;

function loadMemory(): { ts: number; snapshot: PriceSnapshot } | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; snapshot: PriceSnapshot };
    if (!parsed?.snapshot?.byCoin) return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(snapshot: PriceSnapshot) {
  memory = { ts: Date.now(), snapshot };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memory));
  } catch {
  }
}

function knownToken(chainId: string, address?: string) {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return (CHAIN_TOKENS[chainId] ?? []).find((t) => t.address.toLowerCase() === lower);
}

function trustedStable(chainId: string, symbol: string, address?: string): boolean {
  if (!STABLE_SYMBOLS.has(symbol.toUpperCase())) return false;
  return !address || Boolean(knownToken(chainId, address));
}

export function targetsForHoldings(holdings: Holding[]): PriceTarget[] {
  const map = new Map<string, PriceTarget>();
  for (const h of holdings) {
    const chain = getChain(h.chainId);
    const id = coinId(chain, h.address);
    if (!id || map.has(id)) continue;
    map.set(id, {
      coinId: id,
      symbol: h.tokenSymbol,
      stable: trustedStable(h.chainId, h.tokenSymbol, h.address),
      coingeckoId: h.address
        ? knownToken(h.chainId, h.address)?.coingeckoId
        : chain?.coingeckoId,
    });
  }
  return [...map.values()];
}

export async function fetchPrices(
  targets: PriceTarget[],
  force = false,
): Promise<PriceSnapshot> {
  const cached = loadMemory();
  const ids = [...new Set(targets.map((t) => t.coinId))];

  const fresh = cached !== null && Date.now() - cached.ts < CACHE_TTL_MS;
  if (!force && fresh && ids.every((id) => cached.snapshot.byCoin[id])) {
    return cached.snapshot;
  }

  const now = Date.now();
  const [prices, dayAgo] = await Promise.all([
    llamaCurrentPrices(ids).catch(() => ({}) as LlamaPriceMap),
    llamaHistoricalPrices(ids, Math.floor(now / 1000) - 86_400, "1h").catch(
      () => ({}) as LlamaPriceMap,
    ),
  ]);
  const change = percentChange(prices, dayAgo);

  const missing = targets.filter((t) => !prices[t.coinId] && t.coingeckoId);
  if (missing.length > 0) {
    const extra = await fromCoinGecko(missing).catch(() => ({
      prices: {} as LlamaPriceMap,
      change: {} as Record<string, number>,
    }));
    Object.assign(prices, extra.prices);
    Object.assign(change, extra.change);
  }

  const bySymbol: PriceMap = {};
  for (const target of targets) {
    const row = prices[target.coinId];
    if (row) {
      bySymbol[target.symbol] = {
        usd: row.price,
        change24h: change[target.coinId] ?? 0,
        confidence: row.confidence,
        source: row.confidence >= 0.9 ? "defillama" : "coingecko",
      };
    } else if (target.stable) {
      bySymbol[target.symbol] = { usd: 1, change24h: 0, confidence: 1, source: "sabit" };
    }
  }

  const snapshot: PriceSnapshot = {
    byCoin: { ...(cached?.snapshot.byCoin ?? {}), ...prices },
    change: { ...(cached?.snapshot.change ?? {}), ...change },
    bySymbol: { ...(cached?.snapshot.bySymbol ?? {}), ...bySymbol },
    updatedAt: now,
  };

  if (Object.keys(prices).length > 0) writeCache(snapshot);
  return snapshot;
}

export function valueHoldings(holdings: Holding[], snapshot: PriceSnapshot): Holding[] {
  return holdings.map((h) => {
    const id = coinId(getChain(h.chainId), h.address);
    const row = id ? snapshot.byCoin[id] : undefined;
    const stable = trustedStable(h.chainId, h.tokenSymbol, h.address);
    const price = row?.price ?? (stable ? 1 : 0);
    return {
      ...h,
      price,
      usdValue: h.amount * price,
      change24h: id ? snapshot.change[id] ?? 0 : 0,
      confidence: row?.confidence ?? (stable ? 1 : 0),
    };
  });
}

export function usdFor(
  snapshot: PriceSnapshot,
  chainId: string,
  symbol: string,
  amount: number,
  address?: string,
): number {
  const id = coinId(getChain(chainId), address);
  const direct = id ? snapshot.byCoin[id]?.price : undefined;
  if (direct != null) return amount * direct;
  if (address) return trustedStable(chainId, symbol, address) ? amount : 0;
  const bySymbol = snapshot.bySymbol[symbol]?.usd;
  if (bySymbol != null) return amount * bySymbol;
  return STABLE_SYMBOLS.has(symbol.toUpperCase()) ? amount : 0;
}

async function fromCoinGecko(
  targets: PriceTarget[],
): Promise<{ prices: LlamaPriceMap; change: Record<string, number> }> {
  const ids = [...new Set(targets.map((t) => t.coingeckoId).filter(Boolean))] as string[];
  if (ids.length === 0) return { prices: {}, change: {} };

  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}` +
    `&vs_currencies=usd&include_24hr_change=true`;
  const data = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
    url,
    {},
    12_000,
  );

  const prices: LlamaPriceMap = {};
  const change: Record<string, number> = {};
  for (const target of targets) {
    const row = target.coingeckoId ? data[target.coingeckoId] : undefined;
    if (row && typeof row.usd === "number") {
      prices[target.coinId] = {
        price: row.usd,
        symbol: target.symbol,
        timestamp: Date.now(),
        confidence: 0.5,
      };
      if (typeof row.usd_24h_change === "number") change[target.coinId] = row.usd_24h_change;
    }
  }
  return { prices, change };
}
