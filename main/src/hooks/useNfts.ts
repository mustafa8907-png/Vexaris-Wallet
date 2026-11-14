import { useEffect, useState } from "react";
import { fetchNfts, type NftItem } from "@/lib/api/nfts";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";

/** Cüzdanın gerçek NFT koleksiyonu (Blockscout). */
export function useNfts() {
  const address = useWalletStore((s) => s.wallet?.address ?? null);
  const enabledKey = useChainStore((s) => s.enabledChainIds.join(","));
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

  return { nfts, failed, loading };
}
