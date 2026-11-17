import { fetchJson } from "./http";
import { cacheGet, cacheSet } from "@/lib/db";

const BASE = "https://api.coingecko.com/api/v3";
const LIST_KEY = "coingecko:coins-list";
const LIST_TTL_MS = 24 * 3_600_000;
const MARKETS_TTL_MS = 5 * 60_000;
const MARKETS_GROUP = 250;

export interface CoinListEntry {
  id: string;
  symbol: string;
  name: string;
}

type StoredList = { ts: number; entries: CoinListEntry[] };

let memList: StoredList | null = null;
let listTask: Promise<CoinListEntry[]> | null = null;

export async function coinList(): Promise<CoinListEntry[]> {
  if (memList && Date.now() - memList.ts < LIST_TTL_MS) return memList.entries;
  if (listTask) return listTask;
  listTask = loadList().finally(() => {
    listTask = null;
  });
  return listTask;
}

async function loadList(): Promise<CoinListEntry[]> {
  const stored = await cacheGet<StoredList>(LIST_KEY);
  if (stored && Date.now() - stored.ts < LIST_TTL_MS) {
    memList = stored;
    return stored.entries;
  }
  try {
    const raw = await fetchJson<Partial<CoinListEntry>[]>(`${BASE}/coins/list`, {}, 25_000);
    const entries = raw
      .filter((r): r is CoinListEntry => Boolean(r?.id && r.symbol && r.name))
      .map((r) => ({ id: r.id, symbol: r.symbol.toUpperCase(), name: r.name }));
    if (entries.length === 0) throw new Error("empty list");
    const next: StoredList = { ts: Date.now(), entries };
    memList = next;
    void cacheSet(LIST_KEY, next);
    return entries;
  } catch {
    if (stored) {
      memList = stored;
      return stored.entries;
    }
    return [];
  }
}

export interface CoinMarketRow {
  id: string;
  symbol: string;
  name: string;
  currentPrice?: number;
  marketCap?: number;
  marketCapRank?: number;
  totalVolume?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  change1y?: number;
  ath?: number;
  atl?: number;
  fetchedAt: number;
}

interface RawMarket {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_1y_in_currency?: number;
  ath?: number;
  atl?: number;
}

const marketsCache = new Map<string, { ts: number; rows: Record<string, CoinMarketRow> }>();
const marketsPending = new Map<string, Promise<Record<string, CoinMarketRow>>>();

function groupKey(ids: string[], vs: string): string {
  return `${vs}|${[...ids].sort().join(",")}`;
}

export async function coinMarkets(
  ids: string[],
  vs = "usd",
): Promise<Record<string, CoinMarketRow>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const groups: string[][] = [];
  for (let i = 0; i < unique.length; i += MARKETS_GROUP) groups.push(unique.slice(i, i + MARKETS_GROUP));

  const parts = await Promise.all(groups.map((group) => loadGroup(group, vs)));
  return Object.assign({}, ...parts) as Record<string, CoinMarketRow>;
}

async function loadGroup(ids: string[], vs: string): Promise<Record<string, CoinMarketRow>> {
  const key = groupKey(ids, vs);
  const hit = marketsCache.get(key);
  if (hit && Date.now() - hit.ts < MARKETS_TTL_MS) return hit.rows;
  const pending = marketsPending.get(key);
  if (pending) return pending;

  const task = fetchMarkets(ids, vs)
    .then((rows) => {
      marketsCache.set(key, { ts: Date.now(), rows });
      return rows;
    })
    .catch(() => hit?.rows ?? {})
    .finally(() => marketsPending.delete(key));
  marketsPending.set(key, task);
  return task;
}

async function fetchMarkets(ids: string[], vs: string): Promise<Record<string, CoinMarketRow>> {
  const url =
    `${BASE}/coins/markets?vs_currency=${vs}` +
    `&localization=false&sparkline=false&price_change_percentage=1h%2C24h%2C7d%2C30d%2C1y` +
    `&ids=${ids.join(",")}`;
  const raw = await fetchJson<RawMarket[]>(url, {}, 20_000);
  const out: Record<string, CoinMarketRow> = {};
  const fetchedAt = Date.now();
  for (const row of raw) {
    if (!row?.id) continue;
    out[row.id] = {
      id: row.id,
      symbol: (row.symbol ?? "").toUpperCase(),
      name: row.name ?? row.id,
      currentPrice: row.current_price,
      marketCap: row.market_cap,
      marketCapRank: row.market_cap_rank ?? undefined,
      totalVolume: row.total_volume,
      change1h: row.price_change_percentage_1h_in_currency,
      change24h: row.price_change_percentage_24h_in_currency,
      change7d: row.price_change_percentage_7d_in_currency,
      change30d: row.price_change_percentage_30d_in_currency,
      change1y: row.price_change_percentage_1y_in_currency,
      ath: row.ath,
      atl: row.atl,
      fetchedAt,
    };
  }
  return out;
}
