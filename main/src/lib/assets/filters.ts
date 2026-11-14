import type { Holding } from "@/types/chain";

/**
 * Airdrop reklamları ve değersiz kalıntılar.
 *
 * Blockscout'un `reputation` alanı OP/ARB/Base gibi ağlarda bu tokenları
 * işaretlemiyor; sembol/ad üzerinden ayrıca eleniyorlar.
 */

const DOMAIN =
  /\.(com|net|org|io|xyz|cfd|top|vip|app|cc|link|site|online|finance|exchange|live|fun|club|shop|tech|space|store|icu|buzz|rest|lol|click|life|world|today|pro|one|info|biz|me|dev|ai|gg|sh|to|pw|win|cash|money)\b/i;

const PROMO = /\b(claim|airdrop|bonus|free|casino|slot|giveaway|visit|rewards?|earn)\b/i;

/** Kesin reklam: adres biçiminde metin taşıyan ya da aşırı uzun semboller. */
export function isSpamToken(symbol: string, name?: string): boolean {
  // Gerçek semboller ASCII'dir. "ᑌSDС" gibi benzer glifler kimlik avıdır.
  if (/[^\x20-\x7E]/.test(symbol)) return true;
  for (const raw of [symbol, name ?? ""]) {
    const value = raw.trim();
    if (!value) continue;
    // "E T H - B O N U S . C O M" gibi harf harf yazılmış alan adları.
    const compact = value.replace(/\s+/g, "");
    if (/https?:\/\//i.test(compact)) return true;
    if (/(^|[^a-z0-9])www\./i.test(compact)) return true;
    if (DOMAIN.test(compact)) return true;
    if (/(t\.me\/|telegram|@[a-z0-9_]{4,})/i.test(compact)) return true;
    if (/\$\s?\d/.test(value)) return true;
  }
  if (symbol.trim().length > 24) return true;
  if (PROMO.test(symbol)) return true;
  return false;
}

/** Fiyatı bulunamayan ya da bir sentin altında kalan varlıklar. */
export function isDust(holding: Holding): boolean {
  return !(holding.price && holding.price > 0) || holding.usdValue < 0.01;
}

export interface PartitionedHoldings {
  primary: Holding[];
  dust: Holding[];
}

/** Görüntülenecek varlıklar ve "toz" çekmecesine gidenler. */
export function partitionHoldings(holdings: Holding[]): PartitionedHoldings {
  const primary: Holding[] = [];
  const dust: Holding[] = [];
  for (const h of holdings) {
    if (isSpamToken(h.tokenSymbol, h.name) || isDust(h)) dust.push(h);
    else primary.push(h);
  }
  return { primary, dust };
}