import { toChecksumAddress } from "@/lib/crypto/keccak";
import { BUNDLED_CHAIN_ICONS, BUNDLED_TOKEN_ICONS } from "./bundled";


const REPOS = [
  "https://raw.githubusercontent.com/trustwallet/assets/master",
  "https://cdn.jsdelivr.net/gh/trustwallet/assets@master",
];

export const TW_SLUGS: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  base: "base",
  polygon: "polygon",
  bsc: "smartchain",
  optimism: "optimism",
  avalanche: "avalanchec",
  linea: "linea",
  scroll: "scroll",
  zksync: "zksync",
  fantom: "fantom",
  gnosis: "xdai",
  celo: "celo",
  cronos: "cronos",
  blast: "blast",
  mantle: "mantle",
  solana: "solana",
  bitcoin: "bitcoin",
  litecoin: "litecoin",
  bitcoincash: "bitcoincash",
  cardano: "cardano",
  near: "near",
  aptos: "aptos",
  sui: "sui",
  stellar: "stellar",
  sonic: "sonic",
  monad: "monad",
  arc: "arc",
  unichain: "unichain",
  tron: "tron",
  ton: "ton",
  ripple: "ripple",
  dogecoin: "doge",
};

const dead = new Set<string>();

const resolved = new Set<string>();

function candidates(path: string): string[] {
  return REPOS.map((repo) => `${repo}/${path}`).filter((url) => !dead.has(url));
}

export function markDead(url: string): void {
  dead.add(url);
}

export function markLoaded(url: string): void {
  resolved.add(url);
}

export function cachedIcon(sources: string[]): string | null {
  for (const url of sources) if (resolved.has(url)) return url;
  return null;
}

function bundledChain(chainId: string): string[] {
  const file = BUNDLED_CHAIN_ICONS[chainId];
  return file ? [`/icons/chains/${file}`] : [];
}

export function tokenIconSources(
  chainId: string,
  symbol: string,
  address?: string,
  slug?: string,
): string[] {
  const folder = slug ?? TW_SLUGS[chainId];

  if (!address) {
    return [
      ...bundledChain(chainId),
      ...(folder ? candidates(`blockchains/${folder}/info/logo.png`) : []),
      ...symbolFallbackSources(symbol),
    ];
  }

  const key = /^0x[0-9a-fA-F]{40}$/.test(address) ? toChecksumAddress(address) : address;

  return [
    ...(folder ? candidates(`blockchains/${folder}/assets/${key}/logo.png`) : []),
    ...(folder === "solana"
      ? candidates(`blockchains/solana/assets/${address}/logo.png`)
      : []),
    ...evmTokenSources(chainId, address),
    ...symbolFallbackSources(symbol),
  ];
}

export function chainIconSources(chainId: string, slug?: string): string[] {
  const folder = slug ?? TW_SLUGS[chainId];
  return [
    ...bundledChain(chainId),
    ...(folder ? candidates(`blockchains/${folder}/info/logo.png`) : []),
  ];
}

function evmTokenSources(_chainId: string, address: string): string[] {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return [];
  return [`https://tokens.1inch.io/${address.toLowerCase()}.png`];
}

const SYMBOL_ASSET_IDS: Record<string, string> = {
  ETH: "ethereum/info/logo.png",
  WETH: "ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  BTC: "bitcoin/info/logo.png",
  WBTC: "ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
  SOL: "solana/info/logo.png",
  BNB: "smartchain/info/logo.png",
  POL: "polygon/info/logo.png",
  MATIC: "polygon/info/logo.png",
  AVAX: "avalanchec/info/logo.png",
  ARB: "arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png",
  OP: "optimism/assets/0x4200000000000000000000000000000000000042/logo.png",
  USDC: "ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  DAI: "ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
  LINK: "ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png",
  UNI: "ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png",
  AAVE: "ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png",
  GMX: "arbitrum/assets/0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a/logo.png",
  JUP: "solana/assets/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png",
  LDO: "ethereum/assets/0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32/logo.png",
  PEPE: "ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png",
  SHIB: "ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png",
  CRV: "ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png",
  MKR: "ethereum/assets/0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2/logo.png",
  GRT: "ethereum/assets/0xc944E90C64B2c07662A292be6244BDf05Cda44a7/logo.png",
  STETH: "ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png",
  WSTETH: "ethereum/assets/0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0/logo.png",
  CBETH: "ethereum/assets/0xBe9895146f7AF43049ca1c1AE358B0541Ea49704/logo.png",
  RETH: "ethereum/assets/0xae78736Cd615f374D3085123A210448E74Fc6393/logo.png",
  FTM: "fantom/info/logo.png",
  XDAI: "xdai/info/logo.png",
  CELO: "celo/info/logo.png",
  CRO: "cronos/info/logo.png",
  MNT: "mantle/info/logo.png",
  MON: "monad/info/logo.png",
  TRX: "tron/info/logo.png",
  TON: "ton/info/logo.png",
  XRP: "ripple/info/logo.png",
  DOGE: "doge/info/logo.png",
  LTC: "litecoin/info/logo.png",
  BCH: "bitcoincash/info/logo.png",
  ATOM: "cosmos/info/logo.png",
  NEAR: "near/info/logo.png",
  APT: "aptos/info/logo.png",
  SUI: "sui/info/logo.png",
  INJ: "ethereum/assets/0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30/logo.png",
  FIL: "filecoin/info/logo.png",
  ETC: "classic/info/logo.png",
  XLM: "stellar/info/logo.png",
  ADA: "cardano/info/logo.png",
  S: "sonic/info/logo.png",
  HBAR: "hedera/info/logo.png",
  VET: "vechain/info/logo.png",
  ALGO: "algorand/info/logo.png",
  SAND: "ethereum/assets/0x3845badAde8e6dFF049820680d1F14bD3903a5d0/logo.png",
  MANA: "ethereum/assets/0x0F5D2fB29fb7d3CFeE444a200298f468908cC942/logo.png",
  AXS: "ethereum/assets/0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b/logo.png",
  CAKE: "smartchain/assets/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82/logo.png",
  AERO: "base/assets/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png",
  BTCB: "smartchain/assets/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/logo.png",
};

function symbolFallbackSources(symbol: string): string[] {
  const key = symbol.trim().toUpperCase();
  const path = SYMBOL_ASSET_IDS[key];
  const low = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const local = BUNDLED_TOKEN_ICONS[low];
  return [
    ...(local ? [`/icons/tokens/${local}`] : []),
    ...(path ? candidates(`blockchains/${path}`) : []),
    ...(low ? [`https://assets.coincap.io/assets/icons/${low}@2x.png`] : []),
  ];
}
