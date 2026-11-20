import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  ArrowUpRight,
  Button,
  Card,
  ChevronDown,
  Box,
  Eye,
  Grid,
  IconButton,
  Input,
  Layers,
  Refresh,
  Search,
  Segmented,
  Skeleton,
  cn,
} from "@/kit";
import { ArrowDownLeft, EyeOff, InteractiveChart, QrCode, Send, Swap, type ChartPoint } from "@/kit/ext";
import { TokenIcon } from "@/components/TokenIcon";
import { MarketList } from "@/components/MarketList";
import { TxDetailDrawer, TxKindBadge } from "@/components/TxDetailDrawer";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/hooks/useHistory";
import { useCountUp } from "@/hooks/useCountUp";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getChain } from "@/lib/chains/registry";
import { MARKET_COINS } from "@/lib/chains/market";
import { partitionHoldings, isDust } from "@/lib/assets/filters";
import { RANGE_SHORT, type ChartRange } from "@/lib/api/defillama";
import type { TxRecord } from "@/lib/api/history";
import type { Holding } from "@/types/chain";
import { useChainStore } from "@/stores/chainStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatAmount, formatPercent, formatUsd, shortAddress } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

type SortKey = "value" | "change" | "name";

const ROW_LIMIT = 24;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: $t("Değer") },
  { key: "change", label: $t("Değişim") },
  { key: "name", label: $t("Ad") },
];

const RANGE_ORDER: ChartRange[] = ["1h", "24h", "7d", "30d", "90d", "1y"];

const SPLIT_COLORS = ["#e5484d", "#4c8dff", "#a78bfa", "#2dd4bf", "#ffb020", "#ff4d9d", "#c7f284", "#3ecf8e"];

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
  hidden,
}: {
  value: number;
  loading: boolean;
  hidden: boolean;
}) {
  const animated = useCountUp(value, 650);
  if (loading) return <>—</>;
  if (hidden) return <>••••••</>;
  return <>{formatUsd(animated)}</>;
});

const TokenLine = memo(function TokenLine({
  holding: h,
  hideBalance,
  onOpen,
}: {
  holding: Holding;
  hideBalance: boolean;
  onOpen: (h: Holding) => void;
}) {
  const chain = getChain(h.chainId);
  const change = h.change24h ?? 0;
  const changeTone = h.price ? (change > 0 ? "text-up" : "text-down") : "text-muted";
  return (
    <li>
      <button
        onClick={() => onOpen(h)}
        className={cn(
          "focus-ring flex w-full items-center gap-2.5 rounded-card border border-transparent px-2.5 py-2.5 text-left transition-all duration-150 hover:border-line hover:bg-surface2",
          isDust(h) && "opacity-55 hover:opacity-100",
        )}
      >
        <TokenIcon symbol={h.tokenSymbol} chainId={h.chainId} address={h.address} size={34} badge />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-text">{h.tokenSymbol}</span>
            {chain?.shortName && chain.shortName !== h.tokenSymbol && (
              <span className="shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                {chain.shortName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 truncate text-[11px] text-muted">
            <span className={cn("tabular sm:hidden", h.price ? changeTone : "text-muted")}>
              {h.price ? `${formatPercent(change)}%` : $t("fiyat yok")}
            </span>
            <span className="hidden truncate sm:inline">{h.name ?? chain?.name}</span>
          </div>
        </div>

        <div className="hidden w-[74px] shrink-0 text-right sm:block">
          <div className={cn("tabular text-[12px] font-medium", changeTone)}>
            {h.price ? `${formatPercent(change)}%` : "—"}
          </div>
          <div className="tabular text-[10px] text-muted">
            {h.price ? formatUsd(h.price) : $t("fiyat yok")}
          </div>
        </div>

        <div className="w-[92px] shrink-0 text-right sm:w-[112px]">
          <div className="tabular text-[13px] font-semibold text-text">
            {hideBalance ? "••••" : h.usdValue > 0 ? formatUsd(h.usdValue) : "—"}
          </div>
          <div className="tabular truncate text-[11px] text-muted">
            {hideBalance ? "••••" : `${formatAmount(h.amount, 5)} ${h.tokenSymbol}`}
          </div>
        </div>

        <ChevronDown size={15} className="hidden shrink-0 -rotate-90 text-muted sm:block" />
      </button>
    </li>
  );
});

function TxPreviewLine({ tx, hideBalance, onOpen }: { tx: TxRecord; hideBalance: boolean; onOpen: (tx: TxRecord) => void }) {
  return (
    <li>
      <button
        onClick={() => onOpen(tx)}
        className="focus-ring flex w-full items-center gap-3 rounded-card border border-transparent px-2.5 py-2.5 text-left transition-colors hover:bg-surface2"
      >
        <TxKindBadge tx={tx} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-text">
            {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
            {hideBalance ? "••••" : `${formatAmount(tx.amount, 5)} ${tx.symbol}`}
          </div>
          <div className="truncate text-[10px] text-muted">
            {getChain(tx.chainId)?.shortName} · {timeAgo(tx.timestamp)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[11px] text-textsoft">
            {hideBalance ? "••••" : tx.usdValue > 0 ? formatUsd(tx.usdValue) : "—"}
          </div>
          <div className="truncate font-mono text-[9px] text-muted">{shortAddress(tx.counterparty, 4)}</div>
        </div>
      </button>
    </li>
  );
}

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
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const viewChainId = useChainStore((s) => s.viewChainId);
  const setHideBalance = useSettingsStore((s) => s.setHideBalance);
  const wide = useMediaQuery("(min-width: 1024px)");

  const [tab, setTab] = useState<"tokens" | "market" | "split">("tokens");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("value");
  const [showDust, setShowDust] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openTx, setOpenTx] = useState<TxRecord | null>(null);
  const openAsset = useCallback((h: Holding) => navigate(assetPath(h)), [navigate]);

  const scoped = useMemo(
    () => (viewChainId ? holdings.filter((h) => h.chainId === viewChainId) : holdings),
    [holdings, viewChainId],
  );
  const scopedTotal = useMemo(
    () => scoped.reduce((sum, h) => sum + h.usdValue, 0),
    [scoped],
  );
  const { primary, dust } = useMemo(() => partitionHoldings(scoped), [scoped]);
  const searching = query.trim().length > 0;
  const expanded = showDust || searching || primary.length === 0;
  const visible = expanded ? scoped : primary;

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

  const points = useMemo<ChartPoint[]>(
    () =>
      series.map((p) => ({
        label: new Date(p.t).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        value: p.v,
      })),
    [series],
  );

  const up = changePct >= 0;
  const preview = history.records.slice(0, 6);

  const shown = searching || showAll ? rows : rows.slice(0, ROW_LIMIT);

  const warnings = [
    failedChains.length > 0
      ? $t("Ulaşılamayan ağ: {0}.", [failedChains.map((c) => getChain(c)?.shortName ?? c).join(", ")])
      : "",
    partialChains.length > 0
      ? $t("Token listesi tamamlanamadı: {0} — yeniden dene.", [
          partialChains.map((c) => getChain(c)?.shortName ?? c).join(", "),
        ])
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-8 pt-4 sm:px-5 lg:px-6">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                {$t("Toplam bakiye")}
                {viewChainId && (
                  <span className="rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium normal-case tracking-normal text-textsoft">
                    {getChain(viewChainId)?.name ?? viewChainId}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-end gap-2.5">
                <span className="tabular font-display text-[30px] font-semibold leading-none tracking-tight text-text">
                  <AnimatedTotal value={viewChainId ? scopedTotal : totalUsd} loading={loading} hidden={hideBalance} />
                </span>
                <button
                  type="button"
                  onClick={() => setHideBalance(!hideBalance)}
                  className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-ctrl text-muted transition-colors hover:bg-surface2 hover:text-text"
                  title={hideBalance ? $t("Bakiyeyi göster") : $t("Bakiyeyi gizle")}
                  aria-label={hideBalance ? $t("Bakiyeyi göster") : $t("Bakiyeyi gizle")}
                >
                  {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                <span
                  className={cn("tabular rounded-xs px-1.5 py-0.5 font-semibold", up ? "bg-up/10 text-up" : "bg-down/10 text-down")}
                >
                  {formatPercent(changePct)}%
                </span>
                <span>{RANGE_SHORT[range]}</span>
                <span>
                  {primary.length} {$t("varlık")}
                  {dust.length > 0 && <span className="text-muted/70"> · {$t("{0} toz", [dust.length])}</span>}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden text-[10.5px] text-muted sm:inline">
                {updatedAt
                  ? $t("Güncellendi {0}", [
                      new Date(updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                    ])
                  : $t("Veriler okunuyor…")}
              </span>
              <IconButton
                variant="outline"
                size="sm"
                label={$t("Yenile")}
                disabled={refreshing}
                onClick={() => void refreshNow()}
              >
                <Refresh size={15} className={cn(refreshing && "anim-spin")} />
              </IconButton>
            </div>
          </div>

          <div className="mt-3">
            {loading && points.length === 0 ? (
              <Skeleton className={cn("w-full", wide ? "h-[150px]" : "h-[94px]")} />
            ) : points.length === 0 ? (
              <div className={cn("grid place-items-center text-[12px] text-muted", wide ? "h-[150px]" : "h-[94px]")}>
                {$t("Grafik için yeterli veri yok.")}
              </div>
            ) : (
              <InteractiveChart points={points} positive={up} accent="auto" hidden={hideBalance} height={wide ? 150 : 94} />
            )}
          </div>
          <div className="mt-2.5 flex justify-center">
            <Segmented
              size="sm"
              ariaLabel={$t("Grafik aralığı")}
              value={range}
              onChange={(next) => void setRange(next)}
              options={RANGE_ORDER.map((r) => ({ value: r, label: RANGE_SHORT[r] }))}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button tone="brand" fullWidth className="h-14" href="#/send" iconLeft={<Send size={16} />}>
              {$t("Gönder")}
            </Button>
            <Button variant="soft" fullWidth className="h-14" href="#/receive" iconLeft={<QrCode size={16} />}>
              {$t("Al")}
            </Button>
            <Button variant="soft" fullWidth className="h-14" href="#/swap" iconLeft={<Swap size={16} />}>
              {$t("Takas")}
            </Button>
            <Button variant="soft" fullWidth className="h-14" href="#/nfts" iconLeft={<Box size={16} />}>
              {$t("Koleksiyon")}
            </Button>
          </div>

          {(error || warnings) && (
            <Alert tone="warning" className="mt-3.5" title={$t("Verilerde eksik var")}>
              {error ?? warnings}
            </Alert>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-3.5 py-3">
              <Segmented
                size="sm"
                ariaLabel={$t("Portföy görünümü")}
                value={tab}
                onChange={setTab}
                options={[
                  { value: "tokens", label: $t("Tokenlar"), icon: <Grid size={13} /> },
                  { value: "market", label: $t("Piyasa"), icon: <ArrowUpRight size={13} /> },
                  { value: "split", label: $t("Dağılım"), icon: <Layers size={13} /> },
                ]}
              />
              <span className="ml-auto hidden text-[11px] text-muted sm:block">
                {tab === "market"
                  ? `${MARKET_COINS.length} coin`
                  : tab === "tokens"
                    ? $t("{0} varlık", [visible.length])
                    : $t("{0} ağ", [split.length])}
              </span>
            </div>

            {tab === "tokens" && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
                <Input
                  size="sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={$t("Token veya ağ ara")}
                  iconLeft={<Search size={13} />}
                  className="min-w-[150px] flex-1"
                  aria-label={$t("Token veya ağ ara")}
                />
                <button
                  onClick={() => setSort(SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length].key)}
                  className="focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-ctrl border border-line bg-surface2 px-2.5 text-[11px] text-muted transition-colors hover:border-linestrong hover:text-text"
                  title={$t("Sıralamayı değiştir")}
                >
                  {SORTS.find((s) => s.key === sort)?.label}
                  <ChevronDown size={12} />
                </button>
                {dust.length > 0 && (
                  <button
                    onClick={() => setShowDust((v) => !v)}
                    className={cn(
                      "focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-ctrl border px-2.5 text-[11px] transition-colors",
                      showDust
                        ? "border-brand/40 bg-brandsoft text-brand"
                        : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
                    )}
                    title={$t("Fiyatı bulunamayan ya da değeri çok küçük tokenlar")}
                  >
                    {showDust ? <EyeOff size={12} /> : <Eye size={12} />}
                    {$t("Toz {0}", [dust.length])}
                  </button>
                )}
              </div>
            )}

            {tab === "market" ? (
              <MarketList holdings={scoped} />
            ) : tab === "tokens" ? (
              loading && holdings.length === 0 ? (
                <div className="space-y-1.5 p-3.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-[56px] w-full rounded-card" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-14 text-center">
                  <span className="text-sm text-textsoft">
                    {query ? $t("Eşleşen varlık yok") : $t("Bu adreste henüz varlık yok")}
                  </span>
                  <span className="max-w-[300px] text-xs leading-relaxed text-muted">
                    {query
                      ? $t("Farklı bir sembol ya da ağ adı dene.")
                      : $t("Al sekmesinden adresini kopyalayıp bu cüzdana varlık gönderebilirsin.")}
                  </span>
                </div>
              ) : (
                <>
                  <ul className="space-y-0.5 p-1.5">
                    {shown.map((h) => (
                      <TokenLine key={`${h.chainId}-${h.address ?? "native"}`} holding={h} hideBalance={hideBalance} onOpen={openAsset} />
                    ))}
                  </ul>
                  {rows.length > shown.length && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="focus-ring w-full border-t border-line py-2.5 text-[11px] text-muted transition-colors hover:text-brand"
                    >
                      {rows.length - shown.length} {$t("varlık daha göster")}
                    </button>
                  )}
                </>
              )
            ) : split.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted">{$t("Dağılım için değerlenmiş varlık gerekiyor.")}</div>
            ) : (
              <div className="p-4">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface2">
                  {split.map((s, i) => (
                    <span
                      key={s.chainId}
                      className="h-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, background: SPLIT_COLORS[i % SPLIT_COLORS.length] }}
                      title={`${getChain(s.chainId)?.name} %${s.pct.toFixed(1)}`}
                    />
                  ))}
                </div>
                <ul className="mt-4 space-y-0.5">
                  {split.map((s, i) => {
                    const chain = getChain(s.chainId);
                    return (
                      <li
                        key={s.chainId}
                        className="flex items-center gap-2.5 rounded-card px-2 py-2 transition-colors hover:bg-surface2"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }}
                        />
                        <span className="flex-1 truncate text-[12px] text-text">{chain?.name}</span>
                        <span className="hidden text-[11px] text-muted sm:block">{s.count} token</span>
                        <span className="tabular w-[46px] text-right text-[12px] text-textsoft sm:w-[52px]">
                          %{s.pct.toFixed(1)}
                        </span>
                        <span className="tabular w-[82px] text-right text-[12px] font-semibold text-text sm:w-[92px]">
                          {hideBalance ? "••••" : formatUsd(s.value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>

          <Card className="h-fit">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-semibold text-text">{$t("Son işlemler")}</span>
              <button
                onClick={() => navigate("/activity")}
                className="focus-ring flex items-center gap-1 rounded text-[11px] text-muted transition-colors hover:text-brand"
              >
                {$t("Tümü")} <ChevronDown size={12} className="-rotate-90" />
              </button>
            </div>

            {history.loading && preview.length === 0 && !history.error ? (
              <div className="space-y-1.5 p-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[50px] w-full rounded-card" />
                ))}
              </div>
            ) : preview.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-surface2 text-muted">
                  <ArrowDownLeft size={17} />
                </span>
                <span className="mt-1 text-[13px] text-textsoft">{$t("Henüz işlem yok")}</span>
                <span className="text-[11px] leading-relaxed text-muted">
                  {history.unsupported.length > 0 && history.failed.length === 0
                    ? $t("Etkin ağların hiçbiri için işlem geçmişi okunamadı.")
                    : $t("Yaptığın transferler burada görünür.")}
                </span>
              </div>
            ) : (
              <ul className="space-y-0.5 p-1.5">
                {preview.map((tx) => (
                  <TxPreviewLine key={tx.id} tx={tx} hideBalance={hideBalance} onOpen={setOpenTx} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
    </div>
  );
}
