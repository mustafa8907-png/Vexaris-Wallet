import { useState } from "react";
import { Alert, Box, Card, Layers, Skeleton, cn } from "@/kit";
import { useNfts } from "@/hooks/useNfts";
import { getChain } from "@/lib/chains/registry";
import { shortAddress } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";
import type { NftItem } from "@/lib/api/nfts";

function fallbackArt(seed: string): string {
  let hash = 7;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) % 997;
  const hue = hash % 360;
  return `linear-gradient(150deg, hsl(${hue} 45% 32% / 0.35), hsl(${hue} 20% 8%) 72%)`;
}

function NftCard({ nft }: { nft: NftItem }) {
  const [broken, setBroken] = useState(false);
  const chain = getChain(nft.chainId);

  return (
    <Card className="group cursor-default overflow-hidden p-2 transition-colors duration-150 hover:border-linestrong">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-card border border-line"
        style={{ background: fallbackArt(nft.uid) }}
      >
        {nft.image && !broken ? (
          <img
            src={nft.image}
            alt={nft.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <Box size={22} />
          </div>
        )}
        {chain && (
          <span className="absolute top-2 left-2 rounded-xs bg-bg/75 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-textsoft backdrop-blur">
            {chain.shortName}
          </span>
        )}
      </div>
      <div className="px-1 pt-2.5 pb-1">
        <div className="truncate text-[13px] font-semibold text-text">{nft.name}</div>
        <div className="truncate text-[11px] text-muted">{nft.collection}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-muted">
          {shortAddress(nft.tokenId, 4)}
        </div>
      </div>
    </Card>
  );
}

export function NftsPage() {
  const { nfts, failed, loading } = useNfts();
  const unreachable = failed.map((id) => getChain(id)?.name ?? id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-3 pb-8 pt-4 sm:px-5 lg:px-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-text">{$t("Koleksiyon")}</h1>
            <p className="mt-0.5 text-xs text-muted">{$t("Cüzdanındaki NFT'ler")}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <Layers size={12} />
            {loading ? $t("yükleniyor…") : $t("{0} öğe", [nfts.length])}
          </span>
        </div>

        {unreachable.length > 0 && !loading && (
          <Alert tone="warning" className="mb-4" title={$t("Bazı ağlar okunamadı")}>
            {unreachable.join(", ")} {$t("ağlarındaki koleksiyonlar şu anda okunamadı.")}
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className={cn("space-y-2 p-2")}>
                <Skeleton className="aspect-square w-full rounded-card" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </Card>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <Card className="grid place-items-center border-dashed py-16">
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-surface2 text-muted">
                <Box size={20} />
              </span>
              <span className="text-sm text-textsoft">{$t("Bu adreste NFT bulunamadı")}</span>
              <span className="max-w-xs text-[11px] leading-relaxed text-muted">
                {$t("Ethereum ve desteklenen ağlardaki ERC-721 / ERC-1155 varlıkları otomatik listelenir.")}
              </span>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {nfts.map((nft) => (
              <NftCard key={nft.uid} nft={nft} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
