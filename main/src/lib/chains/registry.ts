import type { Chain } from "@/types/chain";
import { CHAINS, WATCH_CHAINS } from "./config";

let customChains: Chain[] = [];

export function setCustomChains(chains: Chain[]): void {
  customChains = chains;
}

export function allChains(): Chain[] {
  return [...CHAINS, ...customChains];
}

export function getChain(id: string): Chain | undefined {
  return (
    CHAINS.find((c) => c.id === id) ??
    customChains.find((c) => c.id === id) ??
    WATCH_CHAINS.find((c) => c.id === id)
  );
}

export function findChainByNumber(chainId: number): Chain | undefined {
  return allChains().find((c) => c.chainId === chainId);
}

export function liveEvmChains(enabledIds: string[]): Chain[] {
  return allChains().filter(
    (c) => c.kind === "evm" && c.live !== false && enabledIds.includes(c.id),
  );
}