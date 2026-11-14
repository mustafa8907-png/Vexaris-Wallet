import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import type { TxStatus } from "@/types/transaction";
import { allChains, getChain } from "@/lib/chains/registry";
import { fetchJson } from "./http";
import { usdFor, type PriceSnapshot } from "./prices";


export type TxKind = "send" | "receive" | "swap" | "approve" | "contract" | "self";
export type TxDirection = "in" | "out" | "self";

export interface TxRecord {
  id: string;
  hash: string;
  chainId: string;
  direction: TxDirection;
  kind: TxKind;
  status: TxStatus;
  symbol: string;
  tokenName?: string;
  tokenAddress?: string;
  decimals: number;
  amount: number;
  usdValue: number;
  from: string;
  to: string;
  counterparty: string;
  counterpartyLabel?: string;
  timestamp: number;
  blockNumber?: number;
  feeNative?: number;
  feeUsd?: number;
  feeSymbol?: string;
  gasUsed?: number;
  gasPriceGwei?: number;
  nonce?: number;
  method?: string;
  methodLabel?: string;
  explorerUrl: string;
  isToken: boolean;
  confirmations?: number;
}

export type HistoryCursors = Record<string, Record<string, string | number> | null>;

export interface HistoryPage {
  records: TxRecord[];
  cursors: HistoryCursors;
  failed: string[];
  unsupported: string[];
  hasMore: boolean;
}

interface Party {
  hash?: string;
  name?: string | null;
  ens_domain_name?: string | null;
  is_contract?: boolean;
}

interface NativeTx {
  hash?: string;
  from?: Party;
  to?: Party | null;
  value?: string;
  timestamp?: string;
  status?: string | null;
  result?: string | null;
  block_number?: number | null;
  confirmations?: number;
  fee?: { value?: string } | null;
  gas_used?: string | null;
  gas_price?: string | null;
  nonce?: number;
  method?: string | null;
  transaction_types?: string[];
  created_contract?: Party | null;
}

interface TokenTransfer {
  transaction_hash?: string;
  log_index?: number;
  block_number?: number;
  timestamp?: string;
  method?: string | null;
  from?: Party;
  to?: Party;
  token_type?: string;
  token?: {
    address_hash?: string;
    address?: string;
    symbol?: string | null;
    name?: string | null;
    decimals?: string | null;
    reputation?: string | null;
    type?: string;
  };
  total?: { value?: string; decimals?: string | null };
}

interface Paged<T> {
  items?: T[];
  next_page_params?: Record<string, string | number> | null;
}

const PAGE_SIZE_NOTE = $t("Blockscout sayfa başına ~50 kayıt döner.");

export function historyChains(enabledChainIds: string[]): Chain[] {
  return allChains().filter((c) => c.kind === "evm" && enabledChainIds.includes(c.id));
}

export async function fetchHistoryPage(
  address: string,
  enabledChainIds: string[],
  cursors: HistoryCursors,
  prices: PriceSnapshot,
): Promise<HistoryPage> {
  const chains = historyChains(enabledChainIds);
  const self = address.toLowerCase();
  const records: TxRecord[] = [];
  const nextCursors: HistoryCursors = { ...cursors };
  const failed: string[] = [];
  const unsupported: string[] = [];

  await Promise.all(
    chains.map(async (chain) => {
      if (!chain.blockscoutUrl) {
        unsupported.push(chain.id);
        nextCursors[chain.id] = null;
        return;
      }
      if (chain.id in cursors && cursors[chain.id] === null) return;

      const base = `${chain.blockscoutUrl}/api/v2/addresses/${address}`;
      const cursor = cursors[chain.id];

      const [native, tokens] = await Promise.allSettled([
        fetchJson<Paged<NativeTx>>(`${base}/transactions${pageQuery(cursor)}`, {}, 18_000),
        fetchJson<Paged<TokenTransfer>>(
          `${base}/token-transfers?type=ERC-20${pageQuery(cursor, true)}`,
          {},
          18_000,
        ),
      ]);

      if (native.status === "rejected" && tokens.status === "rejected") {
        failed.push(chain.id);
        return;
      }

      const nativeItems = native.status === "fulfilled" ? native.value.items ?? [] : [];
      const tokenItems = tokens.status === "fulfilled" ? tokens.value.items ?? [] : [];

      const meta = new Map<string, NativeTx>();
      for (const item of nativeItems) {
        if (item.hash) meta.set(item.hash, item);
      }

      for (const item of nativeItems) {
        const record = mapNative(item, chain, self, prices);
        if (record) records.push(record);
      }
      for (const item of tokenItems) {
        const record = mapToken(item, chain, self, prices, meta);
        if (record) records.push(record);
      }

      const nativeNext =
        native.status === "fulfilled" ? native.value.next_page_params ?? null : null;
      const tokenNext =
        tokens.status === "fulfilled" ? tokens.value.next_page_params ?? null : null;

      nextCursors[chain.id] = nativeNext ?? tokenNext;
    }),
  );

  const unique = dedupe(records);
  markSwaps(unique, self);
  unique.sort((a, b) => b.timestamp - a.timestamp);

  const hasMore = chains.some((c) => nextCursors[c.id] != null);
  return { records: unique, cursors: nextCursors, failed, unsupported, hasMore };
}

function pageQuery(
  cursor: Record<string, string | number> | null | undefined,
  append = false,
): string {
  if (!cursor) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(cursor)) params.set(key, String(value));
  const query = params.toString();
  if (!query) return "";
  return append ? `&${query}` : `?${query}`;
}

function dedupe(records: TxRecord[]): TxRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function markSwaps(records: TxRecord[], self: string): void {
  const byHash = new Map<string, TxRecord[]>();
  for (const r of records) {
    if (!r.isToken) continue;
    const list = byHash.get(`${r.chainId}:${r.hash}`) ?? [];
    list.push(r);
    byHash.set(`${r.chainId}:${r.hash}`, list);
  }
  for (const list of byHash.values()) {
    const out = list.some((r) => r.from === self && r.to !== self);
    const incoming = list.some((r) => r.to === self && r.from !== self);
    if (out && incoming) {
      for (const r of list) {
        r.kind = "swap";
        r.direction = r.from === self ? "out" : "in";
      }
    }
  }
}

function mapNative(
  item: NativeTx,
  chain: Chain,
  self: string,
  prices: PriceSnapshot,
): TxRecord | null {
  if (!item.hash || !item.timestamp) return null;

  const from = item.from?.hash?.toLowerCase() ?? "";
  const to = (item.to?.hash ?? item.created_contract?.hash ?? "").toLowerCase();
  const amount = weiToNumber(item.value ?? "0");
  const isSelf = from === self && to === self;
  const direction: TxDirection = isSelf ? "self" : from === self ? "out" : "in";

  let kind: TxKind;
  if (amount > 0) {
    kind = isSelf ? "self" : direction === "in" ? "receive" : "send";
  } else {
    kind = contractKind(item.method, item.transaction_types);
  }

  const feeNative = direction === "out" || isSelf ? weiToNumber(item.fee?.value ?? "0") : undefined;
  const counterparty = direction === "in" ? item.from : item.to ?? item.created_contract;

  return {
    id: `${chain.id}:${item.hash}:native`,
    hash: item.hash,
    chainId: chain.id,
    direction,
    kind,
    status: statusOf(item.status, item.result),
    symbol: chain.nativeSymbol,
    tokenName: chain.name,
    decimals: 18,
    amount,
    usdValue: usdFor(prices, chain.id, chain.nativeSymbol, amount),
    from,
    to,
    counterparty: counterparty?.hash ?? "—",
    counterpartyLabel: labelOf(counterparty),
    timestamp: Date.parse(item.timestamp) || 0,
    blockNumber: item.block_number ?? undefined,
    feeNative,
    feeUsd:
      feeNative != null
        ? usdFor(prices, chain.id, chain.nativeSymbol, feeNative)
        : undefined,
    feeSymbol: chain.nativeSymbol,
    gasUsed: item.gas_used ? Number(item.gas_used) : undefined,
    gasPriceGwei: item.gas_price ? Number(item.gas_price) / 1e9 : undefined,
    nonce: item.nonce,
    method: item.method ?? undefined,
    methodLabel: methodLabel(item.method, kind),
    explorerUrl: `${chain.explorerUrl}/tx/${item.hash}`,
    isToken: false,
    confirmations: item.confirmations,
  };
}

function mapToken(
  item: TokenTransfer,
  chain: Chain,
  self: string,
  prices: PriceSnapshot,
  meta: Map<string, NativeTx>,
): TxRecord | null {
  const hash = item.transaction_hash;
  const symbol = item.token?.symbol?.trim();
  const contract = item.token?.address_hash ?? item.token?.address;
  if (!hash || !item.timestamp || !symbol || !contract) return null;
  if (item.token_type && item.token_type !== "ERC-20") return null;
  if (item.token?.reputation === "spam" || item.token?.reputation === "scam") return null;

  const decimals = Number(item.total?.decimals ?? item.token?.decimals ?? 18) || 18;
  const amount = rawToAmount(item.total?.value ?? "0", decimals);
  if (amount <= 0) return null;

  const from = item.from?.hash?.toLowerCase() ?? "";
  const to = item.to?.hash?.toLowerCase() ?? "";
  const isSelf = from === self && to === self;
  const direction: TxDirection = isSelf ? "self" : to === self ? "in" : "out";
  const parent = meta.get(hash);
  const feeNative =
    direction === "out" && parent ? weiToNumber(parent.fee?.value ?? "0") : undefined;

  return {
    id: `${chain.id}:${hash}:${item.log_index ?? 0}`,
    hash,
    chainId: chain.id,
    direction,
    kind: isSelf ? "self" : direction === "in" ? "receive" : "send",
    status: parent ? statusOf(parent.status, parent.result) : "confirmed",
    symbol,
    tokenName: item.token?.name?.trim() || symbol,
    tokenAddress: contract,
    decimals,
    amount,
    usdValue: usdFor(prices, chain.id, symbol, amount, contract),
    from,
    to,
    counterparty: (direction === "in" ? item.from?.hash : item.to?.hash) ?? "—",
    counterpartyLabel: labelOf(direction === "in" ? item.from : item.to),
    timestamp: Date.parse(item.timestamp) || 0,
    blockNumber: item.block_number ?? parent?.block_number ?? undefined,
    feeNative,
    feeUsd:
      feeNative != null
        ? usdFor(prices, chain.id, chain.nativeSymbol, feeNative)
        : undefined,
    feeSymbol: chain.nativeSymbol,
    gasUsed: parent?.gas_used ? Number(parent.gas_used) : undefined,
    gasPriceGwei: parent?.gas_price ? Number(parent.gas_price) / 1e9 : undefined,
    nonce: parent?.nonce,
    method: item.method ?? parent?.method ?? undefined,
    methodLabel: methodLabel(item.method ?? parent?.method, "send"),
    explorerUrl: `${chain.explorerUrl}/tx/${hash}`,
    isToken: true,
    confirmations: parent?.confirmations,
  };
}

function contractKind(method?: string | null, types?: string[]): TxKind {
  const selector = method?.slice(0, 10).toLowerCase();
  if (selector === "0x095ea7b3" || selector === "0xd505accf") return "approve";
  if (selector && SWAP_SELECTORS.has(selector)) return "swap";
  if (types?.includes("contract_creation")) return "contract";
  return "contract";
}

const SWAP_SELECTORS = new Set([
  "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x5c11d795", "0xfb3bdb41",
  "0x414bf389", "0xc04b8d59", "0xdb3e2198", "0x3593564c", "0x24856bc3",
  "0x12aa3caf", "0x5f575529", "0x415565b0", "0x5ae401dc", "0xac9650d8",
]);

const METHOD_NAMES: Record<string, string> = {
  "0x095ea7b3": $t("Onay (approve)"),
  "0xa9059cbb": "Transfer",
  "0x23b872dd": "TransferFrom",
  "0x3593564c": $t("Uniswap takas"),
  "0x12aa3caf": $t("1inch takas"),
  "0x414bf389": $t("Uniswap V3 takas"),
  "0x38ed1739": $t("Uniswap V2 takas"),
  "0x5f575529": $t("MetaMask takas"),
  "0xd0e30db0": $t("Yatır (deposit)"),
  "0x2e1a7d4d": $t("Çek (withdraw)"),
  "0xa694fc3a": "Stake",
  "0x2e17de78": "Unstake",
  "0x3ccfd60b": $t("Ödeme çek"),
  "0x40c10f19": "Mint",
  "0xa0712d68": "Mint",
  "0x1249c58b": "Mint",
  "0x6a761202": $t("Multisig işlemi"),
  "0xac9650d8": "Multicall",
  "0x5ae401dc": "Multicall",
};

function methodLabel(method: string | null | undefined, kind: TxKind): string | undefined {
  if (!method || method === "0x") return undefined;
  const named = METHOD_NAMES[method.slice(0, 10).toLowerCase()];
  if (named) return named;
  if (kind === "approve") return $t("Onay (approve)");
  if (kind === "contract") return $t("Sözleşme çağrısı");
  return undefined;
}

function labelOf(party?: Party | null): string | undefined {
  return party?.name ?? party?.ens_domain_name ?? undefined;
}

function statusOf(status?: string | null, result?: string | null): TxStatus {
  if (status === "ok" || result === "success") return "confirmed";
  if (status === "error" || result === "failed") return "failed";
  return "pending";
}

function weiToNumber(raw: string): number {
  return rawToAmount(raw, 18);
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

export function txExplorerUrl(chainId: string, hash: string): string {
  const chain = getChain(chainId);
  return chain ? `${chain.explorerUrl}/tx/${hash}` : hash;
}

export { PAGE_SIZE_NOTE };
