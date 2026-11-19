export interface WalletInfo {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

export type CredentialKind = "password" | "pin";

export interface WalletStatus {
  exists: boolean;
  unlocked: boolean;
  wallet: WalletInfo | null;
  wallets: WalletInfo[];
  missingCredential: CredentialKind | null;
}
