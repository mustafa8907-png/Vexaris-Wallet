import { fetchJson } from "./http";
import { cacheGet, cacheSet } from "@/lib/db";
import type { SeriesPoint } from "./defillama";

const API = "https://api.llama.fi";
const PROTOCOLS_KEY = "llama:protocols";
const PROTOCOLS_TTL_MS = 24 * 3_600_000;

export interface LlamaProtocol {
  slug: string;
  name: string;
  tvl: number;
  category?: string;
  chains: string[];
  audits: number;
  url?: string;
  description?: string;
}

type ProtocolIndex = Record<string, LlamaProtocol>;
type StoredProtocols = { ts: number; index: ProtocolIndex };

let memIndex: StoredProtocols | null = null;
let indexTask: Promise<ProtocolIndex> | null = null;

interface RawProtocol {
  slug?: string;
  name?: string;
  tvl?: number;
  category?: string;
  chains?: string[];
  audit_links?: unknown[];
  url?: string;
  description?: string;
  gecko_id?: string | number | null;
}

export async function llamaProtocolIndex(): Promise<ProtocolIndex> {
  if (memIndex && Date.now() - memIndex.ts < PROTOCOLS_TTL_MS) return memIndex.index;
  if (indexTask) return indexTask;
  indexTask = loadProtocols().finally(() => {
    indexTask = null;
  });
  return indexTask;
}

async function loadProtocols(): Promise<ProtocolIndex> {
  const stored = await cacheGet<StoredProtocols>(PROTOCOLS_KEY);
  if (stored && Date.now() - stored.ts < PROTOCOLS_TTL_MS) {
    memIndex = stored;
    return stored.index;
  }
  try {
    const raw = await fetchJson<RawProtocol[]>(`${API}/protocols`, {}, 25_000);
    const index: ProtocolIndex = {};
    for (const row of raw) {
      if (!row?.slug) continue;
      const geckoId = typeof row.gecko_id === "string" ? row.gecko_id : undefined;
      if (!geckoId || index[geckoId]) continue;
      index[geckoId] = {
        slug: row.slug,
        name: row.name ?? row.slug,
        tvl: typeof row.tvl === "number" ? row.tvl : 0,
        category: row.category,
        chains: row.chains ?? [],
        audits: Array.isArray(row.audit_links) ? row.audit_links.length : 0,
        url: row.url,
        description: row.description,
      };
    }
    if (Object.keys(index).length === 0) throw new Error("empty index");
    const next: StoredProtocols = { ts: Date.now(), index };
    memIndex = next;
    void cacheSet(PROTOCOLS_KEY, next);
    return index;
  } catch {
    if (stored) {
      memIndex = stored;
      return stored.index;
    }
    return {};
  }
}

export async function findProtocolByGeckoId(geckoId?: string): Promise<LlamaProtocol | null> {
  if (!geckoId) return null;
  const index = await llamaProtocolIndex();
  return index[geckoId] ?? null;
}

export interface RangeStats {
  high: number;
  low: number;
  avg: number;
  volatility: number;
}

export function llamaRangeStats(series: SeriesPoint[]): RangeStats | null {
  const values = series.map((p) => p.v).filter((v) => Number.isFinite(v) && v > 0);
  if (values.length < 2) return null;

  let high = values[0];
  let low = values[0];
  let sum = 0;
  for (const v of values) {
    if (v > high) high = v;
    if (v < low) low = v;
    sum += v;
  }
  const avg = sum / values.length;

  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const before = values[i - 1];
    if (before > 0) returns.push(values[i] / before - 1);
  }
  let volatility = 0;
  if (returns.length > 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
    volatility = Math.sqrt(variance) * 100;
  }

  return { high, low, avg, volatility };
}
