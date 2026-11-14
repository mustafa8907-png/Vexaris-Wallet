import type { Holding } from "@/types/chain";
import { getChain } from "@/lib/chains/registry";
import { STABLE_SYMBOLS } from "@/lib/chains/tokens";
import {
  coinId,
  llamaChart,
  valueAt,
  type ChartRange,
  type SeriesPoint,
} from "./defillama";

export type { ChartRange, SeriesPoint };

/**
 * Portföy değer eğrisi — DefiLlama geçmiş fiyatları.
 *
 * Her varlığın güncel miktarı geçmiş fiyatla çarpılır ve toplanır.
 * Yaklaşıktır: geçmişteki alım/satımlar değil, bugünkü miktarlar esas alınır.
 * Kararlı paralar sabit kabul edilir.
 */
/**
 * Grafikte izlenen coin sayısı. Kalan varlıklar sabit kabul edilir; böylece
 * yüzlerce toz token için yüzlerce istek atılmaz ve eğri ana varlıkları izler.
 */
const MAX_CHART_COINS = 10;

export async function fetchPortfolioSeries(
  holdings: Holding[],
  range: ChartRange,
): Promise<SeriesPoint[]> {
  const active = holdings.filter((h) => h.amount > 0);
  if (active.length === 0) return [];

  const byCoin = new Map<string, { amount: number; usdValue: number; symbol: string }>();
  let constantUsd = 0;

  for (const h of active) {
    const id = coinId(getChain(h.chainId), h.address);
    if (!id || STABLE_SYMBOLS.has(h.tokenSymbol.toUpperCase())) {
      constantUsd += h.usdValue;
      continue;
    }
    const entry = byCoin.get(id) ?? { amount: 0, usdValue: 0, symbol: h.tokenSymbol };
    entry.amount += h.amount;
    entry.usdValue += h.usdValue;
    byCoin.set(id, entry);
  }

  const ranked = [...byCoin.entries()].sort((a, b) => b[1].usdValue - a[1].usdValue);
  for (const [, entry] of ranked.slice(MAX_CHART_COINS)) constantUsd += entry.usdValue;
  const ids = ranked.slice(0, MAX_CHART_COINS).map(([id]) => id);

  if (ids.length === 0) {
    return constantUsd > 0 ? flatSeries(constantUsd, range) : [];
  }

  const charts = await llamaChart(ids, range);
  const priced = ids
    .map((id) => ({ id, series: charts[id], holding: byCoin.get(id)! }))
    .filter((entry) => entry.series && entry.series.length > 1);

  for (const id of ids) {
    if (!charts[id]) constantUsd += byCoin.get(id)!.usdValue;
  }

  if (priced.length === 0) {
    return constantUsd > 0 ? flatSeries(constantUsd, range) : [];
  }

  // Zaman çizelgesi: en uzun seri. Diğer coinler en yakın önceki fiyatla okunur.
  const base = priced.reduce((a, b) => (a.series!.length >= b.series!.length ? a : b));
  const points: SeriesPoint[] = [];

  for (const point of base.series!) {
    let total = constantUsd;
    for (const entry of priced) {
      const price = valueAt(entry.series!, point.t);
      if (price != null) total += price * entry.holding.amount;
    }
    points.push({ t: point.t, v: total });
  }
  return points;
}

/** Tek coinin fiyat serisi — detay sayfası grafiği. */
export async function fetchCoinSeries(
  chainId: string,
  address: string | undefined,
  range: ChartRange,
): Promise<SeriesPoint[]> {
  const id = coinId(getChain(chainId), address);
  if (!id) return [];
  const charts = await llamaChart([id], range);
  return charts[id] ?? [];
}

/** Kararlı para ağırlıklı portföy: düz çizgi yerine gerçek zaman ekseni. */
function flatSeries(value: number, range: ChartRange): SeriesPoint[] {
  const spanMs: Record<ChartRange, number> = {
    "1h": 3_600_000,
    "24h": 86_400_000,
    "7d": 7 * 86_400_000,
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
    "1y": 365 * 86_400_000,
  };
  const end = Date.now();
  const start = end - spanMs[range];
  return Array.from({ length: 24 }, (_, i) => ({
    t: start + ((end - start) * i) / 23,
    v: value,
  }));
}

export function seriesChange(series: SeriesPoint[]): number {
  if (series.length < 2) return 0;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  if (first <= 0) return 0;
  return ((last - first) / first) * 100;
}
