import { t as $t } from "@/lib/i18n";
import { memo } from "react";
import { ArrowRight, Layers } from "@/kit";
import { Coins, Swap } from "@/kit/ext";
import { TokenIcon } from "@/components/TokenIcon";
import { ENGINE_META } from "@/lib/swap/config";
import type { SwapAsset } from "@/lib/swap/assets";
import type { SwapQuote } from "@/lib/swap/types";
import { cn, formatPercent } from "@/lib/utils";


const KIND_ICON = {
  dex: Swap,
  bridge: ArrowRight,
  wrap: Layers,
  settle: Coins,
} as const;

export const RouteFlow = memo(function RouteFlow({
  quote,
  from,
  to,
}: {
  quote: SwapQuote;
  from: SwapAsset;
  to: SwapAsset;
}) {
  const meta = ENGINE_META[quote.engine];
  const split = quote.engine === "kyber" && quote.hops.length > 1;
  const accent = quote.engine === "kyber" ? "teal" : "violet";

  return (
    <div className={cn("rounded-card border p-3", accent === "teal" ? "border-teal/25 bg-teal/[0.04]" : "border-violet/25 bg-violet/[0.04]")}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", accent === "teal" ? "bg-teal" : "bg-violet")} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", meta.text)}>
            {meta.short} {$t("rotası")}
          </span>
        </span>
        <span className="text-[10px] text-muted">
          {split ? `${quote.hops.length} ${$t("paralel yol")}` : $t("{0} adım", [quote.hops.length])}
        </span>
      </div>

      <div className="flex items-stretch gap-2.5">
        <Endpoint asset={from} caption={$t("Giriş")} />

        <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-line to-transparent" />
          {quote.hops.map((hop, i) => {
            const Icon = KIND_ICON[hop.kind];
            return (
              <div
                key={`${hop.label}-${i}`}
                className="relative flex items-center gap-2 rounded-ctrl border border-line bg-surface px-2 py-1.5"
              >
                <Icon size={11} className={cn("shrink-0", meta.text)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-text">{hop.label}</span>
                  <span className="block truncate text-[9px] text-muted">{hop.detail}</span>
                </span>
                {split && (
                  <span className="tabular shrink-0 text-[10px] font-semibold text-textsoft">
                    {formatPercent(hop.share * 100, 0).replace("+", "")}%
                  </span>
                )}
                {split && (
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 h-[2px] rounded-full",
                      accent === "teal" ? "bg-teal/60" : "bg-violet/60",
                    )}
                    style={{ width: `${Math.max(4, hop.share * 100)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Endpoint asset={to} caption={$t("Çıkış")} align="right" />
      </div>
    </div>
  );
});

function Endpoint({
  asset,
  caption,
  align = "left",
}: {
  asset: SwapAsset;
  caption: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex w-[74px] shrink-0 flex-col items-center justify-center gap-1", align === "right" && "order-last")}>
      <TokenIcon symbol={asset.symbol} chainId={asset.chainId} address={asset.address} size={30} badge />
      <span className="max-w-full truncate text-[11px] font-medium text-text">{asset.symbol}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted">{caption}</span>
    </div>
  );
}
