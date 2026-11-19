import { t as $t } from "@/lib/i18n";
import type { WalletInfo, WalletStatus } from "@/types/wallet";
import type { TokenAmount } from "@/types/chain";
import type { Transaction } from "@/types/transaction";

const MOCK_WALLET: WalletInfo = {
  id: "mock-001",
  name: $t("Ana Cüzdan"),
  address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  createdAt: Date.now() - 1000 * 60 * 60 * 24 * 42,
};

let mockWallets: WalletInfo[] = [MOCK_WALLET];
let mockActiveId = MOCK_WALLET.id;
let mockUnlocked = false;
let mockInitialized = false;

const MOCK_BALANCES: Record<string, TokenAmount[]> = {
  ethereum: [
    { tokenSymbol: "ETH", amount: 1.8421, usdValue: 6210.5 },
    { tokenSymbol: "USDC", amount: 1250.0, usdValue: 1250.0 },
    { tokenSymbol: "LINK", amount: 320.5, usdValue: 5128.0 },
  ],
  arbitrum: [
    { tokenSymbol: "ETH", amount: 0.421, usdValue: 1419.9 },
    { tokenSymbol: "GMX", amount: 12.4, usdValue: 868.0 },
  ],
  base: [{ tokenSymbol: "ETH", amount: 0.1023, usdValue: 345.1 }],
  polygon: [{ tokenSymbol: "POL", amount: 1520.0, usdValue: 790.4 }],
  bsc: [{ tokenSymbol: "BNB", amount: 2.71, usdValue: 1680.2 }],
  solana: [
    { tokenSymbol: "SOL", amount: 24.6, usdValue: 4208.4 },
    { tokenSymbol: "JUP", amount: 540.0, usdValue: 540.0 },
  ],
};

const now = Date.now();
const MOCK_TXS: Transaction[] = [
  {
    hash: "0x9f2a...c41d",
    chainId: "ethereum",
    direction: "in",
    status: "confirmed",
    symbol: "ETH",
    amount: 0.5,
    usdValue: 1685.0,
    counterparty: "0xAbC1...9Ef2",
    timestamp: now - 1000 * 60 * 42,
  },
  {
    hash: "0x11d8...07aa",
    chainId: "arbitrum",
    direction: "swap",
    status: "confirmed",
    symbol: "USDC → ETH",
    amount: 500,
    usdValue: 500.0,
    counterparty: "Uniswap V3",
    timestamp: now - 1000 * 60 * 60 * 5,
  },
  {
    hash: "0x7c3e...b290",
    chainId: "solana",
    direction: "out",
    status: "pending",
    symbol: "SOL",
    amount: 1.2,
    usdValue: 205.2,
    counterparty: "5KQull...Hx2pR",
    timestamp: now - 1000 * 60 * 8,
  },
  {
    hash: "0xa0b4...55f1",
    chainId: "base",
    direction: "in",
    status: "confirmed",
    symbol: "ETH",
    amount: 0.05,
    usdValue: 168.5,
    counterparty: "0xDeaD...BEEF",
    timestamp: now - 1000 * 60 * 60 * 26,
  },
];

function addMockWallet(name: string): WalletInfo {
  const wallet: WalletInfo = {
    id: `mock-${Date.now()}`,
    name: name.trim() || $t("Ana Cüzdan"),
    address: MOCK_WALLET.address,
    createdAt: Date.now(),
  };
  if (!mockInitialized) {
    mockWallets = [wallet];
    mockInitialized = true;
  } else {
    mockWallets = [...mockWallets, wallet];
  }
  mockActiveId = wallet.id;
  mockUnlocked = true;
  return wallet;
}

export function mockInvoke(cmd: string, args?: Record<string, unknown>): unknown {  switch (cmd) {
    case "create_wallet":
    case "import_wallet": {
      rememberCredentials(String(args?.password ?? ""), String(args?.pin ?? ""));
      return addMockWallet(String(args?.name ?? ""));
    }
    case "unlock_wallet": {
      const creds = readCredentials();
      const secret = String(args?.password ?? "");
      const ok = !creds.password && !creds.pin ? true : secret === creds.password || secret === creds.pin;
      if (ok) {
        mockUnlocked = true;
        const requested = args?.walletId as string | undefined;
        if (requested && mockWallets.some((item) => item.id === requested)) mockActiveId = requested;
      }
      return ok;
    }
    case "lock_wallet":
      mockUnlocked = false;
      return null;
    case "switch_wallet": {
      const id = String(args?.walletId ?? "");
      const wallet = mockWallets.find((item) => item.id === id);
      if (!wallet) throw new Error($t("Cüzdan bulunamadı"));
      mockActiveId = id;
      mockUnlocked = true;
      return wallet;
    }
    case "rename_wallet": {
      const id = String(args?.walletId ?? mockActiveId);
      const wallet = mockWallets.find((item) => item.id === id);
      if (!wallet) throw new Error($t("Cüzdan bulunamadı"));
      wallet.name = String(args?.name ?? wallet.name);
      return { ...wallet };
    }
    case "reveal_mnemonic": {
      const creds = readCredentials();
      if (creds.password && String(args?.password ?? "") !== creds.password) {
        throw new Error($t("Parola hatalı."));
      }
      return DEMO_MNEMONIC;
    }
    case "delete_wallet": {
      if (mockWallets.length <= 1) throw new Error($t("Son cüzdanı silmek için cüzdanı sıfırla."));
      const id = String(args?.walletId ?? "");
      mockWallets = mockWallets.filter((item) => item.id !== id);
      if (mockActiveId === id) {
        mockActiveId = mockWallets[0].id;
        mockUnlocked = false;
      }
      return null;
    }
    case "add_vault_credential":
      return null;
    case "reset_wallet":
      mockCredentials = {};
      mockWallets = [];
      mockInitialized = false;
      mockUnlocked = false;
      return null;
    case "wallet_status": {
      const active = mockWallets.find((item) => item.id === mockActiveId) ?? mockWallets[0] ?? null;
      const status: WalletStatus = {
        exists: mockWallets.length > 0,
        unlocked: mockUnlocked,
        wallet: active,
        wallets: mockWallets,
        missingCredential: null,
      };
      return status;
    }
    case "mock:get_balances":
      return MOCK_BALANCES;
    case "mock:get_transactions":
      return MOCK_TXS;
    case "sign_transaction":
      throw new Error($t("İmzalama motoru henüz hazır değil (P1)"));
    case "set_secure":
    case "plugin:vexwebview|set_secure":
    case "plugin:window|set_content_protected":
      return null;
    default:
      throw new Error(`Bilinmeyen komut: ${cmd}`);
  }
}

let mockCredentials: { password?: string; pin?: string } = {};

function rememberCredentials(password: string, pin: string) {
  mockCredentials = { password, pin };
}

function readCredentials(): { password?: string; pin?: string } {
  return mockCredentials;
}

const DEMO_MNEMONIC =
  "test test test test test test test test test test test junk";
