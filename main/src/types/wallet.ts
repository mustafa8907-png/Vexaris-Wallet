export interface WalletInfo {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

export interface WalletStatus {
  exists: boolean;
  unlocked: boolean;
  wallet: WalletInfo | null;
}
