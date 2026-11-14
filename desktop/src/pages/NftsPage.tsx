import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { ImageBroken, Stack, WifiHigh } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { useNfts } from "@/hooks/useNfts";
import { getChain } from "@/lib/chains/registry";
import { shortAddress } from "@/lib/utils";
import type { NftItem } from "@/lib/api/nfts";

function fallbackArt(seed: string): string {
  let hash = 7;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) % 997;
  const hue = hash % 360;
  return `linear-gradient(150deg, hsl(${hue} 45% 32% / 0.35), #131315 72%)`;
}

function NftCard({ nft }: { nft: NftItem }) {
  const [broken, setBroken] = useState(false);
  const chain = getChain(nft.chainId);

  return (
    <Card className="group cursor-pointer overflow-hidden p-2 transition-colors duration-150 hover:border-white/[0.14]">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/[0.05]"
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
          <div className="grid h-full w-full place-items-center text-zinc-600">
            <ImageBroken size={22} />
          </div>
        )}
        {chain && (
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-200 backdrop-blur">
            {chain.shortName}
          </span>
        )}
      </div>
      <div className="px-1 pb-1 pt-2.5">
        <div className="truncate text-[13px] font-medium text-white">{nft.name}</div>
        <div className="truncate text-[11px] text-zinc-500">{nft.collection}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
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
    <div className="page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{$t("Koleksiyon")}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">{$t("Cüzdanındaki NFT'ler")}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
            {nfts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-success/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-success">
                <WifiHigh size={9} /> {$t("canlı")}
              </span>
            )}
            <Stack size={12} />
            {loading ? $t("yükleniyor…") : $t("{0} öğe", [nfts.length])}
          </span>
        </div>

        {unreachable.length > 0 && !loading && (
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-surface-850 px-3 py-2 text-[11px] text-zinc-500">
            {unreachable.join(", ")} {$t("ağlarındaki koleksiyonlar şu anda okunamadı.")}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl2 border border-white/[0.05] bg-surface-850 p-2"
              >
                <div className="aspect-square w-full rounded-lg bg-surface-800" />
                <div className="px-1 pb-1 pt-2.5">
                  <div className="h-3 w-2/3 rounded bg-surface-800" />
                  <div className="mt-1.5 h-2.5 w-1/2 rounded bg-surface-800/70" />
                </div>
              </div>
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <Card className="grid place-items-center border-dashed py-16">
            <div className="flex flex-col items-center gap-2 text-center">
              <ImageBroken size={22} className="text-zinc-600" />
              <span className="text-sm text-zinc-400">{$t("Bu adreste NFT bulunamadı")}</span>
              <span className="max-w-xs text-[11px] leading-relaxed text-zinc-600">
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
