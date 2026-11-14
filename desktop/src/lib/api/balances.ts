import type { Chain, Holding } from "@/types/chain";
import { liveEvmChains } from "@/lib/chains/registry";
import { CHAIN_TOKENS } from "@/lib/chains/tokens";
import { isSpamToken } from "@/lib/assets/filters";
import { fetchJson } from "./http";
import { hexToAmount, rpcBatch, type RpcCall } from "./rpc";

/**
 * Gerçek bakiyeler.
 *
 * İki kaynak birleştirilir:
 *  - RPC: yerel coin (`eth_getBalance`) + bilinen ERC-20'ler (`balanceOf`).
 *    Tek toplu istekte okunur, en taze ve en güvenilir kaynaktır.
 *  - Blockscout: adreste bulunan TÜM ERC-20'ler. Bilinen listede olmayan
 *    tokenlar da böylece gerçek sözleşme adresiyle görünür.
 *
 * USD değeri burada hesaplanmaz; fiyat katmanı sonradan uygular.
 */

export interface HoldingsResult {
  holdings: Holding[];
  /** RPC'sine hiç ulaşılamayan ağlar. */
  failed: string[];
  /** Token keşfi yapılamayan ama bakiyesi okunan ağlar. */
  partial: string[];
  /** Token keşfi kaynağı hiç olmayan ağlar — geçici arıza değil, kalıcı eksik. */
  noSource: string[];
}

interface BlockscoutTokenItem {
  value?: string;
  token?: {
    address_hash?: string;
    address?: string;
    symbol?: string | null;
    name?: string | null;
    decimals?: string | null;
    type?: string;
    reputation?: string | null;
  };
}

export async function fetchHoldings(
  address: string,
  enabledChainIds: string[],
): Promise<HoldingsResult> {
  const chains = liveEvmChains(enabledChainIds);
  const holdings: Holding[] = [];
  const failed: string[] = [];
  const partial: string[] = [];
  const noSource: string[] = [];

  await Promise.all(
    chains.map(async (chain) => {
      const [rpc, discovered] = await Promise.all([
        readRpcBalances(chain, address).catch(() => null),
        discoverTokens(chain, address).catch(() => null),
      ]);

      if (!rpc && !discovered) {
        failed.push(chain.id);
        return;
      }
      if (!discovered) (chain.blockscoutUrl ? partial : noSource).push(chain.id);

      const merged = new Map<string, Holding>();

      if (rpc) {
        if (rpc.native > 0) {
          merged.set("native", {
            chainId: chain.id,
            tokenSymbol: chain.nativeSymbol,
            name: chain.name,
            amount: rpc.native,
            usdValue: 0,
            decimals: chain.nativeDecimals ?? 18,
          });
        }
        for (const token of rpc.tokens) {
          merged.set(token.address!.toLowerCase(), token);
        }
      }

      for (const token of discovered ?? []) {
        const key = token.address!.toLowerCase();
        // RPC okuması varsa o tutar esas alınır; keşif yalnızca eksikleri tamamlar.
        if (!merged.has(key)) merged.set(key, token);
      }

      holdings.push(...merged.values());
    }),
  );

  holdings.sort((a, b) => b.usdValue - a.usdValue);
  return { holdings, failed, partial, noSource };
}

async function readRpcBalances(
  chain: Chain,
  address: string,
): Promise<{ native: number; tokens: Holding[] }> {
  const defs = CHAIN_TOKENS[chain.id] ?? [];
  const calls: RpcCall[] = [
    { method: "eth_getBalance", params: [address, "latest"] },
    ...defs.map((token) => ({
      method: "eth_call",
      params: [{ to: token.address, data: balanceOfData(address) }, "latest"],
    })),
  ];

  const results = await rpcBatch<string>(chain, calls);
  const native = hexToAmount(results[0] ?? "0x0", chain.nativeDecimals ?? 18);
  const tokens: Holding[] = [];

  defs.forEach((token, i) => {
    const amount = hexToAmount(results[i + 1] ?? "0x0", token.decimals);
    if (amount <= 0) return;
    tokens.push({
      chainId: chain.id,
      tokenSymbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals,
      amount,
      usdValue: 0,
    });
  });

  return { native, tokens };
}

async function discoverTokens(chain: Chain, address: string): Promise<Holding[] | null> {
  if (!chain.blockscoutUrl) return null;

  const url = `${chain.blockscoutUrl}/api/v2/addresses/${address}/tokens?type=ERC-20`;
  const data = await fetchJson<{ items?: BlockscoutTokenItem[] }>(url, {}, 20_000);
  const out: Holding[] = [];

  for (const item of data.items ?? []) {
    const token = item.token;
    const contract = token?.address_hash ?? token?.address;
    const symbol = token?.symbol?.trim();
    if (!contract || !symbol) continue;
    if (token?.type && token.type !== "ERC-20") continue;
    if (token?.reputation === "spam" || token?.reputation === "scam") continue;

    const decimals = Number(token?.decimals ?? 18);
    const amount = rawToAmount(item.value ?? "0", Number.isFinite(decimals) ? decimals : 18);
    if (amount <= 0) continue;

    const name = token?.name?.trim() || symbol;
    if (isSpamToken(symbol, name)) continue;

    out.push({
      chainId: chain.id,
      tokenSymbol: symbol,
      name,
      address: contract,
      decimals: Number.isFinite(decimals) ? decimals : 18,
      amount,
      usdValue: 0,
    });
  }
  return out;
}

function rawToAmount(raw: string, decimals: number): number {
  try {
    const value = BigInt(raw);
    if (value <= 0n) return 0;
    const base = 10n ** BigInt(Math.min(Math.max(decimals, 0), 30));
    return Number(value / base) + Number(value % base) / Number(base);
  } catch {
    return 0;
  }
}

function balanceOfData(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "");
  return `0x70a08231${hex.padStart(64, "0")}`;
}
