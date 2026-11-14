import { t as $t } from "@/lib/i18n";
import { create } from "zustand";
import {
  fetchHistoryPage,
  type HistoryCursors,
  type TxRecord,
} from "@/lib/api/history";
import { usdFor, type PriceSnapshot } from "@/lib/api/prices";


interface HistoryState {
  address: string | null;
  records: TxRecord[];
  cursors: HistoryCursors;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  failed: string[];
  unsupported: string[];
  updatedAt: number;
  error: string | null;

  load: (address: string, chainIds: string[], prices: PriceSnapshot, force?: boolean) => Promise<void>;
  loadMore: (prices: PriceSnapshot) => Promise<void>;
  revalue: (prices: PriceSnapshot) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  address: null,
  records: [],
  cursors: {},
  loading: true,
  loadingMore: false,
  hasMore: false,
  failed: [],
  unsupported: [],
  updatedAt: 0,
  error: null,

  load: async (address, chainIds, prices, force = false) => {
    const current = get();
    if (current.loading && current.updatedAt > 0) return;
    if (current.loadingMore) return;

    set({
      address,
      loading: true,
      error: null,
      records: force ? [] : current.address === address ? current.records : [],
      cursors: {},
    });

    try {
      const page = await fetchHistoryPage(address, chainIds, {}, prices);
      if (get().address !== address) return;
      set({
        records: page.records,
        cursors: page.cursors,
        hasMore: page.hasMore,
        failed: page.failed,
        unsupported: page.unsupported,
        loading: false,
        updatedAt: Date.now(),
        error:
          page.records.length === 0 && page.failed.length > 0
            ? $t("İşlem geçmişine ulaşılamadı — gezgin uçları yanıt vermedi.")
            : null,
      });
    } catch (e) {
      if (get().address !== address) return;
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  loadMore: async (prices) => {
    const { address, cursors, loading, loadingMore, hasMore, records } = get();
    if (!address || loading || loadingMore || !hasMore) return;

    const chainIds = Object.keys(cursors);
    set({ loadingMore: true });
    try {
      const page = await fetchHistoryPage(address, chainIds, cursors, prices);
      if (get().address !== address) return;
      const seen = new Set(records.map((r) => r.id));
      const merged = [...records, ...page.records.filter((r) => !seen.has(r.id))].sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      set({
        records: merged,
        cursors: page.cursors,
        hasMore: page.hasMore,
        failed: [...new Set([...get().failed, ...page.failed])],
        loadingMore: false,
        updatedAt: Date.now(),
      });
    } catch {
      set({ loadingMore: false });
    }
  },

  revalue: (prices) => {
    const records = get().records;
    if (records.length === 0 || prices.updatedAt === 0) return;
    set({
      records: records.map((r) => ({
        ...r,
        usdValue: usdFor(prices, r.chainId, r.symbol, r.amount, r.tokenAddress),
        feeUsd:
          r.feeNative != null
            ? usdFor(prices, r.chainId, r.feeSymbol ?? "ETH", r.feeNative)
            : r.feeUsd,
      })),
    });
  },

  clear: () =>
    set({
      address: null,
      records: [],
      cursors: {},
      hasMore: false,
      failed: [],
      unsupported: [],
      updatedAt: 0,
      loading: true,
      error: null,
    }),
}));

export const KIND_LABELS: Record<TxRecord["kind"], string> = {
  send: $t("Gönderildi"),
  receive: $t("Alındı"),
  swap: $t("Takas"),
  approve: $t("Onay"),
  contract: $t("Sözleşme"),
  self: "Kendine",
};

export const STATUS_LABELS: Record<TxRecord["status"], string> = {
  pending: $t("Beklemede"),
  confirmed: $t("Onaylandı"),
  failed: $t("Başarısız"),
};
