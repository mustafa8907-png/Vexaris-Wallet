import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Card,
  Check,
  ChevronRight,
  Code,
  Copy,
  Github,
  Info,
  Link as LinkIcon,
  Refresh,
  Segmented,
  Skeleton,
  cn,
} from "@/kit";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import {
  Activity,
  ExternalLink,
  Globe,
  InteractiveChart,
  QrCode,
  Send,
  Swap,
  TrendingDown,
  TrendingUp,
  type ChartPoint,
} from "@/kit/ext";
import { TxDetailDrawer, TxKindBadge } from "@/components/TxDetailDrawer";
import { PageBody } from "@/components/layout/PageBody";
import { TokenSafetyCard } from "@/components/TokenSafetyCard";
import { RangeStatsCard } from "@/components/analytics/RangeStatsCard";
import { ProtocolCard } from "@/components/analytics/ProtocolCard";
import { useTokenAnalytics } from "@/hooks/useTokenAnalytics";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/hooks/useHistory";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getChain } from "@/lib/chains/registry";
import { CHAIN_TOKENS } from "@/lib/chains/tokens";
import { fetchCoinSeries } from "@/lib/api/chart";
import {
  coinId,
  llamaChart,
  llamaCurrentPrices,
  llamaLivePrice,
  llamaRangeChange,
  RANGE_SHORT,
  type ChartRange,
  type LlamaPrice,
  type LlamaPriceMap,
  type SeriesPoint,
} from "@/lib/api/defillama";
import { fetchCoinMeta, type CoinMeta } from "@/lib/api/market";
import type { TxRecord } from "@/lib/api/history";
import {
  compactNumber,
  compactUsd,
  formatAmount,
  formatPercent,
  formatPrice,
  formatUsd,
  shortAddress,
} from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { useChainStore } from "@/stores/chainStore";
import { useSettingsStore } from "@/stores/settingsStore";

const RANGES: ChartRange[] = ["1h", "24h", "7d", "30d", "90d", "1y"];
const PERF_RANGES: ChartRange[] = ["1h", "24h", "7d", "30d", "1y"];
const LIVE_MS = 15_000;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface2/60 p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="tabular mt-1.5 text-[14px] font-semibold text-text">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[10px] text-muted">{hint}</div>}
    </div>
  );
}

function LinkPill({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring inline-flex items-center gap-1.5 rounded-ctrl border border-line bg-surface2/60 px-2.5 py-1.5 text-[11px] text-textsoft transition-colors hover:border-linestrong hover:text-text"
    >
      {icon}
      {label}
      <ExternalLink size={10} className="text-muted" />
    </a>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-[13px] font-semibold text-text">{children}</span>
      {right}
    </div>
  );
}

export function TokenDetailPage() {
  const params = useParams<{ chainId?: string; asset?: string; id?: string }>();
  const geckoId = params.id;
  const geckoMode = Boolean(geckoId);
  const chainId = params.chainId ?? "";
  const asset = params.asset ?? "native";

  const navigate = useNavigate();
  const setActiveChain = useChainStore((s) => s.setActive);
  const { holdings, totalUsd, refreshNow, refreshing } = usePortfolio();
  const history = useHistory();
  const hideBalance = useSettingsStore((s) => s.hideBalance);

  const chain = geckoMode ? undefined : getChain(chainId);
  const address = geckoMode || asset === "native" ? undefined : asset;
  const tokenDef = useMemo(
    () =>
      address
        ? (CHAIN_TOKENS[chainId] ?? []).find((t) => t.address.toLowerCase() === address.toLowerCase())
        : undefined,
    [chainId, address],
  );

  const holding = holdings.find(
    (h) =>
      h.chainId === chainId &&
      (address ? h.address?.toLowerCase() === address.toLowerCase() : !h.address),
  );

  const symbol = geckoMode ? "—" : (holding?.tokenSymbol ?? tokenDef?.symbol ?? chain?.nativeSymbol ?? "—");
  const name = geckoMode ? (geckoId ?? "—") : (holding?.name ?? tokenDef?.name ?? chain?.name ?? symbol);
  const id = geckoMode ? `coingecko:${geckoId}` : coinId(chain, address);
  const watchOnly = !geckoMode && Boolean(chain?.watchOnly);

  const [range, setRange] = useState<ChartRange>("24h");
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [live, setLive] = useState<LlamaPrice | null>(null);
  const [liveOn, setLiveOn] = useState(true);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [liveAt, setLiveAt] = useState(0);
  const [meta, setMeta] = useState<CoinMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [perf, setPerf] = useState<Partial<Record<ChartRange, number>>>({});
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openTx, setOpenTx] = useState<TxRecord | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    const task = geckoMode && id
      ? llamaChart([id], range).then((rows) => rows[id] ?? [])
      : fetchCoinSeries(chainId, address, range);
    void task
      .then((points) => {
        if (!cancelled) setSeries(points);
      })
      .catch(() => {
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geckoMode, id, chainId, address, range]);

  useEffect(() => {
    if (!id || !liveOn) return;
    let cancelled = false;

    const tick = async () => {
      const row = await llamaLivePrice(id).catch(() => null);
      if (cancelled || !row) return;
      const before = prevPrice.current;
      if (before != null && row.price !== before) {
        setFlash(row.price > before ? "up" : "down");
        window.setTimeout(() => !cancelled && setFlash(null), 900);
      }
      prevPrice.current = row.price;
      setLive(row);
      setLiveAt(Date.now());
    };

    void tick();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, LIVE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, liveOn]);

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    void fetchCoinMeta(
      geckoMode
        ? { chainId: "", coingeckoId: geckoId }
        : { chainId, address, coingeckoId: address ? tokenDef?.coingeckoId : chain?.coingeckoId },
    )
      .then((row) => {
        if (!cancelled) setMeta(row);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geckoMode, geckoId, chainId, address, tokenDef?.coingeckoId, chain?.coingeckoId]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const current = await llamaCurrentPrices([id]).catch(() => ({}) as LlamaPriceMap);
      if (cancelled || !current[id]) return;
      const rows = await Promise.all(
        PERF_RANGES.map((r) =>
          llamaRangeChange([id], current, r).catch(() => ({}) as Record<string, number>),
        ),
      );
      if (cancelled) return;
      const next: Partial<Record<ChartRange, number>> = {};
      PERF_RANGES.forEach((r, i) => {
        const value = rows[i][id];
        if (value != null) next[r] = value;
      });
      setPerf(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { protocol } = useTokenAnalytics(geckoMode ? geckoId : meta?.id, series);

  const displaySymbol = geckoMode ? (meta?.symbol ?? symbol) : symbol;
  const displayName = geckoMode ? (meta?.name ?? name) : name;

  const price = live?.price ?? (geckoMode ? 0 : holding?.price ?? 0);
  const rangePct = series.length > 1 ? ((series[series.length - 1].v - series[0].v) / series[0].v) * 100 : holding?.change24h ?? 0;
  const up = rangePct >= 0;
  const amount = holding?.amount ?? 0;
  const value = amount * price;
  const allocation = totalUsd > 0 ? (value / totalUsd) * 100 : 0;

  const elsewhere = useMemo(
    () =>
      holdings.filter(
        (h) =>
          !(h.chainId === chainId && h.address?.toLowerCase() === address?.toLowerCase()) &&
          h.tokenSymbol.toUpperCase() === displaySymbol.toUpperCase() &&
          h.usdValue > 0,
      ),
    [holdings, chainId, address, displaySymbol],
  );

  const txs = useMemo(
    () =>
      history.records.filter((r) =>
        r.chainId !== chainId
          ? false
          : address
            ? r.tokenAddress?.toLowerCase() === address.toLowerCase()
            : !r.isToken,
      ),
    [history.records, chainId, address],
  );

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      series.map((p) => ({
        label: new Date(p.t).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
        value: p.v,
      })),
    [series],
  );

  const dayLow = meta?.low24h;
  const dayHigh = meta?.high24h;
  const dayPos =
    dayLow != null && dayHigh != null && dayHigh > dayLow && price > 0
      ? Math.min(100, Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100))
      : null;

  const explorerToken = address
    ? `${chain?.explorerUrl}/token/${address}`
    : chain?.explorerUrl;

  if (!geckoMode && !chain) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="text-sm text-textsoft">{$t("Bu ağ bulunamadı.")}</p>
          <button
            onClick={() => navigate("/")}
            className="focus-ring mt-3 rounded-ctrl border border-line bg-surface2 px-3 py-1.5 text-xs text-textsoft transition-colors hover:border-linestrong hover:text-text"
          >
            {$t("Portföye dön")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageBody width="wide">
        <button
          onClick={() => navigate(-1)}
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-xs text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={13} /> {$t("Geri")}
        </button>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <TokenIcon symbol={displaySymbol} chainId={geckoMode ? "" : chainId} address={address} size={46} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-display text-[17px] font-semibold tracking-tight text-text">{displayName}</h1>
                  {meta?.rank != null && (
                    <span className="shrink-0 rounded-xs border border-warn/30 bg-warnsoft px-1.5 py-0.5 text-[9.5px] font-medium text-warn">
                      #{meta.rank}
                    </span>
                  )}
                  {geckoMode && (
                    <span className="shrink-0 rounded-xs border border-info/30 bg-infosoft px-1.5 py-0.5 text-[9.5px] font-medium text-info">
                      {$t("analiz")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span className="font-medium text-textsoft">{displaySymbol}</span>
                  {geckoMode ? (
                    <span className="inline-flex items-center gap-1">
                      <Globe size={12} /> CoinGecko
                    </span>
                  ) : (
                    chain && (
                      <span className="inline-flex items-center gap-1">
                        <ChainIcon chainId={chainId} size={13} />
                        {chain.name}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLiveOn((v) => !v)}
                className={cn(
                  "focus-ring flex h-8 items-center gap-1.5 rounded-ctrl border px-2.5 text-[11px] transition-colors",
                  liveOn
                    ? "border-ok/30 bg-oksoft text-ok"
                    : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
                )}
                title={liveOn ? $t("Canlı akışı durdur") : $t("Canlı akışı başlat")}
              >
                <Activity size={12} />
                {liveOn ? $t("Canlı") : $t("Duraklatıldı")}
              </button>
              {!geckoMode && (
                <button
                  onClick={refreshNow}
                  disabled={refreshing}
                  className="focus-ring grid h-8 w-8 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition-colors hover:border-linestrong hover:text-text disabled:opacity-50"
                  title={$t("Bakiyeyi yenile")}
                >
                  <Refresh size={13} className={cn(refreshing && "animate-spin")} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <span
              className={cn(
                "tabular rounded px-1 font-display text-[30px] font-semibold leading-none tracking-tight text-text transition-colors",
                flash === "up" && "text-up",
                flash === "down" && "text-down",
              )}
            >
              {hideBalance && !geckoMode
                ? "••••"
                : price > 0
                  ? formatPrice(price)
                  : $t("Fiyat bulunamadı")}
            </span>
            <span
              className={cn(
                "mb-1 inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[12px] font-semibold",
                up ? "bg-upsoft text-up" : "bg-downsoft text-down",
              )}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatPercent(rangePct)}%
              <span className="font-normal opacity-70">{RANGE_SHORT[range]}</span>
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
            <span>
              {liveAt
                ? $t("Son fiyat {0}", [new Date(liveAt).toLocaleTimeString()])
                : $t("Fiyat bekleniyor…")}
            </span>
            {live && (
              <span>
                {$t("Fiyat güveni %")}{Math.round((live.confidence ?? 0) * 100)}
              </span>
            )}
            {meta?.marketCap != null && meta.marketCap > 0 && (
              <span>{$t("Piyasa değeri")} {compactUsd(meta.marketCap)}</span>
            )}
          </div>

          <div className="mt-4">
            <Segmented
              ariaLabel={$t("Grafik aralığı")}
              size="sm"
              value={range}
              onChange={(v) => setRange(v as ChartRange)}
              options={RANGES.map((r) => ({ value: r, label: RANGE_SHORT[r] }))}
            />
          </div>

          <div className="mt-3">
            {chartLoading && series.length === 0 ? (
              <Skeleton className={cn("w-full rounded-card", wide ? "h-[220px]" : "h-[176px]")} />
            ) : chartPoints.length > 1 ? (
              <InteractiveChart
                points={chartPoints}
                positive={up}
                accent="auto"
                hidden={hideBalance && !geckoMode}
                height={wide ? 220 : 176}
                formatValue={(v) => formatPrice(v)}
              />
            ) : (
              <div className={cn("grid place-items-center rounded-card border border-dashed border-line bg-surface2/50 px-4 text-center text-[11px] text-muted", wide ? "h-[220px]" : "h-[176px]")}>
                {$t("Bu varlık için geçmiş fiyat serisi bulunamadı.")}
              </div>
            )}
          </div>

          {dayPos != null && !hideBalance && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted">
                <span>{$t("24s düşük")} {formatPrice(dayLow!)}</span>
                <span className="uppercase tracking-[0.14em]">{$t("gün aralığı")}</span>
                <span>{$t("24s yüksek")} {formatPrice(dayHigh!)}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/60 via-warn/50 to-up/60">
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-text"
                  style={{ left: `${dayPos}%` }}
                />
              </div>
            </div>
          )}
        </Card>

          <div className="space-y-4">
            <RangeStatsCard series={series} loading={chartLoading} />
            {protocol && <ProtocolCard protocol={protocol} />}
          </div>
        </div>

        <Card className="mt-4 p-4">
          <SectionTitle right={<span className="text-[10px] text-muted">{$t("USD bazlı")}</span>}>
            {$t("Performans")}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                [$t("1 saat"), perf["1h"] ?? meta?.change1h],
                [$t("24 saat"), perf["24h"] ?? meta?.change24h],
                [$t("7 gün"), perf["7d"] ?? meta?.change7d],
                [$t("30 gün"), perf["30d"] ?? meta?.change30d],
                [$t("1 yıl"), perf["1y"] ?? meta?.change1y],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-card border border-line bg-surface2/60 p-3">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
                <div
                  className={cn(
                    "tabular mt-1.5 text-[15px] font-semibold",
                    value == null ? "text-muted" : value >= 0 ? "text-up" : "text-down",
                  )}
                >
                  {value == null ? (metaLoading ? "…" : "—") : `${formatPercent(value)}%`}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <SectionTitle
            right={
              meta?.updatedAt ? (
                <span className="text-[10px] text-muted">
                  {new Date(meta.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}{" "}
                  {$t("itibarıyla")}
                </span>
              ) : null
            }
          >
            {$t("Piyasa istatistikleri")}
          </SectionTitle>

          {metaLoading && !meta ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[64px] rounded-card" />
              ))}
            </div>
          ) : !meta ? (
            <div className="flex items-start gap-2 rounded-card border border-line bg-surface2/60 p-3 text-[11px] leading-relaxed text-muted">
              <Info size={13} className="mt-px shrink-0 text-info" />
              {$t("Bu varlık için piyasa değeri ve arz bilgisi bulunmuyor; fiyat ve grafik doğrudan borsa verisinden hesaplanır.")}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <Stat label={$t("Piyasa değeri")} value={compactUsd(meta.marketCap)} hint={meta.rank ? $t("Sıra #{0}", [meta.rank]) : undefined} />
                <Stat label={$t("Seyreltilmiş değer")} value={compactUsd(meta.fdv)} />
                <Stat label={$t("24s hacim")} value={compactUsd(meta.volume24h)} />
                <Stat
                  label={$t("Hacim / Piyasa değeri")}
                  value={
                    meta.volume24h && meta.marketCap
                      ? `%${((meta.volume24h / meta.marketCap) * 100).toFixed(2)}`
                      : "—"
                  }
                />
                <Stat
                  label={$t("Dolaşımdaki arz")}
                  value={compactNumber(meta.circulatingSupply)}
                  hint={meta.circulatingSupply ? `${meta.circulatingSupply.toLocaleString("tr-TR")} ${displaySymbol}` : undefined}
                />
                <Stat label={$t("Toplam arz")} value={compactNumber(meta.totalSupply)} />
                <Stat label={$t("Maksimum arz")} value={compactNumber(meta.maxSupply)} />
                <Stat
                  label={$t("24s aralık")}
                  value={meta.low24h != null ? `${formatPrice(meta.low24h)}` : "—"}
                  hint={meta.high24h != null ? `↑ ${formatPrice(meta.high24h)}` : undefined}
                />
                <Stat
                  label={$t("Tüm zamanların zirvesi")}
                  value={meta.ath != null ? formatPrice(meta.ath) : "—"}
                  hint={
                    meta.athChangePct != null
                      ? `${formatPercent(meta.athChangePct)}% · ${
                          meta.athDate ? new Date(meta.athDate).toLocaleDateString("tr-TR") : ""
                        }`
                      : undefined
                  }
                />
                <Stat
                  label={$t("Tüm zamanların dibi")}
                  value={meta.atl != null ? formatPrice(meta.atl) : "—"}
                  hint={
                    meta.atlChangePct != null
                      ? `${formatPercent(meta.atlChangePct)}% · ${
                          meta.atlDate ? new Date(meta.atlDate).toLocaleDateString("tr-TR") : ""
                        }`
                      : undefined
                  }
                />
                <Stat
                  label={$t("Topluluk görüşü")}
                  value={meta.sentimentUp != null ? `%${meta.sentimentUp.toFixed(0)} olumlu` : "—"}
                />
                <Stat
                  label={$t("İzleme listesi")}
                  value={meta.watchlists != null ? compactNumber(meta.watchlists) : "—"}
                  hint={meta.genesisDate ? $t("Çıkış {0}", [meta.genesisDate]) : undefined}
                />
              </div>

              {meta.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {meta.categories.map((c) => (
                    <span key={c} className="rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className={geckoMode ? "p-4 lg:col-span-3" : "p-4 lg:col-span-2"}>
            <SectionTitle
              right={
                !geckoMode && !watchOnly ? (
                  <button
                    onClick={() => navigate("/activity")}
                    className="focus-ring flex items-center gap-1 rounded text-[11px] text-muted transition-colors hover:text-brand"
                  >
                    {$t("Tüm geçmiş")} <ChevronRight size={12} />
                  </button>
                ) : undefined
              }
            >
              {geckoMode ? $t("CoinGecko analizi") : watchOnly ? $t("Zincir kaydı") : $t("{0} işlemleri", [displaySymbol])}
            </SectionTitle>

            {geckoMode ? (
              <p className="text-[11px] leading-relaxed text-muted">
                {$t("Bu sayfa CoinGecko verisiyle analiz görünümüdür; varlık cüzdan ağına bağlı değildir.")}{" "}
                {$t("Takas için coin arayüzünde bir zincir seç.")}
              </p>
            ) : watchOnly ? (
              <div className="py-6 text-center">
                <p className="text-[13px] text-textsoft">{chain?.name} {$t("bu cüzdanda salt-okunur")}</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-muted">
                  {displaySymbol} {$t("için adres türetilmediğinden işlem geçmişi okunmaz. Ağdaki hareketleri zincir gezgininden izleyebilirsin.")}
                </p>
                <a
                  href={explorerToken}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-ctrl border border-line bg-surface2 px-3 py-1.5 text-[11px] text-textsoft transition-colors hover:border-linestrong hover:text-text"
                >
                  {chain?.name} {$t("ağ gezgini")} <ExternalLink size={11} />
                </a>
              </div>
            ) : history.loading && txs.length === 0 ? (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[46px] rounded-card" />
                ))}
              </div>
            ) : txs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] text-textsoft">{$t("Bu varlıkta işlem bulunamadı")}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {chain?.blockscoutUrl
                    ? $t("Yüklenen sayfalar içinde bu varlığa ait transfer yok.")
                    : $t("{0} için işlem geçmişi kaynağı tanımlı değil.", [chain?.name ?? chainId])}
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {txs.slice(0, 10).map((tx) => (
                  <li key={tx.id}>
                    <button
                      onClick={() => setOpenTx(tx)}
                      className="focus-ring flex w-full items-center gap-3 rounded-card border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-line hover:bg-surface2"
                    >
                      <TxKindBadge tx={tx} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-textsoft">
                          {tx.direction === "in" ? $t("Alındı") : tx.direction === "out" ? $t("Gönderildi") : $t("Kendine")}
                          {" · "}
                          {hideBalance ? "••••" : `${formatAmount(tx.amount, 6)} ${tx.symbol}`}
                        </div>
                        <div className="truncate font-mono text-[10px] text-muted">
                          {shortAddress(tx.counterparty, 6)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-[11px] text-textsoft">
                          {hideBalance ? "••••" : tx.usdValue > 0 ? formatUsd(tx.usdValue) : "—"}
                        </div>
                        <div className="text-[10px] text-muted">
                          {new Date(tx.timestamp).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4 lg:col-span-1">
            {!geckoMode && (
              <Card className="p-4">
                <SectionTitle>{watchOnly ? $t("Piyasa konumu") : $t("Pozisyonun")}</SectionTitle>
                {watchOnly ? (
                  <div>
                    <div className="tabular font-display text-[24px] font-semibold leading-none text-text">
                      {price > 0 ? formatPrice(price) : "—"}
                    </div>
                    <div className="mt-1.5 text-[12px] text-textsoft">{displayName} · {$t("birim fiyat")}</div>
                    <div className="mt-3 flex items-start gap-2 rounded-card border border-info/20 bg-infosoft/60 p-2.5 text-[11px] leading-relaxed text-info">
                      <Info size={13} className="mt-px shrink-0" />
                      <span>
                        {chain?.name} {$t("bu cüzdanda salt-okunur:")} {displaySymbol} {$t("gönderilemez veya alınamaz. Fiyat, grafik ve piyasa istatistikleri gerçek verilerle gösterilir.")}
                      </span>
                    </div>
                  </div>
                ) : holding ? (
                  <div>
                    <div className="tabular font-display text-[24px] font-semibold leading-none text-text">
                      {hideBalance ? "••••" : formatUsd(value)}
                    </div>
                    <div className="tabular mt-1.5 text-[12px] text-textsoft">
                      {hideBalance ? "••••" : `${formatAmount(amount, 8)} ${displaySymbol}`}
                    </div>
                    {totalUsd > 0 && value > 0 && !hideBalance && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                          <span>{$t("Portföy payı")}</span>
                          <span className="tabular text-textsoft">%{allocation.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                          <span
                            className="block h-full rounded-full bg-brand transition-all duration-500"
                            style={{ width: `${Math.min(100, allocation)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {amount === 0 && (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {$t("Bu varlık cüzdanında yok. Al sekmesinden adresini kullanarak")} {chain?.name} {$t("ağında")} {displaySymbol} {$t("alabilirsin.")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="tabular font-display text-[24px] font-semibold leading-none text-text">
                      {price > 0 ? formatPrice(price) : "—"}
                    </div>
                    <div className="mt-1.5 text-[12px] text-textsoft">{displayName} · {$t("birim fiyat")}</div>
                    <div className="mt-3 flex items-start gap-2 rounded-card border border-line bg-surface2/60 p-2.5 text-[11px] leading-relaxed text-muted">
                      <Info size={13} className="mt-px shrink-0 text-info" />
                      <span>{$t("Bu varlık cüzdanında görünmüyor.")}</span>
                    </div>
                  </div>
                )}

                {!watchOnly && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: $t("Gönder"), icon: <Send size={14} />, to: "/send" },
                      { label: $t("Al"), icon: <QrCode size={14} />, to: "/receive" },
                      { label: $t("Takas"), icon: <Swap size={14} />, to: "/swap" },
                    ].map(({ label, icon, to }) => (
                      <button
                        key={label}
                        onClick={() => {
                          setActiveChain(chainId);
                          navigate(to);
                        }}
                        className="focus-ring flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface2/60 py-2.5 text-[11px] text-textsoft transition-colors hover:border-brand/40 hover:text-text"
                      >
                        {icon}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {elsewhere.length > 0 && !geckoMode && (
              <Card className="p-4">
                <SectionTitle>{$t("Diğer ağlardaki")} {displaySymbol}</SectionTitle>
                <ul className="space-y-0.5">
                  {elsewhere.map((h) => (
                    <li key={`${h.chainId}-${h.address ?? "native"}`}>
                      <button
                        onClick={() => navigate(`/token/${h.chainId}/${h.address ?? "native"}`)}
                        className="focus-ring flex w-full items-center gap-2 rounded-card px-2 py-1.5 text-left transition-colors hover:bg-surface2"
                      >
                        <ChainIcon chainId={h.chainId} size={18} />
                        <span className="flex-1 truncate text-[11px] text-textsoft">
                          {getChain(h.chainId)?.name}
                        </span>
                        <span className="tabular text-[11px] text-text">
                          {hideBalance ? "••••" : formatUsd(h.usdValue)}
                        </span>
                        <ChevronRight size={12} className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {address && !geckoMode && (
              <Card className="p-4">
                <SectionTitle>{$t("Sözleşme")}</SectionTitle>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(address);
                    setCopied(true);
                    toast($t("Sözleşme adresi kopyalandı"), "success");
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="focus-ring flex w-full items-center gap-2 rounded-card border border-line bg-surface2/60 px-2.5 py-2 text-left font-mono text-[11px] text-textsoft transition-colors hover:border-linestrong hover:text-text"
                >
                  <Code size={12} className="shrink-0 text-muted" />
                  <span className="flex-1 truncate">{shortAddress(address, 8)}</span>
                  {copied ? (
                    <Check size={12} className="shrink-0 text-up" />
                  ) : (
                    <Copy size={12} className="shrink-0 text-muted" />
                  )}
                </button>
              </Card>
            )}

            {address && !geckoMode && <TokenSafetyCard chainId={chainId} address={address} />}
          </div>
        </div>

        <Card className="mt-4 p-4">
          <SectionTitle>{$t("Hakkında")}</SectionTitle>
          {meta?.description ? (
            <>
              <p className={cn("text-[11px] leading-relaxed text-textsoft", !expanded && "line-clamp-6")}>
                {meta.description}
              </p>
              {meta.description.length > 320 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="focus-ring mt-1.5 rounded text-[11px] font-medium text-brand hover:brightness-110"
                >
                  {expanded ? $t("Daha az göster") : $t("Devamını oku")}
                </button>
              )}
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted">
              {metaLoading
                ? $t("Künye yükleniyor…")
                : geckoMode
                  ? $t("Bu coin için açıklama bulunamadı.")
                  : $t("{0}, {1} ağında {2} olarak çalışır.", [
                      displayName,
                      chain?.name ?? "",
                      address ? $t("bir ERC-20 tokenı") : $t("yerel coin"),
                    ])}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {meta?.homepage && <LinkPill href={meta.homepage} icon={<Globe size={12} />} label={$t("Site")} />}
            {meta?.twitter && (
              <LinkPill
                href={`https://twitter.com/${meta.twitter}`}
                icon={<LinkIcon size={12} />}
                label="Twitter"
              />
            )}
            {meta?.telegram && (
              <LinkPill
                href={`https://t.me/${meta.telegram}`}
                icon={<Send size={12} />}
                label="Telegram"
              />
            )}
            {meta?.github && <LinkPill href={meta.github} icon={<Github size={12} />} label="GitHub" />}
            {!geckoMode && explorerToken && (
              <LinkPill
                href={explorerToken}
                icon={<ExternalLink size={12} />}
                label={address ? $t("Sözleşme gezgini") : $t("Ağ gezgini")}
              />
            )}
          </div>
        </Card>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
    </PageBody>
  );
}
