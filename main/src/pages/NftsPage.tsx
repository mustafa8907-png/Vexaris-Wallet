import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Download,
  Input,
  Layers,
  Modal,
  Select,
  Skeleton,
  Trash,
  Upload,
  cn,
} from "@/kit";
import { useNfts } from "@/hooks/useNfts";
import { allChains, getChain } from "@/lib/chains/registry";
import { isEvmChain } from "@/lib/chains/address";
import { useChainStore } from "@/stores/chainStore";
import { useNftStore } from "@/stores/nftStore";
import { toast } from "@/stores/toastStore";
import { shortAddress } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";
import type { NftItem } from "@/lib/api/nfts";

function fallbackArt(seed: string): string {
  let hash = 7;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) % 997;
  const hue = hash % 360;
  return `linear-gradient(150deg, hsl(${hue} 45% 32% / 0.35), hsl(${hue} 20% 8%) 72%)`;
}

function NftCard({ nft, onRemove }: { nft: NftItem; onRemove?: () => void }) {
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
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={$t("Kaldır")}
            aria-label={$t("Kaldır")}
            className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-ctrl bg-bg/80 text-muted backdrop-blur transition-colors hover:text-danger"
          >
            <Trash size={12} />
          </button>
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

function exportJson(items: NftItem[]) {
  const payload = items.map((nft) => ({
    chainId: nft.chainId,
    name: nft.name,
    collection: nft.collection,
    tokenId: nft.tokenId,
    image: nft.image,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vexaris-nft-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function NftsPage() {
  const { nfts, failed, loading } = useNfts();
  const imported = useNftStore((s) => s.imported);
  const addImported = useNftStore((s) => s.add);
  const removeImported = useNftStore((s) => s.remove);
  const enabled = useChainStore((s) => s.enabledChainIds);
  const unreachable = failed.map((id) => getChain(id)?.name ?? id);

  const [open, setOpen] = useState(false);
  const [chainId, setChainId] = useState("ethereum");
  const [contract, setContract] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const evmChains = useMemo(
    () => allChains().filter((c) => c.kind === "evm" && enabled.includes(c.id)),
    [enabled],
  );

  function reset() {
    setContract("");
    setTokenId("");
    setName("");
    setImage("");
    setError(null);
  }

  function submit() {
    const address = contract.trim();
    const id = tokenId.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError($t("Geçerli bir sözleşme adresi gir."));
      return;
    }
    if (!/^[0-9]+$/.test(id)) {
      setError($t("Token kimliği sayı olmalı."));
      return;
    }
    const link = image.trim();
    const nft: NftItem = {
      uid: `import-${chainId}-${address.toLowerCase()}-${id}`,
      chainId,
      name: name.trim() || `#${id}`,
      collection: getChain(chainId)?.name ?? chainId,
      image: /^(https:\/\/|data:image\/)/.test(link) ? link : null,
      tokenId: id,
    };
    addImported(nft);
    toast($t("NFT eklendi"), "success");
    reset();
    setOpen(false);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-3 pb-8 pt-4 sm:px-5 lg:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-text">{$t("Koleksiyon")}</h1>
            <p className="mt-0.5 text-xs text-muted">{$t("Cüzdanındaki NFT'ler")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <Layers size={12} />
              {loading ? $t("yükleniyor…") : $t("{0} öğe", [nfts.length])}
            </span>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Upload size={13} />}
              onClick={() => {
                setChainId(evmChains[0]?.id ?? "ethereum");
                reset();
                setOpen(true);
              }}
            >
              {$t("İçe aktar")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download size={13} />}
              onClick={() => {
                if (nfts.length === 0) {
                  toast($t("Dışa aktarılacak NFT yok"), "info");
                  return;
                }
                exportJson(nfts);
                toast($t("{0} NFT dışa aktarıldı", [nfts.length]), "success");
              }}
            >
              {$t("Dışa aktar")}
            </Button>
          </div>
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
              <NftCard
                key={nft.uid}
                nft={nft}
                onRemove={
                  imported.some((item) => item.uid === nft.uid)
                    ? () => removeImported(nft.uid)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={$t("NFT içe aktar")}
        description={$t("Ekleyeceğin NFT zincirde doğrulanır, imza gerekmez.")}
        onClose={() => setOpen(false)}
        size="sm"
      >
        <div className="mt-4 space-y-3">
          <Select
            aria-label={$t("Ağ")}
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            options={evmChains.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            value={contract}
            spellCheck={false}
            placeholder={$t("Sözleşme adresi")}
            onChange={(e) => {
              setContract(e.target.value);
              setError(null);
            }}
            className="font-mono text-[11.5px]"
          />
          <Input
            value={tokenId}
            inputMode="numeric"
            placeholder={$t("Token kimliği")}
            onChange={(e) => {
              setTokenId(e.target.value);
              setError(null);
            }}
          />
          <Input
            value={name}
            placeholder={$t("Ad (isteğe bağlı)")}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            value={image}
            spellCheck={false}
            placeholder={$t("Görsel bağlantısı (isteğe bağlı)")}
            onChange={(e) => setImage(e.target.value)}
          />
          {error && <p className="text-[11px] text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" fullWidth onClick={() => setOpen(false)}>
              {$t("Vazgeç")}
            </Button>
            <Button tone="brand" className="flex-[1.4]" onClick={submit} disabled={!isEvmChain(chainId)}>
              {$t("Ekle")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
