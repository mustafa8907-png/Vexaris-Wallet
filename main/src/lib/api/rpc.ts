import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import { postJson } from "./http";

export interface RpcCall {
  method: string;
  params: unknown[];
}

interface RpcReply<T> {
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Zincirin RPC'sine toplu JSON-RPC isteği gönderir.
 * Birincil uç başarısız olursa yedek uçlar sırayla denenir.
 */
export async function rpcBatch<T = unknown>(chain: Chain, calls: RpcCall[]): Promise<T[]> {
  if (calls.length === 0) return [];

  const endpoints = [chain.rpcUrl, ...(chain.rpcFallbacks ?? [])];
  const payload = calls.map((call, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: call.method,
    params: call.params,
  }));

  let lastError: unknown;
  for (const url of endpoints) {
    try {
      const replies = await postJson<RpcReply<T>[] | RpcReply<T>>(url, payload, 10_000);
      const list = Array.isArray(replies) ? replies : [replies];
      if (list.length !== calls.length) throw new Error($t("Eksik RPC yanıtı"));

      const failed = list.find((r) => r.error);
      if (failed?.error) throw new Error(`${failed.error.code}: ${failed.error.message}`);

      return list.map((r) => r.result as T);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error($t("RPC erişilemedi"));
}

/** `0x...` hex miktarı ondalıklı sayıya çevirir. */
export function hexToAmount(hex: string, decimals: number): number {
  if (!hex || hex === "0x") return 0;
  try {
    const raw = BigInt(hex);
    if (raw === 0n) return 0;
    // BigInt'i doğrudan Number'a çevirmek taşabilir; önce böl, sonra kesir ekle.
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const frac = raw % base;
    return Number(whole) + Number(frac) / Number(base);
  } catch {
    return 0;
  }
}
