import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chain } from "@/types/chain";
import { CHAINS, DEFAULT_CHAIN_IDS } from "@/lib/chains/config";
import { setCustomChains } from "@/lib/chains/registry";


interface ChainState {
  activeChainId: string;
  viewChainId: string | null;
  enabledChainIds: string[];
  customChains: Chain[];
  setActive: (id: string) => void;
  setViewChain: (id: string | null) => void;
  toggleEnabled: (id: string) => void;
  addCustomChain: (chain: Chain) => void;
  updateCustomChain: (id: string, patch: Partial<Chain>) => void;
  removeCustomChain: (id: string) => void;
}

function sync(chains: Chain[]) {
  setCustomChains(chains);
}

export const useChainStore = create<ChainState>()(
  persist(
    (set, get) => ({
      activeChainId: "ethereum",
      viewChainId: null,
      enabledChainIds: DEFAULT_CHAIN_IDS,
      customChains: [],

      setActive: (id) => set({ activeChainId: id }),

      setViewChain: (id) => {
        const enabled = get().enabledChainIds;
        set({ viewChainId: id && enabled.includes(id) ? id : null });
      },

      toggleEnabled: (id) => {
        const { enabledChainIds, activeChainId } = get();
        const enabled = enabledChainIds.includes(id)
          ? enabledChainIds.filter((c) => c !== id)
          : [...enabledChainIds, id];
        if (enabled.length === 0) return;
        set({
          enabledChainIds: enabled,
          activeChainId: enabled.includes(activeChainId) ? activeChainId : enabled[0],
          viewChainId: get().viewChainId && enabled.includes(get().viewChainId!) ? get().viewChainId : null,
        });
      },

      addCustomChain: (chain) => {
        const { customChains, enabledChainIds } = get();
        if (CHAINS.some((c) => c.id === chain.id) || customChains.some((c) => c.id === chain.id)) return;
        const next = [...customChains, { ...chain, custom: true }];
        sync(next);
        set({
          customChains: next,
          enabledChainIds: [...enabledChainIds, chain.id],
          activeChainId: chain.id,
        });
      },

      updateCustomChain: (id, patch) => {
        const next = get().customChains.map((c) => (c.id === id ? { ...c, ...patch, id } : c));
        sync(next);
        set({ customChains: next });
      },

      removeCustomChain: (id) => {
        const { customChains, enabledChainIds, activeChainId } = get();
        const next = customChains.filter((c) => c.id !== id);
        const enabled = enabledChainIds.filter((c) => c !== id);
        sync(next);
        set({
          customChains: next,
          enabledChainIds: enabled.length > 0 ? enabled : DEFAULT_CHAIN_IDS,
          activeChainId: activeChainId === id ? "ethereum" : activeChainId,
        });
      },
    }),
    {
      name: "vexaris-chains",
      version: 4,
      migrate: (state, version) => {
        const persisted = state as ChainState;
        const ids = persisted.enabledChainIds ?? [];
        const custom = persisted.customChains ?? [];
        if (version < 2) {
          const wasDefault = CHAINS.filter((c) => c.id !== "optimism").every((c) =>
            ids.includes(c.id),
          );
          return {
            ...persisted,
            customChains: custom,
            enabledChainIds: wasDefault ? [...ids, "optimism"] : ids,
          };
        }
        if (version < 3) {
          const added = ["avalanche", "linea", "sonic"];
          const owned = custom.filter((c) => added.includes(c.id)).map((c) => c.id);
          const nextCustom = custom.filter((c) => !added.includes(c.id));
          const wasDefault = CHAINS.every((c) => ids.includes(c.id) || added.includes(c.id));
          const enable = new Set([...ids, ...(wasDefault ? added : owned)]);
          return {
            ...persisted,
            customChains: nextCustom,
            enabledChainIds: [...enable],
          };
        }
        if (version < 4) {
          const legacyDefault = [
            "ethereum", "arbitrum", "base", "polygon", "optimism",
            "bsc", "solana", "avalanche", "linea", "sonic",
          ];
          const wasDefault = legacyDefault.every((id) => ids.includes(id));
          const nextCustom = custom.filter((c) => !CHAINS.some((b) => b.id === c.id));
          const owned = nextCustom.map((c) => c.id);
          return {
            ...persisted,
            customChains: nextCustom,
            enabledChainIds: wasDefault
              ? [...DEFAULT_CHAIN_IDS, ...owned]
              : [...new Set([...ids, ...owned])],
          };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        sync(state?.customChains ?? []);
      },
    },
  ),
);

sync(useChainStore.getState().customChains);
