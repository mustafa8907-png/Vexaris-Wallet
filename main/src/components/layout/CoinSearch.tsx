import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlass, TrendDown, TrendUp, X } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { TokenIcon } from "@/components/TokenIcon";
import { useMarket } from "@/hooks/useMarket";
import { MARKET_COINS, marketCoinPath, marketHoldingKey } from "@/lib/chains/market";
import { getChain } from "@/lib/chains/registry";
import { swapAssets } from "@/lib/swap/assets";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { formatPercent, formatPrice, cn } from "@/lib/utils";


interface CoinRow {
  key: string;
  symbol: string;
  name: string;
  chainId: string;
  address?: string;
  price: number;
  change24h?: number;
  path: string;
  owned: boolean;
}

const SUGGESTIONS = ["BTC", "ETH", "USDT", "USDC", "SOL", "TRX", "TON", "XRP"];

export function CoinSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { quotes } = useMarket();
  const holdings = usePortfolioStore((s) => s.holdings);

  const all = useMemo<CoinRow[]>(() => {
    const map = new Map<string, CoinRow>();
    const put = (row: CoinRow) => {
      const prev = map.get(row.key);
      if (prev && (prev.price > 0 || row.price === 0)) {
        if (!prev.owned && row.owned) map.set(row.key, { ...prev, owned: true });
        return;
      }
      map.set(row.key, row);
    };

    for (const coin of MARKET_COINS) {
      put({
        key: coin.key,
        symbol: coin.symbol,
        name: coin.name,
        chainId: coin.chainId,
        address: coin.address,
        price: quotes[coin.key]?.price ?? 0,
        change24h: quotes[coin.key]?.change24h,
        path: marketCoinPath(coin),
        owned: holdings.some((h) => `${h.chainId}:${h.address?.toLowerCase() ?? "native"}` === marketHoldingKey(coin)),
      });
    }

    for (const h of holdings) {
      const key = `${h.chainId}:${h.address?.toLowerCase() ?? "native"}`;
      const prev = map.get(key);
      put({
        key,
        symbol: h.tokenSymbol,
        name: h.name ?? h.tokenSymbol,
        chainId: h.chainId,
        address: h.address,
        price: h.price ?? prev?.price ?? 0,
        change24h: h.change24h ?? prev?.change24h,
        path: `/token/${h.chainId}/${h.address ?? "native"}`,
        owned: true,
      });
    }

    for (const a of swapAssets()) {
      if (!a.intentsPrice) continue;
      put({
        key: a.id,
        symbol: a.symbol,
        name: a.name,
        chainId: a.chainId,
        address: a.address,
        price: a.intentsPrice,
        path: `/token/${a.chainId}/${a.address ?? "native"}`,
        owned: false,
      });
    }

    return [...map.values()];
  }, [quotes, holdings]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? all.filter(
          (r) =>
            r.symbol.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (getChain(r.chainId)?.name ?? "").toLowerCase().includes(q),
        )
      : all.filter((r) => r.price > 0);
    return [...list]
      .filter((r) => r.price > 0)
      .sort((a, b) => b.price * (b.owned ? 10 : 1) - a.price * (a.owned ? 10 : 1))
      .slice(0, 40);
  }, [all, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !query) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [query, onClose]);

  function open(row: CoinRow) {
    navigate(row.path);
    onClose();
  }

  return (
    <Modal title={$t("Coin ara")} description={$t("Sembol veya ad yaz; fiyat ve değişimi gör.")} onClose={onClose} width="lg">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-800/70 px-3 focus-within:border-accent/50">
        <MagnifyingGlass size={14} className="shrink-0 text-zinc-500" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={$t("Token adı gir — BTC, ETH, USDT…")}
          className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="focus-ring shrink-0 rounded text-zinc-600 hover:text-white"
            aria-label={$t("Aramayı temizle")}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {!query && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="focus-ring rounded-full border border-white/[0.07] bg-surface-800/60 px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 max-h-[52vh] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-zinc-500">
            {query ? $t("Eşleşen coin bulunamadı.") : $t("Fiyat verisi yükleniyor…")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((r) => {
              const up = (r.change24h ?? 0) >= 0;
              return (
                <li key={`${r.key}-${r.chainId}`}>
                  <button
                    onClick={() => open(r)}
                    className="row-hover focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left"
                  >
                    <TokenIcon
                      symbol={r.symbol}
                      chainId={r.chainId}
                      address={r.address}
                      size={30}
                      badge={Boolean(r.address)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-white">{r.symbol}</span>
                        <span className="chip shrink-0">{getChain(r.chainId)?.shortName}</span>
                        {r.owned && (
                          <span className="chip shrink-0 border-accent/30 bg-accent-soft text-accent">{$t("sende var")}</span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">{r.name}</span>
                    </span>
                    {r.change24h != null && (
                      <span
                        className={cn(
                          "tabular flex shrink-0 items-center gap-1 text-[11px] font-medium",
                          up ? "text-up" : "text-down",
                        )}
                      >
                        {up ? <TrendUp size={11} /> : <TrendDown size={11} />}
                        {formatPercent(r.change24h)}%
                      </span>
                    )}
                    <span className="tabular w-[92px] shrink-0 text-right text-[13px] font-medium text-white">
                      {formatPrice(r.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
