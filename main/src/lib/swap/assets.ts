import { CHAINS, WATCH_CHAINS } from "@/lib/chains/config";
import { CHAIN_TOKENS } from "@/lib/chains/tokens";
import { getChain } from "@/lib/chains/registry";
import { fetchJson } from "@/lib/api/http";
import { INTENTS_BASE, INTENTS_CHAINS, INTENTS_TO_CHAIN, KYBER_CHAINS } from "./config";

/**
 * Takas varlık evreni.
 *
 * Temel liste cüzdanın kendi zincir/token kaydından gelir; üzerine 1Click'in
 * canlı token listesi bindirilir. Böylece cbBTC, Tron USDT veya Solana SPL
 * tokenları gibi yerel kayıtta olmayan varlıklar da takasa açılır ve her
 * varlığın hangi motorda işlem gördüğü tek yerden çözülür.
 */

export interface SwapAsset {
  /** "zincir:sözleşme" — portföy anahtarıyla aynı biçim. */
  id: string;
  symbol: string;
  name: string;
  chainId: string;
  address?: string;
  decimals: number;
  coingeckoId?: string;
  /** 1Click `assetId`; yoksa NEAR Intents bu varlığı desteklemiyor. */
  intentsId?: string;
  /** 1Click'in bildirdiği anlık USD fiyatı. */
  intentsPrice?: number;
}

const NATIVE_DECIMALS: Record<string, number> = {
  bitcoin: 8,
  litecoin: 8,
  bitcoincash: 8,
  dogecoin: 8,
  solana: 9,
  sui: 9,
  ton: 9,
  near: 24,
  aptos: 8,
  cardano: 6,
  stellar: 7,
  tron: 6,
  ripple: 6,
};

const NATIVE_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Ethereum",
  base: "Ethereum",
  optimism: "Ethereum",
  linea: "Ethereum",
  unichain: "Ethereum",
  polygon: "Polygon",
  bsc: "BNB",
  avalanche: "Avalanche",
  gnosis: "xDai",
  celo: "Celo",
  sonic: "Sonic",
  monad: "Monad",
  arc: "USD Coin",
  bitcoin: "Bitcoin",
  litecoin: "Litecoin",
  bitcoincash: "Bitcoin Cash",
  solana: "Solana",
  tron: "Tron",
  ton: "Toncoin",
  near: "NEAR",
  aptos: "Aptos",
  sui: "Sui",
  cardano: "Cardano",
  stellar: "Stellar",
  ripple: "XRP",
  dogecoin: "Dogecoin",
};

export function assetId(chainId: string, address?: string): string {
  return `${chainId}:${address ? address.toLowerCase() : "native"}`;
}

/** Yerel kayıt + canlı 1Click listesinin birleşimi. */
let universe: SwapAsset[] = buildStatic();
let listeners: (() => void) | null = null;
let loadTask: Promise<SwapAsset[]> | null = null;
let loadedAt = 0;

function buildStatic(): SwapAsset[] {
  const out: SwapAsset[] = [];
  const seen = new Set<string>();

  const push = (a: SwapAsset) => {
    if (seen.has(a.id)) return;
    seen.add(a.id);
    out.push(a);
  };

  for (const chain of [...CHAINS, ...WATCH_CHAINS]) {
    push({
      id: assetId(chain.id),
      symbol: chain.nativeSymbol,
      name: NATIVE_NAMES[chain.id] ?? chain.name,
      chainId: chain.id,
      decimals: chain.nativeDecimals ?? NATIVE_DECIMALS[chain.id] ?? 18,
      coingeckoId: chain.coingeckoId,
    });
  }

  for (const [chainId, tokens] of Object.entries(CHAIN_TOKENS)) {
    for (const t of tokens) {
      push({
        id: assetId(chainId, t.address),
        symbol: t.symbol,
        name: t.name ?? t.symbol,
        chainId,
        address: t.address,
        decimals: t.decimals,
        coingeckoId: t.coingeckoId,
      });
    }
  }

  return out;
}

export function swapAssets(): SwapAsset[] {
  return universe;
}

export function findAsset(id: string): SwapAsset | undefined {
  return universe.find((a) => a.id === id);
}

export function onAssetsChanged(fn: () => void): () => void {
  listeners = fn;
  return () => {
    if (listeners === fn) listeners = null;
  };
}

interface IntentsToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string;
  coingeckoId?: string;
}

const TOKENS_TTL = 10 * 60_000;

/** Canlı token listesini çeker ve evrene bindirir. Hata olursa yerel liste kalır. */
export function loadSwapAssets(force = false): Promise<SwapAsset[]> {
  if (!force && loadedAt && Date.now() - loadedAt < TOKENS_TTL) return Promise.resolve(universe);
  if (loadTask) return loadTask;

  loadTask = fetchJson<IntentsToken[]>(`${INTENTS_BASE}/v0/tokens`, {}, 15_000)
    .then((tokens) => {
      universe = mergeIntents(buildStatic(), tokens);
      loadedAt = Date.now();
      listeners?.();
      return universe;
    })
    .catch(() => {
      // Liste alınamazsa yerel varlıklarla devam edilir; Kyber yolu çalışır.
      loadedAt = Date.now();
      return universe;
    })
    .finally(() => {
      loadTask = null;
    });

  return loadTask;
}

/** 1Click varlığının zincirin yerel coinini mi temsil ettiği. */
function isNativeAsset(t: IntentsToken, slug: string): boolean {
  if (!t.contractAddress) return true;
  if (/^0x0{40}$/i.test(t.contractAddress)) return true;
  if (t.assetId === `nep141:${slug}.omft.near` || t.assetId === `nep141:${slug}.omdep.near`) return true;
  return t.assetId.endsWith("_11111111111111111111");
}

function mergeIntents(base: SwapAsset[], tokens: IntentsToken[]): SwapAsset[] {
  const byId = new Map(base.map((a) => [a.id, { ...a }]));

  // Aynı zincir + sembol için birden fazla varlık varsa eski (DEPRECATED /
  // nep245) kayıtlar yerine yeni omft/omdep kaydı tercih edilir.
  const ranked = [...tokens].sort((a, b) => rank(b) - rank(a));

  for (const t of ranked) {
    const chainId = INTENTS_TO_CHAIN[t.blockchain];
    if (!chainId) continue;
    if (/DEPRECATED/i.test(t.symbol)) continue;

    const native = isNativeAsset(t, t.blockchain);
    const id = native ? assetId(chainId) : assetId(chainId, t.contractAddress);
    const existing = byId.get(id);

    if (existing) {
      // Yerel kaydın ondalığı EVM için doğrudur; 1Click yalnızca eksikleri doldurur.
      existing.intentsId = t.assetId;
      existing.intentsPrice = t.price;
      if (!existing.coingeckoId && t.coingeckoId) existing.coingeckoId = t.coingeckoId;
      continue;
    }

    // Yerel kayıtta olmayan varlık (cbBTC, Tron USDT, SPL tokenları…).
    byId.set(id, {
      id,
      symbol: t.symbol,
      name: t.symbol,
      chainId,
      address: native ? undefined : t.contractAddress,
      decimals: t.decimals,
      coingeckoId: t.coingeckoId,
      intentsId: t.assetId,
      intentsPrice: t.price,
    });
  }

  return [...byId.values()];
}

function rank(t: IntentsToken): number {
  let score = 0;
  if (t.assetId.startsWith("nep141:")) score += 4;
  if (t.assetId.includes(".omft.near")) score += 2;
  if (t.assetId.includes(".omdep.near")) score += 1;
  return score;
}

/** Varlığın Kyber rota adresi; ağ desteklenmiyorsa null. */
export function kyberTarget(asset: SwapAsset): { chain: string; token: string } | null {
  const chain = KYBER_CHAINS[asset.chainId];
  if (!chain) return null;
  const registryChain = getChain(asset.chainId);
  if (registryChain && registryChain.kind !== "evm") return null;
  return { chain, token: asset.address ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" };
}

export function supportsIntents(asset: SwapAsset): boolean {
  return Boolean(asset.intentsId) && Boolean(INTENTS_CHAINS[asset.chainId]);
}

/** Zincir görünen adı — kayıtta olmayan ağlar için kimlik başlaştırılır. */
export function chainLabel(chainId: string): string {
  const name = getChain(chainId)?.name;
  if (name) return name;
  return chainId.charAt(0).toUpperCase() + chainId.slice(1);
}