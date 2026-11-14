import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CHAINS, DEFAULT_CHAIN_IDS, WATCH_CHAINS } from "@/lib/chains/config";
import { isEvmChain, isValidAddress } from "@/lib/chains/address";
import { getChain } from "@/lib/chains/registry";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";


const PRIMARY_CHAINS = [
  ...DEFAULT_CHAIN_IDS,
  "avalanche",
  "sonic",
  "ton",
  "ripple",
  "dogecoin",
  "near",
  "aptos",
  "sui",
  "cardano",
  "litecoin",
  "bitcoincash",
];

interface AccountState {
  custom: Record<string, string>;
  derived: Record<string, string>;
  defaultChainId: string;
  setDefaultChain: (chainId: string) => void;
  saveAddress: (chainId: string, address: string) => boolean;
  clearAddress: (chainId: string) => void;
  setDerived: (addresses: Record<string, string>) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      custom: {},
      derived: {},
      defaultChainId: "ethereum",

      setDefaultChain: (chainId) => set({ defaultChainId: chainId }),

      saveAddress: (chainId, address) => {
        const value = address.trim();
        if (value && !isValidAddress(chainId, value)) return false;
        set({ custom: { ...get().custom, [chainId]: value } });
        return true;
      },

      clearAddress: (chainId) => {
        const next = { ...get().custom };
        delete next[chainId];
        set({ custom: next });
      },

      setDerived: (addresses) => set({ derived: addresses }),
    }),
    {
      name: "vexaris-account",
      version: 2,
      partialize: (state) => ({ custom: state.custom, defaultChainId: state.defaultChainId }),
    },
  ),
);

export function addressForChain(chainId: string): string {
  const { custom, derived } = useAccountStore.getState();
  if (derived[chainId]) return derived[chainId];
  if (isEvmChain(chainId)) return useWalletStore.getState().wallet?.address ?? "";
  return custom[chainId] ?? "";
}

export function accountChains(): string[] {
  const ids = new Set<string>([
    ...CHAINS.map((c) => c.id),
    ...WATCH_CHAINS.map((c) => c.id),
    ...useChainStore.getState().customChains.map((c) => c.id),
    ...Object.keys(useAccountStore.getState().custom),
  ]);
  const ordered = PRIMARY_CHAINS.filter((id) => ids.has(id));
  const extra = [...ids]
    .filter((id) => !ordered.includes(id))
    .sort((a, b) => (getChain(a)?.name ?? a).localeCompare(getChain(b)?.name ?? b, "tr"));
  return [...ordered, ...extra];
}
