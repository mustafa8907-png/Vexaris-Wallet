import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NftItem } from "@/lib/api/nfts";

interface NftState {
  imported: NftItem[];
  add: (nft: NftItem) => void;
  remove: (uid: string) => void;
}

export const useNftStore = create<NftState>()(
  persist(
    (set) => ({
      imported: [],
      add: (nft) =>
        set((state) => ({
          imported: [
            nft,
            ...state.imported.filter((item) => item.uid !== nft.uid),
          ].slice(0, 200),
        })),
      remove: (uid) =>
        set((state) => ({ imported: state.imported.filter((item) => item.uid !== uid) })),
    }),
    { name: "vexaris-nfts", version: 1 },
  ),
);
