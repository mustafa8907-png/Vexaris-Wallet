import { t as $t } from "@/lib/i18n";
import { fetchJson, postJson, ApiError } from "@/lib/api/http";
import { getChain } from "@/lib/chains/registry";
import {
  BLOCK_SECONDS,
  FEE_BPS,
  FEE_RECIPIENT_EVM,
  KYBER_BASE,
  KYBER_CLIENT_ID,
  QUOTE_TTL_MS,
} from "./config";
import { kyberTarget, type SwapAsset } from "./assets";
import { applySlippage, unitsToNumber } from "./units";
import type { KyberBuild, KyberPayload, RouteHop, SwapQuote } from "./types";


interface KyberSwap {
  pool: string;
  tokenIn: string;
  tokenOut: string;
  swapAmount: string;
  amountOut: string;
  exchange: string;
  gas: number;
}

interface KyberSummary {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInUsd: string;
  amountOut: string;
  amountOutUsd: string;
  gas: string;
  gasPrice: string;
  gasUsd: string;
  route: KyberSwap[][];
  routerAddress: string;
  routeID: string;
}

interface RoutesResponse {
  code: number;
  message: string;
  data?: { routeSummary: KyberSummary; routerAddress: string };
}

interface BuildResponse {
  code: number;
  message: string;
  data?: {
    amountIn: string;
    amountOut: string;
    amountOutUsd: string;
    gas: string;
    gasUsd: string;
    data: string;
    routerAddress: string;
    transactionValue: string;
    outputChange?: { percent: number };
  };
}

const headers = { "x-client-id": KYBER_CLIENT_ID, "x-client-name": "Vexaris Wallet" };

export interface KyberQuoteParams {
  from: SwapAsset;
  to: SwapAsset;
  amountIn: bigint;
  slippagePct: number;
}

export async function quoteKyber({
  from,
  to,
  amountIn,
  slippagePct,
}: KyberQuoteParams): Promise<SwapQuote> {
  const src = kyberTarget(from);
  const dst = kyberTarget(to);
  if (!src || !dst) throw new ApiError($t("Bu ağ KyberSwap'ta yok."));
  if (src.chain !== dst.chain) throw new ApiError($t("KyberSwap yalnızca aynı ağda takas yapar."));
  if (src.token.toLowerCase() === dst.token.toLowerCase())
    throw new ApiError($t("Aynı token için takas yapılamaz."));

  const url =
    `${KYBER_BASE}/${src.chain}/api/v1/routes` +
    `?tokenIn=${src.token}&tokenOut=${dst.token}&amountIn=${amountIn}` +
    `&saveGas=0&gasInclude=1&slippageTolerance=${Math.round(slippagePct * 100)}` +
    `&chargeFeeBy=currency_out&feeReceiver=${FEE_RECIPIENT_EVM}` +
    `&feeAmount=${FEE_BPS}&isInBps=true`;

  const res = await fetchJson<RoutesResponse>(url, { headers }, 15_000);
  if (res.code !== 0 || !res.data) throw new ApiError(kyberMessage(res.message));

  const s = res.data.routeSummary;
  const out = BigInt(s.amountOut);
  const inUsd = Number(s.amountInUsd) || 0;
  const outUsd = Number(s.amountOutUsd) || 0;
  const outUi = unitsToNumber(out, to.decimals);
  const toPrice = outUi > 0 ? outUsd / outUi : 0;
  const feeUnits = (out * BigInt(FEE_BPS)) / BigInt(10_000 - FEE_BPS);
  const block = BLOCK_SECONDS[from.chainId] ?? 12;
  const now = Date.now();

  const payload: KyberPayload = {
    chain: src.chain,
    routeSummary: s,
    routerAddress: s.routerAddress ?? res.data.routerAddress,
    gas: BigInt(s.gas || "0"),
    gasPrice: BigInt(s.gasPrice || "0"),
  };

  return {
    id: `kyber-${s.routeID ?? now}`,
    engine: "kyber",
    fromId: from.id,
    toId: to.id,
    amountIn,
    amountOut: out,
    minAmountOut: applySlippage(out, slippagePct),
    amountInUsd: inUsd,
    amountOutUsd: outUsd,
    feeUnits,
    feeUsd: unitsToNumber(feeUnits, to.decimals) * toPrice,
    feeRecipient: FEE_RECIPIENT_EVM,
    protocolFeeUsd: 0,
    protocolFeeBps: 0,
    networkFeeUsd: Number(s.gasUsd) || 0,
    networkFeeNative: unitsToNumber(payload.gas * payload.gasPrice, 18),
    networkFeeSymbol: getChain(from.chainId)?.nativeSymbol ?? "ETH",
    priceImpactPct: inUsd > 0 ? ((outUsd / (1 - FEE_BPS / 10_000) - inUsd) / inUsd) * 100 : 0,
    rate:
      unitsToNumber(amountIn, from.decimals) > 0
        ? outUi / unitsToNumber(amountIn, from.decimals)
        : 0,
    etaSeconds: block * 2,
    etaLow: block,
    etaHigh: block * 5,
    hops: describeRoute(s, from, to),
    createdAt: now,
    expiresAt: now + QUOTE_TTL_MS,
    kyber: payload,
  };
}

export async function buildKyber(
  payload: KyberPayload,
  sender: string,
  recipient: string,
  slippagePct: number,
  deadlineSeconds: number,
): Promise<KyberBuild> {
  const res = await postJson<BuildResponse>(
    `${KYBER_BASE}/${payload.chain}/api/v1/route/build`,
    {
      routeSummary: payload.routeSummary,
      sender,
      recipient,
      slippageTolerance: Math.round(slippagePct * 100),
      deadline: Math.floor(Date.now() / 1000) + deadlineSeconds,
      source: KYBER_CLIENT_ID,
    },
    20_000,
  );
  if (res.code !== 0 || !res.data) throw new ApiError(kyberMessage(res.message));

  const d = res.data;
  return {
    to: d.routerAddress,
    data: d.data,
    value: d.transactionValue ?? "0",
    gas: d.gas,
    gasPrice: payload.gasPrice.toString(),
    amountOut: d.amountOut,
    amountOutUsd: Number(d.amountOutUsd) || 0,
    priceImpactPct: d.outputChange?.percent ?? 0,
  };
}

function describeRoute(s: KyberSummary, from: SwapAsset, to: SwapAsset): RouteHop[] {
  const paths = s.route ?? [];
  const total = BigInt(s.amountIn || "1");
  const hops: RouteHop[] = [];

  if (paths.length === 0) {
    return [{ label: "KyberSwap", detail: `${from.symbol} → ${to.symbol}`, share: 1, kind: "dex" }];
  }

  for (const path of paths.slice(0, 4)) {
    const first = path[0];
    if (!first) continue;
    const share = total > 0n ? Number((BigInt(first.swapAmount) * 1000n) / total) / 1000 : 1;
    const legs = path.map((p) => prettyExchange(p.exchange));
    hops.push({
      label: legs[0] ?? "DEX",
      detail:
        path.length > 1
          ? $t("{0} adım · {1}", [path.length, legs.slice(1).join(" → ")])
          : `${from.symbol} → ${to.symbol}`,
      share,
      kind: "dex",
    });
  }

  const sum = hops.reduce((a, h) => a + h.share, 0);
  if (sum > 0 && Math.abs(sum - 1) > 0.01) {
    for (const h of hops) h.share = h.share / sum;
  }
  return hops;
}

const EXCHANGE_NAMES: Record<string, string> = {
  uniswapv2: "Uniswap V2",
  uniswapv3: "Uniswap V3",
  uniswapv4: "Uniswap V4",
  sushiswap: "SushiSwap",
  pancakeswap: "PancakeSwap",
  "pancakeswap-v3": "PancakeSwap V3",
  curve: "Curve",
  balancer: "Balancer",
  "balancer-v2": "Balancer V2",
  "balancer-v3": "Balancer V3",
  quickswap: "QuickSwap",
  traderjoe: "Trader Joe",
  camelot: "Camelot",
  aerodrome: "Aerodrome",
  velodrome: "Velodrome",
  syncswap: "SyncSwap",
  maverick: "Maverick",
  "maverick-v2": "Maverick V2",
  dodo: "DODO",
  wombat: "Wombat",
  thena: "Thena",
  "algebra-integral": "Algebra",
};

function prettyExchange(raw: string): string {
  const key = (raw ?? "").toLowerCase().split("/").pop() ?? "";
  if (EXCHANGE_NAMES[key]) return EXCHANGE_NAMES[key];
  if (key.startsWith("pmm")) return "Kyber PMM";
  return key
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function kyberMessage(raw: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("no route") || m.includes("not found") || m.includes("no pool"))
    return $t("Bu çift için KyberSwap rotası bulunamadı.");
  if (m.includes("amount") && m.includes("small")) return $t("Tutar bu rota için çok küçük.");
  if (m.includes("token")) return $t("Token bu ağda KyberSwap tarafından desteklenmiyor.");
  return raw ? `KyberSwap: ${raw}` : $t("KyberSwap kotasyon vermedi.");
}