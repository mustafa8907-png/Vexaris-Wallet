import { t as $t } from "@/lib/i18n";
import { memo, useEffect, useState } from "react";
import { Warning, Clock, GasPump, Gauge, Info, Percent, ArrowsClockwise, ShieldCheck, TrendDown } from "@phosphor-icons/react";
import { ENGINE_META, FEE_PERCENT, QUOTE_TTL_MS } from "@/lib/swap/config";
import { formatEta } from "@/lib/swap/intents";
import type { SwapAsset } from "@/lib/swap/assets";
import type { SwapQuote } from "@/lib/swap/types";
import { unitsToNumber } from "@/lib/swap/units";
import { cn, formatAmount, formatPercent, formatPrice, formatUsd, shortAddress } from "@/lib/utils";
import { etaRange, tokenAmount } from "./format";
import { RouteFlow } from "./RouteFlow";


interface Props {
  quote: SwapQuote;
  from: SwapAsset;
  to: SwapAsset;
  quotedAt: number;
  loading: boolean;
  onRefresh: () => void;
}

export const QuotePanel = memo(function QuotePanel({
  quote,
  from,
  to,
  quotedAt,
  loading,
  onRefresh,
}: Props) {
  const meta = ENGINE_META[quote.engine];
  const outUi = unitsToNumber(quote.amountOut, to.decimals);
  const grossUi = outUi + unitsToNumber(quote.feeUnits, to.decimals);
  const impact = quote.priceImpactPct;
  const impactTone =
    impact <= -5 ? "text-danger" : impact <= -1.5 ? "text-warning" : "text-zinc-200";

  return (
    <div className="mt-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Clock size={12} />}
          label={$t("Ortalama süre")}
          value={formatEta(quote.etaSeconds)}
          hint={etaRange(quote.etaLow, quote.etaHigh, formatEta)}
          tone={quote.etaSeconds <= 60 ? "text-success" : "text-info"}
        />
        <Stat
          icon={<Gauge size={12} />}
          label={$t("Fiyat etkisi")}
          value={`${formatPercent(impact, 2)}%`}
          hint={impact <= -1.5 ? $t("Yüksek kayma") : $t("Normal aralık")}
          tone={impactTone}
        />
        <Stat
          icon={<GasPump size={12} />}
          label={$t("Ağ ücreti")}
          value={quote.networkFeeUsd > 0 ? formatUsd(quote.networkFeeUsd) : "—"}
          hint={
            quote.networkFeeNative > 0
              ? `${tokenAmount(quote.networkFeeNative)} ${quote.networkFeeSymbol}`
              : $t("Ücret bildirilmedi")
          }
        />
        <Stat
          icon={<Percent size={12} />}
          label={$t("Vexaris payı")}
          value={`%${formatAmount(FEE_PERCENT, 2)}`}
          hint={quote.feeUsd > 0 ? formatUsd(quote.feeUsd) : $t("çıkıştan kesilir")}
          tone="text-warning"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-surface-800/45 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] text-zinc-500">{$t("Kur")}</span>
          <span className="tabular truncate text-[12px] text-zinc-200">
            1 {from.symbol} = {tokenAmount(quote.rate)} {to.symbol}
          </span>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">
            ({formatPrice(quote.amountInUsd / Math.max(1e-12, unitsToNumber(quote.amountIn, from.decimals)))})
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("chip", meta.ring, meta.tint, meta.text)}>{meta.short}</span>
          <Freshness quotedAt={quotedAt} loading={loading} onRefresh={onRefresh} />
        </span>
      </div>

      <div className="animate-fade-up overflow-hidden rounded-xl border border-white/[0.06] bg-surface-800/35">
        <div className="flex items-center gap-1.5 border-b border-white/[0.05] px-3 py-2">
          <ShieldCheck size={12} className="text-zinc-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {$t("Tutar dökümü")}
          </span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          <Row
            label={$t("Brüt çıkış")}
            value={`${tokenAmount(grossUi)} ${to.symbol}`}
            hint={$t("Komisyon öncesi rota çıktısı")}
          />
          <Row
            label={$t("Vexaris Wallet komisyonu · %{0}", [formatAmount(FEE_PERCENT, 2)])}
            value={`− ${tokenAmount(unitsToNumber(quote.feeUnits, to.decimals))} ${to.symbol}`}
            hint={$t("{0} adresine gider", [shortAddress(quote.feeRecipient, 6)])}
            tone="text-warning"
          />
          {quote.protocolFeeBps > 0 && (
            <Row
              label={$t("NEAR Intents protokol payı · %{0}", [formatAmount(quote.protocolFeeBps / 100, 2)])}
              value={`− ${formatUsd(quote.protocolFeeUsd)}`}
              hint={$t("protokol ortağı payı")}
              tone="text-violet"
            />
          )}
          <Row
            label={$t("Ağ / teslim ücreti")}
            value={quote.networkFeeUsd > 0 ? `− ${formatUsd(quote.networkFeeUsd)}` : "—"}
            hint={
              quote.engine === "kyber"
                ? `${formatAmount(quote.networkFeeNative, 6)} ${quote.networkFeeSymbol} gas`
                : $t("{0} zinciri çekim ücreti", [quote.networkFeeSymbol])
            }
          />
          <Row
            label={$t("Eline geçecek net")}
            value={`${tokenAmount(outUi)} ${to.symbol}`}
            hint={formatUsd(quote.amountOutUsd)}
            tone="text-success"
            strong
          />
          <Row
            label={$t("Kayma sonrası garanti")}
            value={`≥ ${tokenAmount(unitsToNumber(quote.minAmountOut, to.decimals))} ${to.symbol}`}
            hint={$t("Bu tutarın altında işlem gerçekleşmez, geri alınır")}
            tone="text-zinc-300"
          />
        </div>
      </div>

      <RouteFlow quote={quote} from={from} to={to} />

      {impact <= -1.5 && (
        <Notice tone="warning" icon={<TrendDown size={13} />}>
          {$t("Fiyat etkisi")} {formatPercent(impact, 2)}{$t("%. Tutarı bölmek daha iyi bir kur verebilir.")}
        </Notice>
      )}
      {quote.engine === "intents" && (
        <Notice tone="info" icon={<Info size={13} />}>
          {$t("Zincirler arası takas:")} {from.symbol} {$t("yatırma adresine gönderilir,")} {to.symbol} {$t("hedef zincirde teslim edilir. Ortalama süre çözünücünün açık artırmasına göre değişir.")}
        </Notice>
      )}
      {quote.minAmountOut === 0n && (
        <Notice tone="danger" icon={<Warning size={13} />}>
          {$t("Bu rota minimum çıkış garantisi vermiyor. Kayma toleransını düşürüp yeniden dene.")}
        </Notice>
      )}
    </div>
  );
});

function Row({
  label,
  value,
  hint,
  tone = "text-zinc-200",
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-3 py-2", strong && "bg-success/[0.04]")}>
      <span className="min-w-0">
        <span className={cn("block truncate text-[11px]", strong ? "font-semibold text-white" : "text-zinc-400")}>
          {label}
        </span>
        {hint && <span className="block truncate text-[10px] text-zinc-600">{hint}</span>}
      </span>
      <span className={cn("tabular shrink-0 text-[12px]", strong ? "font-semibold" : "", tone)}>
        {value}
      </span>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = "text-zinc-100",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <span className="text-zinc-600">{icon}</span>
        {label}
      </span>
      <span className={cn("tabular mt-1 block text-[15px] font-semibold leading-tight", tone)}>{value}</span>
      {hint && <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{hint}</span>}
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "info" | "warning" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-info/20 bg-info/[0.06] text-info/90",
    warning: "border-warning/25 bg-warning/[0.07] text-warning/90",
    danger: "border-danger/25 bg-danger/[0.07] text-danger/90",
  }[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed", styles)}>
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Freshness({
  quotedAt,
  loading,
  onRefresh,
}: {
  quotedAt: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, QUOTE_TTL_MS - (now - quotedAt));
  const ratio = quotedAt ? left / QUOTE_TTL_MS : 0;
  const seconds = Math.ceil(left / 1000);
  const r = 8;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      title={$t("Fiyatı yenile")}
      aria-label={$t("Fiyatı yenile, {0} saniye kaldı", [seconds])}
      className="focus-ring group flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-2 transition-colors hover:border-accent/40 disabled:opacity-60"
    >
      <span className="relative grid h-[22px] w-[22px] place-items-center">
        <svg width="22" height="22" viewBox="0 0 22 22" className="absolute -rotate-90">
          <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle
            cx="11"
            cy="11"
            r={r}
            fill="none"
            stroke={ratio > 0.35 ? "#3ecf8e" : "#ffb020"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        <ArrowsClockwise size={10} className={cn("text-zinc-400 group-hover:text-white", loading && "animate-spin")} />
      </span>
      <span className="tabular text-[10px] text-zinc-400">{$t("{0} sn", [seconds])}</span>
    </button>
  );
}