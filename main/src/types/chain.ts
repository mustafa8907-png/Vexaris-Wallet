export type ChainKind =
  | "evm"
  | "solana"
  | "bitcoin"
  | "tron"
  | "ton"
  | "dogecoin"
  | "ripple"
  | "near"
  | "aptos"
  | "sui"
  | "cardano"
  | "stellar"
  | "litecoin"
  | "bitcoincash";

export interface TokenDef {
  symbol: string;
  address: string;
  decimals: number;
  name?: string;
  coingeckoId?: string;
}

export interface Chain {
  id: string;
  kind: ChainKind;
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals?: number;
  iconSymbol: string;
  color: string;
  rpcUrl: string;
  rpcFallbacks?: string[];
  explorerUrl: string;
  chainId?: number;
  live?: boolean;
  blockscoutUrl?: string;
  twSlug?: string;
  llamaChain?: string;
  coingeckoId?: string;
  custom?: boolean;
  derived?: boolean;
  watchOnly?: boolean;
}

export interface TokenAmount {
  tokenSymbol: string;
  amount: number;
  usdValue: number;
  address?: string;
  decimals?: number;
  name?: string;
  price?: number;
  change24h?: number;
  confidence?: number;
}

export interface Holding extends TokenAmount {
  chainId: string;
}
