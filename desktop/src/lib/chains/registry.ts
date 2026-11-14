import type { Chain } from "@/types/chain";
import { CHAINS, WATCH_CHAINS } from "./config";

/**
 * Çalışma zamanı zincir kaydı: yerleşikler + kullanıcının eklediği ağlar.
 *
 * chainStore kalıcı özel ağları buraya yazar; API katmanı store'a bağımlı
 * olmadan tüm ağları tek yerden okur.
 */
let customChains: Chain[] = [];

export function setCustomChains(chains: Chain[]): void {
  customChains = chains;
}

/** Ağ listeleri salt-okunur piyasa zincirlerini içermez. */
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

/** Bakiye/fiyat sorgusu yapılabilen etkin EVM ağları. */
export function liveEvmChains(enabledIds: string[]): Chain[] {
  return allChains().filter(
    (c) => c.kind === "evm" && c.live !== false && enabledIds.includes(c.id),
  );
}