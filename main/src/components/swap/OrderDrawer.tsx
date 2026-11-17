import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Check, Copy, Refresh, Trash, X } from "@/kit";
import { ExternalLink } from "@/kit/ext";
import { TokenIcon } from "@/components/TokenIcon";
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


const FLOW: Record<EngineId, OrderStage[]> = {
  kyber: ["hazirlaniyor", "gonderildi", "isleniyor", "tamamlandi"],
  intents: ["hazirlaniyor", "yatirma-bekleniyor", "gonderildi", "isleniyor", "tamamlandi"],
};

function engineBadge(engine: EngineId): string {
  return engine === "kyber"
    ? "border-teal/30 bg-teal/10 text-teal"
    : "border-violet/30 bg-violet/10 text-violet";
}

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
      className="fixed inset-0 z-[92] flex justify-end bg-bg/75 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={$t("Takas detayı")}
        className="flex h-full w-full max-w-[400px] animate-slide-in-right flex-col border-l border-line bg-surface shadow-2"
      >
        <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
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
            <h2 className="truncate text-[13px] font-semibold text-text">
              {order.fromSymbol} → {order.toSymbol}
            </h2>
            <p className="truncate text-[10px] text-muted">
              {chainLabel(order.fromChainId)} → {chainLabel(order.toChainId)} · {clock(order.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={$t("Kapat")}
            className="grid size-8 shrink-0 place-items-center rounded-ctrl text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <section className={cn("rounded-card border p-3", stage.border, stage.bg)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", stage.dot, active && "animate-pulse")} />
                <span className={cn("text-[12px] font-semibold", stage.text)}>{stage.label}</span>
              </span>
              <span className="tabular text-[10px] text-textsoft">
                {active ? $t("{0} geçti", [formatEta(elapsed)]) : clock(order.updatedAt)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-textsoft">{order.statusText ?? "—"}</p>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface3">
              <div
                className={cn("h-full rounded-full transition-all duration-700", stage.dot)}
                style={{ width: `${stage.progress}%` }}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge size="sm" className={cn("font-medium", engineBadge(order.engine))}>
                {meta.short}
              </Badge>
              <Badge size="sm">{`${$t("hedef süre")} ${formatEta(order.etaSeconds)}`}</Badge>
              {order.simulated && (
                <Badge size="sm" tone="warning" className="font-medium">
                  test
                </Badge>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-card border border-line">
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
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {$t("Aşamalar")}
            </h3>
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

          <section className="divide-line divide-y overflow-hidden rounded-card border border-line">
            <Detail label={$t("Motor")} value={meta.name} />
            <Detail
              label={$t("Vexaris komisyonu · %{0}", [formatAmount(FEE_PERCENT, 2)])}
              value={formatUsd(order.feeUsd)}
              tone="text-warn"
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
            <p className="rounded-card border border-danger/25 bg-danger/5 px-3 py-2 text-[11px] leading-relaxed text-danger">
              {order.error}
            </p>
          )}

          {order.simulated && (
            <p className="rounded-card border border-line bg-surface2 px-3 py-2 text-[10px] leading-relaxed text-muted">
              {$t("Bu emir test yürütmesiyle oluşturuldu. Fiyat, rota ve komisyon gerçek kotasyondan alındı; zincire işlem gönderilmedi.")}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          {active ? (
            <Button size="sm" tone="danger" variant="soft" className="flex-1" iconLeft={<X size={13} />} onClick={() => cancelOrder(order.id)}>
              {$t("İptal et")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="soft"
              className="flex-1"
              iconLeft={<Refresh size={13} />}
              onClick={() => {
                retryOrder(order.id);
                onClose();
              }}
            >
              {$t("Tekrar dene")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<Trash size={13} />}
            onClick={() => {
              removeOrder(order.id);
              onClose();
            }}
          >
            {$t("Sil")}
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
        highlight ? "bg-ok/5" : "border-b border-line",
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{caption}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "tabular block truncate text-[13px] font-semibold",
            highlight ? "text-ok" : "text-text",
          )}
        >
          {value}
        </span>
        <span className="tabular block text-[10px] text-muted">{usd}</span>
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
            done ? "bg-linestrong" : "bg-line",
          )}
        />
      )}
      <span
        className={cn(
          "relative z-10 mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full border",
          done ? cn(tone, "border-transparent") : "border-line bg-surface2",
          current && "ring-2 ring-linestrong",
        )}
      >
        {done && <Check size={9} className="text-bg" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("text-[11px]", done ? "font-medium text-text" : "text-muted")}>
            {label}
          </span>
          {time && <span className="tabular shrink-0 text-[10px] text-muted">{time}</span>}
        </span>
        {text && done && <span className="block text-[10px] leading-snug text-textsoft">{text}</span>}
      </span>
    </li>
  );
}

function Detail({
  label,
  value,
  tone = "text-textsoft",
  mono,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="shrink-0 text-[11px] text-muted">{label}</span>
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
      <span className="block text-[11px] text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className="min-w-0 flex-1 break-all font-mono text-[10px] leading-snug text-textsoft">
          {value}
        </span>
        <button
          onClick={onCopy}
          title={$t("Kopyala")}
          aria-label={`${label} kopyala`}
          className="grid size-6 shrink-0 place-items-center rounded-ctrl text-muted transition-colors hover:bg-surface2 hover:text-text"
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
            className="grid size-6 shrink-0 place-items-center rounded-ctrl text-muted transition-colors hover:bg-surface2 hover:text-info"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </span>
    </div>
  );
}
