import { t as $t } from "@/lib/i18n";
import { ApiError } from "@/lib/api/http";
import type { EngineId } from "./config";
import { kyberTarget, supportsIntents, type SwapAsset } from "./assets";
import { quoteKyber } from "./kyber";
import { quoteIntents } from "./intents";
import type { QuoteFailure, QuoteResult, SwapQuote } from "./types";

/**
 * Rota seçimi.
 *
 * Aynı ağdaki EVM çiftleri KyberSwap'a, BTC ve zincirler arası çiftler NEAR
 * Intents'e gider. İki motor da aynı çifti destekliyorsa ikisi birden
 * fiyatlanır ve net çıkışı yüksek olan seçilir.
 */

export type RoutePreference = "auto" | EngineId;

export const ROUTE_LABELS: Record<RoutePreference, string> = {
  auto: $t("Otomatik · en iyi net"),
  kyber: "KyberSwap",
  intents: "NEAR Intents",
};

export function canUseKyber(from: SwapAsset, to: SwapAsset): boolean {
  const a = kyberTarget(from);
  const b = kyberTarget(to);
  return Boolean(a && b && a.chain === b.chain && a.token.toLowerCase() !== b.token.toLowerCase());
}

export function canUseIntents(from: SwapAsset, to: SwapAsset): boolean {
  return supportsIntents(from) && supportsIntents(to) && from.intentsId !== to.intentsId;
}

/** Çift için hiç rota yoksa kullanıcıya gösterilecek gerekçe. */
export function routeBlocker(from: SwapAsset, to: SwapAsset): string | null {
  if (from.id === to.id) return $t("Aynı varlığı kendisiyle takas edemezsin.");
  if (canUseKyber(from, to) || canUseIntents(from, to)) return null;
  if (!supportsIntents(from) && !kyberTarget(from))
    return $t("{0} için takas rotası yok — bu ağ henüz desteklenmiyor.", [from.symbol]);
  if (!supportsIntents(to) && !kyberTarget(to))
    return $t("{0} hedef olarak desteklenmiyor.", [to.symbol]);
  return $t("Bu çift için iki motorda da rota bulunamadı.");
}

export interface QuoteParams {
  from: SwapAsset;
  to: SwapAsset;
  amountIn: bigint;
  slippagePct: number;
  preference: RoutePreference;
  refundTo: string;
  recipient: string;
  deadlineMinutes: number;
}

export async function fetchQuotes(params: QuoteParams): Promise<QuoteResult> {
  const { from, to, preference } = params;
  if (params.amountIn <= 0n) return { best: null, all: [], failures: [] };

  const tasks: Promise<SwapQuote>[] = [];
  const failures: QuoteFailure[] = [];

  const wantKyber = preference !== "intents" && canUseKyber(from, to);
  const wantIntents = preference !== "kyber" && canUseIntents(from, to);

  if (wantKyber) {
    tasks.push(
      quoteKyber(params).catch((e) => {
        failures.push({ engine: "kyber", reason: errorText(e) });
        return null as never;
      }),
    );
  }
  if (wantIntents) {
    tasks.push(
      quoteIntents(params).catch((e) => {
        failures.push({ engine: "intents", reason: errorText(e) });
        return null as never;
      }),
    );
  }

  if (tasks.length === 0) {
    const blocker = routeBlocker(from, to);
    if (blocker) failures.push({ engine: "kyber", reason: blocker });
    return { best: null, all: [], failures };
  }

  const settled = await Promise.all(tasks);
  const all = settled.filter((q): q is SwapQuote => Boolean(q));
  const best = all.length
    ? all.reduce((a, b) => (netUsd(b) > netUsd(a) ? b : a))
    : null;

  return { best, all, failures };
}

/** Ağ ücreti düşülmüş net değer — motorlar arası kıyas bu değere göre yapılır. */
export function netUsd(q: SwapQuote): number {
  return q.amountOutUsd - q.networkFeeUsd;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
