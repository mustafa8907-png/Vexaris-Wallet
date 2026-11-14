export type TxDirection = "in" | "out" | "swap";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface Transaction {
  hash: string;
  chainId: string;
  direction: TxDirection;
  status: TxStatus;
  symbol: string;
  amount: number;
  usdValue: number;
  counterparty: string;
  timestamp: number;
}

export interface UnsignedTx {
  chainId: number;
  from: string;
  to: string;
  valueHex: string;
  dataHex: string;
  gasLimitHex: string;
  maxFeePerGasHex: string;
  maxPriorityFeeHex: string;
  nonceHex: string;
}
