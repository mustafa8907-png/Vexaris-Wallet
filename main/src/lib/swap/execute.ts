import { t as $t } from "@/lib/i18n";
import { rpcBatch } from "@/lib/api/rpc";
import { getChain } from "@/lib/chains/registry";
import { invoke } from "@/lib/tauri/ipc";
import type { Chain } from "@/types/chain";
import type { UnsignedTx } from "@/types/transaction";
import { buildKyber } from "./kyber";
import { openIntentsDeposit, submitIntentsDeposit } from "./intents";
import type { SwapQuote } from "./types";
import type { SwapAsset } from "./assets";


export class ExecutionError extends Error {}

function chainOrThrow(chainId: string): Chain {
  const chain = getChain(chainId);
  if (!chain || chain.kind !== "evm" || !chain.rpcUrl)
    throw new ExecutionError($t("Bu ağ için RPC ucu tanımlı değil."));
  return chain;
}

function pad32(hex: string): string {
  return hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

export function encodeApprove(spender: string, amount: bigint): string {
  return `0x095ea7b3${pad32(spender)}${pad32(amount.toString(16))}`;
}

export async function erc20Allowance(
  chain: Chain,
  owner: string,
  token: string,
  spender: string,
): Promise<bigint> {
  const data = `0xdd62ed3e${pad32(owner)}${pad32(spender)}`;
  const [raw] = await rpcBatch<string>(chain, [
    { method: "eth_call", params: [{ to: token, data }, "latest"] },
  ]);
  try {
    return raw && raw !== "0x" ? BigInt(raw) : 0n;
  } catch {
    return 0n;
  }
}

export interface FeeEstimate {
  maxFeePerGasHex: string;
  maxPriorityFeeHex: string;
}

export async function estimateFees(chain: Chain): Promise<FeeEstimate> {
  try {
    const [base, tip] = await rpcBatch<string>(chain, [
      { method: "eth_gasPrice", params: [] },
      { method: "eth_maxPriorityFeePerGas", params: [] },
    ]);
    const gasPrice = BigInt(base);
    const priority = BigInt(tip);
    return {
      maxFeePerGasHex: `0x${(gasPrice + priority).toString(16)}`,
      maxPriorityFeeHex: `0x${priority.toString(16)}`,
    };
  } catch {
    const [base] = await rpcBatch<string>(chain, [{ method: "eth_gasPrice", params: [] }]);
    const gasPrice = BigInt(base);
    return {
      maxFeePerGasHex: `0x${((gasPrice * 13n) / 10n).toString(16)}`,
      maxPriorityFeeHex: `0x${(gasPrice / 10n).toString(16)}`,
    };
  }
}

async function nextNonce(chain: Chain, address: string): Promise<string> {
  const [nonce] = await rpcBatch<string>(chain, [
    { method: "eth_getTransactionCount", params: [address, "pending"] },
  ]);
  return nonce;
}

export async function signAndSend(
  chain: Chain,
  tx: Omit<UnsignedTx, "chainId" | "nonceHex">,
): Promise<string> {
  const nonceHex = await nextNonce(chain, tx.from);
  const signed = await invoke<{ rawHex: string; hash: string }>("sign_transaction", {
    tx: { ...tx, chainId: chain.chainId ?? 0, nonceHex },
  });
  const [hash] = await rpcBatch<string>(chain, [
    { method: "eth_sendRawTransaction", params: [signed.rawHex] },
  ]);
  return hash;
}

export interface TransferParams {
  chainId: string;
  sender: string;
  to: string;
  amountUnits: bigint;
  token?: string;
}

interface TransferRequest {
  chain: Chain;
  to: string;
  valueHex: string;
  dataHex: string;
}

function transferRequest(params: TransferParams): TransferRequest {
  const chain = chainOrThrow(params.chainId);
  return {
    chain,
    to: params.token ?? params.to,
    valueHex: params.token ? "0x0" : `0x${params.amountUnits.toString(16)}`,
    dataHex: params.token ? encodeTransfer(params.to, params.amountUnits) : "0x",
  };
}

export async function sendTransfer(
  params: TransferParams,
  feesOverride?: FeeEstimate,
): Promise<string> {
  const request = transferRequest(params);
  const [fees, gasLimitHex] = await Promise.all([
    feesOverride ? Promise.resolve(feesOverride) : estimateFees(request.chain),
    estimateGas(request.chain, params.sender, request.to, request.valueHex, request.dataHex),
  ]);
  return signAndSend(request.chain, {
    from: params.sender,
    to: request.to,
    valueHex: request.valueHex,
    dataHex: request.dataHex,
    gasLimitHex,
    ...fees,
  });
}

export interface FeeTier {
  key: "slow" | "normal" | "fast";
  maxFeePerGasHex: string;
  maxPriorityFeeHex: string;
  feeUnits: bigint;
}

export interface TransferTiers {
  gasLimitUnits: bigint;
  tiers: FeeTier[];
}

export async function estimateTransferTiers(params: TransferParams): Promise<TransferTiers> {
  const request = transferRequest(params);
  const [fees, gasLimitHex] = await Promise.all([
    estimateFees(request.chain),
    estimateGas(request.chain, params.sender, request.to, request.valueHex, request.dataHex),
  ]);
  const gasLimit = BigInt(gasLimitHex);
  const maxFee = BigInt(fees.maxFeePerGasHex);
  const tip = BigInt(fees.maxPriorityFeeHex);
  const base = maxFee > tip ? maxFee - tip : maxFee;

  const mk = (key: FeeTier["key"], t: bigint): FeeTier => {
    const max = base + t;
    return {
      key,
      maxFeePerGasHex: `0x${max.toString(16)}`,
      maxPriorityFeeHex: `0x${t.toString(16)}`,
      feeUnits: gasLimit * max,
    };
  };

  const slowTip = (tip * 4n) / 5n;
  const fastTip = (tip * 8n) / 5n;
  return {
    gasLimitUnits: gasLimit,
    tiers: [mk("slow", slowTip), mk("normal", tip), mk("fast", fastTip)],
  };
}

export interface TransferCost {
  gasLimitUnits: bigint;
  feeUnits: bigint;
}

export async function estimateTransferCost(params: TransferParams): Promise<TransferCost> {
  const request = transferRequest(params);
  const [fees, gasLimitHex] = await Promise.all([
    estimateFees(request.chain),
    estimateGas(request.chain, params.sender, request.to, request.valueHex, request.dataHex),
  ]);
  const gasLimitUnits = BigInt(gasLimitHex);
  return { gasLimitUnits, feeUnits: gasLimitUnits * BigInt(fees.maxFeePerGasHex) };
}

export function encodeTransfer(to: string, amount: bigint): string {
  return `0xa9059cbb${pad32(to)}${pad32(amount.toString(16))}`;
}

export async function estimateGas(
  chain: Chain,
  from: string,
  to: string,
  value: string,
  data: string,
): Promise<string> {
  const fallback = data === "0x" ? 21000n : 65000n;
  try {
    const [raw] = await rpcBatch<string>(chain, [
      { method: "eth_estimateGas", params: [{ from, to, value, data }] },
    ]);
    const estimate = BigInt(raw);
    if (estimate > 0n) return `0x${((estimate * 12n) / 10n).toString(16)}`;
  } catch {
  }
  return `0x${fallback.toString(16)}`;
}

export interface EvmSwapResult {
  hash: string;
  approveHash?: string;
  amountOut: string;
  routerAddress: string;
  calldataBytes: number;
}

export async function executeKyberSwap(params: {
  quote: SwapQuote;
  from: SwapAsset;
  sender: string;
  recipient: string;
  slippagePct: number;
  deadlineMinutes: number;
  onProgress?: (text: string) => void;
}): Promise<EvmSwapResult> {
  const { quote, from, sender, recipient, slippagePct, deadlineMinutes, onProgress } = params;
  if (!quote.kyber) throw new ExecutionError($t("Kyber rotası eksik."));
  const chain = chainOrThrow(from.chainId);

  onProgress?.($t("İşlem verisi hazırlanıyor"));
  const build = await buildKyber(
    quote.kyber,
    sender,
    recipient,
    slippagePct,
    deadlineMinutes * 60,
  );

  const fees = await estimateFees(chain);
  let approveHash: string | undefined;

  if (from.address) {
    onProgress?.($t("Token onayı denetleniyor"));
    const allowance = await erc20Allowance(chain, sender, from.address, build.to);
    if (allowance < quote.amountIn) {
      onProgress?.($t("Token onayı imzalanıyor"));
      approveHash = await signAndSend(chain, {
        from: sender,
        to: from.address,
        valueHex: "0x0",
        dataHex: encodeApprove(build.to, quote.amountIn),
        gasLimitHex: "0x186a0",
        ...fees,
      });
      onProgress?.($t("Onayın zincire yazılması bekleniyor"));
      await waitReceipt(chain, approveHash, 90_000);
    }
  }

  onProgress?.($t("Takas imzalanıyor"));
  const hash = await signAndSend(chain, {
    from: sender,
    to: build.to,
    valueHex: `0x${BigInt(build.value || "0").toString(16)}`,
    dataHex: build.data,
    gasLimitHex: `0x${((BigInt(build.gas) * 13n) / 10n).toString(16)}`,
    ...fees,
  });

  return {
    hash,
    approveHash,
    amountOut: build.amountOut,
    routerAddress: build.to,
    calldataBytes: Math.max(0, (build.data.length - 2) / 2),
  };
}

export async function waitReceipt(
  chain: Chain,
  hash: string,
  timeoutMs = 180_000,
): Promise<"confirmed" | "failed"> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const [receipt] = await rpcBatch<{ status: string } | null>(chain, [
        { method: "eth_getTransactionReceipt", params: [hash] },
      ]);
      if (receipt) return receipt.status === "0x1" ? "confirmed" : "failed";
    } catch {
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new ExecutionError($t("İşlem zaman aşımına uğradı — gezginden kontrol et."));
}

export interface IntentsDepositResult {
  depositAddress: string;
  signature?: string;
  amountOut: string;
  minAmountOut: string;
}

export async function executeIntentsDeposit(params: {
  quote: SwapQuote;
  from: SwapAsset;
  to: SwapAsset;
  refundTo: string;
  recipient: string;
  slippagePct: number;
  deadlineMinutes: number;
}): Promise<IntentsDepositResult> {
  const { quote, from, to, refundTo, recipient, slippagePct, deadlineMinutes } = params;
  const res = await openIntentsDeposit({
    from,
    to,
    amountIn: quote.amountIn,
    slippagePct,
    refundTo,
    recipient,
    deadlineMinutes,
  });
  return res;
}

export async function fundIntentsFromEvm(params: {
  from: SwapAsset;
  amountIn: bigint;
  depositAddress: string;
  signature?: string;
  sender: string;
  onProgress?: (text: string) => void;
}): Promise<string> {
  const { from, amountIn, depositAddress, signature, sender, onProgress } = params;
  const chain = chainOrThrow(from.chainId);
  const fees = await estimateFees(chain);

  onProgress?.($t("Yatırma işlemi imzalanıyor"));
  const hash = await signAndSend(chain, {
    from: sender,
    to: from.address ?? depositAddress,
    valueHex: from.address ? "0x0" : `0x${amountIn.toString(16)}`,
    dataHex: from.address
      ? `0xa9059cbb${pad32(depositAddress)}${pad32(amountIn.toString(16))}`
      : "0x",
    gasLimitHex: from.address ? "0x186a0" : "0x5208",
    ...fees,
  });

  onProgress?.($t("Yatırma 1Click'e bildiriliyor"));
  await submitIntentsDeposit(depositAddress, hash, signature).catch(() => undefined);
  return hash;
}