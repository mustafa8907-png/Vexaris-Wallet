import { useState, type ReactNode } from "react";
import {
  Alert,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code,
  Copy,
  Drawer,
  Refresh,
  Shield,
  Zap,
  cn,
} from "@/kit";
import { ArrowDownLeft, ExternalLink, Swap } from "@/kit/ext";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import { KIND_LABELS, STATUS_LABELS } from "@/stores/historyStore";
import type { TxRecord } from "@/lib/api/history";
import { getChain } from "@/lib/chains/registry";
import { isSpamToken } from "@/lib/assets/filters";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatAmount, formatUsd } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { t as $t } from "@/lib/i18n";

const KIND_ICON = {
  send: ArrowUpRight,
  receive: ArrowDownLeft,
  swap: Swap,
  approve: Shield,
  contract: Code,
  self: Refresh,
} as const;

const KIND_TONE = {
  send: "text-down bg-downsoft",
  receive: "text-up bg-upsoft",
  swap: "text-info bg-infosoft",
  approve: "text-warn bg-warnsoft",
  contract: "text-violet bg-violet/10",
  self: "text-teal bg-teal/10",
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
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="shrink-0 text-[11px] text-muted">{label}</span>
      <span className="min-w-0 text-right text-[12px] text-textsoft">{children}</span>
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
        "focus-ring group inline-flex max-w-full items-center gap-1.5 rounded text-left transition-colors hover:text-text",
        mono && "font-mono",
      )}
      title={$t("Kopyala")}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check size={11} className="shrink-0 text-up" />
      ) : (
        <Copy size={11} className="shrink-0 text-muted group-hover:text-textsoft" />
      )}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </div>
  );
}

interface Props {
  tx: TxRecord | null;
  onClose: () => void;
}

export function TxDetailDrawer({ tx, onClose }: Props) {
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const chain = tx ? getChain(tx.chainId) : null;
  const sign = tx?.direction === "in" ? "+" : tx?.direction === "out" ? "−" : "";

  return (
    <Drawer
      open={tx != null}
      onClose={onClose}
      title={$t("İşlem detayı")}
      footer={
        tx && (
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-ctrl bg-brand text-[13px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
          >
            {$t("Gezginde aç")} <ExternalLink size={14} />
          </a>
        )
      }
    >
      {!tx ? null : (
        <>
          <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface2/60 p-5">
            <div className="relative">
              <TokenIcon symbol={tx.symbol} chainId={tx.chainId} address={tx.tokenAddress} size={46} />
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-surface">
                <TxKindBadge tx={tx} size={20} />
              </span>
            </div>
            <div className="tabular mt-1 font-display text-[22px] font-semibold text-text">
              {hideBalance ? "••••" : `${sign}${formatAmount(tx.amount, 6)} ${tx.symbol}`}
            </div>
            <div className="tabular text-[12px] text-muted">
              {hideBalance ? "••••" : tx.usdValue > 0 ? formatUsd(tx.usdValue) : $t("Fiyat verisi yok")}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                {KIND_LABELS[tx.kind]}
              </span>
              <span
                className={cn(
                  "rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[9.5px] font-medium",
                  tx.status === "confirmed" && "text-up",
                  tx.status === "failed" && "text-down",
                  tx.status === "pending" && "text-warn",
                )}
              >
                {STATUS_LABELS[tx.status]}
              </span>
            </div>
          </div>

          {isSpamToken(tx.symbol) && (
            <Alert tone="danger" className="mt-4" title={$t("Şüpheli token")}>
              {$t("Bu token kimlik avı amaçlı olabilir: sembolü bilinen bir coinin benzer gliflerle taklidi ya da reklam metni içeriyor. Göndermeyin, içindeki bağlantılara gitmeyin ve sözleşmesine onay vermeyin.")}
            </Alert>
          )}

          <div className="mt-4">
            <SectionTitle>{$t("Zincir")}</SectionTitle>
            <Row label={$t("Ağ")}>
              <span className="inline-flex items-center gap-1.5">
                <ChainIcon chainId={tx.chainId} size={16} />
                {chain?.name ?? tx.chainId}
              </span>
            </Row>
            <Row label={$t("Tarih")}>
              {new Date(tx.timestamp).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
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
            <SectionTitle>{$t("Taraflar")}</SectionTitle>
            <Row label={$t("Gönderen")}>
              <span className="block">
                <CopyLine value={tx.from} />
                {tx.direction === "out" && (
                  <span className="mt-0.5 block text-[10px] text-brand">{$t("Bu cüzdan")}</span>
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
                  <span className="mt-0.5 block text-[10px] text-brand">{$t("Bu cüzdan")}</span>
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
              <SectionTitle>
                <Zap size={11} /> {$t("Ağ ücreti")}
              </SectionTitle>
              {tx.feeNative != null && (
                <Row label={$t("Ücret")}>
                  <span className="tabular">
                    {hideBalance ? "••••" : `${formatAmount(tx.feeNative, 8)} ${tx.feeSymbol}`}
                    {!hideBalance && tx.feeUsd ? <span className="ml-1.5 text-muted">≈ {formatUsd(tx.feeUsd)}</span> : null}
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
            <SectionTitle>
              <ArrowRight size={11} /> {$t("İşlem kimliği")}
            </SectionTitle>
            <div className="rounded-card border border-line bg-surface2/60 p-2.5 text-[11px]">
              <CopyLine value={tx.hash} />
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
