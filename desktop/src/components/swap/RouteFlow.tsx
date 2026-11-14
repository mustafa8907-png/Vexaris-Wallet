import { t as $t } from "@/lib/i18n";
import { memo } from "react";
import { ArrowRight, Stack, Repeat, Lightning } from "@phosphor-icons/react";
import { TokenIcon } from "@/components/TokenIcon";
import { ENGINE_META } from "@/lib/swap/config";
import type { SwapAsset } from "@/lib/swap/assets";
import type { SwapQuote } from "@/lib/swap/types";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Rotanın görsel akışı.
 *
 * Kyber'de paralel DEX yolları paylarıyla, NEAR Intents'te yatırma → çözünücü
 * → teslim zinciri olarak çizilir. Bağlantı çizgileri akan gradyanla "canlı"
 * görünür; hareket azaltma tercihinde durur.
 */

const KIND_ICON = {
  dex: Repeat,
  bridge: ArrowRight,
  wrap: Stack,
  settle: Lightning,
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

  return (
    <div className={cn("rounded-xl border bg-surface-800/45 p-3", meta.ring)}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", quote.engine === "kyber" ? "bg-teal" : "bg-violet")} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", meta.text)}>
            {meta.short} {$t("rotası")}
          </span>
        </span>
        <span className="text-[10px] text-zinc-500">
          {split ? `${quote.hops.length} paralel yol` : $t("{0} adım", [quote.hops.length])}
        </span>
      </div>

      <div className="flex items-stretch gap-2.5">
        <Endpoint asset={from} caption="Giriş" />

        <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
          {quote.hops.map((hop, i) => {
            const Icon = KIND_ICON[hop.kind];
            return (
              <div
                key={`${hop.label}-${i}`}
                className="relative flex items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-850/95 px-2 py-1.5"
              >
                <Icon size={11} className={cn("shrink-0", meta.text)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-zinc-200">{hop.label}</span>
                  <span className="block truncate text-[9px] text-zinc-600">{hop.detail}</span>
                </span>
                {split && (
                  <span className="tabular shrink-0 text-[10px] font-semibold text-zinc-400">
                    {formatPercent(hop.share * 100, 0).replace("+", "")}%
                  </span>
                )}
                {split && (
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 h-[2px] rounded-full",
                      quote.engine === "kyber" ? "bg-teal/60" : "bg-violet/60",
                    )}
                    style={{ width: `${Math.max(4, hop.share * 100)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Endpoint asset={to} caption="Çıkış" align="right" />
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
      <span className="max-w-full truncate text-[11px] font-medium text-white">{asset.symbol}</span>
      <span className="text-[9px] uppercase tracking-wider text-zinc-600">{caption}</span>
    </div>
  );
}