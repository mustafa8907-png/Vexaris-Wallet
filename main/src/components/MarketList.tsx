import { t as $t } from "@/lib/i18n";
import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowsDownUp, CaretRight, ArrowsClockwise, MagnifyingGlass, Star, X } from "@phosphor-icons/react";
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
import { formatAmount, formatPercent, formatPrice, formatUsd, cn } from "@/lib/utils";

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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-2.5">
        <div className="flex h-8 min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 focus-within:border-accent/50">
          <MagnifyingGlass size={13} className="shrink-0 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={$t("Coin ara — BTC, ETH, USDT…")}
            className="w-full bg-transparent text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="focus-ring shrink-0 rounded text-zinc-600 hover:text-white"
              aria-label={$t("Aramayı temizle")}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() =>
            setSort(
              (Object.keys(SORT_LABELS) as SortKey[])[
                ((Object.keys(SORT_LABELS) as SortKey[]).indexOf(sort) + 1) %
                  (Object.keys(SORT_LABELS) as SortKey[]).length
              ],
            )
          }
          className="focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.14] hover:text-white"
          title={$t("Sıralamayı değiştir")}
        >
          <ArrowsDownUp size={12} />
          {SORT_LABELS[sort]}
        </button>
        <button
          onClick={() => setOwnedOnly((v) => !v)}
          className={cn(
            "focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors",
            ownedOnly
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-white/[0.06] bg-surface-800/70 text-zinc-400 hover:border-white/[0.14] hover:text-white",
          )}
          title={$t("Yalnızca cüzdanında bulunan coinler")}
        >
          <Star size={12} className={cn(ownedOnly && "fill-current")} />
          {$t("Sahip")} {ownedCount}
        </button>
        <button
          onClick={refresh}
          className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-surface-800/70 text-zinc-400 transition-colors hover:border-white/[0.14] hover:text-white"
          aria-label={$t("Piyasa fiyatlarını yenile")}
          title={$t("Fiyatları yenile")}
        >
          <ArrowsClockwise size={12} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] px-3 py-2">
        {CATEGORIES.map((key) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={cn(
              "focus-ring rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
              category === key
                ? "border-accent/45 bg-accent-soft text-accent"
                : "border-white/[0.06] bg-surface-800/50 text-zinc-500 hover:border-white/[0.14] hover:text-zinc-200",
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
            className="focus-ring ml-auto rounded-full px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:text-white"
          >
            {$t("Filtreleri temizle")}
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-white/[0.05] bg-warning/[0.05] px-4 py-2 text-[11px] text-warning/90">
          {error} {$t("— yenilemeyi dene.")}
        </div>
      )}

      {loading && rows.length > 0 && Object.keys(quotes).length === 0 ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[52px] w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-14 text-center">
          <span className="text-sm text-zinc-400">{$t("Eşleşen coin yok")}</span>
          <span className="max-w-[300px] text-xs leading-relaxed text-zinc-600">
            {$t("Farklı bir sembol dene ya da filtreleri temizle.")}
          </span>
        </div>
      ) : (
        <ul className="stagger p-1.5">
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

      <div className="border-t border-white/[0.05] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
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
        className="row-hover focus-ring group flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left sm:gap-3 sm:px-2.5"
      >
        <span className="tabular hidden w-5 shrink-0 text-right text-[10px] text-zinc-600 sm:block">
          {rank}
        </span>
        <TokenIcon
          symbol={coin.symbol}
          chainId={coin.chainId}
          address={coin.address}
          size={34}
          badge={Boolean(coin.address)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-white">{coin.symbol}</span>
            {chain && <span className="chip hidden shrink-0 sm:inline">{chain.shortName}</span>}
            {holding && (
              <span className="chip shrink-0 border-accent/30 bg-accent-soft text-accent">
                <Star size={9} className="fill-current" /> {$t("Sahipsin")}
              </span>
            )}
            <span
              className={cn(
                "tabular text-[11px] font-medium sm:hidden",
                change > 0 ? "text-up" : change < 0 ? "text-down" : "text-zinc-500",
              )}
            >
              {quote?.change24h != null ? `${formatPercent(change)}%` : "—"}
            </span>
          </div>
          <div className="truncate text-[11px] text-zinc-500">
            {holding
              ? `${formatAmount(holding.amount, 5)} ${coin.symbol} · ${formatUsd(holding.usdValue)}`
              : coin.name}
          </div>
        </div>

        <div className="hidden w-[74px] shrink-0 text-right sm:block">
          <div
            className={cn(
              "tabular text-[12px] font-medium",
              change > 0 ? "text-up" : change < 0 ? "text-down" : "text-zinc-500",
            )}
          >
            {quote?.change24h != null ? `${formatPercent(change)}%` : "—"}
          </div>
          <div className="text-[10px] text-zinc-600">{$t("24 saat")}</div>
        </div>

        <div className="w-[92px] shrink-0 text-right sm:w-[112px]">
          <div className="tabular truncate text-[13px] font-medium text-white">
            {hasPrice ? formatPrice(quote.price) : "—"}
          </div>
          <div className="text-[10px] text-zinc-600">
            {hasPrice ? $t("güncel fiyat") : $t("fiyat bekleniyor")}
          </div>
        </div>

        <CaretRight
          size={15}
          className="hidden shrink-0 text-zinc-700 transition-colors group-hover:text-accent sm:block"
        />
      </button>
    </li>
  );
});