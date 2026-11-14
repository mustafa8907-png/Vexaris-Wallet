import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowsLeftRight, ChartBar, Check, CaretRight, Copy, ArrowSquareOut, GithubLogo, Globe, Info, Pause, Play, QrCode, ArrowsClockwise, PaperPlaneTilt, TrendDown, TrendUp, TwitterLogo } from "@phosphor-icons/react";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import { AreaChart, computeChange } from "@/components/charts/AreaChart";
import { TxDetailDrawer, TxKindBadge } from "@/components/TxDetailDrawer";
import { TokenSafetyCard } from "@/components/TokenSafetyCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/hooks/useHistory";
import { getChain } from "@/lib/chains/registry";
import { CHAIN_TOKENS } from "@/lib/chains/tokens";
import { fetchCoinSeries } from "@/lib/api/chart";
import {
  coinId,
  llamaCurrentPrices,
  llamaLivePrice,
  llamaRangeChange,
  RANGE_LABELS,
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
  cn,
} from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { useChainStore } from "@/stores/chainStore";

const RANGES: ChartRange[] = ["1h", "24h", "7d", "30d", "90d", "1y"];
const PERF_RANGES: ChartRange[] = ["1h", "24h", "7d", "30d", "1y"];
const LIVE_MS = 15_000;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      <div className="tabular mt-1 text-[14px] font-semibold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-600">{hint}</div>}
    </div>
  );
}

function LinkPill({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-800/70 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
    >
      {icon}
      {label}
      <ArrowSquareOut size={10} className="text-zinc-600" />
    </a>
  );
}

export function TokenDetailPage() {
  const { chainId = "", asset = "native" } = useParams();
  const navigate = useNavigate();
  const setActiveChain = useChainStore((s) => s.setActive);
  const { holdings, totalUsd, refreshNow, refreshing } = usePortfolio();
  const history = useHistory();

  const chain = getChain(chainId);
  const address = asset === "native" ? undefined : asset;
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

  const symbol = holding?.tokenSymbol ?? tokenDef?.symbol ?? chain?.nativeSymbol ?? "—";
  const name = holding?.name ?? tokenDef?.name ?? chain?.name ?? symbol;
  const id = coinId(chain, address);
  const watchOnly = Boolean(chain?.watchOnly);

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
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    void fetchCoinSeries(chainId, address, range)
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
  }, [chainId, address, range]);

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
    void fetchCoinMeta({
      chainId,
      address,
      coingeckoId: address ? tokenDef?.coingeckoId : chain?.coingeckoId,
    })
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
  }, [chainId, address, tokenDef?.coingeckoId, chain?.coingeckoId]);

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

  const price = live?.price ?? holding?.price ?? 0;
  const rangePct = series.length > 1 ? computeChange(series) : holding?.change24h ?? 0;
  const up = rangePct >= 0;
  const amount = holding?.amount ?? 0;
  const value = amount * price;
  const allocation = totalUsd > 0 ? (value / totalUsd) * 100 : 0;

  const elsewhere = useMemo(
    () =>
      holdings.filter(
        (h) =>
          !(h.chainId === chainId && h.address?.toLowerCase() === address?.toLowerCase()) &&
          h.tokenSymbol.toUpperCase() === symbol.toUpperCase() &&
          h.usdValue > 0,
      ),
    [holdings, chainId, address, symbol],
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

  const dayLow = meta?.low24h;
  const dayHigh = meta?.high24h;
  const dayPos =
    dayLow != null && dayHigh != null && dayHigh > dayLow && price > 0
      ? Math.min(100, Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100))
      : null;

  const explorerToken = address
    ? `${chain?.explorerUrl}/token/${address}`
    : chain?.explorerUrl;

  if (!chain) {
    return (
      <div className="page">
        <div className="mx-auto max-w-3xl py-20 text-center">
          <p className="text-sm text-zinc-400">{$t("Bu ağ bulunamadı.")}</p>
          <button
            onClick={() => navigate("/")}
            className="focus-ring mt-3 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
          >
            {$t("Portföye dön")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="mx-auto max-w-6xl pb-6">
        <button
          onClick={() => navigate(-1)}
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-lg text-[12px] text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} /> {$t("Geri")}
        </button>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel bg-mesh-brand p-5 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <TokenIcon symbol={symbol} chainId={chainId} address={address} size={48} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-[18px] font-semibold text-white">{name}</h1>
                    {meta?.rank != null && (
                      <span className="chip shrink-0 text-warning">#{meta.rank}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-medium text-zinc-400">{symbol}</span>
                    <span className="inline-flex items-center gap-1">
                      <ChainIcon chainId={chainId} size={13} />
                      {chain.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLiveOn((v) => !v)}
                  className={cn(
                    "focus-ring flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors",
                    liveOn
                      ? "border-success/30 bg-success/[0.08] text-success"
                      : "border-white/[0.08] bg-surface-800 text-zinc-400 hover:text-white",
                  )}
                  title={liveOn ? $t("Canlı akışı durdur") : $t("Canlı akışı başlat")}
                >
                  {liveOn ? <Pause size={12} /> : <Play size={12} />}
                  {liveOn ? $t("Canlı") : $t("Duraklatıldı")}
                </button>
                <button
                  onClick={refreshNow}
                  disabled={refreshing}
                  className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-surface-800 text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
                  title={$t("Bakiyeyi yenile")}
                >
                  <ArrowsClockwise size={13} className={cn(refreshing && "animate-spin")} />
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <span
                className={cn(
                  "tabular rounded-lg px-1 text-[34px] font-semibold leading-none tracking-tight text-white transition-colors",
                  flash === "up" && "animate-flash-up",
                  flash === "down" && "animate-flash-down",
                )}
              >
                {price > 0 ? formatPrice(price) : $t("Fiyat bulunamadı")}
              </span>
              <span
                className={cn(
                  "mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
                  up ? "bg-up/[0.1] text-up" : "bg-down/[0.1] text-down",
                )}
              >
                {up ? <TrendUp size={12} /> : <TrendDown size={12} />}
                {formatPercent(rangePct)}%
                <span className="font-normal opacity-70">{RANGE_LABELS[range]}</span>
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">
              <span>
                {liveAt
                  ? `Son tick ${new Date(liveAt).toLocaleTimeString("tr-TR")}`
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

            <div className="mt-5">
              <AreaChart
                series={series}
                range={range}
                ranges={RANGES}
                onRange={setRange}
                loading={chartLoading}
                changePct={rangePct}
                live={liveOn}
                height={230}
                formatValue={(v) => formatPrice(v)}
                emptyText={$t("Bu varlık için geçmiş fiyat serisi bulunamadı.")}
              />
            </div>

            {dayPos != null && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{$t("24s düşük")} {formatPrice(dayLow!)}</span>
                  <span className="uppercase tracking-[0.14em] text-zinc-600">{$t("gün aralığı")}</span>
                  <span>{$t("24s yüksek")} {formatPrice(dayHigh!)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/60 via-warning/50 to-up/60">
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-900 bg-white shadow-glow transition-all duration-500"
                    style={{ left: `${dayPos}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="panel flex flex-col p-5">
            <div className="section-title">{watchOnly ? $t("Piyasa konumu") : $t("Pozisyonun")}</div>
            {watchOnly ? (
              <div className="mt-3">
                <div className="tabular text-[26px] font-semibold leading-none text-white">
                  {price > 0 ? formatPrice(price) : "—"}
                </div>
                <div className="mt-1.5 text-[12px] text-zinc-400">{name} {$t("· birim fiyat")}</div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-info/20 bg-info/[0.06] p-2.5 text-[11px] leading-relaxed text-info/90">
                  <Info size={13} className="mt-px shrink-0" />
                  <span>
                    {chain.name} {$t("bu cüzdanda salt-okunur:")} {symbol} {$t("gönderilemez veya alınamaz. Fiyat, grafik ve piyasa istatistikleri gerçek verilerle gösterilir.")}
                  </span>
                </div>
                {meta?.marketCap != null && meta.marketCap > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Stat label={$t("Piyasa değeri")} value={compactUsd(meta.marketCap)} hint={meta.rank ? $t("Sıra #{0}", [meta.rank]) : undefined} />
                    <Stat label={$t("24s hacim")} value={compactUsd(meta.volume24h)} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <div className="tabular text-[26px] font-semibold leading-none text-white">
                    {value > 0 ? formatUsd(value) : formatUsd(0)}
                  </div>
                  <div className="tabular mt-1.5 text-[12px] text-zinc-400">
                    {formatAmount(amount, 8)} {symbol}
                  </div>
                  {totalUsd > 0 && value > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                        <span>{$t("Portföy payı")}</span>
                        <span className="tabular text-zinc-300">%{allocation.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-accent to-magenta transition-all duration-500"
                          style={{ width: `${Math.min(100, allocation)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {amount === 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                      {$t("Bu varlık cüzdanında yok. Al sekmesinden adresini kullanarak")}{" "}
                      {chain.name} {$t("ağında")} {symbol} alabilirsin.
                    </p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: $t("Gönder"), icon: PaperPlaneTilt, to: "/send" },
                    { label: $t("Al"), icon: QrCode, to: "/receive" },
                    { label: $t("Takas"), icon: ArrowsLeftRight, to: "/swap" },
                  ].map(({ label, icon: Icon, to }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setActiveChain(chainId);
                        navigate(to);
                      }}
                      className="focus-ring flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-surface-800/70 py-2.5 text-[11px] text-zinc-300 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:text-white"
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {elsewhere.length > 0 && (
              <div className="mt-4">
                <div className="section-title">{$t("Diğer ağlardaki")} {symbol}</div>
                <ul className="mt-2 space-y-0.5">
                  {elsewhere.map((h) => (
                    <li key={`${h.chainId}-${h.address ?? "native"}`}>
                      <button
                        onClick={() => navigate(`/token/${h.chainId}/${h.address ?? "native"}`)}
                        className="row-hover focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                      >
                        <ChainIcon chainId={h.chainId} size={18} />
                        <span className="flex-1 truncate text-[11px] text-zinc-300">
                          {getChain(h.chainId)?.name}
                        </span>
                        <span className="tabular text-[11px] text-white">
                          {formatUsd(h.usdValue)}
                        </span>
                        <CaretRight size={12} className="text-zinc-700" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {address && (
              <div className="mt-4">
                <div className="section-title">{$t("Sözleşme")}</div>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(address);
                    setCopied(true);
                    toast($t("Sözleşme adresi kopyalandı"), "success");
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="focus-ring mt-2 flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 py-2 text-left font-mono text-[11px] text-zinc-300 transition-colors hover:border-white/[0.14] hover:text-white"
                >
                  <span className="flex-1 truncate">{shortAddress(address, 8)}</span>
                  {copied ? (
                    <Check size={12} className="shrink-0 text-up" />
                  ) : (
                    <Copy size={12} className="shrink-0 text-zinc-600" />
                  )}
                </button>
              </div>
            )}

            {address && <TokenSafetyCard chainId={chainId} address={address} />}
          </div>
        </div>

        <div className="panel mt-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ChartBar size={14} className="text-accent" />
            <span className="text-[13px] font-medium text-white">{$t("Performans")}</span>
            <span className="text-[10px] text-zinc-600">{$t("USD bazlı")}</span>
          </div>
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
              <div key={label} className="stat-tile">
                <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</div>
                <div
                  className={cn(
                    "tabular mt-1 text-[15px] font-semibold",
                    value == null ? "text-zinc-600" : value >= 0 ? "text-up" : "text-down",
                  )}
                >
                  {value == null ? (metaLoading ? "…" : "—") : `${formatPercent(value)}%`}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel mt-4 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-white">{$t("Piyasa istatistikleri")}</span>
            {meta?.updatedAt ? (
              <span className="text-[10px] text-zinc-600">
                {new Date(meta.updatedAt).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                {$t("itibarıyla")}
              </span>
            ) : null}
          </div>

          {!meta && metaLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-[64px]" />
              ))}
            </div>
          ) : !meta ? (
            <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-surface-800/50 p-3 text-[11px] leading-relaxed text-zinc-500">
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
                  hint={meta.circulatingSupply ? `${meta.circulatingSupply.toLocaleString("tr-TR")} ${symbol}` : undefined}
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
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[13px] font-medium text-white">
                {watchOnly ? $t("Zincir kaydı") : $t("{0} işlemleri", [symbol])}
              </span>
              {!watchOnly && (
                <button
                  onClick={() => navigate("/activity")}
                  className="focus-ring flex items-center gap-1 rounded text-[11px] text-zinc-500 transition-colors hover:text-accent"
                >
                  {$t("Tüm geçmiş")} <CaretRight size={12} />
                </button>
              )}
            </div>
            {watchOnly ? (
              <div className="px-4 py-9 text-center">
                <p className="text-[13px] text-zinc-400">{chain.name} {$t("bu cüzdanda salt-okunur")}</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-zinc-600">
                  {symbol} {$t("için adres türetilmediğinden işlem geçmişi okunmaz. Ağdaki hareketleri zincir gezgininden izleyebilirsin.")}
                </p>
                <a
                  href={explorerToken}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-800 px-3 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
                >
                  {chain.name} gezgini <ArrowSquareOut size={11} className="text-zinc-600" />
                </a>
              </div>
            ) : history.loading && txs.length === 0 ? (
              <div className="space-y-1.5 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-[46px]" />
                ))}
              </div>
            ) : txs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] text-zinc-400">{$t("Bu varlıkta işlem bulunamadı")}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {chain.blockscoutUrl
                    ? $t("Yüklenen sayfalar içinde bu varlığa ait transfer yok.")
                    : $t("{0} için işlem geçmişi kaynağı tanımlı değil.", [chain.name])}
                </p>
              </div>
            ) : (
              <ul className="stagger p-1.5">
                {txs.slice(0, 10).map((tx) => (
                  <li key={tx.id}>
                    <button
                      onClick={() => setOpenTx(tx)}
                      className="row-hover focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left"
                    >
                      <TxKindBadge tx={tx} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-zinc-100">
                          {tx.direction === "in" ? $t("Alındı") : tx.direction === "out" ? $t("Gönderildi") : "Kendine"}
                          {" · "}
                          {formatAmount(tx.amount, 6)} {tx.symbol}
                        </div>
                        <div className="truncate font-mono text-[10px] text-zinc-600">
                          {shortAddress(tx.counterparty, 6)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-[11px] text-zinc-300">
                          {tx.usdValue > 0 ? formatUsd(tx.usdValue) : "—"}
                        </div>
                        <div className="text-[10px] text-zinc-600">
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
          </div>

          <div className="panel p-4">
            <div className="section-title">{$t("Hakkında")}</div>
            {meta?.description ? (
              <>
                <p
                  className={cn(
                    "mt-2 text-[11px] leading-relaxed text-zinc-400",
                    !expanded && "line-clamp-6",
                  )}
                >
                  {meta.description}
                </p>
                {meta.description.length > 320 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="focus-ring mt-1.5 rounded text-[11px] font-medium text-accent hover:text-accent-hover"
                  >
                    {expanded ? $t("Daha az göster") : $t("Devamını oku")}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                {metaLoading
                  ? $t("Künye yükleniyor…")
                  : `${name}, ${chain.name} ağında ${address ? $t("bir ERC-20 tokenı") : $t("yerel coin")} olarak çalışır.`}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta?.homepage && <LinkPill href={meta.homepage} icon={<Globe size={12} />} label="Site" />}
              {meta?.twitter && (
                <LinkPill
                  href={`https://twitter.com/${meta.twitter}`}
                  icon={<TwitterLogo size={12} />}
                  label="Twitter"
                />
              )}
              {meta?.telegram && (
                <LinkPill
                  href={`https://t.me/${meta.telegram}`}
                  icon={<PaperPlaneTilt size={12} />}
                  label="Telegram"
                />
              )}
              {meta?.github && <LinkPill href={meta.github} icon={<GithubLogo size={12} />} label="GitHub" />}
              {explorerToken && (
                <LinkPill
                  href={explorerToken}
                  icon={<ArrowSquareOut size={12} />}
                  label={address ? $t("Sözleşme gezgini") : $t("Ağ gezgini")}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
    </div>
  );
}
