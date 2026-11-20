import { useEffect, useState } from "react";
import { fetchNfts, type NftItem } from "@/lib/api/nfts";
import { useChainStore } from "@/stores/chainStore";
import { useNftStore } from "@/stores/nftStore";
import { useWalletStore } from "@/stores/walletStore";

export function useNfts() {
  const address = useWalletStore((s) => s.wallet?.address ?? null);
  const enabledKey = useChainStore((s) => s.enabledChainIds.join(","));
  const imported = useNftStore((s) => s.imported);
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const enabled = enabledKey ? enabledKey.split(",") : [];

    fetchNfts(address, enabled)
      .then((result) => {
        if (!alive) return;
        setNfts(result.nfts);
        setFailed(result.failed);
      })
      .catch(() => {
        if (alive) setNfts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [address, enabledKey]);

  const merged = (() => {
    const seen = new Set(nfts.map((item) => `${item.chainId}-${item.tokenId}`));
    const extra = imported.filter((item) => !seen.has(`${item.chainId}-${item.tokenId}`));
    return [...extra, ...nfts];
  })();

  return { nfts: merged, failed, loading };
}
