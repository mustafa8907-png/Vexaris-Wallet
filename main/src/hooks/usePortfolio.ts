import { useCallback, useEffect } from "react";
import { useChainStore } from "@/stores/chainStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWalletStore } from "@/stores/walletStore";

const AUTO_REFRESH_MS = 45_000;

/**
 * Canlı portföy verisi.
 *
 * Bakiyeler zincir RPC'lerinden ve gezgin keşfinden, fiyatlar piyasa
 * servisinden gelir. Adres veya etkin ağlar değişince yeniden yüklenir; 45
 * saniyede bir sessizce tazelenir.
 */
export function usePortfolio() {
  const address = useWalletStore((s) => s.wallet?.address ?? null);
  const enabledKey = useChainStore((s) => s.enabledChainIds.join(","));
  const state = usePortfolioStore();

  const refreshNow = useCallback(() => {
    if (address) void usePortfolioStore.getState().refresh(address, true);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    void usePortfolioStore.getState().refresh(address);
  }, [address, enabledKey]);

  useEffect(() => {
    if (!address) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void usePortfolioStore.getState().refresh(address);
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [address]);

  return { ...state, refreshNow };
}
