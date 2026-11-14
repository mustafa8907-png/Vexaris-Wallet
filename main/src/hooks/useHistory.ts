import { useEffect, useRef } from "react";
import { useChainStore } from "@/stores/chainStore";
import { useHistoryStore } from "@/stores/historyStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWalletStore } from "@/stores/walletStore";
import { EMPTY_SNAPSHOT } from "@/stores/portfolioStore";

export function useHistory() {
  const address = useWalletStore((s) => s.wallet?.address ?? null);
  const enabledKey = useChainStore((s) => s.enabledChainIds.join(","));
  const snapshot = usePortfolioStore((s) => s.snapshot);
  const loadedKey = useRef<string | null>(null);
  const state = useHistoryStore();

  useEffect(() => {
    if (!address) {
      loadedKey.current = null;
      return;
    }
    const key = `${address}|${enabledKey}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    const chains = enabledKey.split(",");
    const load = () =>
      void useHistoryStore.getState().load(address, chains, snapshot ?? EMPTY_SNAPSHOT);
    const idle = deferUntilIdle(load);
    return () => idle();
  }, [address, enabledKey, snapshot]);

  useEffect(() => {
    if (snapshot) useHistoryStore.getState().revalue(snapshot);
  }, [snapshot]);

  const refreshNow = () => {
    if (!address) return;
    loadedKey.current = `${address}|${enabledKey}`;
    void useHistoryStore
      .getState()
      .load(address, enabledKey.split(","), snapshot ?? EMPTY_SNAPSHOT, true);
  };

  const loadMore = () => void useHistoryStore.getState().loadMore(snapshot ?? EMPTY_SNAPSHOT);

  return { ...state, refreshNow, loadMore };
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function deferUntilIdle(task: () => void): () => void {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === "function" && typeof w.cancelIdleCallback === "function") {
    const handle = w.requestIdleCallback(() => task(), { timeout: 2000 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(task, 300);
  return () => window.clearTimeout(timer);
}
