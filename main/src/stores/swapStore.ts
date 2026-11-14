import { t as $t } from "@/lib/i18n";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isTauri } from "@/lib/tauri/ipc";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { toast } from "@/stores/toastStore";
import { getChain } from "@/lib/chains/registry";
import { isEvmChain, isValidAddress, sampleAddress } from "@/lib/chains/address";
import { addressForChain } from "@/stores/accountStore";
import {
  fetchQuotes,
  type RoutePreference,
} from "@/lib/swap/engine";
import {
  chainLabel,
  findAsset,
  loadSwapAssets,
  onAssetsChanged,
  swapAssets,
  type SwapAsset,
} from "@/lib/swap/assets";
import { parseUnits, plainNumber, sanitizeAmount, unitsToNumber, formatUnits } from "@/lib/swap/units";
import {
  executeIntentsDeposit,
  executeKyberSwap,
  fundIntentsFromEvm,
  waitReceipt,
} from "@/lib/swap/execute";
import { fetchIntentsStatus, INTENTS_STATUS_TEXT } from "@/lib/swap/intents";
import { screenPair } from "@/lib/api/security";
import { QUOTE_TTL_MS } from "@/lib/swap/config";
import type { QuoteFailure, QuoteResult, SwapOrder, SwapQuote } from "@/lib/swap/types";


export interface SwapSettings {
  slippagePct: number;
  deadlineMinutes: number;
  preference: RoutePreference;
  autoRefresh: boolean;
  refreshSeconds: number;
  securityCheck: boolean;
  testMode: boolean;
}

interface SwapState {
  settings: SwapSettings;
  assets: SwapAsset[];
  assetsLoading: boolean;

  fromId: string;
  toId: string;
  amount: string;

  quote: SwapQuote | null;
  alternatives: SwapQuote[];
  quoteLoading: boolean;
  quoteError: string | null;
  engineErrors: QuoteFailure[];
  quotedAt: number;

  orders: SwapOrder[];
  activeOrderId: string | null;
  executing: boolean;
  lastRemoved: SwapOrder[];

  initAssets: () => Promise<void>;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
  flip: () => void;
  setAmount: (raw: string) => void;
  setPercent: (pct: number) => void;
  patchSettings: (patch: Partial<SwapSettings>) => void;
  resetSettings: () => void;
  requestQuote: (force?: boolean) => void;
  execute: (walletAddress: string) => Promise<string | null>;
  cancelOrder: (id: string) => void;
  retryOrder: (id: string) => void;
  removeOrder: (id: string) => void;
  removeOrders: (ids: string[]) => void;
  undoRemove: () => void;
  clearOrders: () => void;
  setActiveOrder: (id: string | null) => void;
  trackOrder: (id: string) => void;
}

const DEFAULT_SETTINGS: SwapSettings = {
  slippagePct: 0.5,
  deadlineMinutes: 20,
  preference: "auto",
  autoRefresh: true,
  refreshSeconds: 20,
  securityCheck: true,
  testMode: !isTauri(),
};

const MAX_ORDERS = 40;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pollers = new Map<string, ReturnType<typeof setInterval>>();
const watchers = new Set<string>();
let quoteSeq = 0;
let debounce: ReturnType<typeof setTimeout> | null = null;

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

function clearPoller(id: string) {
  const p = pollers.get(id);
  if (p) clearInterval(p);
  pollers.delete(id);
}

export function balanceOf(assetId: string): number {
  const holdings = usePortfolioStore.getState().holdings;
  const hit = holdings.find((h) => `${h.chainId}:${h.address?.toLowerCase() ?? "native"}` === assetId);
  return hit?.amount ?? 0;
}

export function resolveAddress(chainId: string): string {
  const saved = addressForChain(chainId);
  if (isValidAddress(chainId, saved)) return saved;
  return isEvmChain(chainId) ? "" : sampleAddress(chainId) ?? "";
}

export function missingAddressLegs(fromId: string, toId: string) {
  const from = findAsset(fromId);
  const to = findAsset(toId);
  return {
    refund: Boolean(from && !resolveAddress(from.chainId)),
    recipient: Boolean(to && !resolveAddress(to.chainId)),
  };
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => {
      function patchOrder(id: string, patch: Partial<SwapOrder>) {
        set({
          orders: get().orders.map((o) => {
            if (o.id !== id) return o;
            const at = Date.now();
            const trail =
              patch.stage && patch.stage !== o.stage
                ? [
                    ...(o.trail ?? [{ stage: o.stage, at: o.createdAt }]),
                    { stage: patch.stage, at, text: patch.statusText },
                  ]
                : o.trail;
            return { ...o, ...patch, trail, updatedAt: at };
          }),
        });
      }

      function scheduleQuote() {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => void runQuote(), 420);
      }

      async function runQuote() {
        const { fromId, toId, amount, settings } = get();
        const from = findAsset(fromId);
        const to = findAsset(toId);
        if (!from || !to) return;

        const amountIn = parseUnits(amount, from.decimals);
        if (amountIn <= 0n) {
          quoteSeq++;
          set({ quote: null, alternatives: [], quoteError: null, engineErrors: [], quoteLoading: false });
          return;
        }

        const seq = ++quoteSeq;
        set({ quoteLoading: true, quoteError: null });

        const result: QuoteResult = await fetchQuotes({
          from,
          to,
          amountIn,
          slippagePct: settings.slippagePct,
          preference: settings.preference,
          refundTo: resolveAddress(from.chainId),
          recipient: resolveAddress(to.chainId),
          deadlineMinutes: settings.deadlineMinutes,
        });

        if (seq !== quoteSeq) return;

        set({
          quote: result.best,
          alternatives: result.all,
          engineErrors: result.failures,
          quoteLoading: false,
          quotedAt: Date.now(),
          quoteError: result.best
            ? null
            : result.failures[0]?.reason ?? $t("Bu çift için kotasyon alınamadı."),
        });
      }

      function runTestTimeline(order: SwapOrder) {
        const isIntent = order.engine === "intents";
        const steps: [number, Partial<SwapOrder>][] = isIntent
          ? [
              [1200, { stage: "yatirma-bekleniyor", statusText: $t("Yatıra adresi hazır") }],
              [4200, { stage: "gonderildi", statusText: $t("Yatırma zincirde görüldü") }],
              [7400, { stage: "isleniyor", statusText: $t("Çözünücü en iyi fiyatı buluyor") }],
              [
                11_000,
                {
                  stage: "tamamlandi",
                  statusText: $t("Teslim edildi"),
                  amountOut: order.amountOut,
                },
              ],
            ]
          : [
              [900, { stage: "gonderildi", statusText: $t("İşlem ağa yayınlandı") }],
              [3200, { stage: "isleniyor", statusText: $t("Blok onayı bekleniyor") }],
              [6000, { stage: "tamamlandi", statusText: $t("Takas tamamlandı") }],
            ];

        for (const [delay, patch] of steps) {
          timers.set(
            `${order.id}:${delay}`,
            setTimeout(() => {
              const current = get().orders.find((o) => o.id === order.id);
              if (!current || current.stage === "iptal" || current.stage === "basarisiz") return;
              patchOrder(order.id, patch);
              if (patch.stage === "tamamlandi") toast($t("Takas tamamlandı (test)"), "success");
            }, delay),
          );
        }
      }

      async function pollIntents(order: SwapOrder) {
        if (!order.depositAddress) return;
        clearPoller(order.id);
        const tick = async () => {
          const current = get().orders.find((o) => o.id === order.id);
          if (!current || ["tamamlandi", "iade", "basarisiz", "iptal"].includes(current.stage)) {
            clearPoller(order.id);
            return;
          }
          try {
            const progress = await fetchIntentsStatus(current.depositAddress!);
            const stage: SwapOrder["stage"] =
              progress.status === "SUCCESS"
                ? "tamamlandi"
                : progress.status === "REFUNDED"
                  ? "iade"
                  : progress.status === "FAILED"
                    ? "basarisiz"
                    : progress.status === "PROCESSING" || progress.status === "KNOWN_DEPOSIT_TX"
                      ? "isleniyor"
                      : "yatirma-bekleniyor";
            patchOrder(order.id, {
              stage,
              statusText: INTENTS_STATUS_TEXT[progress.status],
              txHash: progress.destinationHash ?? progress.originHash ?? current.txHash,
            });
            if (stage === "tamamlandi") {
              toast($t("Takas tamamlandı"), "success");
              clearPoller(order.id);
            }
          } catch {
          }
        };
        pollers.set(order.id, setInterval(() => void tick(), 8000));
        void tick();
      }

      async function watchEvmReceipt(order: SwapOrder) {
        if (!order.txHash || watchers.has(order.id)) return;
        const chain = getChain(order.fromChainId);
        if (!chain) return;
        watchers.add(order.id);
        try {
          const status = await waitReceipt(chain, order.txHash);
          patchOrder(order.id, {
            stage: status === "confirmed" ? "tamamlandi" : "basarisiz",
            statusText: status === "confirmed" ? $t("Takas tamamlandı") : $t("İşlem geri alındı"),
          });
        } catch {
          patchOrder(order.id, { statusText: $t("Onay alınamadı — gezginden kontrol et") });
        } finally {
          watchers.delete(order.id);
        }
      }

      return {
        settings: DEFAULT_SETTINGS,
        assets: swapAssets(),
        assetsLoading: true,
        fromId: "ethereum:native",
        toId: "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        amount: "",
        quote: null,
        alternatives: [],
        quoteLoading: false,
        quoteError: null,
        engineErrors: [],
        quotedAt: 0,
        orders: [],
        activeOrderId: null,
        executing: false,
        lastRemoved: [],

        initAssets: async () => {
          set({ assetsLoading: true });
          await loadSwapAssets();
          set({ assets: swapAssets(), assetsLoading: false });
        },

        setFrom: (id) => {
          const { fromId, toId } = get();
          if (id === fromId) return;
          set({ fromId: id, toId: toId === id ? fromId : toId });
          scheduleQuote();
        },

        setTo: (id) => {
          const { fromId, toId } = get();
          if (id === toId) return;
          set({ toId: id, fromId: fromId === id ? toId : fromId });
          scheduleQuote();
        },

        flip: () => {
          const { fromId, toId, quote, amount } = get();
          const to = findAsset(toId);
          const carried =
            quote && to ? plainNumber(unitsToNumber(quote.amountOut, to.decimals), to.decimals) : amount;
          set({ fromId: toId, toId: fromId, amount: carried, quote: null, alternatives: [] });
          scheduleQuote();
        },

        setAmount: (raw) => {
          const from = findAsset(get().fromId);
          set({ amount: sanitizeAmount(raw, from?.decimals ?? 18) });
          scheduleQuote();
        },

        setPercent: (pct) => {
          const from = findAsset(get().fromId);
          if (!from) return;
          const balance = balanceOf(from.id);
          if (balance <= 0) {
            toast(`${from.symbol} bakiyesi yok`, "info");
            return;
          }
          const native = !from.address && getChain(from.chainId)?.kind === "evm";
          const usable = native ? Math.max(0, balance - 0.0025) : balance;
          const value = (usable * pct) / 100;
          set({ amount: plainNumber(value, from.decimals) });
          scheduleQuote();
        },

        patchSettings: (patch) => {
          set({ settings: { ...get().settings, ...patch } });
          if ("slippagePct" in patch || "preference" in patch || "deadlineMinutes" in patch)
            scheduleQuote();
        },

        resetSettings: () => {
          set({ settings: { ...DEFAULT_SETTINGS } });
          scheduleQuote();
          toast($t("Takas ayarları sıfırlandı"), "info");
        },

        requestQuote: (force) => {
          if (force) void runQuote();
          else scheduleQuote();
        },

        execute: async (walletAddress) => {
          const { quote, settings, executing } = get();
          if (executing) return null;
          if (!quote) {
            toast($t("Önce geçerli bir kotasyon al"), "info");
            return null;
          }
          const from = findAsset(quote.fromId);
          const to = findAsset(quote.toId);
          if (!from || !to) return null;

          if (Date.now() > quote.expiresAt) {
            toast($t("Kotasyon eskidi — yenileniyor"), "info");
            void runQuote();
            return null;
          }

          const refundTo = addressForChain(from.chainId);
          const recipient = addressForChain(to.chainId);

          if (quote.engine === "intents") {
            if (!isValidAddress(from.chainId, refundTo)) {
              toast($t("Hesap ayarlarına {0} adresini ekle", [chainLabel(from.chainId)]), "info");
              return null;
            }
            if (!isValidAddress(to.chainId, recipient)) {
              toast($t("Hesap ayarlarına {0} adresini ekle", [chainLabel(to.chainId)]), "info");
              return null;
            }
          } else if (!walletAddress) {
            toast($t("Cüzdan adresi bulunamadı"), "info");
            return null;
          }

          if (settings.securityCheck) {
            const risks = await screenPair([from, to]);
            const blocker = risks.findIndex((r) => r.blocked);
            if (blocker >= 0) {
              const leg = blocker === 0 ? from : to;
              toast($t("{0} güvenlik denetimini geçemedi — takas yapılmadı", [leg.symbol]), "error");
              return null;
            }
          }

          const id = `sw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          const order: SwapOrder = {
            id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            engine: quote.engine,
            fromId: from.id,
            toId: to.id,
            fromSymbol: from.symbol,
            toSymbol: to.symbol,
            fromChainId: from.chainId,
            toChainId: to.chainId,
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
            minAmountOut: quote.minAmountOut.toString(),
            amountInDecimals: from.decimals,
            amountOutDecimals: to.decimals,
            amountInUsd: quote.amountInUsd,
            amountOutUsd: quote.amountOutUsd,
            feeUsd: quote.feeUsd,
            feeRecipient: quote.feeRecipient,
            networkFeeUsd: quote.networkFeeUsd,
            etaSeconds: quote.etaSeconds,
            slippagePct: settings.slippagePct,
            stage: "hazirlaniyor",
            trail: [{ stage: "hazirlaniyor", at: Date.now(), text: $t("İşlem hazırlanıyor") }],
            statusText: $t("İşlem hazırlanıyor"),
            simulated: settings.testMode,
            originChainId: from.chainId,
            destinationChainId: to.chainId,
          };

          set({
            orders: [order, ...get().orders].slice(0, MAX_ORDERS),
            activeOrderId: id,
            executing: true,
          });

          try {
            if (settings.testMode) {
              if (quote.engine === "intents") {
                const deposit = await executeIntentsDeposit({
                  quote,
                  from,
                  to,
                  refundTo,
                  recipient,
                  slippagePct: settings.slippagePct,
                  deadlineMinutes: settings.deadlineMinutes,
                }).catch(() => null);
                patchOrder(id, {
                  depositAddress: deposit?.depositAddress,
                  statusText: deposit
                    ? $t("Yatıra adresi alındı")
                    : $t("Test yatıra akışı — adres üretilmedi"),
                });
              }
              runTestTimeline(get().orders.find((o) => o.id === id)!);
              set({ executing: false, amount: "" });
              return id;
            }

            if (quote.engine === "kyber") {
              const result = await executeKyberSwap({
                quote,
                from,
                sender: walletAddress,
                recipient: walletAddress,
                slippagePct: settings.slippagePct,
                deadlineMinutes: settings.deadlineMinutes,
                onProgress: (text) => patchOrder(id, { statusText: text }),
              });
              patchOrder(id, {
                stage: "gonderildi",
                txHash: result.hash,
                statusText: $t("İşlem ağa yayınlandı"),
              });
              const chain = getChain(from.chainId);
              if (chain) {
                const status = await waitReceipt(chain, result.hash);
                patchOrder(id, {
                  stage: status === "confirmed" ? "tamamlandi" : "basarisiz",
                  statusText: status === "confirmed" ? $t("Takas tamamlandı") : $t("İşlem geri alındı"),
                  amountOut: result.amountOut,
                });
                toast(
                  status === "confirmed" ? $t("Takas tamamlandı") : $t("İşlem başarısız"),
                  status === "confirmed" ? "success" : "info",
                );
              }
            } else {
              const deposit = await executeIntentsDeposit({
                quote,
                from,
                to,
                refundTo,
                recipient,
                slippagePct: settings.slippagePct,
                deadlineMinutes: settings.deadlineMinutes,
              });
              patchOrder(id, {
                stage: "yatirma-bekleniyor",
                depositAddress: deposit.depositAddress,
                amountOut: deposit.amountOut,
                minAmountOut: deposit.minAmountOut,
                statusText: $t("Yatırma bekleniyor"),
              });

              if (getChain(from.chainId)?.kind === "evm") {
                const hash = await fundIntentsFromEvm({
                  from,
                  amountIn: quote.amountIn,
                  depositAddress: deposit.depositAddress,
                  signature: deposit.signature,
                  sender: walletAddress,
                  onProgress: (text) => patchOrder(id, { statusText: text }),
                });
                patchOrder(id, { txHash: hash, stage: "gonderildi" });
              }
              void pollIntents(get().orders.find((o) => o.id === id)!);
            }
            set({ amount: "" });
            return id;
          } catch (e) {
            patchOrder(id, {
              stage: "basarisiz",
              error: e instanceof Error ? e.message : String(e),
              statusText: $t("Yürütme başarısız"),
            });
            toast($t("Takas başlatılamadı"), "info");
            return id;
          } finally {
            set({ executing: false });
          }
        },

        cancelOrder: (id) => {
          clearPoller(id);
          for (const key of [...timers.keys()]) {
            if (key.startsWith(`${id}:`)) clearTimer(key);
          }
          patchOrder(id, { stage: "iptal", statusText: $t("Kullanıcı iptal etti") });
          toast($t("Takas iptal edildi"), "info");
        },

        retryOrder: (id) => {
          const order = get().orders.find((o) => o.id === id);
          if (!order) return;
          const from = findAsset(order.fromId);
          set({
            fromId: order.fromId,
            toId: order.toId,
            amount: from ? formatUnits(BigInt(order.amountIn), from.decimals) : "",
            activeOrderId: null,
          });
          void runQuote();
          toast($t("Tutar forma yüklendi — yeni fiyat alınıyor"), "info");
        },

        removeOrder: (id) => get().removeOrders([id]),

        removeOrders: (ids) => {
          if (ids.length === 0) return;
          const drop = new Set(ids);
          for (const id of ids) {
            clearPoller(id);
            for (const key of [...timers.keys()]) {
              if (key.startsWith(`${id}:`)) clearTimer(key);
            }
          }
          set({
            lastRemoved: get().orders.filter((o) => drop.has(o.id)),
            orders: get().orders.filter((o) => !drop.has(o.id)),
            activeOrderId: drop.has(get().activeOrderId ?? "") ? null : get().activeOrderId,
          });
        },

        undoRemove: () => {
          const batch = get().lastRemoved;
          if (batch.length === 0) return;
          const ids = new Set(batch.map((o) => o.id));
          set({
            orders: [...batch, ...get().orders.filter((o) => !ids.has(o.id))]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, MAX_ORDERS),
            lastRemoved: [],
          });
          toast(batch.length > 1 ? $t("{0} kayıt geri alındı", [batch.length]) : $t("Kayıt geri alındı"), "success");
        },

        clearOrders: () => {
          for (const id of [...pollers.keys()]) clearPoller(id);
          for (const key of [...timers.keys()]) clearTimer(key);
          set({ orders: [], activeOrderId: null, lastRemoved: [] });
        },

        setActiveOrder: (id) => set({ activeOrderId: id }),

        trackOrder: (id) => {
          const order = get().orders.find((o) => o.id === id);
          if (!order || order.simulated) return;
          if (order.engine === "intents") {
            if (order.depositAddress) void pollIntents(order);
          } else if (order.txHash) {
            void watchEvmReceipt(order);
          }
        },
      };
    },
    {
      name: "vexaris-swap",
      version: 1,
      partialize: (state) => ({
        settings: state.settings,
        orders: state.orders,
        fromId: state.fromId,
        toId: state.toId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!isTauri()) state.settings.testMode = true;
        state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
        for (const order of state.orders) {
          if (order.stage === "hazirlaniyor") {
            order.stage = "basarisiz";
            order.statusText = $t("Uygulama kapanırken yarıda kaldı");
          }
        }
      },
    },
  ),
);

onAssetsChanged(() => {
  useSwapStore.setState({ assets: swapAssets() });
  useSwapStore.getState().requestQuote(true);
});

export function quoteFreshness(quotedAt: number): number {
  if (!quotedAt) return 0;
  return Math.max(0, 1 - (Date.now() - quotedAt) / QUOTE_TTL_MS);
}