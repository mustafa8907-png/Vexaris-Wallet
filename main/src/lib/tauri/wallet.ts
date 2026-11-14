import { invoke } from "./ipc";
import type { WalletInfo, WalletStatus } from "@/types/wallet";

export const walletApi = {
  createWallet: (name: string, password: string, pin: string) =>
    invoke<WalletInfo>("create_wallet", { name, password, pin }),
  importWallet: (name: string, mnemonic: string, password: string, pin: string) =>
    invoke<WalletInfo>("import_wallet", { name, mnemonic, password, pin }),
  unlock: (password: string) => invoke<boolean>("unlock_wallet", { password }),
  lock: () => invoke<null>("lock_wallet"),
  status: () => invoke<WalletStatus>("wallet_status"),
  rename: (name: string) => invoke<WalletInfo>("rename_wallet", { name }),
  revealMnemonic: (password: string) => invoke<string>("reveal_mnemonic", { password }),
  reset: (password: string) => invoke<null>("reset_wallet", { password }),
};
