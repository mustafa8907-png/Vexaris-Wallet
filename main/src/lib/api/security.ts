import { t as $t } from "@/lib/i18n";
import { getChain } from "@/lib/chains/registry";
import type { Chain } from "@/types/chain";
import { fetchJson } from "./http";

/**
 * GoPlus token güvenliği.
 *
 * Takas onayı öncesinde sözleşme honeypot, alım/satım kilidi, vergi ve
 * üretici yetkileri açısından denetlenir. Uç nokta anahtar istemez; veri
 * yoksa veya uç ulaşılamazsa risk "bilinmiyor" kalır ve işlem engellenmez.
 * EVM zincirleri `token_security`, Solana `solana/token_security` ucundan
 * okunur. Diğer zincirler (UTXO, TON, Near…) için güvenlik verisi yoktur.
 */

const BASE = "https://api.gopluslabs.io";
const TTL_MS = 10 * 60_000;
const STALE_ERROR_MS = 30_000;
/** Yüzde. Bu verginin üzerindeki token takasa kapatılır. */
const BLOCK_TAX_PCT = 20;
const WARN_TAX_PCT = 5;
/** Doğrulanmamış üretici yetkisi uyarılarında gösterilecek en fazla madde. */
const MAX_WARNINGS = 3;

export type RiskLevel = "safe" | "warning" | "blocked" | "unknown";

export interface TokenRisk {
  level: RiskLevel;
  /** Ekranda doğrudan gösterilecek gerekeler (etkin dilde üretilir). */
  reasons: string[];
  /** Honeypot/satış kilidi gibi fon kaybettiren kesin bulgular. */
  blocked: boolean;
  honeypot: boolean;
  /** En yüksek alım/satım vergisi (yüzde). */
  taxPct: number;
  /** Büyük borsalarda listeli veya GoPlus güven listesinde. */
  trusted: boolean;
  /** GoPlus'ta kayıt bulunamadı ya da istek başarısız. */
  missing: boolean;
  checkedAt: number;
}

const UNKNOWN: TokenRisk = {
  level: "unknown",
  reasons: [],
  blocked: false,
  honeypot: false,
  taxPct: 0,
  trusted: false,
  missing: true,
  checkedAt: 0,
};

interface GoPlusRow {
  token_name?: string;
  token_symbol?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_honeypot?: string;
  cannot_buy?: string;
  cannot_sell?: string;
  can_sell?: string;
  honeypot_with_same_creator?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_blacklisted?: string;
  transfer_pausable?: string;
  is_mintable?: string;
  slippage_modifiable?: string;
  personal_slippage_modifiable?: string;
  owner_change_balance?: string;
  hidden_owner?: string;
  external_call?: string;
  selfdestruct?: string;
  is_anti_whale?: string;
  trading_cooldown?: string;
  can_take_back_ownership?: string;
  is_whitelisted?: string;
  trust_list?: string;
  is_in_cex?: { listed?: string };
}

interface SolanaRow {
  metadata?: { name?: string; symbol?: string };
  non_transferable?: string;
  transfer_hook?: unknown[];
  freezable?: { status?: string };
  mintable?: { status?: string };
  transfer_fee_upgradable?: { status?: string };
  default_account_state_upgradable?: { status?: string };
  trusted_token?: number;
}

interface GoPlusReply<T> {
  code: number;
  message?: string;
  result?: Record<string, T> | null;
}

const cache = new Map<string, TokenRisk>();
const inflight = new Map<string, Promise<TokenRisk>>();

function on(value?: string): boolean {
  return value === "1";
}

/** GoPlus vergiyi çoğunlukla kesir (0.05) olarak verir; yüzde gelen uçta böl. */
function toPercent(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 1 ? n * 100 : n;
}

function isSolana(chain: Chain | undefined): boolean {
  return chain?.kind === "solana";
}

/** Sorgulanabilir hedef: EVM sözleşmesi ya da Solana mint'i. */
function lookupFor(
  chain: Chain,
  address: string,
): { url: string; key: string } | null {
  if (chain.kind === "solana") {
    return { url: `${BASE}/api/v1/solana/token_security?contract_addresses=${address}`, key: address };
  }
  if (chain.kind !== "evm" || typeof chain.chainId !== "number") return null;
  const lowered = address.toLowerCase();
  return {
    url: `${BASE}/api/v1/token_security/${chain.chainId}?contract_addresses=${lowered}`,
    key: lowered,
  };
}

function classifyEvm(row: GoPlusRow): TokenRisk {
  const taxPct = Math.max(toPercent(row.buy_tax), toPercent(row.sell_tax));
  const trusted = on(row.trust_list) || on(row.is_in_cex?.listed);

  const blocked: string[] = [];
  if (on(row.is_honeypot)) blocked.push($t("Honeypot: bu token alındıktan sonra geri satılamıyor."));
  if (on(row.cannot_sell)) blocked.push($t("Satış sözleşme tarafından kilitlenmiş."));
  if (row.can_sell === "0") blocked.push($t("Satış sözleşme tarafından kilitlenmiş."));
  if (on(row.cannot_buy)) blocked.push($t("Alım sözleşme tarafından kilitlenmiş."));
  if (on(row.honeypot_with_same_creator))
    blocked.push($t("Üreticinin daha önce honeypot olarak işaretlenmiş tokenları var."));
  if (taxPct >= BLOCK_TAX_PCT)
    blocked.push($t("Alım/satım vergisi %{0} — token el değiştikçe değerin büyük kısmı yakılıyor.", [Math.round(taxPct)]));

  const warnings: string[] = [];
  if (row.is_open_source === "0") warnings.push($t("Sözleşme kaynak kodu doğrulanmamış."));
  if (taxPct >= WARN_TAX_PCT && taxPct < BLOCK_TAX_PCT)
    warnings.push($t("Alım/satım vergisi %{0}.", [Math.round(taxPct)]));
  // Güven listesindeki ya da büyük borsalarda listeli sözleşmelerde üretici
  // yetkileri bilinçlidir (USDC basılabilir, transferi durdurulabilir). Aynı
  // uyarıyı her büyük coine vermek kullanıcıyı uyarıları yok saymaya alıştırır.
  if (!trusted) {
    if (on(row.is_proxy)) warnings.push($t("Sözleşme proxy: mantık sonradan değiştirilebilir."));
    if (on(row.selfdestruct)) warnings.push($t("Sözleşme kendisini imha edebiliyor."));
    if (on(row.external_call)) warnings.push($t("Sözleşme harici adresleri çağırabiliyor."));
    if (on(row.hidden_owner)) warnings.push($t("Gizli sahip (hidden owner) bildiriliyor."));
    if (on(row.can_take_back_ownership)) warnings.push($t("Sahiplik geri alınabiliyor."));
    if (on(row.is_blacklisted)) warnings.push($t("Üretici adresleri kara listeye alabiliyor."));
    if (on(row.transfer_pausable)) warnings.push($t("Transferler üretici tarafından durdurulabiliyor."));
    if (on(row.is_mintable)) warnings.push($t("Sınırsız token basılabiliyor."));
    if (on(row.slippage_modifiable) || on(row.personal_slippage_modifiable))
      warnings.push($t("Vergi oranları üretici tarafından değiştirilebiliyor."));
    if (on(row.owner_change_balance)) warnings.push($t("Sahip bakiyeleri değiştirebiliyor."));
    if (on(row.is_anti_whale) || on(row.trading_cooldown))
      warnings.push($t("Alım/satım limiti veya bekleme süresi uygulanabiliyor."));
    if (on(row.is_whitelisted)) warnings.push($t("Yalnızca beyaz liste işlem yapabiliyor."));
  }

  const shown = [...blocked, ...warnings.slice(0, MAX_WARNINGS)];
  if (!blocked.length && warnings.length > MAX_WARNINGS)
    shown.push($t("+{0} yetki uyarısı daha", [warnings.length - MAX_WARNINGS]));

  return {
    level: blocked.length ? "blocked" : warnings.length ? "warning" : "safe",
    reasons: shown,
    blocked: blocked.length > 0,
    honeypot: on(row.is_honeypot) || on(row.cannot_sell) || row.can_sell === "0",
    taxPct,
    trusted,
    missing: false,
    checkedAt: Date.now(),
  };
}

function classifySolana(row: SolanaRow): TokenRisk {
  const trusted = row.trusted_token === 1;
  const blocked: string[] = [];
  if (on(row.non_transferable)) blocked.push($t("Transferler kapalı: token cüzdandan çıkamıyor."));

  const warnings: string[] = [];
  if (row.transfer_hook && row.transfer_hook.length > 0)
    warnings.push($t("Transfer hook tanımlı: her transfer sözleşme tarafından filtrelenebilir."));
  if (!trusted) {
    if (on(row.mintable?.status)) warnings.push($t("Sınırsız token basılabiliyor."));
    if (on(row.freezable?.status)) warnings.push($t("Hesaplar dondurulabiliyor."));
    if (on(row.transfer_fee_upgradable?.status))
      warnings.push($t("Transfer ücreti sonradan eklenebiliyor."));
    if (on(row.default_account_state_upgradable?.status))
      warnings.push($t("Hesap doğrulaması sonradan değiştirilebiliyor."));
  }

  const shown = [...blocked, ...warnings.slice(0, MAX_WARNINGS)];
  return {
    level: blocked.length ? "blocked" : warnings.length ? "warning" : "safe",
    reasons: shown,
    blocked: blocked.length > 0,
    honeypot: blocked.length > 0,
    taxPct: 0,
    trusted,
    missing: false,
    checkedAt: Date.now(),
  };
}

/**
 * Bir sözleşmenin risk krokisi. Anahtarlı önbellek 10 dakika; aynı çift için
 * onay ekranı ile yürütme tek istek yapar.
 */
export async function tokenRisk(chainId: string, address?: string): Promise<TokenRisk> {
  const chain = address ? getChain(chainId) : undefined;
  if (!chain || !address) return UNKNOWN;
  if (!isSolana(chain) && !/^0x[0-9a-fA-F]{40}$/.test(address)) return UNKNOWN;
  const target = lookupFor(chain, address);
  if (!target) return UNKNOWN;

  const cacheKey = `${chainId}:${target.key}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.checkedAt < (hit.missing ? STALE_ERROR_MS : TTL_MS)) return hit;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const request = (async (): Promise<TokenRisk> => {
    try {
      const res = await fetchJson<GoPlusReply<GoPlusRow | SolanaRow>>(target.url, {}, 6_000);
      const row = res.result?.[target.key];
      if (res.code !== 1 || !row) return remember(cacheKey, { ...UNKNOWN, checkedAt: Date.now() });
      const risk = isSolana(chain)
        ? classifySolana(row as SolanaRow)
        : classifyEvm(row as GoPlusRow);
      return remember(cacheKey, risk);
    } catch {
      return remember(cacheKey, { ...UNKNOWN, checkedAt: Date.now() });
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, request);
  return request;
}

function remember(key: string, risk: TokenRisk): TokenRisk {
  cache.set(key, risk);
  return risk;
}

/** Takasın iki bacağı için adım adım risk krokisi. */
export async function screenPair(
  legs: { chainId: string; address?: string }[],
): Promise<TokenRisk[]> {
  return Promise.all(legs.map((leg) => tokenRisk(leg.chainId, leg.address)));
}

export interface SiteRisk {
  /** GoPlus oltalama kara listesinde. */
  phishing: boolean;
  /** Uç ulaşılamadı ya da kayıt yok — tarayıcı engellemez, yalnızca uyarmaz. */
  unknown: boolean;
  checkedAt: number;
}

const siteCache = new Map<string, SiteRisk>();
const siteInflight = new Map<string, Promise<SiteRisk>>();

/**
 * Tarayıcıda açılan adresin oltalama kaydı. Sözleşme taramasından ayrıdır:
 * site sahte olabilir ama işlem hedefi temiz görünür; ikisi birlikte gerekir.
 */
export async function siteRisk(url: string): Promise<SiteRisk> {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return { phishing: false, unknown: true, checkedAt: Date.now() };
  }
  if (!origin.startsWith("http")) return { phishing: false, unknown: true, checkedAt: Date.now() };

  const hit = siteCache.get(origin);
  if (hit && Date.now() - hit.checkedAt < (hit.unknown ? STALE_ERROR_MS : TTL_MS)) return hit;
  const pending = siteInflight.get(origin);
  if (pending) return pending;

  const request = (async (): Promise<SiteRisk> => {
    try {
      const res = await fetchJson<{
        code: number;
        result?: { phishing_site?: number };
      }>(`${BASE}/api/v1/phishing_site?url=${encodeURIComponent(origin)}`, {}, 6_000);
      const risk: SiteRisk =
        res.code === 1 && res.result
          ? { phishing: res.result.phishing_site === 1, unknown: false, checkedAt: Date.now() }
          : { phishing: false, unknown: true, checkedAt: Date.now() };
      siteCache.set(origin, risk);
      return risk;
    } catch {
      const risk: SiteRisk = { phishing: false, unknown: true, checkedAt: Date.now() };
      siteCache.set(origin, risk);
      return risk;
    } finally {
      siteInflight.delete(origin);
    }
  })();

  siteInflight.set(origin, request);
  return request;
}
