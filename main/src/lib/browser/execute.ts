import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import { findChainByNumber, getChain } from "@/lib/chains/registry";
import { WcExecutionError, execute as executeShared } from "@/lib/walletconnect/execute";
import { useBrowserStore } from "@/stores/browserStore";
import { useChainStore } from "@/stores/chainStore";
import type { WcRequest } from "@/stores/walletConnectStore";
import { requestedChainNumber } from "./provider";

export interface AddChainParams {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
  decimals: number;
  explorerUrl: string;
}

export function parseAddChain(params: unknown): AddChainParams | null {
  const list = Array.isArray(params) ? params : [params];
  const raw = list.find((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  if (!raw) return null;
  const chainId = requestedChainNumber([raw]);
  if (chainId === null || chainId <= 0) return null;

  const rpcUrls = Array.isArray(raw.rpcUrls) ? raw.rpcUrls.filter((url): url is string => typeof url === "string") : [];
  const rpcUrl = rpcUrls[0]?.trim() ?? "";
  if (!rpcUrl) return null;

  const currency = (raw.nativeCurrency ?? {}) as Record<string, unknown>;
  const explorers = Array.isArray(raw.blockExplorerUrls)
    ? raw.blockExplorerUrls.filter((url): url is string => typeof url === "string")
    : [];
  const decimals = typeof currency.decimals === "number" ? currency.decimals : 18;

  return {
    chainId,
    name: typeof raw.chainName === "string" && raw.chainName.trim() ? raw.chainName.trim() : `EVM ${chainId}`,
    rpcUrl,
    symbol: typeof currency.symbol === "string" && currency.symbol.trim() ? currency.symbol.trim() : "ETH",
    decimals: Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18,
    explorerUrl: explorers[0]?.trim() ?? "",
  };
}

function chainRecord(added: AddChainParams): Chain {
  return {
    id: `eip155-${added.chainId}`,
    kind: "evm",
    name: added.name,
    shortName: added.symbol.slice(0, 6).toUpperCase(),
    nativeSymbol: added.symbol,
    nativeDecimals: added.decimals,
    iconSymbol: added.symbol,
    color: "#4c8dff",
    rpcUrl: added.rpcUrl,
    explorerUrl: added.explorerUrl,
    chainId: added.chainId,
    live: true,
    custom: true,
  };
}

export async function executeBrowserRequest(request: WcRequest): Promise<unknown> {
  const source = request.source;
  if (source?.kind !== "browser") return executeShared(request);

  switch (request.method) {
    case "wallet_switchEthereumChain": {
      const number = requestedChainNumber(request.params);
      const chain = number === null ? undefined : findChainByNumber(number);
      if (!chain || chain.kind !== "evm") {
        throw new WcExecutionError($t("Bu ağ cüzdanda tanımlı değil."));
      }
      await useBrowserStore.getState().setTabChain(source.tabId, chain.id);
      return null;
    }

    case "wallet_addEthereumChain": {
      const added = parseAddChain(request.params);
      if (!added) throw new WcExecutionError($t("Ağ bilgileri okunamadı."));
      const known = findChainByNumber(added.chainId);
      if (known && !getChain(known.id)?.custom) {
        await useBrowserStore.getState().setTabChain(source.tabId, known.id);
        return null;
      }
      const record = chainRecord(added);
      useChainStore.getState().addCustomChain(record);
      await useBrowserStore.getState().setTabChain(source.tabId, known?.id ?? record.id);
      return null;
    }

    default:
      return executeShared(request);
  }
}