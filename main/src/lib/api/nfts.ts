import { t as $t } from "@/lib/i18n";
import { allChains } from "@/lib/chains/registry";
import { fetchJson } from "./http";

export interface NftItem {
  uid: string;
  chainId: string;
  name: string;
  collection: string;
  image: string | null;
  tokenId: string;
}

interface BlockscoutNft {
  id?: string;
  image_url?: string | null;
  metadata?: { name?: string | null };
  token?: { name?: string | null; symbol?: string | null; type?: string };
  collection?: { name?: string | null };
}

interface BlockscoutNftResponse {
  items?: BlockscoutNft[];
}

export async function fetchNfts(
  address: string,
  enabledChainIds: string[],
  limit = 12,
): Promise<{ nfts: NftItem[]; failed: string[] }> {
  const chains = allChains().filter(
    (c) => c.kind === "evm" && c.blockscoutUrl && enabledChainIds.includes(c.id),
  );

  const nfts: NftItem[] = [];
  const failed: string[] = [];

  await Promise.all(
    chains.map(async (chain) => {
      try {
        const url =
          `${chain.blockscoutUrl}/api/v2/addresses/${address}/nft` +
          `?type=ERC-721,ERC-1155`;
        const data = await fetchJson<BlockscoutNftResponse>(url, {}, 15_000);
        for (const item of data.items ?? []) {
          nfts.push(mapNft(item, chain.id, nfts.length));
        }
      } catch {
        failed.push(chain.id);
      }
    }),
  );

  return { nfts: nfts.slice(0, limit), failed };
}

function mapNft(item: BlockscoutNft, chainId: string, index: number): NftItem {
  const tokenId = item.id ?? String(index);
  const name =
    item.metadata?.name?.trim() ||
    item.token?.name?.trim() ||
    item.collection?.name?.trim() ||
    `#${tokenId.slice(-6)}`;

  return {
    uid: `${chainId}-${tokenId}-${index}`,
    chainId,
    name,
    collection:
      item.collection?.name?.trim() || item.token?.symbol?.trim() || $t("Koleksiyon"),
    image: normalizeImageUrl(item.image_url),
    tokenId,
  };
}

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${trimmed.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  if (trimmed.startsWith("ar://")) {
    return `https://arweave.net/${trimmed.slice("ar://".length)}`;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return null;
}
