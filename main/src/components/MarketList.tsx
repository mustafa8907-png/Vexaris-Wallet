import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Input, Refresh, Search, Skeleton, Star, cn } from "@/kit";
import { TokenIcon } from "@/components/TokenIcon";
import { useMarket } from "@/hooks/useMarket";
import {
  MARKET_CATEGORY_LABELS,
  MARKET_COINS,
  marketCoinPath,
  marketHoldingKey,
  type MarketCategory,
  type MarketCoin,
} from "@/lib/chains/market";
import type { MarketQuote } from "@/lib/api/quotes";
import { getChain } from "@/lib/chains/registry";
import type { Holding } from "@/types/chain";
import { formatAmount, formatPercent, formatPrice, formatUsd } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

type SortKey = "rank" | "change" | "price" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  rank: $t("Piyasa sırası"),
  change: $t("Değişim"),
  price: $t("Fiyat"),
  name: $t("Ad"),
};

const CATEGORIES: (MarketCategory | "all")[] = ["all", "major", "stable", "layer2", "defi", "meme"];

interface Props {
  holdings: Holding[];
}

export function MarketList({ holdings }: Props) {
  const { quotes, loading, error, refresh } = useMarket();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("rank");
  const [ownedOnly, setOwnedOnly] = useState(false);

  const owned = useMemo(() => {
    const map = new Map<string, Holding>();
    for (const h of holdings) {
      if (h.amount > 0) map.set(`${h.chainId}:${h.address?.toLowerCase() ?? "native"}`, h);
    }
    return map;
  }, [holdings]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = MARKET_COINS.filter((coin) => {
      if (category !== "all" && coin.category !== category) return false;
      if (ownedOnly && !owned.has(marketHoldingKey(coin))) return false;
      if (!q) return true;
      return (
        coin.symbol.toLowerCase().includes(q) ||
        coin.name.toLowerCase().includes(q) ||
        (getChain(coin.chainId)?.name ?? "").toLowerCase().includes(q)
      );
    });
    if (sort !== "rank") {
      list = [...list];
      if (sort === "change") {
        list.sort((a, b) => (quotes[b.key]?.change24h ?? 0) - (quotes[a.key]?.change24h ?? 0));
      }
      if (sort === "price") {
        list.sort((a, b) => (quotes[b.key]?.price ?? 0) - (quotes[a.key]?.price ?? 0));
      }
      if (sort === "name") {
        list.sort((a, b) => a.symbol.localeCompare(b.symbol, "tr"));
      }
    }
    return list;
  }, [query, category, sort, ownedOnly, owned, quotes]);

  const ownedCount = useMemo(
    () => MARKET_COINS.filter((c) => owned.has(marketHoldingKey(c))).length,
    [owned],
  );
  const activeFilters = (category !== "all" ? 1 : 0) + (query ? 1 : 0) + (ownedOnly ? 1 : 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <Input
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={$t("Coin ara — BTC, ETH, USDT…")}
          iconLeft={<Search size={13} />}
          className="min-w-[160px] flex-1"
          aria-label={$t("Coin ara — BTC, ETH, USDT…")}
        />
        <button
          onClick={() =>
            setSort(
              (Object.keys(SORT_LABELS) as SortKey[])[
                ((Object.keys(SORT_LABELS) as SortKey[]).indexOf(sort) + 1) %
                  (Object.keys(SORT_LABELS) as SortKey[]).length
              ],
            )
          }
          className="focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-ctrl border border-line bg-surface2 px-2.5 text-[11px] text-muted transition-colors hover:border-linestrong hover:text-text"
          title={$t("Sıralamayı değiştir")}
        >
          {SORT_LABELS[sort]}
          <ChevronDown size={12} />
        </button>
        <button
          onClick={() => setOwnedOnly((v) => !v)}
          className={cn(
            "focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-ctrl border px-2.5 text-[11px] transition-colors",
            ownedOnly
              ? "border-brand/40 bg-brandsoft text-brand"
              : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
          )}
          title={$t("Yalnızca cüzdanında bulunan coinler")}
        >
          <Star size={12} fill={ownedOnly ? "currentColor" : "none"} />
          {$t("Sahip")} {ownedCount}
        </button>
        <button
          onClick={refresh}
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition-colors hover:border-linestrong hover:text-text"
          aria-label={$t("Piyasa fiyatlarını yenile")}
          title={$t("Fiyatları yenile")}
        >
          <Refresh size={12} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
        {CATEGORIES.map((key) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={cn(
              "focus-ring rounded-ctrl border px-2.5 py-1 text-[10px] font-medium transition-colors",
              category === key
                ? "border-brand/45 bg-brandsoft text-brand"
                : "border-line bg-surface2/60 text-muted hover:border-linestrong hover:text-text",
            )}
          >
            {MARKET_CATEGORY_LABELS[key]}
          </button>
        ))}
        {activeFilters > 0 && (
          <button
            onClick={() => {
              setQuery("");
              setCategory("all");
              setOwnedOnly(false);
            }}
            className="focus-ring ml-auto rounded-ctrl px-2 py-1 text-[10px] text-muted transition-colors hover:text-text"
          >
            {$t("Filtreleri temizle")}
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-line bg-warnsoft px-4 py-2 text-[11px] text-warn">
          {error} {$t("— yenilemeyi dene.")}
        </div>
      )}

      {loading && rows.length > 0 && Object.keys(quotes).length === 0 ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] w-full rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-14 text-center">
          <span className="text-sm text-textsoft">{$t("Eşleşen coin yok")}</span>
          <span className="max-w-[300px] text-xs leading-relaxed text-muted">
            {$t("Farklı bir sembol dene ya da filtreleri temizle.")}
          </span>
        </div>
      ) : (
        <ul className="space-y-0.5 p-1.5">
          {rows.map((coin, i) => (
            <MarketRow
              key={coin.key}
              coin={coin}
              rank={i + 1}
              quote={quotes[coin.key]}
              holding={owned.get(marketHoldingKey(coin))}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-2.5 text-[10px] leading-relaxed text-muted">
        {MARKET_COINS.length} {$t("standart coin. Sahip olunmayan coinler de gerçek piyasa fiyatıyla listelenir.")}
      </div>
    </div>
  );
}

const MarketRow = memo(function MarketRow({
  coin,
  rank,
  quote,
  holding,
}: {
  coin: MarketCoin;
  rank: number;
  quote?: MarketQuote;
  holding?: Holding;
}) {
  const navigate = useNavigate();
  const chain = getChain(coin.chainId);
  const change = quote?.change24h ?? 0;
  const hasPrice = quote != null && quote.price > 0;

  return (
    <li>
      <button
        onClick={() => navigate(marketCoinPath(coin))}
        className="focus-ring group flex w-full items-center gap-2.5 rounded-card border border-transparent px-2 py-2.5 text-left transition-all duration-150 hover:border-line hover:bg-surface2 sm:gap-3 sm:px-2.5"
      >
        <span className="tabular hidden w-5 shrink-0 text-right text-[10px] text-muted sm:block">{rank}</span>
        <TokenIcon
          symbol={coin.symbol}
          chainId={coin.chainId}
          address={coin.address}
          size={34}
          badge={Boolean(coin.address)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-text">{coin.symbol}</span>
            {chain && (
              <span className="hidden shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted sm:inline">
                {chain.shortName}
              </span>
            )}
            {holding && (
              <span className="flex shrink-0 items-center gap-1 rounded-xs border border-brand/30 bg-brandsoft px-1.5 py-0.5 text-[9.5px] font-medium text-brand">
                <Star size={9} fill="currentColor" /> {$t("Sahipsin")}
              </span>
            )}
            <span
              className={cn(
                "tabular text-[11px] font-medium sm:hidden",
                change > 0 ? "text-up" : change < 0 ? "text-down" : "text-muted",
              )}
            >
              {quote?.change24h != null ? `${formatPercent(change)}%` : "—"}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted">
            {holding
              ? `${formatAmount(holding.amount, 5)} ${coin.symbol} · ${formatUsd(holding.usdValue)}`
              : coin.name}
          </div>
        </div>

        <div className="hidden w-[74px] shrink-0 text-right sm:block">
          <div
            className={cn(
              "tabular text-[12px] font-medium",
              change > 0 ? "text-up" : change < 0 ? "text-down" : "text-muted",
            )}
          >
            {quote?.change24h != null ? `${formatPercent(change)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted">{$t("24 saat")}</div>
        </div>

        <div className="w-[92px] shrink-0 text-right sm:w-[112px]">
          <div className="tabular truncate text-[13px] font-semibold text-text">
            {hasPrice ? formatPrice(quote.price) : "—"}
          </div>
          <div className="text-[10px] text-muted">
            {hasPrice ? $t("güncel fiyat") : $t("fiyat bekleniyor")}
          </div>
        </div>

        <ChevronDown size={15} className="hidden shrink-0 -rotate-90 text-muted transition-colors group-hover:text-brand sm:block" />
      </button>
    </li>
  );
});
