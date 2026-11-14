/**
 * WalletConnect zincir eşlemesi (CAIP-2 / CAIP-10).
 *
 * Cüzdan kendi ağ anahtarlarını (`ethereum`, `polygon` …) kullanır; protokol
 * tarafı `eip155:<chainId>` ister. Köprü tek yerde tutulur ki iki taraf
 * arasında sessiz sapma olmasın.
 */
import type { Chain } from "@/types/chain";
import { allChains, getChain } from "@/lib/chains/registry";

export const EIP155_NAMESPACE = "eip155";

/** DApp'lere açılan yöntemler. `eth_sign` bilerek yok: ham ön özet imzalama
 *  oltalama aracıdır ve cüzdanlar tarafından önerilmez. */
export const SUPPORTED_METHODS = [
  "eth_accounts",
  "eth_sendTransaction",
  "personal_sign",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
];

export const SUPPORTED_EVENTS = ["accountsChanged", "chainChanged"];

/** WalletConnect'e konu edilebilecek ağlar: EVM + zincir numarası bilinenler. */
export function evmChains(): Chain[] {
  return allChains().filter((chain) => chain.kind === "evm" && chain.chainId);
}

export function toCaip2(chainId: string): string | undefined {
  const chain = getChain(chainId);
  return chain?.chainId ? `${EIP155_NAMESPACE}:${chain.chainId}` : undefined;
}

/** `eip155:137` → cüzdanın ağ anahtarı (`polygon`); tanınmıyorsa `undefined`. */
export function fromCaip2(caip2: string): string | undefined {
  const [namespace, number] = caip2.split(":");
  if (namespace !== EIP155_NAMESPACE) return undefined;
  return evmChains().find((chain) => String(chain.chainId) === number)?.id;
}

/** Hesap kimliği: `eip155:1:0x…`. */
export function toCaip10(caip2: string, address: string): string {
  return `${caip2}:${address}`;
}

/** CAIP-10'un son bölümü adrestir. */
export function addressOfCaip10(account: string): string {
  return account.split(":").pop() ?? "";
}

/** CAIP-10 → CAIP-2: `eip155:1:0x…` → `eip155:1`. */
export function chainOfCaip10(account: string): string {
  const parts = account.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : account;
}

/** Bir namespace bloğundaki zincirler; `chains` verilmemişse hesaplardan türetilir. */
export function namespaceChains(namespace: {
  chains?: string[];
  accounts?: string[];
}): string[] {
  if (namespace.chains?.length) return namespace.chains;
  return [...new Set((namespace.accounts ?? []).map(chainOfCaip10))];
}

/** CAIP-2'nin insan okur adı; tanımadığımız ağ kendi kimliğiyle görünür. */
export function chainLabel(caip2: string): string {
  const key = fromCaip2(caip2);
  return (key ? getChain(key)?.name : undefined) ?? caip2;
}
