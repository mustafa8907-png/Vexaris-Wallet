import { t as $t } from "@/lib/i18n";
import { ApiError, fetchJson, postJson } from "@/lib/api/http";
import {
  FEE_BPS,
  FEE_RECIPIENT_BTC,
  FEE_RECIPIENT_EVM,
  INTENTS_BASE,
  INTENTS_CHAINS,
  INTENTS_FEE_REQUEST_BPS,
  QUOTE_TTL_MS,
} from "./config";
import { supportsIntents, type SwapAsset } from "./assets";
import { unitsToNumber } from "./units";
import type { IntentsPayload, RouteHop, SwapQuote } from "./types";

/**
 * NEAR Intents · 1Click istemcisi.
 *
 * KyberSwap BTC ve zincirler arası takası desteklemediği için bu yol devreye
 * girer. Kullanıcı kaynağa yatırır, çözünücü hedef zincirde teslim eder;
 * uygulama anahtar tutmaz. Komisyon `appFees` ile çıkıştan kesilir.
 */

interface IntentsQuoteResponse {
  message?: string;
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountInUsd: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd: string;
    minAmountOut: string;
    timeEstimate: number;
    deadline?: string;
    depositAddress?: string;
    refundFee?: string;
    withdrawFee?: string;
  };
  quoteRequest: {
    appFees?: { recipient: string; fee: number }[];
    depositAddress?: string;
  };
  signature?: string;
  correlationId?: string;
}

export type IntentsStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

interface StatusResponse {
  status: IntentsStatus;
  quoteResponse?: IntentsQuoteResponse;
  swapDetails?: {
    originChainTxHashes?: { hash: string }[];
    destinationChainTxHashes?: { hash: string }[];
    amountOut?: string;
    amountOutFormatted?: string;
  };
  message?: string;
}

/** Hedef zincire göre komisyonun düşeceği adres. */
export function feeRecipientFor(asset: SwapAsset): string {
  return INTENTS_CHAINS[asset.chainId] === "btc" ? FEE_RECIPIENT_BTC : FEE_RECIPIENT_EVM;
}

export interface IntentsQuoteParams {
  from: SwapAsset;
  to: SwapAsset;
  amountIn: bigint;
  slippagePct: number;
  /** Kaynak zincirde iade adresi. */
  refundTo: string;
  /** Hedef zincirde alıcı adresi. */
  recipient: string;
  /** true → yalnızca fiyat; false → yatıra adresi de üretilir. */
  dry?: boolean;
  deadlineMinutes?: number;
}

export function buildIntentsRequest({
  from,
  to,
  amountIn,
  slippagePct,
  refundTo,
  recipient,
  dry = true,
  deadlineMinutes = 30,
}: IntentsQuoteParams): Record<string, unknown> {
  return {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: Math.round(slippagePct * 100),
    originAsset: from.intentsId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: to.intentsId,
    amount: amountIn.toString(),
    refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + deadlineMinutes * 60_000).toISOString(),
    appFees: [{ recipient: feeRecipientFor(to), fee: INTENTS_FEE_REQUEST_BPS }],
    quoteWaitingTimeMs: 3000,
  };
}

export async function quoteIntents(params: IntentsQuoteParams): Promise<SwapQuote> {
  const { from, to, amountIn } = params;
  if (!supportsIntents(from) || !supportsIntents(to))
    throw new ApiError($t("Bu çift NEAR Intents'te listelenmiyor."));
  if (from.intentsId === to.intentsId) throw new ApiError($t("Aynı varlık için takas yapılamaz."));

  const request = buildIntentsRequest(params);
  const res = await postJson<IntentsQuoteResponse>(`${INTENTS_BASE}/v0/quote`, request, 25_000);
  if (res.message || !res.quote) throw new ApiError(intentsMessage(res.message));

  const q = res.quote;
  const out = BigInt(q.amountOut);
  const outUsd = Number(q.amountOutUsd) || 0;
  const inUsd = Number(q.amountInUsd) || 0;
  const outUi = unitsToNumber(out, to.decimals);
  const toPrice = outUi > 0 ? outUsd / outUi : 0;

  const recipient = feeRecipientFor(to);
  const fees = res.quoteRequest?.appFees ?? [];
  const oursBps = fees.find((f) => f.recipient.toLowerCase() === recipient.toLowerCase())?.fee ?? FEE_BPS;
  const otherBps = fees
    .filter((f) => f.recipient.toLowerCase() !== recipient.toLowerCase())
    .reduce((sum, f) => sum + f.fee, 0);

  const grossUsd = outUsd / Math.max(0.0001, 1 - (oursBps + otherBps) / 10_000);
  const feeUnits = (out * BigInt(oursBps)) / BigInt(Math.max(1, 10_000 - oursBps - otherBps));
  const eta = Math.max(5, q.timeEstimate || 60);
  const now = Date.now();

  const payload: IntentsPayload = {
    request,
    depositAddress: q.depositAddress ?? res.quoteRequest?.depositAddress,
    signature: res.signature,
    withdrawFee: BigInt(q.withdrawFee ?? "0"),
    refundFee: BigInt(q.refundFee ?? "0"),
  };

  return {
    id: `intents-${res.correlationId ?? now}`,
    engine: "intents",
    fromId: from.id,
    toId: to.id,
    amountIn,
    amountOut: out,
    minAmountOut: BigInt(q.minAmountOut || "0"),
    amountInUsd: inUsd,
    amountOutUsd: outUsd,
    feeUnits,
    feeUsd: unitsToNumber(feeUnits, to.decimals) * toPrice,
    feeRecipient: recipient,
    protocolFeeUsd: (grossUsd * otherBps) / 10_000,
    protocolFeeBps: otherBps,
    networkFeeUsd: unitsToNumber(payload.withdrawFee, to.decimals) * toPrice,
    networkFeeNative: unitsToNumber(payload.withdrawFee, to.decimals),
    networkFeeSymbol: to.symbol,
    priceImpactPct: inUsd > 0 ? ((outUsd + unitsToNumber(feeUnits, to.decimals) * toPrice - inUsd) / inUsd) * 100 : 0,
    rate: unitsToNumber(amountIn, from.decimals) > 0 ? outUi / unitsToNumber(amountIn, from.decimals) : 0,
    etaSeconds: eta,
    etaLow: Math.round(eta * 0.6),
    etaHigh: Math.round(eta * 1.8),
    hops: describeIntents(from, to, eta),
    createdAt: now,
    expiresAt: now + QUOTE_TTL_MS,
    intents: payload,
  };
}

function describeIntents(from: SwapAsset, to: SwapAsset, eta: number): RouteHop[] {
  const hops: RouteHop[] = [
    {
      label: $t("{0} yatırma", [from.symbol]),
      detail: chainName(from.chainId),
      share: 1,
      kind: "bridge",
    },
    {
      label: $t("NEAR Intents çözünücü"),
      detail: $t("Ortalama {0} · açık artırma ile en iyi fiyat", [formatEta(eta)]),
      share: 1,
      kind: "settle",
    },
  ];
  if (from.chainId !== to.chainId || from.address !== to.address) {
    hops.push({
      label: `${to.symbol} teslimi`,
      detail: chainName(to.chainId),
      share: 1,
      kind: "bridge",
    });
  }
  return hops;
}

function chainName(chainId: string): string {
  const map: Record<string, string> = {
    ethereum: "Ethereum",
    arbitrum: "Arbitrum One",
    base: "Base",
    polygon: "Polygon PoS",
    optimism: "OP Mainnet",
    bsc: "BNB Smart Chain",
    avalanche: "Avalanche",
    bitcoin: "Bitcoin",
    solana: "Solana",
    tron: "Tron",
    ton: "Ton",
    ripple: "XRP Ledger",
    dogecoin: "Dogecoin",
    gnosis: "Gnosis",
    scroll: "Scroll",
    litecoin: "Litecoin",
    bitcoincash: "Bitcoin Cash",
    near: "NEAR Protocol",
    aptos: "Aptos",
    sui: "Sui",
    cardano: "Cardano",
    stellar: "Stellar",
  };
  return map[chainId] ?? chainId;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return $t("{0} sn", [Math.round(seconds)]);
  const mins = seconds / 60;
  if (mins < 60)
    return $t("{0} dk", [mins < 10 ? mins.toFixed(1).replace(".", ",") : Math.round(mins)]);
  return $t("{0} sa", [(mins / 60).toFixed(1).replace(".", ",")]);
}

/** Yatıra adresi üretilmiş kotasyon — yürütme adımı. */
export async function openIntentsDeposit(params: IntentsQuoteParams): Promise<{
  depositAddress: string;
  signature?: string;
  minAmountOut: string;
  amountOut: string;
}> {
  const res = await postJson<IntentsQuoteResponse>(
    `${INTENTS_BASE}/v0/quote`,
    buildIntentsRequest({ ...params, dry: false }),
    30_000,
  );
  if (res.message || !res.quote) throw new ApiError(intentsMessage(res.message));
  const address = res.quote.depositAddress ?? res.quoteRequest?.depositAddress;
  if (!address) throw new ApiError($t("NEAR Intents yatıra adresi vermedi."));
  return {
    depositAddress: address,
    signature: res.signature,
    minAmountOut: res.quote.minAmountOut,
    amountOut: res.quote.amountOut,
  };
}

/** Kullanıcı yatırdığını bildirdiğinde işlem karması 1Click'e iletilir. */
export async function submitIntentsDeposit(
  depositAddress: string,
  txHash: string,
  signature?: string,
): Promise<void> {
  await postJson(`${INTENTS_BASE}/v0/deposit/submit`, { depositAddress, txHash, signature }, 20_000);
}

export interface IntentsProgress {
  status: IntentsStatus;
  originHash?: string;
  destinationHash?: string;
  amountOut?: string;
}

export async function fetchIntentsStatus(depositAddress: string): Promise<IntentsProgress> {
  const res = await fetchJson<StatusResponse>(
    `${INTENTS_BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
    {},
    15_000,
  );
  return {
    status: res.status,
    originHash: res.swapDetails?.originChainTxHashes?.[0]?.hash,
    destinationHash: res.swapDetails?.destinationChainTxHashes?.[0]?.hash,
    amountOut: res.swapDetails?.amountOut,
  };
}

export const INTENTS_STATUS_TEXT: Record<IntentsStatus, string> = {
  PENDING_DEPOSIT: $t("Yatırma bekleniyor"),
  KNOWN_DEPOSIT_TX: $t("Yatırma görüldü"),
  INCOMPLETE_DEPOSIT: $t("Yatırma eksik — tamamlanması bekleniyor"),
  PROCESSING: $t("Çözünücü işliyor"),
  SUCCESS: $t("Tamamlandı"),
  REFUNDED: $t("İade edildi"),
  FAILED: $t("Başarısız"),
};

function intentsMessage(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("failed to get quote"))
    return $t("NEAR Intents bu ortamda yatıra adresi üretemedi. Kotasyon geçerli; yürütme için tekrar dene.");
  if (m.includes("amount") && (m.includes("min") || m.includes("small")))
    return $t("Tutar NEAR Intents'in alt sınırının altında.");
  if (m.includes("refundto") || m.includes("recipient"))
    return $t("Alıcı veya iade adresi bu ağ için geçerli değil.");
  if (m.includes("deadline")) return $t("Kotasyon süresi doldu, yeniden fiyat al.");
  return raw ? `NEAR Intents: ${raw}` : $t("NEAR Intents kotasyon vermedi.");
}