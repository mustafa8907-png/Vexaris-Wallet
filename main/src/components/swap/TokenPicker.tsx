import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MagnifyingGlass, TrendUp, X } from "@phosphor-icons/react";
import { TokenIcon } from "@/components/TokenIcon";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { chainLabel, type SwapAsset } from "@/lib/swap/assets";
import { canUseIntents, canUseKyber } from "@/lib/swap/engine";
import { formatAmount, formatUsd, cn } from "@/lib/utils";

/**
 * Takas varlık seçici.
 *
 * Sahip olunanlar üstte, ardından popüler coinler gelir. Arama sembol, ad ve
 * zincir adında çalışır; her satır varlığın hangi motorda takas edilebildiğini
 * gösterir, böylece kullanıcı rota bulamayan bir çift seçip tıkanmaz.
 */

const POPULAR = [
  "bitcoin:native",
  "ethereum:native",
  "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7",
  "solana:native",
  "bsc:native",
  "polygon:native",
  "tron:native",
  "base:native",
  "arbitrum:native",
  "avalanche:native",
  "near:native",
  "ton:native",
];

interface Props {
  assets: SwapAsset[];
  selectedId: string;
  /** Karşı taraftaki varlık — desteklenen motorları işaretlemek için. */
  counterpart?: SwapAsset;
  side: "from" | "to";
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TokenPicker({ assets, selectedId, counterpart, side, onSelect, onClose }: Props) {
  const holdings = usePortfolioStore((s) => s.holdings);
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const owned = useMemo(() => {
    const map = new Map<string, { amount: number; usd: number }>();
    for (const h of holdings) {
      if (h.amount > 0)
        map.set(`${h.chainId}:${h.address?.toLowerCase() ?? "native"}`, {
          amount: h.amount,
          usd: h.usdValue,
        });
    }
    return map;
  }, [holdings]);

  const chains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) counts.set(a.chainId, (counts.get(a.chainId) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
  }, [assets]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assets.filter((a) => {
      if (chainFilter !== "all" && a.chainId !== chainFilter) return false;
      if (ownedOnly && !owned.has(a.id)) return false;
      if (!q) return true;
      return (
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        chainLabel(a.chainId).toLowerCase().includes(q) ||
        (a.address ?? "").toLowerCase() === q
      );
    });

    const rank = (a: SwapAsset) => {
      const bal = owned.get(a.id);
      if (bal) return -1_000_000 - bal.usd;
      const pop = POPULAR.indexOf(a.id);
      if (pop >= 0) return pop;
      return 1000 + (a.address ? 1 : 0);
    };

    return list.sort((a, b) => {
      const d = rank(a) - rank(b);
      return d !== 0 ? d : a.symbol.localeCompare(b.symbol, "tr");
    });
  }, [assets, query, chainFilter, ownedOnly, owned]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [query, chainFilter, ownedOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && rows[cursor]) {
        e.preventDefault();
        onSelect(rows[cursor].id);
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rows, cursor, onSelect, onClose]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={side === "from" ? $t("Verilecek tokenı seç") : $t("Alınacak tokenı seç")}
        className="flex max-h-full w-full max-w-lg animate-fade-up flex-col overflow-hidden rounded-xl3 border border-white/[0.09] bg-surface-850 shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-white">
              {side === "from" ? $t("Verilecek token") : $t("Alınacak token")}
            </h2>
            <p className="text-[10px] text-zinc-500">{assets.length} {$t("varlık · canlı liste")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={$t("Kapat")}
            className="focus-ring rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-800 px-3 py-2 focus-within:border-accent/45">
            <MagnifyingGlass size={14} className="shrink-0 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={$t("Sembol, ad, zincir veya sözleşme adresi")}
              spellCheck={false}
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-zinc-600"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={$t("Aramayı temizle")}
                className="focus-ring rounded text-zinc-500 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto">
            <FilterChip active={chainFilter === "all"} onClick={() => setChainFilter("all")}>
              {$t("Tümü")}
            </FilterChip>
            <FilterChip active={ownedOnly} onClick={() => setOwnedOnly((v) => !v)}>
              <TrendUp size={10} /> {$t("Sahip")} {owned.size}
            </FilterChip>
            {chains.map((id) => (
              <FilterChip key={id} active={chainFilter === id} onClick={() => setChainFilter(id)}>
                {chainLabel(id)}
              </FilterChip>
            ))}
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[13px] text-zinc-400">{$t("Eşleşen varlık yok")}</p>
              <p className="mt-1 text-[11px] text-zinc-600">
                {$t("Aramayı kısalt veya zincir filtresini kaldır.")}
              </p>
            </div>
          ) : (
            rows.map((a, i) => {
              const bal = owned.get(a.id);
              const kyber = counterpart ? canUseKyber(side === "from" ? a : counterpart, side === "from" ? counterpart : a) : false;
              const intents = counterpart ? canUseIntents(side === "from" ? a : counterpart, side === "from" ? counterpart : a) : false;
              return (
                <button
                  key={a.id}
                  data-idx={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    onSelect(a.id);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    i === cursor ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                  )}
                >
                  <TokenIcon symbol={a.symbol} chainId={a.chainId} address={a.address} size={32} badge />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-white">{a.symbol}</span>
                      {a.id === selectedId && <Check size={12} className="shrink-0 text-accent" />}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {chainLabel(a.chainId)}
                      {a.address ? $t(" · sözleşme") : $t(" · yerel")}
                    </span>
                  </span>
                  {counterpart && (
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      {kyber && <span className="chip border-teal/25 text-teal">Kyber</span>}
                      {intents && <span className="chip border-violet/25 text-violet">Intents</span>}
                      {!kyber && !intents && <span className="chip text-zinc-600">{$t("rota yok")}</span>}
                    </span>
                  )}
                  <span className="shrink-0 text-right">
                    <span className="tabular block text-[12px] text-zinc-200">
                      {bal ? formatAmount(bal.amount, 6) : "—"}
                    </span>
                    <span className="tabular block text-[10px] text-zinc-600">
                      {bal && bal.usd > 0 ? formatUsd(bal.usd) : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-2 text-[10px] text-zinc-600">
          {$t("↑ ↓ gezin · Enter seç · Esc kapat")}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-accent/45 bg-accent-soft text-accent"
          : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}