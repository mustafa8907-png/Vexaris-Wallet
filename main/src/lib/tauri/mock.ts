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

export function mockInvoke(cmd: string, args?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "create_wallet":
    case "import_wallet": {
      rememberCredentials(String(args?.password ?? ""), String(args?.pin ?? ""));
      return { ...MOCK_WALLET, name: (args?.name as string) || MOCK_WALLET.name, createdAt: Date.now() };
    }
    case "unlock_wallet": {
      const creds = readCredentials();
      const secret = String(args?.password ?? "");
      if (!creds.password && !creds.pin) return true;
      return secret === creds.password || secret === creds.pin;
    }
    case "lock_wallet":
      return null;
    case "rename_wallet":
      return { ...MOCK_WALLET, name: String(args?.name ?? MOCK_WALLET.name) };
    case "reveal_mnemonic": {
      const creds = readCredentials();
      if (creds.password && String(args?.password ?? "") !== creds.password) {
        throw new Error($t("Parola hatalı."));
      }
      return DEMO_MNEMONIC;
    }
    case "reset_wallet":
      mockCredentials = {};
      return null;
    case "wallet_status": {
      const status: WalletStatus = { exists: true, unlocked: false, wallet: MOCK_WALLET };
      return status;
    }
    case "mock:get_balances":
      return MOCK_BALANCES;
    case "mock:get_transactions":
      return MOCK_TXS;
    case "sign_transaction":
      throw new Error($t("İmzalama motoru henüz hazır değil (P1)"));
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
