import { t as $t } from "@/lib/i18n";
import { postJson } from "./http";


export interface RpcProbe {
  ok: boolean;
  chainId?: number;
  blockNumber?: number;
  latencyMs: number;
  error?: string;
}

interface Reply {
  result?: string;
  error?: { message?: string };
}

export function normalizeRpcUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function probeRpc(url: string, expectedChainId?: number): Promise<RpcProbe> {
  const normalized = normalizeRpcUrl(url);
  if (!normalized) {
    return { ok: false, latencyMs: 0, error: $t("Geçerli bir http(s) RPC adresi gir.") };
  }

  const started = performance.now();
  try {
    const replies = await postJson<Reply[] | Reply>(
      normalized,
      [
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] },
      ],
      10_000,
    );
    const list = Array.isArray(replies) ? replies : [replies];
    const chainReply = list.find((r) => r.result?.startsWith("0x"));
    const failed = list.find((r) => r.error);
    if (failed?.error) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: failed.error.message ?? $t("RPC hata döndürdü."),
      };
    }

    const chainId = chainReply?.result ? Number(BigInt(chainReply.result)) : undefined;
    const blockReply = list[1]?.result;
    const blockNumber = blockReply ? Number(BigInt(blockReply)) : undefined;

    if (chainId == null) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: $t("Uç EVM JSON-RPC yanıtı vermedi."),
      };
    }
    if (expectedChainId != null && chainId !== expectedChainId) {
      return {
        ok: false,
        chainId,
        latencyMs: Math.round(performance.now() - started),
        error: $t("Ağ kimliği uyuşmuyor: uç {0} döndürdü, beklenen {1}.", [chainId, expectedChainId]),
      };
    }

    return {
      ok: true,
      chainId,
      blockNumber,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error:
        e instanceof Error && e.message.includes("HTTP")
          ? $t("Uç yanıt vermedi ({0}).", [e.message])
          : $t("Uca ulaşılamadı. Adresi ve CORS erişimini kontrol et."),
    };
  }
}
