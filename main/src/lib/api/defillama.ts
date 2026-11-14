import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import { toChecksumAddress } from "@/lib/crypto/keccak";
import { fetchJson } from "./http";


const BASE = "https://coins.llama.fi";
const CHUNK = 40;

export interface LlamaPrice {
  price: number;
  symbol: string;
  decimals?: number;
  timestamp: number;
  confidence: number;
}

export type LlamaPriceMap = Record<string, LlamaPrice>;

export interface SeriesPoint {
  t: number;
  v: number;
}

export type ChartRange = "1h" | "24h" | "7d" | "30d" | "90d" | "1y";

export const RANGE_PARAMS: Record<
  ChartRange,
  { span: number; period: string; search: string }
> = {
  "1h": { span: 60, period: "1m", search: "10m" },
  "24h": { span: 96, period: "15m", search: "1h" },
  "7d": { span: 168, period: "1h", search: "4h" },
  "30d": { span: 180, period: "4h", search: "12h" },
  "90d": { span: 180, period: "12h", search: "2d" },
  "1y": { span: 365, period: "1d", search: "7d" },
};

export const RANGE_LABELS: Record<ChartRange, string> = {
  "1h": $t("1 saat"),
  "24h": $t("24 saat"),
  "7d": $t("7 gün"),
  "30d": $t("30 gün"),
  "90d": $t("90 gün"),
  "1y": $t("1 yıl"),
};

export const RANGE_SHORT: Record<ChartRange, string> = {
  "1h": "1s",
  "24h": "24s",
  "7d": "7g",
  "30d": "30g",
  "90d": "90g",
  "1y": "1y",
};

export const RANGE_SECONDS: Record<ChartRange, number> = {
  "1h": 3_600,
  "24h": 86_400,
  "7d": 7 * 86_400,
  "30d": 30 * 86_400,
  "90d": 90 * 86_400,
  "1y": 365 * 86_400,
};

const NATIVE_PLACEHOLDER = "0x0000000000000000000000000000000000000000";

export function coinId(chain: Chain | undefined, address?: string): string | null {
  if (!chain) return null;
  if (!address) {
    if (chain.coingeckoId) return `coingecko:${chain.coingeckoId}`;
    return chain.llamaChain ? `${chain.llamaChain}:${NATIVE_PLACEHOLDER}` : null;
  }
  if (!chain.llamaChain) return null;
  const key = chain.kind === "solana" ? address : toChecksumAddress(address);
  return `${chain.llamaChain}:${key}`;
}

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CurrentResponse {
  coins?: Record<
    string,
    { price?: number; symbol?: string; decimals?: number; timestamp?: number; confidence?: number }
  >;
}

export async function llamaCurrentPrices(ids: string[]): Promise<LlamaPriceMap> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const parts = await Promise.allSettled(
    chunk(unique).map((group) =>
      fetchJson<CurrentResponse>(`${BASE}/prices/current/${group.join(",")}`, {}, 15_000),
    ),
  );

  const out: LlamaPriceMap = {};
  for (const part of parts) {
    if (part.status !== "fulfilled") continue;
    for (const [id, row] of Object.entries(part.value.coins ?? {})) {
      if (typeof row.price !== "number" || !Number.isFinite(row.price)) continue;
      out[id] = {
        price: row.price,
        symbol: row.symbol ?? "",
        decimals: row.decimals,
        timestamp: (row.timestamp ?? 0) * 1000,
        confidence: row.confidence ?? 0,
      };
    }
  }
  return out;
}

export async function llamaLivePrice(id: string): Promise<LlamaPrice | null> {
  const map = await llamaCurrentPrices([id]);
  return map[id] ?? null;
}





interface ChartResponse {
  coins?: Record<
    string,
    { symbol?: string; confidence?: number; prices?: { timestamp: number; price: number }[] }
  >;
}

const chartCache = new Map<string, { ts: number; series: SeriesPoint[] }>();
const CHART_TTL_MS = 90_000;
const chartPending = new Map<string, Promise<Record<string, SeriesPoint[]>>>();

const POINT_BUDGET = 480;

export async function llamaChart(
  ids: string[],
  range: ChartRange,
): Promise<Record<string, SeriesPoint[]>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const out: Record<string, SeriesPoint[]> = {};
  const missing: string[] = [];
  for (const id of unique) {
    const hit = chartCache.get(`${range}|${id}`);
    if (hit && Date.now() - hit.ts < CHART_TTL_MS) out[id] = hit.series;
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  const { span, period, search } = RANGE_PARAMS[range];
  const size = Math.max(1, Math.floor(POINT_BUDGET / span));

  await Promise.all(
    chunk(missing, size).map(async (group) => {
      const rows = await chartGroup(group, span, period, search);
      const ts = Date.now();
      for (const [id, series] of Object.entries(rows)) {
        out[id] = series;
        chartCache.set(`${range}|${id}`, { ts, series });
      }
    }),
  );

  return out;
}

async function chartGroup(
  group: string[],
  span: number,
  period: string,
  search: string,
): Promise<Record<string, SeriesPoint[]>> {
  const key = `${span}|${period}|${group.join(",")}`;
  const inflight = chartPending.get(key);
  if (inflight) return inflight;

  const task = requestChart(group, span, period, search)
    .then(async (rows) => {
      if (rows) return rows;
      if (group.length === 1) return {};
      const parts = await Promise.all(group.map((id) => chartGroup([id], span, period, search)));
      return Object.assign({}, ...parts) as Record<string, SeriesPoint[]>;
    })
    .finally(() => chartPending.delete(key));

  chartPending.set(key, task);
  return task;
}

async function requestChart(
  group: string[],
  span: number,
  period: string,
  search: string,
): Promise<Record<string, SeriesPoint[]> | null> {
  try {
    const data = await fetchJson<ChartResponse>(
      `${BASE}/chart/${group.join(",")}?span=${span}&period=${period}&searchWidth=${search}`,
      {},
      20_000,
    );
    const out: Record<string, SeriesPoint[]> = {};
    for (const [id, row] of Object.entries(data.coins ?? {})) {
      const points = (row.prices ?? [])
        .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.timestamp))
        .map((p) => ({ t: p.timestamp * 1000, v: p.price }));
      if (points.length > 1) out[id] = points;
    }
    return out;
  } catch {
    return null;
  }
}

export async function llamaHistoricalPrices(
  ids: string[],
  timestampSeconds: number,
  search = "6h",
): Promise<LlamaPriceMap> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const parts = await Promise.allSettled(
    chunk(unique).map((group) =>
      fetchJson<CurrentResponse>(
        `${BASE}/prices/historical/${Math.floor(timestampSeconds)}/${group.join(",")}?searchWidth=${search}`,
        {},
        15_000,
      ),
    ),
  );

  const out: LlamaPriceMap = {};
  for (const part of parts) {
    if (part.status !== "fulfilled") continue;
    for (const [id, row] of Object.entries(part.value.coins ?? {})) {
      if (typeof row.price !== "number") continue;
      out[id] = {
        price: row.price,
        symbol: row.symbol ?? "",
        timestamp: (row.timestamp ?? 0) * 1000,
        confidence: row.confidence ?? 0,
      };
    }
  }
  return out;
}

export function percentChange(
  current: LlamaPriceMap,
  past: LlamaPriceMap,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, row] of Object.entries(current)) {
    const before = past[id]?.price;
    if (!before || before <= 0) continue;
    out[id] = ((row.price - before) / before) * 100;
  }
  return out;
}

export async function llamaRangeChange(
  ids: string[],
  current: LlamaPriceMap,
  range: ChartRange,
): Promise<Record<string, number>> {
  const since = Math.floor(Date.now() / 1000) - RANGE_SECONDS[range];
  const past = await llamaHistoricalPrices(ids, since, RANGE_PARAMS[range].search);
  return percentChange(current, past);
}

export function valueAt(series: SeriesPoint[], t: number): number | null {
  if (series.length === 0) return null;
  let lo = 0;
  let hi = series.length - 1;
  if (t <= series[0].t) return series[0].v;
  if (t >= series[hi].t) return series[hi].v;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].v;
}
