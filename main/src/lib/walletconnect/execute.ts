/**
 * Onaylanmış dApp isteğinin yürütülmesi.
 *
 * Buraya gelen her talep kullanıcının onay ekranından geçmiştir. Anahtar
 * hiçbir zaman JS'e gelmez: imza Rust IPC komutlarında üretilir. Risk
 * taraması burada, arayüzden bağımsız olarak tekrar yapılır — ekranda
 * gösterilen uyarı atlanmış olsa bile honeypot token imzalanmaz.
 */
import { t as $t } from "@/lib/i18n";
import { rpcBatch, hexToAmount } from "@/lib/api/rpc";
import { tokenRisk } from "@/lib/api/security";
import type { Chain } from "@/types/chain";
import { getChain } from "@/lib/chains/registry";
import { invoke } from "@/lib/tauri/ipc";
import { estimateFees, estimateGas, signAndSend } from "@/lib/swap/execute";
import { formatAmount } from "@/lib/utils";
import type { WcRequest } from "@/stores/walletConnectStore";
import {
  chainKeyOfCaip2,
  decodeCalldata,
  decodeTransaction,
  typedPayloadString,
  decodePersonalMessage,
} from "./requests";

/** Kullanıcıya gösterilecek yürütme hatası (ham RPC metni değil). */
export class WcExecutionError extends Error {}

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

const metaCache = new Map<string, TokenMeta>();

/** `symbol()` / `decimals()` — onay ekranındaki tutarları okunur kılmak için. */
export async function tokenMeta(chain: Chain, address: string): Promise<TokenMeta> {
  const key = `${chain.id}:${address.toLowerCase()}`;
  const cached = metaCache.get(key);
  if (cached) return cached;

  try {
    const [symbolHex, decimalsHex] = await rpcBatch<string>(chain, [
      { method: "eth_call", params: [{ to: address, data: "0x95d89b41" }, "latest"] },
      { method: "eth_call", params: [{ to: address, data: "0x313ce567" }, "latest"] },
    ]);
    const meta: TokenMeta = {
      symbol: decodeStringSymbol(symbolHex),
      decimals: Number(BigInt(decimalsHex && decimalsHex !== "0x" ? decimalsHex : "0x12")),
    };
    metaCache.set(key, meta);
    return meta;
  } catch {
    // Sembol okunamazsa adres gösterilir; kullanıcı tanımadığı sözleşmeyi görmeli.
    return { symbol: "", decimals: 18 };
  }
}

/** ABI'lenmiş `string` (dinamik tip) ya da doğrudan 32 baytluk değer. */
function decodeStringSymbol(hex?: string): string {
  if (!hex || hex === "0x") return "";
  const body = hex.replace(/^0x/, "");
  // Dinamik string: offset(32) + length(32) + baytlar
  const lengthHex = body.slice(64, 128);
  const length = Number.parseInt(lengthHex || "0", 16);
  const raw =
    length > 0 && length <= 32 ? body.slice(128, 128 + length * 2) : body.slice(0, 64);
  try {
    return new TextDecoder().decode(
      Uint8Array.from((raw.match(/[\da-f]{2}/gi) ?? []).map((byte) => Number.parseInt(byte, 16))),
    ).replace(/\0+$/, "");
  } catch {
    return "";
  }
}

export interface TxCost {
  gasLimitUnits: bigint;
  /** Ödenecek maksimum ağ ücreti (wei). */
  maxFeeUnits: bigint;
  /** dApp kendi gaz fiyatını gönderdiyse cüzdanın tahmini kullanılır. */
  feeOverridden: boolean;
}

export interface PreparedTransaction {
  chain: Chain;
  from: string;
  to: string;
  valueHex: string;
  dataHex: string;
  cost: TxCost;
  maxFeePerGasHex: string;
  maxPriorityFeeHex: string;
}

/**
 * Onay ekranı bu maliyeti gösterir; imza aynı `prepared` üzerinden yürür.
 * Ekran ve yürütme aynı nesneyi paylaşsın diye hazırlanan işlem kısa süre
 * burada tutulur — böylece kullanıcıya gösterilen gaz limiti ile imzalanan
 * limit ayrılamaz.
 */
const preparedCache = new Map<number, PreparedTransaction>();

/**
 * İstek verisini imzalanacak işleme çevirir ama İMZALAMAZ. Onay ekranı maliyeti
 * göstermek için bunu çağırır; `execute` aynı yoldan tekrar geçer.
 */
export async function prepareTransaction(request: WcRequest): Promise<PreparedTransaction> {
  const carried = preparedCache.get(request.id);
  if (carried) {
    preparedCache.delete(request.id);
    return carried;
  }

  const { chain, address } = resolve(request);
  const tx = decodeTransaction(request.params);
  if (!tx) throw new WcExecutionError($t("İşlem talebi okunamadı."));
  if (tx.from && tx.from.toLowerCase() !== address.toLowerCase()) {
    throw new WcExecutionError($t("İstek bu cüzdanın adresi dışındaki bir hesaptan gönderiyor."));
  }
  if (!tx.to) {
    throw new WcExecutionError($t("Sözleşme kurulumu onaylanmıyor — bunun için adresi bilmemiz gerek."));
  }

  const dataHex = tx.dataHex && tx.dataHex !== "0x" ? tx.dataHex : "0x";
  const valueHex = tx.valueHex ?? "0x0";
  const [fees, gasLimitHex] = await Promise.all([
    estimateFees(chain),
    tx.gasHex
      ? Promise.resolve(tx.gasHex)
      : estimateGas(chain, address, tx.to, valueHex, dataHex),
  ]);

  const gasLimitUnits = parseUnits(gasLimitHex);
  if (gasLimitUnits <= 0n) throw new WcExecutionError($t("Gaz limiti okunamadı."));

  const prepared: PreparedTransaction = {
    chain,
    from: address,
    to: tx.to,
    valueHex,
    dataHex,
    maxFeePerGasHex: fees.maxFeePerGasHex,
    maxPriorityFeeHex: fees.maxPriorityFeeHex,
    cost: {
      gasLimitUnits,
      maxFeeUnits: gasLimitUnits * BigInt(fees.maxFeePerGasHex),
      feeOverridden: Boolean(tx.gasPriceHex || tx.maxFeePerGasHex),
    },
  };

  // Ekran ile imza aynı işlem nesnesini görsün: tahmin tek sefer hesaplanır.
  if (preparedCache.size > 24) preparedCache.clear();
  preparedCache.set(request.id, prepared);
  return prepared;
}

/** İmzaya giden tek yol: onaylanmış `prepared` yayınlınır. */
async function broadcast(prepared: PreparedTransaction): Promise<string> {
  return signAndSend(prepared.chain, {
    from: prepared.from,
    to: prepared.to,
    valueHex: prepared.valueHex,
    dataHex: prepared.dataHex,
    gasLimitHex: `0x${prepared.cost.gasLimitUnits.toString(16)}`,
    maxFeePerGasHex: prepared.maxFeePerGasHex,
    maxPriorityFeeHex: prepared.maxPriorityFeeHex,
  });
}

/**
 * Risk perlonu: hedef sözleşme ve yetki verilen spender. `blocked` dönüşen
 * her şey imzaya gitmeden önce durdurur — ekrandaki uyarı atlanmış olsa bile.
 */
async function screenRisk(prepared: PreparedTransaction): Promise<void> {
  const call = decodeCalldata(prepared.dataHex);
  const targets = [prepared.to];
  if (call && "spender" in call) targets.push(call.spender);
  if (call && "operator" in call) targets.push(call.operator);

  for (const target of targets) {
    const risk = await tokenRisk(prepared.chain.id, target);
    if (risk.blocked) {
      throw new WcExecutionError(risk.reasons[0] ?? $t("Bu sözleşme güvenlik taramasında engellendi."));
    }
  }
}

/** Onay sonrası yürütme: imza + yayın, JSON-RPC sonucunu döner. */
export async function execute(request: WcRequest): Promise<unknown> {
  const { address } = resolve(request);

  switch (request.method) {
    case "eth_accounts":
      return [address];

    case "wallet_switchEthereumChain":
      // Oturumdaki ağlar zaten sunuldu; cüzdanın "etkin ağı" dApp'e göre değişmez.
      return null;

    case "personal_sign": {
      const { message } = decodePersonalMessage(request.params);
      return invoke<string>("personal_sign", { message, account: address });
    }

    case "eth_signTypedData_v4": {
      const payload = typedPayloadString(request.params);
      if (!payload) throw new WcExecutionError($t("Tip verisi okunamadı."));
      return invoke<string>("sign_typed_data", { payload, account: address });
    }

    case "eth_sendTransaction": {
      const prepared = await prepareTransaction(request);
      await screenRisk(prepared);
      return broadcast(prepared);
    }

    default:
      throw new WcExecutionError($t("Bu yöntem desteklenmiyor."));
  }
}

/** dApp'den gelen `0x` sayısı; okunamayan değer 0 sayılır ve işlem engellenir. */
function parseUnits(hex?: string): bigint {
  if (!hex || !/^0x[0-9a-fA-F]+$/.test(hex)) return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function resolve(request: WcRequest): { chain: Chain; address: string } {
  const chainKey = chainKeyOfCaip2(request.chainId);
  const chain = chainKey ? getChain(chainKey) : undefined;
  if (!chain || chain.kind !== "evm" || !chain.rpcUrl) {
    throw new WcExecutionError($t("Bu ağ için RPC ucu tanımlı değil."));
  }
  if (!request.address) throw new WcExecutionError($t("Oturumda paylaşılan adres bulunamadı."));
  return { chain, address: request.address };
}

/** wei → ondalıklı metin (yerel coin). */
export function nativeAmount(chain: Chain, units: bigint): string {
  const decimals = chain.nativeDecimals ?? 18;
  return `${formatAmount(hexToAmount(`0x${units.toString(16)}`, decimals), Math.min(decimals, 6))} ${chain.nativeSymbol}`;
}
