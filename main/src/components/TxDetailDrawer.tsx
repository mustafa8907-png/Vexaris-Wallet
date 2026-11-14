import { t as $t } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDownLeft, ArrowsLeftRight, ArrowUpRight, Check, Copy, ArrowSquareOut, FileCode, GasPump, Hash, Repeat, ShieldWarning, ShieldCheck, X } from "@phosphor-icons/react";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import { KIND_LABELS, STATUS_LABELS } from "@/stores/historyStore";
import type { TxRecord } from "@/lib/api/history";
import { getChain } from "@/lib/chains/registry";
import { isSpamToken } from "@/lib/assets/filters";
import { formatAmount, formatUsd, cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";

const KIND_ICON = {
  send: ArrowUpRight,
  receive: ArrowDownLeft,
  swap: ArrowsLeftRight,
  approve: ShieldCheck,
  contract: FileCode,
  self: Repeat,
} as const;

const KIND_TONE = {
  send: "text-down bg-down/[0.1]",
  receive: "text-up bg-up/[0.1]",
  swap: "text-info bg-info/[0.1]",
  approve: "text-warning bg-warning/[0.1]",
  contract: "text-violet bg-violet/[0.1]",
  self: "text-teal bg-teal/[0.1]",
} as const;

export function TxKindBadge({ tx, size = 34 }: { tx: TxRecord; size?: number }) {
  const Icon = KIND_ICON[tx.kind];
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full", KIND_TONE[tx.kind])}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.44)} />
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="shrink-0 text-[11px] text-zinc-500">{label}</span>
      <span className="min-w-0 text-right text-[12px] text-zinc-200">{children}</span>
    </div>
  );
}

function CopyLine({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        toast($t("Kopyalandı"), "success");
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className={cn(
        "focus-ring group inline-flex max-w-full items-center gap-1.5 rounded text-left transition-colors hover:text-white",
        mono && "font-mono",
      )}
      title={$t("Kopyala")}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check size={11} className="shrink-0 text-up" />
      ) : (
        <Copy size={11} className="shrink-0 text-zinc-600 group-hover:text-zinc-300" />
      )}
    </button>
  );
}

interface Props {
  tx: TxRecord | null;
  onClose: () => void;
}

export function TxDetailDrawer({ tx, onClose }: Props) {
  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tx, onClose]);

  if (!tx) return null;
  const chain = getChain(tx.chainId);
  const sign = tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex justify-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={$t("İşlem detayı")}
        className="flex h-full w-full max-w-md animate-slide-in-right flex-col border-l border-white/[0.08] bg-surface-900 shadow-lift"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <span className="text-[13px] font-semibold text-white">{$t("İşlem detayı")}</span>
          <button
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-zinc-500 transition-colors hover:text-white"
            aria-label={$t("Kapat")}
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col items-center gap-2 rounded-xl2 border border-white/[0.06] bg-mesh-brand p-5">
            <div className="relative">
              <TokenIcon
                symbol={tx.symbol}
                chainId={tx.chainId}
                address={tx.tokenAddress}
                size={46}
              />
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-surface-900">
                <TxKindBadge tx={tx} size={20} />
              </span>
            </div>
            <div className="tabular mt-1 text-[22px] font-semibold text-white">
              {sign}
              {formatAmount(tx.amount, 6)} {tx.symbol}
            </div>
            <div className="tabular text-[12px] text-zinc-400">
              {tx.usdValue > 0 ? formatUsd(tx.usdValue) : $t("Fiyat verisi yok")}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="chip">{KIND_LABELS[tx.kind]}</span>
              <span
                className={cn(
                  "chip",
                  tx.status === "confirmed" && "text-up",
                  tx.status === "failed" && "text-down",
                  tx.status === "pending" && "text-warning",
                )}
              >
                {STATUS_LABELS[tx.status]}
              </span>
            </div>
          </div>

          {isSpamToken(tx.symbol) && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] p-3 text-[11px] leading-relaxed text-danger/90">
              <ShieldWarning size={14} className="mt-px shrink-0" />
              <span>
                {$t("Bu token kimlik avı amaçlı olabilir: sembolü bilinen bir coinin benzer gliflerle taklidi ya da reklam metni içeriyor. Göndermeyin, içindeki bağlantılara gitmeyin ve sözleşmesine onay vermeyin.")}
              </span>
            </div>
          )}

          <div className="mt-4">
            <div className="section-title">{$t("Zincir")}</div>
            <Row label={$t("Ağ")}>
              <span className="inline-flex items-center gap-1.5">
                <ChainIcon chainId={tx.chainId} size={16} />
                {chain?.name ?? tx.chainId}
              </span>
            </Row>
            <Row label={$t("Tarih")}>
              {new Date(tx.timestamp).toLocaleString("tr-TR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </Row>
            {tx.blockNumber != null && (
              <Row label={$t("Blok")}>
                <span className="tabular">{tx.blockNumber.toLocaleString("tr-TR")}</span>
              </Row>
            )}
            {tx.confirmations != null && (
              <Row label={$t("Onay")}>
                <span className="tabular">{tx.confirmations.toLocaleString("tr-TR")}</span>
              </Row>
            )}
            {tx.nonce != null && (
              <Row label="Nonce">
                <span className="tabular">{tx.nonce}</span>
              </Row>
            )}
            {tx.methodLabel && <Row label={$t("Yöntem")}>{tx.methodLabel}</Row>}
          </div>

          <div className="mt-4">
            <div className="section-title">{$t("Taraflar")}</div>
            <Row label={$t("Gönderen")}>
              <span className="block">
                <CopyLine value={tx.from} />
                {tx.direction === "out" && (
                  <span className="mt-0.5 block text-[10px] text-accent">{$t("Bu cüzdan")}</span>
                )}
              </span>
            </Row>
            <Row label={$t("Alıcı")}>
              <span className="block">
                <CopyLine value={tx.to || "—"} />
                {tx.counterpartyLabel && (
                  <span className="mt-0.5 block text-[10px] text-info">{tx.counterpartyLabel}</span>
                )}
                {tx.direction === "in" && (
                  <span className="mt-0.5 block text-[10px] text-accent">{$t("Bu cüzdan")}</span>
                )}
              </span>
            </Row>
            {tx.tokenAddress && (
              <Row label={$t("Sözleşme")}>
                <CopyLine value={tx.tokenAddress} />
              </Row>
            )}
          </div>

          {(tx.feeNative != null || tx.gasUsed != null) && (
            <div className="mt-4">
              <div className="section-title">
                <GasPump size={11} className="mr-1 inline" /> {$t("Ağ ücreti")}
              </div>
              {tx.feeNative != null && (
                <Row label={$t("Ücret")}>
                  <span className="tabular">
                    {formatAmount(tx.feeNative, 8)} {tx.feeSymbol}
                    {tx.feeUsd ? (
                      <span className="ml-1.5 text-zinc-500">≈ {formatUsd(tx.feeUsd)}</span>
                    ) : null}
                  </span>
                </Row>
              )}
              {tx.gasUsed != null && (
                <Row label="Gas">
                  <span className="tabular">{tx.gasUsed.toLocaleString("tr-TR")}</span>
                </Row>
              )}
              {tx.gasPriceGwei != null && (
                <Row label={$t("Gas fiyatı")}>
                  <span className="tabular">{tx.gasPriceGwei.toFixed(3)} Gwei</span>
                </Row>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className="section-title">
              <Hash size={11} className="mr-1 inline" /> {$t("İşlem kimliği")}
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-surface-850 p-2.5 text-[11px]">
              <CopyLine value={tx.hash} />
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/[0.06] p-4">
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {$t("Gezginde aç")} <ArrowSquareOut size={14} />
          </a>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
