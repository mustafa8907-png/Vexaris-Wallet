import { t as $t } from "@/lib/i18n";
import { CHAINS, WATCH_CHAINS } from "@/lib/chains/config";
import { CHAIN_TOKENS, STABLE_SYMBOLS } from "@/lib/chains/tokens";
import { allChains, getChain } from "@/lib/chains/registry";
import { MARKET_COINS, type MarketCategory } from "@/lib/chains/market";
import { supportsIntents, swapAssets } from "@/lib/swap/assets";
import { coinId, llamaCurrentPrices, llamaRangeChange } from "@/lib/api/defillama";
import { coinList } from "@/lib/api/coingeckoList";
import type { Holding } from "@/types/chain";

export type TokenCategory = MarketCategory | "native" | "token" | "analysis";

export interface TokenEntry {
  key: string;
  symbol: string;
  name: string;
  chainId?: string;
  address?: string;
  coingeckoId?: string;
  llamaId?: string;
  category?: TokenCategory;
  swap: boolean;
  cross: boolean;
  verified: boolean;
  analysisOnly: boolean;
  owned: boolean;
  balance: number;
  balanceUsd: number;
  price: number;
  change24h?: number;
}

export interface TokenSearchOptions {
  query: string;
  holdings?: Holding[];
  chainId?: string;
  category?: TokenCategory | "all";
  ownedOnly?: boolean;
  swapOnly?: boolean;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface TokenSearchResult {
  rows: TokenEntry[];
  total: number;
}

export function normalizeTokenText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface AddressQuery {
  chainId: string;
  address: string;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BITCOIN_ADDRESS = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectAddress(query: string, defaultEvmChainId = "ethereum"): AddressQuery | null {
  const q = query.trim();
  if (EVM_ADDRESS.test(q)) {
    const active = defaultEvmChainId;
    const chain = getChain(active);
    const target = chain && chain.kind === "evm" ? active : "ethereum";
    return { chainId: target, address: q };
  }
  if (BITCOIN_ADDRESS.test(q) && !TRON_ADDRESS.test(q) && !SOLANA_ADDRESS.test(q))
    return { chainId: "bitcoin", address: q };
  if (TRON_ADDRESS.test(q)) return { chainId: "tron", address: q };
  if (SOLANA_ADDRESS.test(q)) return { chainId: "solana", address: q };
  return null;
}

export function tokenPath(entry: TokenEntry): string {
  if (entry.analysisOnly) return `/token/gecko/${entry.coingeckoId ?? entry.key}`;
  return `/token/${entry.chainId}/${entry.address ?? "native"}`;
}

function baseRows(): TokenEntry[] {
  const map = new Map<string, TokenEntry>();

  const ensure = (partial: Omit<TokenEntry, "swap" | "cross" | "verified" | "analysisOnly" | "owned" | "balance" | "balanceUsd" | "price">): TokenEntry => {
    const prev = map.get(partial.key);
    if (prev) return prev;
    const row: TokenEntry = {
      ...partial,
      swap: false,
      cross: false,
      verified: false,
      analysisOnly: false,
      owned: false,
      balance: 0,
      balanceUsd: 0,
      price: 0,
    };
    map.set(row.key, row);
    return row;
  };

  const chains = [...CHAINS, ...WATCH_CHAINS, ...allChains().filter((c) => !CHAINS.some((k) => k.id === c.id))];
  for (const chain of chains) {
    if (chain.derived && CHAINS.some((k) => k.id === chain.id)) continue;
    const row = ensure({
      key: `${chain.id}:native`,
      symbol: chain.nativeSymbol,
      name: chain.name,
      chainId: chain.id,
      coingeckoId: chain.coingeckoId,
      llamaId: coinId(chain) ?? undefined,
      category: "native",
    });
    row.verified = true;
  }

  for (const [chainId, list] of Object.entries(CHAIN_TOKENS)) {
    const chain = getChain(chainId);
    for (const token of list) {
      const row = ensure({
        key: `${chainId}:${token.address.toLowerCase()}`,
        symbol: token.symbol,
        name: token.name ?? token.symbol,
        chainId,
        address: token.address,
        coingeckoId: token.coingeckoId,
        llamaId: coinId(chain, token.address) ?? undefined,
        category: STABLE_SYMBOLS.has(token.symbol.toUpperCase()) ? "stable" : "token",
      });
      row.verified = true;
    }
  }

  for (const coin of MARKET_COINS) {
    const key = `${coin.chainId}:${coin.address ? coin.address.toLowerCase() : "native"}`;
    const row = map.get(key) ??
      ensure({
        key,
        symbol: coin.symbol,
        name: coin.name,
        chainId: coin.chainId,
        address: coin.address,
        coingeckoId: coin.coingeckoId,
        llamaId: coinId(getChain(coin.chainId), coin.address) ?? undefined,
      });
    row.category = coin.category;
    row.verified = true;
  }

  for (const asset of swapAssets()) {
    const key = `${asset.chainId}:${asset.address ? asset.address.toLowerCase() : "native"}`;
    const row = map.get(key) ??
      ensure({
        key,
        symbol: asset.symbol,
        name: asset.name,
        chainId: asset.chainId,
        address: asset.address,
        coingeckoId: asset.coingeckoId,
        llamaId: coinId(getChain(asset.chainId), asset.address) ?? (asset.coingeckoId ? `coingecko:${asset.coingeckoId}` : undefined),
        category: "token",
      });
    row.swap = true;
    if (supportsIntents(asset)) row.cross = true;
  }

  const symbolChains = new Map<string, Set<string>>();
  for (const row of map.values()) {
    if (!row.chainId) continue;
    const set = symbolChains.get(row.symbol.toUpperCase()) ?? new Set<string>();
    set.add(row.chainId);
    symbolChains.set(row.symbol.toUpperCase(), set);
  }
  for (const row of map.values()) {
    if ((symbolChains.get(row.symbol.toUpperCase())?.size ?? 0) > 1) row.cross = true;
  }

  return [...map.values()];
}

function applyHoldings(rows: TokenEntry[], holdings: Holding[]): TokenEntry[] {
  const out = rows.map((r) => ({ ...r }));
  const byKey = new Map(out.map((r) => [r.key, r]));
  for (const h of holdings) {
    if (h.amount <= 0) continue;
    const key = `${h.chainId}:${h.address?.toLowerCase() ?? "native"}`;
    let row = byKey.get(key);
    if (!row) {
      const chain = getChain(h.chainId);
      row = {
        key,
        symbol: h.tokenSymbol,
        name: h.name ?? h.tokenSymbol,
        chainId: h.chainId,
        address: h.address,
        llamaId: coinId(chain, h.address) ?? undefined,
        category: "token",
        swap: false,
        cross: false,
        verified: false,
        analysisOnly: false,
        owned: false,
        balance: 0,
        balanceUsd: 0,
        price: 0,
      };
      byKey.set(key, row);
      out.push(row);
    }
    row.owned = true;
    row.balance = h.amount;
    row.balanceUsd = h.usdValue;
    if (h.price && !row.price) row.price = h.price;
    if (h.change24h != null && row.change24h == null) row.change24h = h.change24h;
  }
  return out;
}

function scoreEntry(row: TokenEntry, nq: string, addr: AddressQuery | null): number | null {
  const ns = normalizeTokenText(row.symbol);
  const nn = normalizeTokenText(row.name);
  if (addr && row.address?.toLowerCase() === addr.address.toLowerCase()) return 280;
  if (addr && !row.address) return null;
  if (row.coingeckoId && row.coingeckoId === nq.replace(/ /g, "-")) return 140;
  if (ns && ns === nq) return 300;
  if (ns && ns.startsWith(nq)) return 220;
  if (nq.length >= 2 && ns && ns.includes(nq)) return 160;
  if (nn && nn.startsWith(nq)) return 130;
  if (nq.length >= 2 && nn && nn.includes(nq)) return 100;
  const chainName = normalizeTokenText(getChain(row.chainId ?? "")?.name ?? "");
  if (nq.length >= 3 && chainName && (chainName.startsWith(nq) || chainName.includes(nq))) return 70;
  return null;
}

function remoteScore(entry: { symbol: string; name: string; id: string }, nq: string): number | null {
  const ns = normalizeTokenText(entry.symbol);
  const nn = normalizeTokenText(entry.name);
  if (ns && ns === nq) return 95;
  if (ns && ns.startsWith(nq)) return 75;
  if (entry.id === nq.replace(/ /g, "-")) return 70;
  if (nq.length >= 3 && ns && ns.includes(nq)) return 55;
  if (nq.length >= 3 && nn && nn.startsWith(nq)) return 50;
  if (nq.length >= 4 && nn && nn.includes(nq)) return 40;
  return null;
}

function rankScore(base: number, row: TokenEntry): number {
  let score = base;
  if (row.owned) score += 40;
  if (row.price > 0) score += 10;
  if (row.verified) score += 8;
  if (row.swap) score += 4;
  return score;
}

let localCache: { ts: number; rows: TokenEntry[] } | null = null;
const LOCAL_TTL_MS = 60_000;

function localUniverse(holdings: Holding[]): TokenEntry[] {
  if (!localCache || Date.now() - localCache.ts > LOCAL_TTL_MS) {
    localCache = { ts: Date.now(), rows: baseRows() };
  }
  return applyHoldings(localCache.rows, holdings);
}

export function invalidateTokenUniverse(): void {
  localCache = null;
}

export async function searchTokens(opts: TokenSearchOptions): Promise<TokenSearchResult> {
  const q = opts.query.trim();
  const holdings = opts.holdings ?? [];
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  if (!q) {
    const rows = localUniverse(holdings)
      .filter((r) => !opts.chainId || r.chainId === opts.chainId)
      .filter((r) => opts.category === "all" || !opts.category || r.category === opts.category)
      .filter((r) => !opts.ownedOnly || r.owned)
      .filter((r) => !opts.swapOnly || r.swap);
    rows.sort((a, b) => {
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return b.price * b.balance - a.price * a.balance || b.price - a.price;
    });
    const page = rows.slice(offset, offset + limit);
    await enrich(page, opts.signal);
    return { rows: page, total: rows.length };
  }

  const nq = normalizeTokenText(q);
  const addr = detectAddress(q, opts.chainId);
  const local = localUniverse(holdings);
  const scored: { row: TokenEntry; score: number }[] = [];
  for (const row of local) {
    const base = scoreEntry(row, nq, addr);
    if (base == null) continue;
    if (opts.chainId && row.chainId !== opts.chainId) continue;
    if (opts.category && opts.category !== "all" && row.category !== opts.category) continue;
    if (opts.ownedOnly && !row.owned) continue;
    if (opts.swapOnly && !row.swap) continue;
    scored.push({ row, score: rankScore(base, row) });
  }

  const seenIds = new Set(local.map((r) => r.coingeckoId).filter(Boolean) as string[]);
  const list = nq.length >= 2 ? await coinList() : [];
  for (const entry of list) {
    if (seenIds.has(entry.id)) continue;
    const base = remoteScore(entry, nq);
    if (base == null) continue;
    scored.push({
      row: {
        key: `cg:${entry.id}`,
        symbol: entry.symbol,
        name: entry.name,
        coingeckoId: entry.id,
        llamaId: `coingecko:${entry.id}`,
        category: "analysis",
        swap: false,
        cross: false,
        verified: false,
        analysisOnly: true,
        owned: false,
        balance: 0,
        balanceUsd: 0,
        price: 0,
      },
      score: base,
    });
  }

  if (addr && !scored.some((s) => s.row.address?.toLowerCase() === addr.address.toLowerCase())) {
    const chain = getChain(addr.chainId);
    scored.push({
      row: {
        key: `${addr.chainId}:${addr.address.toLowerCase()}`,
        symbol: chain?.nativeSymbol ?? addr.chainId,
        name: $t("Sözleşme / adres"),
        chainId: addr.chainId,
        address: addr.address,
        llamaId: coinId(chain, addr.address) ?? undefined,
        category: "token",
        swap: false,
        cross: false,
        verified: false,
        analysisOnly: false,
        owned: false,
        balance: 0,
        balanceUsd: 0,
        price: 0,
      },
      score: 260,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const av = a.row.price * (a.row.owned ? a.row.balance : 1);
    const bv = b.row.price * (b.row.owned ? b.row.balance : 1);
    return bv - av;
  });

  const rows = scored.map((s) => s.row);
  const page = rows.slice(offset, offset + limit);
  await enrich(page, opts.signal);
  return { rows: page, total: rows.length };
}

const enrichCache = new Map<string, { ts: number; price: number; change?: number }>();
const ENRICH_TTL_MS = 45_000;

async function enrich(rows: TokenEntry[], signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  for (const row of rows) {
    if (row.price > 0 || !row.llamaId) continue;
    const hit = enrichCache.get(row.llamaId);
    if (hit && now - hit.ts < ENRICH_TTL_MS) {
      row.price = hit.price;
      row.change24h = hit.change;
      if (row.owned && row.balance > 0) row.balanceUsd = row.balance * hit.price;
    }
  }

  const missing = rows.filter((r) => !r.price && r.llamaId);
  if (missing.length === 0) return;
  const ids = [...new Set(missing.map((r) => r.llamaId).filter(Boolean) as string[])].slice(0, 40);
  if (ids.length === 0) return;

  try {
    const current = await llamaCurrentPrices(ids);
    if (signal?.aborted) return;
    for (const row of missing) {
      const hit = row.llamaId ? current[row.llamaId] : undefined;
      if (hit) {
        row.price = hit.price;
        if (row.owned && row.balance > 0) row.balanceUsd = row.balance * hit.price;
        if (row.llamaId) enrichCache.set(row.llamaId, { ts: Date.now(), price: hit.price });
      }
    }
    const changes = await llamaRangeChange(ids, current, "24h");
    if (signal?.aborted) return;
    for (const row of missing) {
      if (!row.change24h && row.llamaId && changes[row.llamaId] != null) {
        row.change24h = changes[row.llamaId];
        const cached = enrichCache.get(row.llamaId);
        if (cached) cached.change = changes[row.llamaId];
      }
    }
  } catch {
  }
}
