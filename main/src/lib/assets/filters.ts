import type { Holding } from "@/types/chain";


const DOMAIN =
  /\.(com|net|org|io|xyz|cfd|top|vip|app|cc|link|site|online|finance|exchange|live|fun|club|shop|tech|space|store|icu|buzz|rest|lol|click|life|world|today|pro|one|info|biz|me|dev|ai|gg|sh|to|pw|win|cash|money)\b/i;

const PROMO = /\b(claim|airdrop|bonus|free|casino|slot|giveaway|visit|rewards?|earn)\b/i;

export function isSpamToken(symbol: string, name?: string): boolean {
  if (/[^\x20-\x7E]/.test(symbol)) return true;
  for (const raw of [symbol, name ?? ""]) {
    const value = raw.trim();
    if (!value) continue;
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

export function isDust(holding: Holding): boolean {
  return !(holding.price && holding.price > 0) || holding.usdValue < 0.01;
}

export interface PartitionedHoldings {
  primary: Holding[];
  dust: Holding[];
}

export function partitionHoldings(holdings: Holding[]): PartitionedHoldings {
  const primary: Holding[] = [];
  const dust: Holding[] = [];
  for (const h of holdings) {
    if (isSpamToken(h.tokenSymbol, h.name) || isDust(h)) dust.push(h);
    else primary.push(h);
  }
  return { primary, dust };
}