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
  /** ERC-20 sözleşme adresi. */
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
  /** Yerel coinin ondalık basamağı; EVM'de 18 varsayılır (Arc'ta USDC 6). */
  nativeDecimals?: number;
  /** Token ikonunda kullanılacak sembol (ör. Arbitrum için ARB). */
  iconSymbol: string;
  color: string;
  rpcUrl: string;
  /** Birincil RPC yanıt vermezse sırayla denenecek yedekler. */
  rpcFallbacks?: string[];
  explorerUrl: string;
  chainId?: number; // EVM için
  /** Canlı bakiye/işlem sorgusu destekleniyor mu. */
  live?: boolean;
  /** Blockscout tabanlı işlem/token API'si (varsa). */
  blockscoutUrl?: string;
  /** Trust Wallet Assets klasör adı (ör. smartchain). */
  twSlug?: string;
  /** DefiLlama zincir anahtarı (ör. avax). */
  llamaChain?: string;
  /** Yerel coinin CoinGecko kimliği. */
  coingeckoId?: string;
  /** Kullanıcının ayarlardan eklediği ağ. */
  custom?: boolean;
  /** Cüzdan bu ağda adresi seed'den türetir (Bitcoin, Solana, Tron, Stellar). */
  derived?: boolean;
  /**
   * Yalnızca fiyat/piyasa referansı. Bu zincirlerde bakiye okunmaz ve ağ
   * seçicide görünmez; EVM dışı coinlerin detay sayfası açılabilmesi için vardır.
   */
  watchOnly?: boolean;
}

export interface TokenAmount {
  tokenSymbol: string;
  amount: number;
  usdValue: number;
  /** ERC-20 sözleşme adresi; yerel coinde tanımsız. */
  address?: string;
  decimals?: number;
  name?: string;
  /** Birim fiyat (USD). */
  price?: number;
  change24h?: number;
  /** DefiLlama fiyat güveni, 0–1. */
  confidence?: number;
}

/** Ekranda gösterilen varlık: bakiye + hangi ağda olduğu. */
export interface Holding extends TokenAmount {
  chainId: string;
}
