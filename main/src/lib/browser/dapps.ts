import { t as $t } from "@/lib/i18n";

export type DappCategory = "swap" | "lend" | "nft" | "bridge" | "tools" | "social" | "game";

export interface DappEntry {
  name: string;
  url: string;
  category: DappCategory;
  chains: string[];
  blurb: string;
}

export const CATEGORY_LABEL: Record<DappCategory, string> = {
  swap: $t("Takas"),
  lend: $t("Borç ve getiri"),
  nft: $t("NFT pazarları"),
  bridge: $t("Köprü"),
  tools: $t("Araçlar"),
  social: $t("Sosyal ve görev"),
  game: $t("Oyun"),
};

export const CATEGORY_TONE: Record<DappCategory, string> = {
  swap: "text-magenta",
  lend: "text-success",
  nft: "text-info",
  bridge: "text-violet",
  tools: "text-warning",
  social: "text-teal",
  game: "text-lime",
};

export const DAPPS: DappEntry[] = [
  { name: "Uniswap", url: "https://app.uniswap.org", category: "swap", chains: ["ethereum", "arbitrum", "base", "optimism", "polygon", "bsc"], blurb: $t("En yaygın merkeziyetsiz takas ve likidite havuzları") },
  { name: "PancakeSwap", url: "https://pancakeswap.finance/swap", category: "swap", chains: ["bsc", "ethereum", "arbitrum", "base", "linea"], blurb: $t("BNB Chain'in ana takas borsası") },
  { name: "1inch", url: "https://app.1inch.io", category: "swap", chains: ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base"], blurb: $t("Birden çok borsadan en iyi fiyatı toplayan yönlendirici") },
  { name: "Aerodrome", url: "https://aerodrome.finance", category: "swap", chains: ["base"], blurb: $t("Base ağının likidite merkezi") },
  { name: "Velodrome", url: "https://velodrome.finance", category: "swap", chains: ["optimism"], blurb: $t("Optimism'in oy verilen likidite borsası") },
  { name: "Camelot", url: "https://app.camelot.exchange", category: "swap", chains: ["arbitrum"], blurb: $t("Arbitrum'a özel takas ve launchpad") },
  { name: "QuickSwap", url: "https://quickswap.exchange", category: "swap", chains: ["polygon"], blurb: $t("Polygon'un ilk ve en köklü takas borsası") },
  { name: "Lynex", url: "https://app.lynex.fi", category: "swap", chains: ["linea"], blurb: $t("Linea ağının likidite katmanı") },
  { name: "Curve", url: "https://curve.finance", category: "swap", chains: ["ethereum", "arbitrum", "polygon", "optimism", "base"], blurb: $t("Stablecoin takasında düşük kayma") },
  { name: "Sushi", url: "https://www.sushi.com/swap", category: "swap", chains: ["ethereum", "arbitrum", "polygon", "bsc", "base"], blurb: $t("Çok zincirli takas ve BentoBox kasaları") },

  { name: "Aave", url: "https://app.aave.com", category: "lend", chains: ["ethereum", "arbitrum", "optimism", "polygon", "base", "avalanche"], blurb: $t("Teminat yatır, faizle borç al") },
  { name: "Morpho", url: "https://app.morpho.org", category: "lend", chains: ["ethereum", "base"], blurb: $t("Eşler arası eşleşmeyle daha iyi borç faizi") },
  { name: "Compound", url: "https://app.compound.finance", category: "lend", chains: ["ethereum", "arbitrum", "polygon", "base"], blurb: $t("Klasik para piyasası protokolü") },
  { name: "Spark", url: "https://app.spark.fi", category: "lend", chains: ["ethereum"], blurb: $t("MakerDAO'nun DAI odaklı borç piyasası") },
  { name: "Lido", url: "https://stake.lido.fi", category: "lend", chains: ["ethereum"], blurb: $t("ETH yatır, likit stETH al") },
  { name: "Rocket Pool", url: "https://stake.rocketpool.net", category: "lend", chains: ["ethereum"], blurb: $t("Merkeziyetsiz ETH stake havuzu") },
  { name: "Pendle", url: "https://app.pendle.finance", category: "lend", chains: ["ethereum", "arbitrum", "bsc", "optimism"], blurb: $t("Getiriyi ayırıp sabit faizle işlem yap") },
  { name: "Beefy", url: "https://app.beefy.com", category: "lend", chains: ["ethereum", "bsc", "polygon", "arbitrum", "base", "optimism"], blurb: $t("Likidite havuzu getirilerini otomatik bileşikleştirir") },
  { name: "Yearn", url: "https://yearn.fi/v3", category: "lend", chains: ["ethereum", "arbitrum", "base", "optimism"], blurb: $t("Strateji kasalarıyla otomatik getiri") },

  { name: "OpenSea", url: "https://opensea.io", category: "nft", chains: ["ethereum", "polygon", "base", "arbitrum", "optimism"], blurb: $t("En büyük NFT pazarı") },
  { name: "Blur", url: "https://blur.io", category: "nft", chains: ["ethereum"], blurb: $t("Profesyonel NFT işlem terminali") },
  { name: "Magic Eden", url: "https://magiceden.io", category: "nft", chains: ["ethereum", "polygon", "base"], blurb: $t("Çok zincirli NFT pazarı ve launchpad") },
  { name: "Rarible", url: "https://rarible.com", category: "nft", chains: ["ethereum", "polygon", "base"], blurb: $t("NFT bas, listele, koleksiyon kur") },
  { name: "Zora", url: "https://zora.co", category: "nft", chains: ["ethereum", "base"], blurb: $t("Yaratıcılar için basım ve toplama") },

  { name: "Across", url: "https://app.across.to", category: "bridge", chains: ["ethereum", "arbitrum", "optimism", "base", "polygon", "linea"], blurb: $t("Niyet tabanlı hızlı ağlar arası transfer") },
  { name: "Stargate", url: "https://stargate.finance", category: "bridge", chains: ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism", "avalanche"], blurb: $t("LayerZero üstünde birleşik likidite köprüsü") },
  { name: "Bungee", url: "https://www.bungee.exchange", category: "bridge", chains: ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism"], blurb: $t("Köprü ve takası tek işlemde birleştiren yönlendirici") },
  { name: "Orbiter", url: "https://www.orbiter.finance", category: "bridge", chains: ["ethereum", "arbitrum", "base", "optimism", "polygon", "linea"], blurb: $t("Katmanlar arası düşük ücretli transfer") },
  { name: "Hop", url: "https://app.hop.exchange", category: "bridge", chains: ["ethereum", "arbitrum", "optimism", "polygon", "base", "linea"], blurb: $t("Katman 2 ağları arasında köprü") },
  { name: "Squid", url: "https://app.squidrouter.com", category: "bridge", chains: ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism", "avalanche"], blurb: $t("Axelar üstünde zincirler arası takas") },

  { name: "Revoke.cash", url: "https://revoke.cash", category: "tools", chains: ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism"], blurb: $t("Sözleşmelere verdiğin harcama izinlerini geri al") },
  { name: "Safe", url: "https://app.safe.global", category: "tools", chains: ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism"], blurb: $t("Çok imzalı ortak kasa") },
  { name: "DeBank", url: "https://debank.com", category: "tools", chains: [], blurb: $t("Tüm ağlardaki varlık ve borçlarının dökümü") },
  { name: "DefiLlama", url: "https://defillama.com", category: "tools", chains: [], blurb: $t("Protokol büyüklükleri ve getiri karşılaştırması") },
  { name: "Etherscan", url: "https://etherscan.io", category: "tools", chains: ["ethereum"], blurb: $t("Ethereum işlem ve sözleşme gezgini") },
  { name: "ENS", url: "https://app.ens.domains", category: "tools", chains: ["ethereum"], blurb: $t(".eth adı al ve adresine bağla") },
  { name: "Zerion", url: "https://app.zerion.io", category: "tools", chains: [], blurb: $t("Portföy takibi ve işlem geçmişi") },
  { name: "Snapshot", url: "https://snapshot.box", category: "tools", chains: [], blurb: $t("Gaz ödemeden yönetişim oyu ver") },

  { name: "Farcaster", url: "https://warpcast.com", category: "social", chains: ["optimism", "base"], blurb: $t("Merkeziyetsiz sosyal ağ istemcisi") },
  { name: "Lens", url: "https://hey.xyz", category: "social", chains: ["polygon"], blurb: $t("Zincir üstü sosyal profil ve yayınlar") },
  { name: "Galxe", url: "https://app.galxe.com", category: "social", chains: [], blurb: $t("Topluluk görevleri ve ödül kampanyaları") },
  { name: "Layer3", url: "https://app.layer3.xyz", category: "social", chains: [], blurb: $t("Zincirleri gezerek öğren, görev tamamla") },
  { name: "Guild", url: "https://guild.xyz", category: "social", chains: [], blurb: $t("Token koşullu topluluk erişimi") },

  { name: "Pixels", url: "https://play.pixels.xyz", category: "game", chains: ["ethereum"], blurb: $t("Çiftlik kur, topla, takas et") },
  { name: "Axie Infinity", url: "https://app.axieinfinity.com", category: "game", chains: ["ethereum"], blurb: $t("Yaratık topla ve savaş") },
  { name: "Decentraland", url: "https://play.decentraland.org", category: "game", chains: ["ethereum", "polygon"], blurb: $t("Sanal dünya ve arazi") },
  { name: "Gods Unchained", url: "https://godsunchained.com", category: "game", chains: ["ethereum"], blurb: $t("Zincir üstü kart oyunu") },
];

export function searchDapps(query: string): DappEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return DAPPS.filter(
    (dapp) =>
      dapp.name.toLowerCase().includes(needle) ||
      dapp.url.toLowerCase().includes(needle) ||
      dapp.blurb.toLowerCase().includes(needle),
  ).slice(0, 6);
}