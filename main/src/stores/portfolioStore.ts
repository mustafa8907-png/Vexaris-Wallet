import { t as $t } from "@/lib/i18n";
import { create } from "zustand";
import type { Holding, TokenAmount } from "@/types/chain";
import { fetchHoldings } from "@/lib/api/balances";
import { fetchPortfolioSeries, seriesChange } from "@/lib/api/chart";
import {
  fetchPrices,
  targetsForHoldings,
  valueHoldings,
  type PriceMap,
  type PriceSnapshot,
} from "@/lib/api/prices";
import {
  type ChartRange,
  type SeriesPoint,
} from "@/lib/api/defillama";
import { useChainStore } from "./chainStore";

/**
 * Canlı portföy durumu.
 *
 * Akış: bakiyeler (RPC + gezgin keşfi) → fiyatlar → USD değerleme → portföy eğrisi.
 */

interface PortfolioState {
  address: string | null;
  holdings: Holding[];
  /** Zincir bazlı görünüm — gönder/takas ekranları için. */
  balances: Record<string, TokenAmount[]>;
  prices: PriceMap;
  snapshot: PriceSnapshot | null;
  series: SeriesPoint[];
  range: ChartRange;
  totalUsd: number;
  changePct: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** RPC'sine ulaşılamayan ağlar. */
  failedChains: string[];
  /** Token keşfi yapılamayan ağlar. */
  partialChains: string[];
  /** Token keşfi kaynağı olmayan ağlar. */
  noSourceChains: string[];
  updatedAt: number;

  refresh: (address: string, force?: boolean) => Promise<void>;
  setRange: (range: ChartRange) => Promise<void>;
  clear: () => void;
}

const EMPTY_SNAPSHOT: PriceSnapshot = {
  byCoin: {},
  change: {},
  bySymbol: {},
  updatedAt: 0,
};

let seriesSeq = 0;

/**
 * Eğrinin son noktasını güncel toplamla değiştirir.
 *
 * Geçmiş noktalar aynı kalır; böylece 45 saniyelik tazelemede onlarca coin için
 * tekrar grafik isteği atılmaz.
 */
function withLivePoint(series: SeriesPoint[], totalUsd: number): SeriesPoint[] {
  if (series.length === 0) return series;
  const next = series.slice();
  next[next.length - 1] = { t: Date.now(), v: totalUsd };
  return next;
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  address: null,
  holdings: [],
  balances: {},
  prices: {},
  snapshot: null,
  series: [],
  range: "24h",
  totalUsd: 0,
  changePct: 0,
  loading: true,
  refreshing: false,
  error: null,
  failedChains: [],
  partialChains: [],
  noSourceChains: [],
  updatedAt: 0,

  refresh: async (address, force = false) => {
    const current = get();
    if (current.refreshing) return;

    set({
      address,
      refreshing: true,
      loading: current.updatedAt === 0,
      error: null,
    });

    try {
      const enabled = useChainStore.getState().enabledChainIds;
      const { holdings: raw, failed, partial, noSource } = await fetchHoldings(address, enabled);
      const snapshot = await fetchPrices(targetsForHoldings(raw), force);
      const holdings = valueHoldings(raw, snapshot).sort((a, b) => b.usdValue - a.usdValue);
      const totalUsd = holdings.reduce((sum, h) => sum + h.usdValue, 0);
      const range = get().range;
      const series = withLivePoint(get().series, totalUsd);

      // Liste ve toplam hemen çizilir; bekleme grafiğin isteğine bağlı kalmaz.
      set({
        holdings,
        balances: groupByChain(holdings),
        prices: snapshot.bySymbol,
        snapshot,
        series,
        totalUsd,
        changePct: series.length > 1 ? seriesChange(series) : weightedChange(holdings),
        loading: false,
        refreshing: false,
        failedChains: failed,
        partialChains: partial,
        noSourceChains: noSource,
        updatedAt: Date.now(),
        error: failed.length > 0 && holdings.length === 0
          ? $t("Ağlara ulaşılamadı — bağlantını ve RPC uçlarını kontrol et.")
          : null,
      });

      // Geçmiş eğri pahalı bir istektir; yalnızca ilk yükleme, aralık değişimi
      // ve kullanıcının bastığı "Yenile" için yeniden çekilir.
      if (force || series.length === 0) {
        const seq = ++seriesSeq;
        void fetchPortfolioSeries(holdings, range).then(
          (next) => {
            if (seq !== seriesSeq || get().range !== range) return;
            set({
              series: withLivePoint(next, totalUsd),
              changePct: next.length > 1 ? seriesChange(next) : weightedChange(holdings),
            });
          },
          () => {
            /* eğrisiz de bakiye görünür */
          },
        );
      }
    } catch (e) {
      set({
        loading: false,
        refreshing: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setRange: async (range) => {
    const previous = get().range;
    set({ range });
    seriesSeq++;
    try {
      const series = await fetchPortfolioSeries(get().holdings, range);
      if (get().range !== range) return;
      set({
        series: withLivePoint(series, get().totalUsd),
        changePct: series.length > 1 ? seriesChange(series) : weightedChange(get().holdings),
      });
    } catch {
      set({ range: previous });
    }
  },

  clear: () =>
    set({
      address: null,
      holdings: [],
      balances: {},
      snapshot: null,
      series: [],
      totalUsd: 0,
      changePct: 0,
      updatedAt: 0,
      loading: true,
      error: null,
      failedChains: [],
      partialChains: [],
      noSourceChains: [],
    }),
}));

function groupByChain(holdings: Holding[]): Record<string, TokenAmount[]> {
  const out: Record<string, TokenAmount[]> = {};
  for (const h of holdings) {
    (out[h.chainId] ??= []).push(h);
  }
  for (const rows of Object.values(out)) rows.sort((a, b) => b.usdValue - a.usdValue);
  return out;
}

/** Grafik yoksa 24s değişimi USD ağırlıklı ortalamadan gelir. */
function weightedChange(holdings: Holding[]): number {
  const priced = holdings.filter((h) => h.usdValue > 0 && h.change24h != null);
  const total = priced.reduce((sum, h) => sum + h.usdValue, 0);
  if (total <= 0) return 0;
  return priced.reduce((sum, h) => sum + (h.change24h ?? 0) * (h.usdValue / total), 0);
}

export { EMPTY_SNAPSHOT };
