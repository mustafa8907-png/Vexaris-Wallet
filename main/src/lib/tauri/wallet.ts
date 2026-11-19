import { invoke } from "./ipc";
import type { CredentialKind, WalletInfo, WalletStatus } from "@/types/wallet";

export const walletApi = {
  createWallet: (name: string, password: string, pin: string) =>
    invoke<WalletInfo>("create_wallet", { name, password, pin }),
  addWallet: (name: string) => invoke<WalletInfo>("create_wallet", { name }),
  importWallet: (name: string, mnemonic: string, password: string, pin: string) =>
    invoke<WalletInfo>("import_wallet", { name, mnemonic, password, pin }),
  unlock: (password: string, walletId?: string) =>
    invoke<boolean>("unlock_wallet", walletId ? { password, walletId } : { password }),
  lock: () => invoke<null>("lock_wallet"),
  status: () => invoke<WalletStatus>("wallet_status"),
  switchWallet: (walletId: string) => invoke<WalletInfo>("switch_wallet", { walletId }),
  rename: (name: string, walletId?: string) =>
    invoke<WalletInfo>("rename_wallet", walletId ? { name, walletId } : { name }),
  revealMnemonic: (password: string, walletId?: string) =>
    invoke<string>("reveal_mnemonic", walletId ? { password, walletId } : { password }),
  deleteWallet: (walletId: string, password: string) =>
    invoke<null>("delete_wallet", { walletId, password }),
  addCredential: (secret: string, kind: CredentialKind) =>
    invoke<CredentialKind | null>("add_vault_credential", { secret, kind }),
  reset: (password: string) => invoke<null>("reset_wallet", { password }),
};
