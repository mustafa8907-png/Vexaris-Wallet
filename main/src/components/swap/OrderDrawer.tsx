import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Prohibit, Check, Copy, ArrowSquareOut, Flask, ArrowCounterClockwise, Trash, X } from "@phosphor-icons/react";
import { TokenIcon } from "@/components/TokenIcon";
import { Button } from "@/components/ui/Button";
import { ENGINE_META, FEE_PERCENT, type EngineId } from "@/lib/swap/config";
import { formatEta } from "@/lib/swap/intents";
import { chainLabel } from "@/lib/swap/assets";
import { getChain } from "@/lib/chains/registry";
import type { OrderStage, SwapOrder } from "@/lib/swap/types";
import { formatUnits, unitsToNumber } from "@/lib/swap/units";
import { useSwapStore } from "@/stores/swapStore";
import { toast } from "@/stores/toastStore";
import { cn, formatAmount, formatUsd } from "@/lib/utils";
import { tokenAmount } from "./format";
import { isActive, STAGE_META } from "./stages";

/**
 * Takas emri detayı.
 *
 * Aşama çizelgesi emrin gerçek geçmişiyle çizilir; yatırma adresi, işlem
 * karması ve komisyon adresi kopyalanabilir ve gezginde açılabilir. Süren
 * emirler buradan iptal edilebilir, bitenler forma geri yüklenebilir.
 */

const FLOW: Record<EngineId, OrderStage[]> = {
  kyber: ["hazirlaniyor", "gonderildi", "isleniyor", "tamamlandi"],
  intents: ["hazirlaniyor", "yatirma-bekleniyor", "gonderildi", "isleniyor", "tamamlandi"],
};

function explorerTx(chainId: string, hash: string): string | null {
  const chain = getChain(chainId);
  if (!chain) return null;
  if (chainId === "tron") return `${chain.explorerUrl}/#/transaction/${hash}`;
  if (chainId === "ton") return `${chain.explorerUrl}/transaction/${hash}`;
  if (chainId === "ripple") return `${chain.explorerUrl}/transactions/${hash}`;
  return `${chain.explorerUrl}/tx/${hash}`;
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast($t("{0} kopyalandı", [label]), "success");
  } catch {
    toast($t("Kopyalanamadı — adresi elle seç"), "info");
  }
}

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function OrderDrawer({ order, onClose }: { order: SwapOrder; onClose: () => void }) {
  const cancelOrder = useSwapStore((s) => s.cancelOrder);
  const retryOrder = useSwapStore((s) => s.retryOrder);
  const removeOrder = useSwapStore((s) => s.removeOrder);

  const [now, setNow] = useState(() => Date.now());
  const active = isActive(order.stage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const meta = ENGINE_META[order.engine];
  const stage = STAGE_META[order.stage];
  const inUi = unitsToNumber(BigInt(order.amountIn), order.amountInDecimals);
  const outUi = unitsToNumber(BigInt(order.amountOut), order.amountOutDecimals);
  const minUi = unitsToNumber(BigInt(order.minAmountOut), order.amountOutDecimals);
  const trail = order.trail ?? [{ stage: order.stage, at: order.createdAt, text: order.statusText }];
  const reached = new Map(trail.map((t) => [t.stage, t]));
  const terminalBad = !active && order.stage !== "tamamlandi";
  const elapsed = Math.max(0, Math.round(((active ? now : order.updatedAt) - order.createdAt) / 1000));
  const txLink = order.txHash ? explorerTx(order.originChainId ?? order.fromChainId, order.txHash) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[92] flex justify-end bg-black/65 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={$t("Takas detayı")}
        className="flex h-full w-full max-w-[400px] animate-slide-in-right flex-col border-l border-white/[0.08] bg-surface-850 shadow-lift"
      >
        <header className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <span className="flex shrink-0 items-center">
            <TokenIcon
              symbol={order.fromSymbol}
              chainId={order.fromChainId}
              address={order.fromId.split(":")[1] === "native" ? undefined : order.fromId.split(":")[1]}
              size={30}
              badge
            />
            <TokenIcon
              symbol={order.toSymbol}
              chainId={order.toChainId}
              address={order.toId.split(":")[1] === "native" ? undefined : order.toId.split(":")[1]}
              size={30}
              badge
              className="-ml-2.5"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13px] font-semibold text-white">
              {order.fromSymbol} → {order.toSymbol}
            </h2>
            <p className="truncate text-[10px] text-zinc-500">
              {chainLabel(order.fromChainId)} → {chainLabel(order.toChainId)} · {clock(order.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={$t("Kapat")}
            className="focus-ring shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <section className={cn("rounded-xl border p-3", stage.border, stage.bg)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", stage.dot, active && "animate-pulse")} />
                <span className={cn("text-[12px] font-semibold", stage.text)}>{stage.label}</span>
              </span>
              <span className="tabular text-[10px] text-zinc-400">
                {active ? $t("{0} geçti", [formatEta(elapsed)]) : clock(order.updatedAt)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{order.statusText ?? "—"}</p>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/35">
              <div
                className={cn("h-full rounded-full transition-all duration-700", stage.dot)}
                style={{ width: `${stage.progress}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn("chip", meta.ring, meta.tint, meta.text)}>{meta.short}</span>
              <span className="chip">
                {$t("hedef süre")} {formatEta(order.etaSeconds)}
              </span>
              {order.simulated && (
                <span className="chip border-warning/25 bg-warning/[0.08] text-warning">
                  <Flask size={9} /> test
                </span>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-800/50">
            <AmountRow
              caption={$t("Verilen")}
              value={`${tokenAmount(inUi)} ${order.fromSymbol}`}
              usd={formatUsd(order.amountInUsd)}
            />
            <AmountRow
              caption={order.stage === "tamamlandi" ? $t("Alınan net") : $t("Beklenen net")}
              value={`${tokenAmount(outUi)} ${order.toSymbol}`}
              usd={formatUsd(order.amountOutUsd)}
              highlight
            />
          </section>

          <section>
            <h3 className="section-title mb-2">{$t("Aşamalar")}</h3>
            <ol className="relative space-y-0">
              {FLOW[order.engine].map((step, i, arr) => {
                const hit = reached.get(step);
                const isCurrent = order.stage === step;
                return (
                  <Step
                    key={step}
                    label={STAGE_META[step].label}
                    done={Boolean(hit)}
                    current={isCurrent && active}
                    text={hit?.text}
                    time={hit ? clock(hit.at) : undefined}
                    last={i === arr.length - 1 && !terminalBad}
                    tone={STAGE_META[step].dot}
                  />
                );
              })}
              {terminalBad && (
                <Step
                  label={stage.label}
                  done
                  text={order.error ?? order.statusText}
                  time={clock(order.updatedAt)}
                  last
                  tone={stage.dot}
                />
              )}
            </ol>
          </section>

          <section className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
            <Detail label={$t("Motor")} value={meta.name} />
            <Detail
              label={$t("Vexaris komisyonu · %{0}", [formatAmount(FEE_PERCENT, 2)])}
              value={formatUsd(order.feeUsd)}
              tone="text-warning"
            />
            <CopyDetail
              label={$t("Komisyon adresi")}
              value={order.feeRecipient}
              onCopy={() => void copy(order.feeRecipient, $t("Komisyon adresi"))}
            />
            <Detail
              label={$t("Ağ / teslim ücreti")}
              value={order.networkFeeUsd > 0 ? formatUsd(order.networkFeeUsd) : "—"}
            />
            <Detail label={$t("Kayma toleransı")} value={`%${formatAmount(order.slippagePct, 2)}`} />
            <Detail
              label={$t("Minimum garanti")}
              value={`${tokenAmount(minUi)} ${order.toSymbol}`}
            />
            <Detail
              label={$t("Tam sayı çıkış")}
              value={formatUnits(BigInt(order.amountOut), order.amountOutDecimals, 8)}
              mono
            />
            {order.depositAddress && (
              <CopyDetail
                label={$t("Yatırma adresi · {0}", [chainLabel(order.fromChainId)])}
                value={order.depositAddress}
                onCopy={() => void copy(order.depositAddress!, $t("Yatırma adresi"))}
              />
            )}
            {order.txHash && (
              <CopyDetail
                label={$t("İşlem karması")}
                value={order.txHash}
                onCopy={() => void copy(order.txHash!, $t("İşlem karması"))}
                href={txLink ?? undefined}
              />
            )}
            <Detail label={$t("Emir no")} value={order.id} mono />
          </section>

          {order.error && (
            <p className="rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[11px] leading-relaxed text-danger/90">
              {order.error}
            </p>
          )}

          {order.simulated && (
            <p className="rounded-xl border border-white/[0.06] bg-surface-800/50 px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
              {$t("Bu emir test yürütmesiyle oluşturuldu. Fiyat, rota ve komisyon gerçek kotasyondan alındı; zincire işlem gönderilmedi.")}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-white/[0.06] p-3">
          {active ? (
            <Button variant="danger" size="sm" className="flex-1" onClick={() => cancelOrder(order.id)}>
              <Prohibit size={13} /> {$t("İptal et")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                retryOrder(order.id);
                onClose();
              }}
            >
              <ArrowCounterClockwise size={13} /> {$t("Tekrar dene")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              removeOrder(order.id);
              onClose();
            }}
          >
            <Trash size={13} /> {$t("Sil")}
          </Button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function AmountRow({
  caption,
  value,
  usd,
  highlight,
}: {
  caption: string;
  value: string;
  usd: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5",
        highlight ? "bg-success/[0.05]" : "border-b border-white/[0.05]",
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{caption}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "tabular block truncate text-[13px] font-semibold",
            highlight ? "text-success" : "text-white",
          )}
        >
          {value}
        </span>
        <span className="tabular block text-[10px] text-zinc-600">{usd}</span>
      </span>
    </div>
  );
}

function Step({
  label,
  done,
  current,
  text,
  time,
  last,
  tone,
}: {
  label: string;
  done: boolean;
  current?: boolean;
  text?: string;
  time?: string;
  last?: boolean;
  tone: string;
}) {
  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {!last && (
        <span
          className={cn(
            "absolute left-[7px] top-4 h-full w-px",
            done ? "bg-white/[0.14]" : "bg-white/[0.06]",
          )}
        />
      )}
      <span
        className={cn(
          "relative z-10 mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border",
          done ? cn(tone, "border-transparent") : "border-white/[0.12] bg-surface-800",
          current && "ring-2 ring-white/15",
        )}
      >
        {done && <Check size={9} className="text-black/70" weight="bold" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("text-[11px]", done ? "font-medium text-zinc-100" : "text-zinc-600")}>
            {label}
          </span>
          {time && <span className="tabular shrink-0 text-[10px] text-zinc-600">{time}</span>}
        </span>
        {text && done && <span className="block text-[10px] leading-snug text-zinc-500">{text}</span>}
      </span>
    </li>
  );
}

function Detail({
  label,
  value,
  tone = "text-zinc-200",
  mono,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="shrink-0 text-[11px] text-zinc-500">{label}</span>
      <span
        className={cn("min-w-0 break-all text-right text-[11px]", mono ? "font-mono text-[10px]" : "tabular", tone)}
      >
        {value}
      </span>
    </div>
  );
}

function CopyDetail({
  label,
  value,
  onCopy,
  href,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  href?: string;
}) {
  return (
    <div className="px-3 py-2">
      <span className="block text-[11px] text-zinc-500">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className="min-w-0 flex-1 break-all font-mono text-[10px] leading-snug text-zinc-300">
          {value}
        </span>
        <button
          onClick={onCopy}
          title={$t("Kopyala")}
          aria-label={`${label} kopyala`}
          className="focus-ring shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Copy size={12} />
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title={$t("Gezginde aç")}
            aria-label={$t("Gezginde aç")}
            className="focus-ring shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-info"
          >
            <ArrowSquareOut size={12} />
          </a>
        )}
      </span>
    </div>
  );
}
