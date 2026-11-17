import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader, Modal, SearchInput, Select } from "@/kit";
import { TrendingDown, TrendingUp } from "@/kit/ext";
import { TokenIcon } from "@/components/TokenIcon";
import { getChain } from "@/lib/chains/registry";
import { searchTokens, tokenPath, type TokenEntry } from "@/lib/tokens";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { formatAmount, formatPercent, formatPrice, formatUsd, cn } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

const SUGGESTIONS = ["BTC", "ETH", "USDT", "USDC", "SOL", "TRX", "TON", "XRP", "PEPE"];
const PAGE_SIZE = 50;
const DEBOUNCE_MS = 200;

export function CoinSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<TokenEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [swapOnly, setSwapOnly] = useState(false);
  const [chainFilter, setChainFilter] = useState("all");
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setVisible(PAGE_SIZE);
      setOwnedOnly(false);
      setSwapOnly(false);
      setChainFilter("all");
      return;
    }
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const seq = ++searchSeq.current;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      const result = await searchTokens({
        query: debounced,
        holdings: usePortfolioStore.getState().holdings,
        ownedOnly,
        swapOnly,
        chainId: chainFilter === "all" ? undefined : chainFilter,
        limit: visible,
        signal: controller.signal,
      });
      if (seq !== searchSeq.current || controller.signal.aborted) return;
      setRows(result.rows);
      setTotal(result.total);
      setLoading(false);
    })();
    return () => {
      controller.abort();
    };
  }, [open, debounced, ownedOnly, swapOnly, chainFilter, visible]);

  const chainOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) if (r.chainId) ids.add(r.chainId);
    const options = [{ value: "all", label: $t("Tüm ağlar") }];
    if (chainFilter !== "all" && !ids.has(chainFilter)) ids.add(chainFilter);
    for (const id of ids) options.push({ value: id, label: getChain(id)?.shortName ?? id });
    return options;
  }, [rows, chainFilter]);

  function openRow(entry: TokenEntry) {
    navigate(tokenPath(entry));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={$t("Coin ara")} description={$t("Sembol, ad veya adres yaz; fiyat, değişim ve bakiyeni gör.")} size="lg">
      <SearchInput
        value={query}
        onChange={setQuery}
        shortcut=""
        placeholder={$t("Token adı gir — BTC, ETH, USDT…")}
      />

      {!debounced && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="focus-ring rounded-ctrl border border-line bg-surface2/60 px-2.5 py-1 text-[10px] font-medium text-muted transition-colors hover:border-brand/40 hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setOwnedOnly((v) => !v)}
          className={cn(
            "focus-ring rounded-ctrl border px-2.5 py-1 text-[10px] font-medium transition-colors",
            ownedOnly
              ? "border-brand/40 bg-brandsoft text-brand"
              : "border-line bg-surface2/60 text-muted hover:border-linestrong hover:text-text",
          )}
        >
          {$t("Sahip")}
        </button>
        <button
          onClick={() => setSwapOnly((v) => !v)}
          className={cn(
            "focus-ring rounded-ctrl border px-2.5 py-1 text-[10px] font-medium transition-colors",
            swapOnly
              ? "border-brand/40 bg-brandsoft text-brand"
              : "border-line bg-surface2/60 text-muted hover:border-linestrong hover:text-text",
          )}
        >
          {$t("Takaslanabilir")}
        </button>
        <Select
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value)}
          options={chainOptions}
          className="!h-8 w-auto min-w-[120px] shrink-0 text-[10px]"
          aria-label={$t("Ağa göre filtrele")}
        />
        <span className="tabular ml-auto text-[10px] text-muted">
          {$t("{0} sonuç", [total.toLocaleString("tr-TR")])}
          {loading && <Loader size={11} className="ml-1.5 inline animate-spin" />}
        </span>
      </div>

      <div className="mt-2 max-h-[52vh] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-muted">
            {loading ? $t("Sonuçlar yükleniyor…") : debounced ? $t("Eşleşen coin bulunamadı.") : $t("Fiyat verisi yükleniyor…")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((r) => {
              const up = (r.change24h ?? 0) >= 0;
              return (
                <li key={`${r.key}-${r.chainId ?? "cg"}`}>
                  <button
                    onClick={() => openRow(r)}
                    className="focus-ring flex w-full items-center gap-3 rounded-card px-2.5 py-2 text-left transition-colors hover:bg-surface2/70"
                  >
                    <TokenIcon
                      symbol={r.symbol}
                      chainId={r.chainId ?? ""}
                      address={r.address}
                      size={30}
                      badge={Boolean(r.address)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-text">{r.symbol}</span>
                        {r.chainId && (
                          <span className="shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                            {getChain(r.chainId)?.shortName ?? r.chainId}
                          </span>
                        )}
                        {r.owned && (
                          <span className="shrink-0 rounded-xs border border-brand/30 bg-brandsoft px-1.5 py-0.5 text-[9.5px] font-medium text-brand">
                            {$t("sende var")}
                          </span>
                        )}
                        {r.analysisOnly && (
                          <span className="shrink-0 rounded-xs border border-info/30 bg-infosoft px-1.5 py-0.5 text-[9.5px] font-medium text-info">
                            {$t("analiz")}
                          </span>
                        )}
                        {r.cross && (
                          <span className="hidden shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-info sm:inline">
                            {$t("Köprü")}
                          </span>
                        )}
                        {r.swap && !r.cross && (
                          <span className="hidden shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted sm:inline">
                            {$t("Takas")}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {r.owned && r.balance > 0
                          ? `${formatAmount(r.balance, 5)} ${r.symbol} · ${formatUsd(r.balanceUsd)}`
                          : r.name}
                      </span>
                    </span>
                    {r.change24h != null && (
                      <span
                        className={cn(
                          "tabular flex shrink-0 items-center gap-1 text-[11px] font-medium",
                          up ? "text-up" : "text-down",
                        )}
                      >
                        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {formatPercent(r.change24h)}%
                      </span>
                    )}
                    <span className="tabular w-[92px] shrink-0 text-right text-[13px] font-semibold text-white">
                      {r.price > 0 ? formatPrice(r.price) : r.analysisOnly ? $t("analiz") : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 0 && rows.length < total && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            disabled={loading}
            className="focus-ring mt-2 w-full rounded-ctrl border border-line bg-surface2/60 py-2 text-[11px] font-medium text-muted transition-colors hover:border-linestrong hover:text-text disabled:opacity-50"
          >
            {$t("Daha fazla göster")} ({Math.min(PAGE_SIZE, total - rows.length)})
          </button>
        )}
      </div>
    </Modal>
  );
}
