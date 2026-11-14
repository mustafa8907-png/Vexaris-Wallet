import { t as $t } from "@/lib/i18n";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Warning, ArrowsLeftRight, ArrowsDownUp, CaretRight, Eye, EyeSlash, ClockCounterClockwise, QrCode, ArrowsClockwise, MagnifyingGlass, PaperPlaneTilt } from "@phosphor-icons/react";
import { TokenIcon } from "@/components/TokenIcon";
import { MarketList } from "@/components/MarketList";
import { PortfolioChart } from "@/components/PortfolioChart";
import { TxDetailDrawer, TxKindBadge } from "@/components/TxDetailDrawer";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/hooks/useHistory";
import { useCountUp } from "@/hooks/useCountUp";
import { getChain } from "@/lib/chains/registry";
import { MARKET_COINS } from "@/lib/chains/market";
import { partitionHoldings, isDust } from "@/lib/assets/filters";
import { RANGE_LABELS, type ChartRange } from "@/lib/api/defillama";
import type { TxRecord } from "@/lib/api/history";
import type { Holding } from "@/types/chain";
import { formatAmount, formatPercent, formatUsd, shortAddress, cn } from "@/lib/utils";

type SortKey = "value" | "change" | "name";

const ROW_LIMIT = 24;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: $t("Değer") },
  { key: "change", label: $t("Değişim") },
  { key: "name", label: $t("Ad") },
];

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return $t("az önce");
  if (m < 60) return $t("{0} dk önce", [m]);
  const h = Math.floor(m / 60);
  if (h < 24) return $t("{0} sa önce", [h]);
  const d = Math.floor(h / 24);
  if (d < 30) return $t("{0} gün önce", [d]);
  return new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function assetPath(h: Holding): string {
  return `/token/${h.chainId}/${h.address ?? "native"}`;
}

const AnimatedTotal = memo(function AnimatedTotal({
  value,
  loading,
}: {
  value: number;
  loading: boolean;
}) {
  const animated = useCountUp(value, 650);
  return (
    <span className="tabular text-[28px] font-semibold leading-none tracking-tight text-white">
      {loading ? "—" : formatUsd(animated)}
    </span>
  );
});

const TokenRow = memo(function TokenRow({
  holding: h,
  onOpen,
}: {
  holding: Holding;
  onOpen: (h: Holding) => void;
}) {
  const chain = getChain(h.chainId);
  const change = h.change24h ?? 0;
  const changeTone = change > 0 ? "text-up" : change < 0 ? "text-down" : "text-zinc-500";
  return (
    <li>
      <button
        onClick={() => onOpen(h)}
        className={cn(
          "row-hover focus-ring group flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left sm:gap-3 sm:px-2.5",
          isDust(h) && "opacity-55 hover:opacity-100",
        )}
      >
        <TokenIcon symbol={h.tokenSymbol} chainId={h.chainId} address={h.address} size={34} badge />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-white">{h.tokenSymbol}</span>
            <span className="chip shrink-0">{chain?.shortName}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate text-[11px] text-zinc-500">
            <span className={cn("tabular sm:hidden", h.price ? changeTone : "text-zinc-600")}>
              {h.price ? `${formatPercent(change)}%` : $t("fiyat yok")}
            </span>
            <span className="hidden truncate sm:inline">{h.name ?? chain?.name}</span>
          </div>
        </div>

        <div className="hidden w-[74px] shrink-0 text-right sm:block">
          <div className={cn("tabular text-[12px] font-medium", changeTone)}>
            {h.price ? `${formatPercent(change)}%` : "—"}
          </div>
          <div className="tabular text-[10px] text-zinc-600">
            {h.price ? formatUsd(h.price) : $t("fiyat yok")}
          </div>
        </div>

        <div className="w-[92px] shrink-0 text-right sm:w-[112px]">
          <div className="tabular text-[13px] font-medium text-white">
            {h.usdValue > 0 ? formatUsd(h.usdValue) : "—"}
          </div>
          <div className="tabular truncate text-[11px] text-zinc-500">
            {formatAmount(h.amount, 5)} {h.tokenSymbol}
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

const TxPreviewRow = memo(function TxPreviewRow({
  tx,
  onOpen,
}: {
  tx: TxRecord;
  onOpen: (tx: TxRecord) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onOpen(tx)}
        className="row-hover focus-ring flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left"
      >
        <TxKindBadge tx={tx} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-zinc-100">
            {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
            {formatAmount(tx.amount, 5)} {tx.symbol}
          </div>
          <div className="truncate text-[10px] text-zinc-500">
            {getChain(tx.chainId)?.shortName} · {timeAgo(tx.timestamp)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[11px] text-zinc-300">
            {tx.usdValue > 0 ? formatUsd(tx.usdValue) : "—"}
          </div>
          <div className="truncate font-mono text-[9px] text-zinc-600">
            {shortAddress(tx.counterparty, 4)}
          </div>
        </div>
      </button>
    </li>
  );
});

export function HomePage() {
  const navigate = useNavigate();
  const {
    holdings,
    series,
    range,
    totalUsd,
    changePct,
    loading,
    refreshing,
    error,
    failedChains,
    partialChains,
    updatedAt,
    refreshNow,
    setRange,
  } = usePortfolio();
  const history = useHistory();

  const [tab, setTab] = useState<"tokens" | "market" | "split">("tokens");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("value");
  const [showDust, setShowDust] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openTx, setOpenTx] = useState<TxRecord | null>(null);
  const openAsset = useCallback((h: Holding) => navigate(assetPath(h)), [navigate]);

  const { primary, dust } = useMemo(() => partitionHoldings(holdings), [holdings]);
  const searching = query.trim().length > 0;
  const expanded = showDust || searching || primary.length === 0;
  const visible = expanded ? holdings : primary;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? visible.filter(
          (h) =>
            h.tokenSymbol.toLowerCase().includes(q) ||
            (h.name ?? "").toLowerCase().includes(q) ||
            (getChain(h.chainId)?.name ?? "").toLowerCase().includes(q),
        )
      : visible;
    const sorted = [...filtered];
    if (sort === "value") sorted.sort((a, b) => b.usdValue - a.usdValue);
    if (sort === "change") sorted.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
    if (sort === "name") sorted.sort((a, b) => a.tokenSymbol.localeCompare(b.tokenSymbol, "tr"));
    return sorted;
  }, [visible, query, sort]);

  const split = useMemo(() => {
    const totals = new Map<string, { value: number; count: number }>();
    for (const h of visible) {
      const entry = totals.get(h.chainId) ?? { value: 0, count: 0 };
      entry.value += h.usdValue;
      entry.count += 1;
      totals.set(h.chainId, entry);
    }
    const list = [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
    const total = list.reduce((sum, [, v]) => sum + v.value, 0) || 1;
    return list.map(([chainId, entry]) => ({
      chainId,
      value: entry.value,
      count: entry.count,
      pct: (entry.value / total) * 100,
    }));
  }, [visible]);

  const up = changePct >= 0;
  const preview = history.records.slice(0, 6);

  const onRange = useCallback((next: ChartRange) => void setRange(next), [setRange]);
  const shown = searching || showAll ? rows : rows.slice(0, ROW_LIMIT);

  const actions = [
    { label: $t("Gönder"), icon: PaperPlaneTilt, onClick: () => navigate("/send"), tone: "text-accent" },
    { label: $t("Al"), icon: QrCode, onClick: () => navigate("/receive"), tone: "text-info" },
    { label: $t("Takas"), icon: ArrowsLeftRight, onClick: () => navigate("/swap"), tone: "text-violet" },
    { label: $t("Geçmiş"), icon: ClockCounterClockwise, onClick: () => navigate("/activity"), tone: "text-teal" },
  ];

  return (
    <div className="page">
      <div className="mx-auto max-w-6xl pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-white">{$t("Portföy")}</h1>
            <span className="live-chip">
              <span className="live-dot" /> {$t("canlı")}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-[11px] text-zinc-600 sm:inline">
              {updatedAt
                ? `Güncellendi ${new Date(updatedAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : $t("Veriler okunuyor…")}
            </span>
            <button
              onClick={refreshNow}
              disabled={refreshing}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-850 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white disabled:opacity-60"
            >
              <ArrowsClockwise size={12} className={cn(refreshing && "animate-spin")} />
              {refreshing ? $t("Yenileniyor…") : $t("Yenile")}
            </button>
          </div>
        </div>

        <section className="panel mt-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              {$t("Toplam bakiye")}
            </div>
            <span
              className={cn(
                "tabular rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                up ? "bg-up/[0.1] text-up" : "bg-down/[0.1] text-down",
              )}
            >
              {formatPercent(changePct)}%
              <span className="ml-1 font-normal opacity-70">{RANGE_LABELS[range]}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <AnimatedTotal value={totalUsd} loading={loading} />
            <span className="mb-0.5 text-[11px] text-zinc-500">
              {primary.length} {$t("varlık")}
              {dust.length > 0 && (
                <span className="text-zinc-600"> · {$t("{0} toz", [dust.length])}</span>
              )}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {actions.map(({ label, icon: Icon, onClick, tone }) => (
              <button
                key={label}
                onClick={onClick}
                className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-surface-850/80 py-3 text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-white"
              >
                <Icon size={16} className={tone} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {(error || failedChains.length > 0 || partialChains.length > 0) && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.06] p-2.5 text-[10px] leading-relaxed text-warning/90">
              <Warning size={12} className="mt-px shrink-0" />
              <span>
                {error ??
                  [
                    failedChains.length > 0
                      ? `Ulaşılamayan ağ: ${failedChains
                          .map((c) => getChain(c)?.shortName ?? c)
                          .join(", ")}.`
                      : "",
                    partialChains.length > 0
                      ? `Token listesi tamamlanamadı: ${partialChains
                          .map((c) => getChain(c)?.shortName ?? c)
                          .join(", ")} — yeniden dene.`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
              </span>
            </div>
          )}
        </section>

        <div className="mt-4">
          <PortfolioChart
            series={series}
            range={range}
            changePct={changePct}
            loading={loading}
            onRange={onRange}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel lg:col-span-2">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 sm:gap-5 sm:px-4">
              {(
                [
                  ["tokens", $t("Tokenlar")],
                  ["market", $t("Piyasa")],
                  ["split", $t("Dağılım")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "relative py-3 text-[13px] font-medium transition-colors",
                    tab === key ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {label}
                  {tab === key && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />
                  )}
                </button>
              ))}
              <span className="ml-auto hidden text-[11px] text-zinc-600 sm:block">
                {tab === "market"
                  ? `${MARKET_COINS.length} coin`
                  : tab === "tokens"
                    ? $t("{0} varlık", [visible.length])
                    : $t("{0} ağ", [split.length])}
              </span>
            </div>

            {tab === "tokens" && (
              <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-2.5">
                <div className="flex h-8 min-w-[150px] flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 focus-within:border-accent/50">
                  <MagnifyingGlass size={13} className="shrink-0 text-zinc-600" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={$t("Token veya ağ ara")}
                    className="w-full bg-transparent text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600"
                  />
                </div>
                <button
                  onClick={() =>
                    setSort(SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length].key)
                  }
                  className="focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.14] hover:text-white"
                  title={$t("Sıralamayı değiştir")}
                >
                  <ArrowsDownUp size={12} />
                  {SORTS.find((s) => s.key === sort)?.label}
                </button>
                {dust.length > 0 && (
                  <button
                    onClick={() => setShowDust((v) => !v)}
                    className={cn(
                      "focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors",
                      showDust
                        ? "border-accent/40 bg-accent-soft text-accent"
                        : "border-white/[0.06] bg-surface-800/70 text-zinc-400 hover:border-white/[0.14] hover:text-white",
                    )}
                    title={$t("Fiyatı bulunamayan ya da değeri çok küçük tokenlar")}
                  >
                    {showDust ? <EyeSlash size={12} /> : <Eye size={12} />}
                    {$t("Toz {0}", [dust.length])}
                  </button>
                )}
              </div>
            )}

            {tab === "market" ? (
              <MarketList holdings={holdings} />
            ) : tab === "tokens" ? (
              loading && holdings.length === 0 ? (
                <div className="space-y-1.5 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-[52px] w-full" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-14 text-center">
                  <span className="text-sm text-zinc-400">
                    {query ? $t("Eşleşen varlık yok") : $t("Bu adreste henüz varlık yok")}
                  </span>
                  <span className="max-w-[300px] text-xs leading-relaxed text-zinc-600">
                    {query
                      ? $t("Farklı bir sembol ya da ağ adı dene.")
                      : $t("Al sekmesinden adresini kopyalayıp bu cüzdana varlık gönderebilirsin.")}
                  </span>
                </div>
              ) : (
                <>
                  <ul className="stagger p-1.5">
                    {shown.map((h) => (
                      <TokenRow
                        key={`${h.chainId}-${h.address ?? "native"}`}
                        holding={h}
                        onOpen={openAsset}
                      />
                    ))}
                  </ul>
                  {rows.length > shown.length && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="focus-ring w-full border-t border-white/[0.05] py-2.5 text-[11px] text-zinc-500 transition-colors hover:text-accent"
                    >
                      {rows.length - shown.length} {$t("varlık daha göster")}
                    </button>
                  )}
                </>
              )
            ) : split.length === 0 ? (
              <div className="py-14 text-center text-sm text-zinc-500">
                {$t("Dağılım için değerlenmiş varlık gerekiyor.")}
              </div>
            ) : (
              <div className="p-4">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-800">
                  {split.map((s, i) => (
                    <span
                      key={s.chainId}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${s.pct}%`,
                        background: SPLIT_COLORS[i % SPLIT_COLORS.length],
                      }}
                      title={`${getChain(s.chainId)?.name} %${s.pct.toFixed(1)}`}
                    />
                  ))}
                </div>
                <ul className="mt-4 space-y-1">
                  {split.map((s, i) => {
                    const chain = getChain(s.chainId);
                    return (
                      <li
                        key={s.chainId}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }}
                        />
                        <span className="flex-1 truncate text-[12px] text-zinc-200">
                          {chain?.name}
                        </span>
                        <span className="hidden text-[11px] text-zinc-600 sm:block">
                          {s.count} token
                        </span>
                        <span className="tabular w-[46px] text-right text-[12px] text-zinc-300 sm:w-[52px]">
                          %{s.pct.toFixed(1)}
                        </span>
                        <span className="tabular w-[82px] text-right text-[12px] font-medium text-white sm:w-[92px]">
                          {formatUsd(s.value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="panel h-fit">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[13px] font-medium text-white">{$t("Son işlemler")}</span>
              <button
                onClick={() => navigate("/activity")}
                className="focus-ring flex items-center gap-1 rounded text-[11px] text-zinc-500 transition-colors hover:text-accent"
              >
                {$t("Tümü")} <CaretRight size={12} />
              </button>
            </div>

            {history.loading && preview.length === 0 ? (
              <div className="space-y-1.5 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-[46px] w-full" />
                ))}
              </div>
            ) : preview.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                <span className="text-[13px] text-zinc-400">{$t("Henüz işlem yok")}</span>
                <span className="text-[11px] leading-relaxed text-zinc-600">
                  {history.unsupported.length > 0 && history.failed.length === 0
                    ? $t("Etkin ağların hiçbiri için işlem geçmişi okunamadı.")
                    : $t("Yaptığın transferler burada görünür.")}
                </span>
              </div>
            ) : (
              <ul className="stagger p-1.5">
                {preview.map((tx) => (
                  <TxPreviewRow key={tx.id} tx={tx} onOpen={setOpenTx} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
    </div>
  );
}

const SPLIT_COLORS = [
  "#e5484d",
  "#4c8dff",
  "#a78bfa",
  "#2dd4bf",
  "#ffb020",
  "#ff4d9d",
  "#c7f284",
  "#3ecf8e",
];
