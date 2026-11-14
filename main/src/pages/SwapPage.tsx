import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Warning, ArrowsDownUp, CaretDown, ArrowSquareOut, ArrowsClockwise, SlidersHorizontal, ShieldCheck } from "@phosphor-icons/react";
import { TokenIcon } from "@/components/TokenIcon";
import { AccountModal } from "@/components/layout/AccountModal";
import { ConfirmSwap } from "@/components/swap/ConfirmSwap";
import { QuotePanel } from "@/components/swap/QuotePanel";
import { SwapSettingsModal } from "@/components/swap/SwapSettingsModal";
import { TokenPicker } from "@/components/swap/TokenPicker";
import { tokenAmount } from "@/components/swap/format";
import { isActive } from "@/components/swap/stages";
import { ENGINE_META, FEE_PERCENT } from "@/lib/swap/config";
import { chainLabel, findAsset, type SwapAsset } from "@/lib/swap/assets";
import { isEvmChain } from "@/lib/chains/address";
import { routeBlocker } from "@/lib/swap/engine";
import { formatEta } from "@/lib/swap/intents";
import { parseUnits, plainNumber, unitsToNumber } from "@/lib/swap/units";
import { addressForChain, useAccountStore } from "@/stores/accountStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useSwapStore, missingAddressLegs } from "@/stores/swapStore";
import { useWalletStore } from "@/stores/walletStore";
import { cn, formatAmount, formatUsd } from "@/lib/utils";

/**
 * Takas ekranı.
 *
 * Tek sütun ve sade: miktar yazılınca eline geçecek net tutar ile ortalama
 * süre görünür. İnce ayarlar dişlinin arkasında, adresler hesap ekranındadır.
 */

const RANDOM_POOL = [
  "ethereum:native",
  "bitcoin:native",
  "solana:native",
  "arbitrum:native",
  "base:native",
  "bsc:native",
  "polygon:native",
  "tron:native",
  "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7",
];

const PERCENTS = [25, 50, 75, 100];

export function SwapPage() {
  const navigate = useNavigate();
  const wallet = useWalletStore((s) => s.wallet);
  const prices = usePortfolioStore((s) => s.prices);
  const holdings = usePortfolioStore((s) => s.holdings);

  const assets = useSwapStore((s) => s.assets);
  const assetsLoading = useSwapStore((s) => s.assetsLoading);
  const fromId = useSwapStore((s) => s.fromId);
  const toId = useSwapStore((s) => s.toId);
  const amount = useSwapStore((s) => s.amount);
  const quote = useSwapStore((s) => s.quote);
  const quoteLoading = useSwapStore((s) => s.quoteLoading);
  const quoteError = useSwapStore((s) => s.quoteError);
  const engineErrors = useSwapStore((s) => s.engineErrors);
  const quotedAt = useSwapStore((s) => s.quotedAt);
  const settings = useSwapStore((s) => s.settings);
  const executing = useSwapStore((s) => s.executing);
  const orders = useSwapStore((s) => s.orders);

  const initAssets = useSwapStore((s) => s.initAssets);
  const setFrom = useSwapStore((s) => s.setFrom);
  const setTo = useSwapStore((s) => s.setTo);
  const flip = useSwapStore((s) => s.flip);
  const setAmount = useSwapStore((s) => s.setAmount);
  const setPercent = useSwapStore((s) => s.setPercent);
  const requestQuote = useSwapStore((s) => s.requestQuote);
  const execute = useSwapStore((s) => s.execute);
  const trackOrder = useSwapStore((s) => s.trackOrder);

  const savedAddressCount = useAccountStore((s) => Object.keys(s.custom).length);

  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tweaks, setTweaks] = useState(false);
  const [account, setAccount] = useState(false);
  const [details, setDetails] = useState(false);

  const from = findAsset(fromId);
  const to = findAsset(toId);

  useEffect(() => {
    void initAssets();
    for (const o of useSwapStore.getState().orders) {
      if (isActive(o.stage)) trackOrder(o.id);
    }
  }, [initAssets, trackOrder]);

  // Hesap ekranından yeni adres eklendiğinde kotasyon gerçek alıcıyla yenilenir.
  useEffect(() => {
    requestQuote(true);
  }, [savedAddressCount, wallet?.address, requestQuote]);

  useEffect(() => {
    if (!settings.autoRefresh || !quote) return;
    const t = setInterval(() => {
      if (Date.now() - quotedAt >= settings.refreshSeconds * 1000) requestQuote(true);
    }, 1000);
    return () => clearInterval(t);
  }, [settings.autoRefresh, settings.refreshSeconds, quote, quotedAt, requestQuote]);

  const holding = useMemo(
    () => holdings.find((h) => `${h.chainId}:${h.address?.toLowerCase() ?? "native"}` === fromId),
    [holdings, fromId],
  );
  const balance = holding?.amount ?? 0;

  const amountIn = from ? parseUnits(amount, from.decimals) : 0n;
  const inUi = from ? unitsToNumber(amountIn, from.decimals) : 0;
  const outUi = quote && to ? unitsToNumber(quote.amountOut, to.decimals) : 0;
  const minUi = quote && to ? unitsToNumber(quote.minAmountOut, to.decimals) : 0;
  const blocker = from && to ? routeBlocker(from, to) : null;
  const insufficient = inUi > 0 && inUi > balance + 1e-12;
  const busyQuote = quoteLoading && !quote;

  // Zincirler arası rotada hedef ağda gerçek bir adres gerekir; örnek adres
  // yalnızca fiyat almak içindir ve yürütme sırasında kabul edilmez.
  const needsSavedAddress = Boolean(
    quote &&
      quote.engine === "intents" &&
      to &&
      !isEvmChain(to.chainId) &&
      !addressForChain(to.chainId),
  );
  const missing = missingAddressLegs(fromId, toId);

  const cta = (() => {
    if (!from || !to) return { label: $t("Varlık listesi yükleniyor…"), disabled: true };
    if (blocker) return { label: $t("Bu çift için rota yok"), disabled: true };
    if (inUi <= 0) return { label: $t("Tutar gir"), disabled: true };
    if (insufficient) return { label: $t("Yetersiz {0} bakiyesi", [from.symbol]), disabled: true };
    if (busyQuote) return { label: $t("En iyi fiyat aranıyor…"), disabled: true };
    if (!quote) return { label: quoteError ? $t("Fiyat alınamadı — yeniden dene") : $t("Fiyat al"), disabled: false };
    if (needsSavedAddress)
      return { label: $t("{0} adresini ekle", [chainLabel(to.chainId)]), disabled: false };
    if (missing.refund && from && !isEvmChain(from.chainId))
      return { label: $t("{0} adresini ekle", [chainLabel(from.chainId)]), disabled: false };
    return { label: $t("Takası gözden geçir"), disabled: false };
  })();

  function onCta() {
    if (!quote) {
      requestQuote(true);
      return;
    }
    if (needsSavedAddress || (missing.refund && from && !isEvmChain(from.chainId))) {
      setAccount(true);
      return;
    }
    setConfirming(true);
  }

  async function onConfirm() {
    const id = await execute(wallet?.address ?? "");
    setConfirming(false);
    if (id) navigate("/activity?tab=swaps");
  }

  function randomPair() {
    const pool = RANDOM_POOL.map(findAsset).filter(
      (a): a is SwapAsset => a !== undefined && a.id !== toId,
    );
    if (pool.length === 0 || !to) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setFrom(pick.id);
    const price = prices[pick.symbol]?.usd ?? pick.intentsPrice ?? 0;
    if (price > 0) setAmount(plainNumber(250 / price, pick.decimals));
    requestQuote(true);
  }

  const liveOrders = orders.filter((o) => isActive(o.stage));

  return (
    <div className="page">
      <div className="mx-auto max-w-[440px] pb-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-white">{$t("Takas")}</h1>
            <span className="live-chip hidden sm:inline-flex">
              <span className="live-dot" /> {$t("canlı")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => requestQuote(true)}
              disabled={quoteLoading}
              title={$t("Fiyatı yenile")}
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-surface-850 text-zinc-400 transition-colors hover:border-accent/40 hover:text-white disabled:opacity-60"
            >
              <ArrowsClockwise size={13} className={cn(quoteLoading && "animate-spin")} />
            </button>
            <button
              onClick={() => setTweaks(true)}
              title={$t("Takas ayarları")}
              className={cn(
                "focus-ring grid h-8 w-8 place-items-center rounded-lg border transition-colors",
                settings.slippagePct !== 0.5 || settings.preference !== "auto"
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-white/[0.07] bg-surface-850 text-zinc-400 hover:border-accent/40 hover:text-white",
              )}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </header>

        <section className="panel p-3.5 sm:p-4">
          <div className="rounded-xl border border-white/[0.05] bg-surface-800/45 p-3 transition-colors focus-within:border-accent/35 sm:border-white/[0.07] sm:bg-surface-800/60 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-zinc-400">{$t("Veriyorsun")}</span>
              <button
                onClick={() => setPercent(100)}
                disabled={balance <= 0}
                className="focus-ring tabular flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                title={$t("Bakiyenin tamamını kullan")}
              >
                {formatAmount(balance, 6)} {from?.symbol ?? ""}
                {balance > 0 && <span className="font-semibold text-accent">{$t("Maks")}</span>}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,0"
                inputMode="decimal"
                aria-label={$t("Verilecek tutar")}
                className={cn(
                  "tabular w-full min-w-0 bg-transparent text-[26px] font-semibold leading-tight outline-none placeholder:text-zinc-700",
                  insufficient ? "text-danger" : "text-white",
                )}
              />
              <AssetButton asset={from} loading={assetsLoading} onClick={() => setPicker("from")} />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="tabular text-[11px] text-zinc-600">
                {quote ? formatUsd(quote.amountInUsd) : inUi > 0 ? "—" : "0,00 $"}
              </span>
              <span className="flex items-center gap-1">
                {PERCENTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPercent(p)}
                    disabled={balance <= 0}
                    className="focus-ring tabular rounded-md border border-white/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40 sm:px-1.5 sm:py-0.5 sm:text-[10px]"
                  >
                    %{p}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex justify-center">
            <button
              onClick={flip}
              title={$t("Yönü değiştir")}
              aria-label={$t("Takas yönünü değiştir")}
              className="focus-ring group absolute -top-3.5 grid h-8 w-8 place-items-center rounded-full border border-white/[0.1] bg-surface-700 text-zinc-300 shadow-lift transition-all hover:border-accent/50 hover:text-white active:scale-95"
            >
              <ArrowsDownUp size={14} className="transition-transform duration-300 group-hover:rotate-180" />
            </button>
          </div>

          <div className="mt-3.5 rounded-xl border border-white/[0.05] bg-surface-800/45 p-3 sm:mt-4 sm:border-success/20 sm:bg-success/[0.04] sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-zinc-400">{$t("Alıyorsun")}</span>
              <span className="chip hidden border-success/25 bg-success/[0.08] text-success sm:inline-flex">
                <ShieldCheck size={9} /> {$t("Net")}
              </span>
            </div>

            {busyQuote || (quoteLoading && inUi > 0) ? (
              <div className="mt-3 space-y-2">
                <span className="skeleton block h-[30px] w-52 rounded-lg" />
                <span className="skeleton block h-[12px] w-36 rounded-md" />
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={cn(
                      "tabular w-full min-w-0 truncate text-[26px] font-semibold leading-tight",
                      outUi > 0 ? "text-success" : "text-zinc-700",
                    )}
                    title={outUi > 0 ? `${tokenAmount(outUi)} ${to?.symbol}` : undefined}
                  >
                    {outUi > 0 ? tokenAmount(outUi) : "0,0"}
                  </span>
                  <AssetButton asset={to} loading={assetsLoading} onClick={() => setPicker("to")} />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular text-[11px] text-zinc-500">
                    {quote ? $t("~{0} içinde · {1}", [formatEta(quote.etaSeconds), formatUsd(quote.amountOutUsd)]) : "—"}
                  </span>
                  <span className={cn("text-[10px] text-zinc-600", quote && "hidden sm:block")}>
                    {quote
                      ? $t("garanti en az {0} {1}", [tokenAmount(minUi), to?.symbol ?? ""])
                      : $t("tutar girince net çıkış hesaplanır")}
                  </span>
                </div>
              </>
            )}
          </div>

          {quote && from && to && (
            <button
              onClick={() => setDetails((v) => !v)}
              className="focus-ring mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-surface-800/45 px-2.5 py-2 text-left transition-colors hover:border-white/[0.14]"
            >
              <span className="tabular min-w-0 truncate text-[11px] text-zinc-400">
                1 {from.symbol} = {tokenAmount(quote.rate)} {to.symbol}
                {quote.networkFeeUsd > 0 && $t(" · ağ {0}", [formatUsd(quote.networkFeeUsd)])}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                {$t("Detaylar")}
                <CaretDown size={12} className={cn("transition-transform", details && "rotate-180")} />
              </span>
            </button>
          )}

          {details && quote && from && to && (
            <QuotePanel
              quote={quote}
              from={from}
              to={to}
              quotedAt={quotedAt}
              loading={quoteLoading}
              onRefresh={() => requestQuote(true)}
            />
          )}

          {blocker && <Banner tone="danger" text={blocker} />}
          {!blocker && insufficient && (
            <Banner
              tone="danger"
              text={$t("Cüzdanda {0} {1} var. Tutarı düşür veya başka bir varlık seç.", [
                formatAmount(balance, 6),
                from?.symbol ?? "",
              ])}
            />
          )}
          {!blocker && !insufficient && quoteError && <Banner tone="warning" text={quoteError} />}
          {!blocker && quote && engineErrors.length > 0 && (
            <Banner
              tone="info"
              className={details ? undefined : "hidden sm:flex"}
              text={engineErrors.map((f) => `${ENGINE_META[f.engine].short}: ${f.reason}`).join(" · ")}
            />
          )}
          {settings.testMode && (
            <Banner
              tone="warning"
              className={details ? undefined : "hidden sm:flex"}
              text={$t("Test yürütmesi açık — fiyat ve rota gerçek, imza ve fon hareketi yok.")}
            />
          )}

          <button
            onClick={onCta}
            disabled={cta.disabled || executing}
            className={cn(
              "focus-ring mt-3.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all",
              cta.disabled || executing
                ? "cursor-not-allowed bg-surface-700 text-zinc-500"
                : "bg-accent text-white shadow-glow hover:bg-accent-hover active:scale-[0.99]",
            )}
          >
            {quoteLoading && !busyQuote && <ArrowsClockwise size={14} className="animate-spin" />}
            {executing ? $t("İşlem başlatılıyor…") : cta.label}
          </button>

          <p className="mt-2.5 text-center text-[10px] text-zinc-500/50">
            %{formatAmount(FEE_PERCENT, 2)} {$t("VexarisWallet komisyonu içerir.")}
          </p>
        </section>

        {liveOrders.length > 0 && (
          <button
            onClick={() => navigate("/activity?tab=swaps")}
            className="focus-ring mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-surface-850 px-3.5 py-2.5 text-left transition-colors hover:border-accent/40"
          >
            <span className="flex items-center gap-2 text-[12px] text-zinc-300">
              <span className="live-dot" />
              {liveOrders.length} {$t("takasın sonucu bekleniyor")}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-accent">
              {$t("İzle")} <ArrowSquareOut size={11} />
            </span>
          </button>
        )}
      </div>

      {picker && (
        <TokenPicker
          assets={assets}
          selectedId={picker === "from" ? fromId : toId}
          counterpart={picker === "from" ? to : from}
          side={picker}
          onSelect={picker === "from" ? setFrom : setTo}
          onClose={() => setPicker(null)}
        />
      )}

      {tweaks && <SwapSettingsModal onClose={() => setTweaks(false)} onRandomPair={randomPair} />}

      {account && <AccountModal onClose={() => setAccount(false)} />}

      {confirming && quote && from && to && (
        <ConfirmSwap
          quote={quote}
          from={from}
          to={to}
          refundTo={addressForChain(from.chainId)}
          recipient={addressForChain(to.chainId)}
          slippagePct={settings.slippagePct}
          testMode={settings.testMode}
          securityCheck={settings.securityCheck}
          busy={executing}
          onConfirm={() => void onConfirm()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function AssetButton({
  asset,
  loading,
  onClick,
}: {
  asset?: SwapAsset;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.09] bg-surface-700 py-2 pl-1.5 pr-2 transition-colors hover:border-accent/45 sm:py-1.5 sm:pr-2.5"
    >
      {asset ? (
        <TokenIcon symbol={asset.symbol} chainId={asset.chainId} address={asset.address} size={26} badge />
      ) : (
        <span className="h-[26px] w-[26px] rounded-full bg-surface-600" />
      )}
      <span className="text-left">
        <span className="block text-[13px] font-semibold leading-tight text-white">
          {asset?.symbol ?? (loading ? "…" : $t("Seç"))}
        </span>
        <span className="block max-w-[86px] truncate text-[9px] leading-tight text-zinc-500">
          {asset ? chainLabel(asset.chainId) : $t("varlık")}
        </span>
      </span>
      <CaretDown size={13} className="shrink-0 text-zinc-500" />
    </button>
  );
}

function Banner({
  tone,
  text,
  className,
}: {
  tone: "info" | "warning" | "danger";
  text: string;
  className?: string;
}) {
  const styles = {
    info: "border-info/20 bg-info/[0.06] text-info/90",
    warning: "border-warning/25 bg-warning/[0.07] text-warning/90",
    danger: "border-danger/25 bg-danger/[0.07] text-danger/90",
  }[tone];
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
        styles,
        className,
      )}
    >
      <Warning size={12} className="mt-px shrink-0" />
      <span className="min-w-0">{text}</span>
    </div>
  );
}
