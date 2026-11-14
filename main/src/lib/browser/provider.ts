import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import { rpcBatch } from "@/lib/api/rpc";
import type { NativeProviderRequest } from "./native";

const READ_ONLY = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_blobBaseFee",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockReceipts",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getUncleCountByBlockHash",
  "eth_getUncleCountByBlockNumber",
  "eth_getUncleByBlockHashAndIndex",
  "eth_getUncleByBlockNumberAndIndex",
  "eth_getLogs",
  "eth_getProof",
  "eth_newFilter",
  "eth_newBlockFilter",
  "eth_newPendingTransactionFilter",
  "eth_getFilterChanges",
  "eth_getFilterLogs",
  "eth_uninstallFilter",
  "eth_protocolVersion",
  "eth_syncing",
  "net_listening",
  "net_peerCount",
  "web3_sha3",
]);

const TYPED_ALIASES = new Set(["eth_signTypedData", "eth_signTypedData_v1", "eth_signTypedData_v3"]);

export interface ProviderContext {
  chain: Chain;
  chainHex: string;
  address: string;
  connected: boolean;
  origin: string;
  respond: (result: unknown) => void;
  fail: (code: number, message: string) => void;
  askConnection: (kind: "accounts" | "permissions") => void;
  askApproval: (method: string, params: unknown[]) => void;
  revoke: () => void;
}

function normalizeMethod(method: string): string {
  return TYPED_ALIASES.has(method) ? "eth_signTypedData_v4" : method;
}

function permissions(address: string, origin: string) {
  if (!address) return [];
  return [
    {
      id: `vex-${origin}`,
      parentCapability: "eth_accounts",
      invoker: origin,
      date: Date.now(),
      caveats: [{ type: "restrictReturnedAccounts", value: [address] }],
    },
  ];
}

export function requestedChainNumber(params: unknown): number | null {
  const list = Array.isArray(params) ? params : [params];
  const first = list.find((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  const raw = typeof first?.chainId === "string" ? first.chainId.trim() : "";
  if (!raw) return null;
  const value = raw.startsWith("0x") ? Number.parseInt(raw.slice(2), 16) : Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export async function routeProviderRequest(
  request: NativeProviderRequest,
  ctx: ProviderContext,
): Promise<void> {
  const method = normalizeMethod(request.method);
  const params = Array.isArray(request.params) ? request.params : [];

  switch (method) {
    case "eth_chainId":
      return ctx.respond(ctx.chainHex);
    case "net_version":
      return ctx.respond(String(ctx.chain.chainId ?? 1));
    case "web3_clientVersion":
      return ctx.respond("VexarisWallet/0.1.0");
    case "eth_coinbase":
      return ctx.respond(ctx.connected ? ctx.address : null);
    case "eth_accounts":
      return ctx.respond(ctx.connected && ctx.address ? [ctx.address] : []);

    case "eth_requestAccounts":
      if (!ctx.address) return ctx.fail(4100, $t("Cüzdan kilitli — önce parolanla aç."));
      if (ctx.connected) return ctx.respond([ctx.address]);
      return ctx.askConnection("accounts");

    case "wallet_requestPermissions":
      if (!ctx.address) return ctx.fail(4100, $t("Cüzdan kilitli — önce parolanla aç."));
      if (ctx.connected) return ctx.respond(permissions(ctx.address, ctx.origin));
      return ctx.askConnection("permissions");

    case "wallet_getPermissions":
      return ctx.respond(ctx.connected ? permissions(ctx.address, ctx.origin) : []);

    case "wallet_revokePermissions":
      ctx.revoke();
      return ctx.respond(null);

    case "metamask_getProviderState":
      return ctx.respond({
        isUnlocked: Boolean(ctx.address),
        chainId: ctx.chainHex,
        networkVersion: String(ctx.chain.chainId ?? 1),
        accounts: ctx.connected && ctx.address ? [ctx.address] : [],
      });

    case "metamask_logInjectedWeb3Usage":
    case "wallet_getCapabilities":
      return ctx.respond(method === "wallet_getCapabilities" ? {} : null);

    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain": {
      const target = requestedChainNumber(params);
      if (target === null) return ctx.fail(-32602, $t("Ağ numarası okunamadı."));
      if (target === ctx.chain.chainId) return ctx.respond(null);
      if (!ctx.connected) return ctx.fail(4100, $t("Önce siteye cüzdanını bağla."));
      return ctx.askApproval(method, params);
    }

    case "eth_sendTransaction":
    case "personal_sign":
    case "eth_signTypedData_v4": {
      if (!ctx.connected || !ctx.address) {
        return ctx.fail(4100, $t("Bu site cüzdana bağlı değil — önce bağlan."));
      }
      return ctx.askApproval(method, params);
    }

    case "eth_sign":
    case "eth_signTransaction":
      return ctx.fail(4200, $t("Bu imzalama yöntemi güvenlik için kapalı."));

    default:
      break;
  }

  if (!READ_ONLY.has(method)) {
    return ctx.fail(4200, $t("Vexaris bu yöntemi desteklemiyor: {0}", [request.method]));
  }

  try {
    const [result] = await rpcBatch<unknown>(ctx.chain, [{ method, params }]);
    ctx.respond(result ?? null);
  } catch (error) {
    ctx.fail(-32603, error instanceof Error ? error.message : $t("Ağ isteği başarısız oldu."));
  }
}