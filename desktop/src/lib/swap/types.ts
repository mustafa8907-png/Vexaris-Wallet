import type { EngineId } from "./config";

/** Rotanın ekranda çizilen tek adımı. */
export interface RouteHop {
  label: string;
  detail: string;
  /** Paralel rotalarda bu adımın payı (0–1). */
  share: number;
  kind: "dex" | "bridge" | "wrap" | "settle";
}

export interface KyberBuild {
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  amountOut: string;
  amountOutUsd: number;
  priceImpactPct: number;
}

export interface KyberPayload {
  chain: string;
  routeSummary: unknown;
  routerAddress: string;
  gas: bigint;
  gasPrice: bigint;
}

export interface IntentsPayload {
  /** Kuru kotasyon talebi — yürütmede `dry:false` ile yeniden istenir. */
  request: Record<string, unknown>;
  depositAddress?: string;
  signature?: string;
  withdrawFee: bigint;
  refundFee: bigint;
}

export interface SwapQuote {
  id: string;
  engine: EngineId;
  fromId: string;
  toId: string;
  /** En küçük birim cinsinden, komisyon düşülmüş net tutarlar. */
  amountIn: bigint;
  amountOut: bigint;
  minAmountOut: bigint;
  amountInUsd: number;
  amountOutUsd: number;
  /** Çıkış varlığından kesilen Vexaris komisyonu. */
  feeUnits: bigint;
  feeUsd: number;
  feeRecipient: string;
  /** Motorun kendi protokol payı (1Click varsayılan ortağı). */
  protocolFeeUsd: number;
  protocolFeeBps: number;
  networkFeeUsd: number;
  networkFeeNative: number;
  networkFeeSymbol: string;
  priceImpactPct: number;
  /** 1 birim giriş karşılığında alınan çıkış. */
  rate: number;
  etaSeconds: number;
  etaLow: number;
  etaHigh: number;
  hops: RouteHop[];
  createdAt: number;
  expiresAt: number;
  kyber?: KyberPayload;
  intents?: IntentsPayload;
}

export type QuoteFailure = { engine: EngineId; reason: string };

export interface QuoteResult {
  best: SwapQuote | null;
  all: SwapQuote[];
  failures: QuoteFailure[];
}

/** Takas emri — kalıcı geçmişte saklanır. */
export type OrderStage =
  | "hazirlaniyor"
  | "yatirma-bekleniyor"
  | "gonderildi"
  | "isleniyor"
  | "tamamlandi"
  | "iade"
  | "basarisiz"
  | "iptal";

/** Emrin geçtiği aşama — geçmiş ekranındaki zaman çizelgesi bunu okur. */
export interface OrderTrail {
  stage: OrderStage;
  at: number;
  text?: string;
}

export interface SwapOrder {
  id: string;
  createdAt: number;
  updatedAt: number;
  engine: EngineId;
  fromId: string;
  toId: string;
  fromSymbol: string;
  toSymbol: string;
  fromChainId: string;
  toChainId: string;
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  amountInDecimals: number;
  amountOutDecimals: number;
  amountInUsd: number;
  amountOutUsd: number;
  feeUsd: number;
  feeRecipient: string;
  networkFeeUsd: number;
  etaSeconds: number;
  slippagePct: number;
  stage: OrderStage;
  trail?: OrderTrail[];
  /** EVM işlem karması veya 1Click yatıra adresi. */
  txHash?: string;
  depositAddress?: string;
  originChainId?: string;
  destinationChainId?: string;
  statusText?: string;
  simulated: boolean;
  error?: string;
}