import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Chip, ChevronDown, IconButton, Refresh, Shield, Skeleton } from "@/kit";
import { ExternalLink, Sliders, Swap } from "@/kit/ext";
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
            <h1 className="font-display text-lg font-semibold tracking-tight text-text">{$t("Takas")}</h1>
            <Badge size="sm" tone="success" dot className="hidden sm:inline-flex">
              {$t("canlı")}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <IconButton
              size="sm"
              label={$t("Fiyatı yenile")}
              onClick={() => requestQuote(true)}
              disabled={quoteLoading}
            >
              <Refresh className={cn(quoteLoading && "animate-spin")} />
            </IconButton>
            <IconButton
              size="sm"
              label={$t("Takas ayarları")}
              onClick={() => setTweaks(true)}
              tone={settings.slippagePct !== 0.5 || settings.preference !== "auto" ? "brand" : "neutral"}
              variant={settings.slippagePct !== 0.5 || settings.preference !== "auto" ? "soft" : "soft"}
            >
              <Sliders />
            </IconButton>
          </div>
        </header>

        <Card className="p-3.5 sm:p-4">
          <div className="rounded-card border border-line bg-surface2 p-3 transition-colors focus-within:border-brand/45 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-textsoft">{$t("Veriyorsun")}</span>
              <button
                onClick={() => setPercent(100)}
                disabled={balance <= 0}
                className="tabular flex items-center gap-1.5 rounded-ctrl px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface3 hover:text-text disabled:opacity-50"
                title={$t("Bakiyenin tamamını kullan")}
              >
                {formatAmount(balance, 6)} {from?.symbol ?? ""}
                {balance > 0 && <span className="font-semibold text-brand">{$t("Maks")}</span>}
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
                  "tabular w-full min-w-0 bg-transparent font-display text-[26px] font-semibold leading-tight text-text outline-none placeholder:text-muted",
                  insufficient && "text-danger",
                )}
              />
              <AssetButton asset={from} loading={assetsLoading} onClick={() => setPicker("from")} />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="tabular text-[11px] text-muted">
                {quote ? formatUsd(quote.amountInUsd) : inUi > 0 ? "—" : "0,00 $"}
              </span>
              <span className="flex items-center gap-1">
                {PERCENTS.map((p) => (
                  <Chip
                    key={p}
                    className="tabular h-7 px-2.5 text-[10.5px] sm:px-2 sm:py-0"
                    onClick={() => setPercent(p)}
                    disabled={balance <= 0}
                  >
                    %{p}
                  </Chip>
                ))}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex justify-center">
            <button
              onClick={flip}
              title={$t("Yönü değiştir")}
              aria-label={$t("Takas yönünü değiştir")}
              className="group absolute -top-3.5 grid size-9 place-items-center rounded-full border border-linestrong bg-surface2 text-textsoft shadow-1 transition-all hover:border-brand/50 hover:text-text active:scale-95"
            >
              <Swap className="size-[15px] transition-transform duration-300 group-hover:rotate-180" />
            </button>
          </div>

          <div className="mt-3.5 rounded-card border border-ok/25 bg-oksoft/40 p-3 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-textsoft">{$t("Alıyorsun")}</span>
              <Badge size="sm" tone="success" className="hidden sm:inline-flex">
                <Shield size={10} /> {$t("Net")}
              </Badge>
            </div>

            {busyQuote || (quoteLoading && inUi > 0) ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-[30px] w-52 rounded-ctrl" />
                <Skeleton className="h-[12px] w-36 rounded-xs" />
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={cn(
                      "tabular font-display w-full min-w-0 truncate text-[26px] font-semibold leading-tight",
                      outUi > 0 ? "text-ok" : "text-muted",
                    )}
                    title={outUi > 0 ? `${tokenAmount(outUi)} ${to?.symbol}` : undefined}
                  >
                    {outUi > 0 ? tokenAmount(outUi) : "0,0"}
                  </span>
                  <AssetButton asset={to} loading={assetsLoading} onClick={() => setPicker("to")} />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular text-[11px] text-textsoft">
                    {quote ? $t("~{0} içinde · {1}", [formatEta(quote.etaSeconds), formatUsd(quote.amountOutUsd)]) : "—"}
                  </span>
                  <span className={cn("text-[10px] text-muted", quote && "hidden sm:block")}>
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
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-card border border-line bg-surface2 px-2.5 py-2 text-left transition-colors hover:border-linestrong"
            >
              <span className="tabular min-w-0 truncate text-[11px] text-textsoft">
                1 {from.symbol} = {tokenAmount(quote.rate)} {to.symbol}
                {quote.networkFeeUsd > 0 && $t(" · ağ {0}", [formatUsd(quote.networkFeeUsd)])}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                {$t("Detaylar")}
                <ChevronDown size={12} className={cn("transition-transform", details && "rotate-180")} />
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

          {blocker && <Alert tone="danger" className="mt-3">{blocker}</Alert>}
          {!blocker && insufficient && (
            <Alert tone="danger" className="mt-3">
              {$t("Cüzdanda {0} {1} var. Tutarı düşür veya başka bir varlık seç.", [
                formatAmount(balance, 6),
                from?.symbol ?? "",
              ])}
            </Alert>
          )}
          {!blocker && !insufficient && quoteError && <Alert tone="warning" className="mt-3">{quoteError}</Alert>}
          {!blocker && quote && engineErrors.length > 0 && (
            <Alert
              tone="info"
              className={cn("mt-3", !details && "hidden sm:flex")}
            >
              {engineErrors.map((f) => `${ENGINE_META[f.engine].short}: ${f.reason}`).join(" · ")}
            </Alert>
          )}

          <Button
            onClick={onCta}
            disabled={cta.disabled || executing}
            loading={executing}
            tone="brand"
            size="lg"
            fullWidth
            className="mt-4"
          >
            {cta.label}
          </Button>

          <p className="mt-2.5 text-center text-[10px] text-muted">
            %{formatAmount(FEE_PERCENT, 2)} {$t("VexarisWallet komisyonu içerir.")}
          </p>
        </Card>

        {liveOrders.length > 0 && (
          <button
            onClick={() => navigate("/activity?tab=swaps")}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-card border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-brand/45"
          >
            <span className="flex items-center gap-2 text-[12px] text-textsoft">
              <span className="size-1.5 animate-pulse rounded-full bg-ok" />
              {liveOrders.length} {$t("takasın sonucu bekleniyor")}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-brand">
              {$t("İzle")} <ExternalLink size={11} />
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

      {account && <AccountModal open onClose={() => setAccount(false)} />}

      {confirming && quote && from && to && (
        <ConfirmSwap
          quote={quote}
          from={from}
          to={to}
          refundTo={addressForChain(from.chainId)}
          recipient={addressForChain(to.chainId)}
          slippagePct={settings.slippagePct}
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
      className="flex shrink-0 items-center gap-2 rounded-ctrl border border-linestrong bg-surface2 py-2 pl-1.5 pr-2.5 transition-colors hover:border-brand/45"
    >
      {asset ? (
        <TokenIcon symbol={asset.symbol} chainId={asset.chainId} address={asset.address} size={26} badge />
      ) : (
        <span className="size-[26px] rounded-full bg-surface3" />
      )}
      <span className="text-left">
        <span className="block text-[13px] font-semibold leading-tight text-text">
          {asset?.symbol ?? (loading ? "…" : $t("Seç"))}
        </span>
        <span className="block max-w-[86px] truncate text-[9px] leading-tight text-muted">
          {asset ? chainLabel(asset.chainId) : $t("varlık")}
        </span>
      </span>
      <ChevronDown size={13} className="shrink-0 text-muted" />
    </button>
  );
}
