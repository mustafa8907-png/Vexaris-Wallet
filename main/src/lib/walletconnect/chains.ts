import type { Chain } from "@/types/chain";
import { allChains, getChain } from "@/lib/chains/registry";

export const EIP155_NAMESPACE = "eip155";

export const SUPPORTED_METHODS = [
  "eth_accounts",
  "eth_sendTransaction",
  "personal_sign",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
];

export const SUPPORTED_EVENTS = ["accountsChanged", "chainChanged"];

export function evmChains(): Chain[] {
  return allChains().filter((chain) => chain.kind === "evm" && chain.chainId);
}

export function toCaip2(chainId: string): string | undefined {
  const chain = getChain(chainId);
  return chain?.chainId ? `${EIP155_NAMESPACE}:${chain.chainId}` : undefined;
}

export function fromCaip2(caip2: string): string | undefined {
  const [namespace, number] = caip2.split(":");
  if (namespace !== EIP155_NAMESPACE) return undefined;
  return evmChains().find((chain) => String(chain.chainId) === number)?.id;
}

export function toCaip10(caip2: string, address: string): string {
  return `${caip2}:${address}`;
}

export function addressOfCaip10(account: string): string {
  return account.split(":").pop() ?? "";
}

export function chainOfCaip10(account: string): string {
  const parts = account.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : account;
}

export function namespaceChains(namespace: {
  chains?: string[];
  accounts?: string[];
}): string[] {
  if (namespace.chains?.length) return namespace.chains;
  return [...new Set((namespace.accounts ?? []).map(chainOfCaip10))];
}

export function chainLabel(caip2: string): string {
  const key = fromCaip2(caip2);
  return (key ? getChain(key)?.name : undefined) ?? caip2;
}
