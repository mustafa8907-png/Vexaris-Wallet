import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader, Modal, Shield, Button, Alert as KitAlert } from "@/kit";
import { TokenIcon } from "@/components/TokenIcon";
import { ENGINE_META, FEE_PERCENT } from "@/lib/swap/config";
import { formatEta } from "@/lib/swap/intents";
import { chainLabel, type SwapAsset } from "@/lib/swap/assets";
import { screenPair, type TokenRisk } from "@/lib/api/security";
import type { SwapQuote } from "@/lib/swap/types";
import { unitsToNumber } from "@/lib/swap/units";
import { cn, formatAmount, formatPercent, formatUsd } from "@/lib/utils";
import { etaRange, tokenAmount } from "./format";


interface Props {
  quote: SwapQuote;
  from: SwapAsset;
  to: SwapAsset;
  refundTo: string;
  recipient: string;
  slippagePct: number;
  securityCheck: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSwap({
  quote,
  from,
  to,
  refundTo,
  recipient,
  slippagePct,
  securityCheck,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const meta = ENGINE_META[quote.engine];
  const inUi = unitsToNumber(quote.amountIn, from.decimals);
  const outUi = unitsToNumber(quote.amountOut, to.decimals);
  const minUi = unitsToNumber(quote.minAmountOut, to.decimals);
  const crossChain = from.chainId !== to.chainId;
  const [risks, setRisks] = useState<TokenRisk[] | null>(null);
  const [scanning, setScanning] = useState(securityCheck);

  useEffect(() => {
    if (!securityCheck) {
      setRisks(null);
      setScanning(false);
      return;
    }
    let alive = true;
    setScanning(true);
    setRisks(null);
    void screenPair([from, to]).then((list) => {
      if (!alive) return;
      setRisks(list);
      setScanning(false);
    });
    return () => {
      alive = false;
    };
  }, [securityCheck, from, to]);

  const blocked = risks?.some((r) => r.blocked) ?? false;

  return (
    <Modal
      open
      title={$t("Takası onayla")}
      description={`${meta.name} · ${meta.blurb}`}
      onClose={busy ? () => undefined : onClose}
      size="md"
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-card border border-line bg-surface2">
          <Leg
            caption={$t("Veriyorsun")}
            asset={from}
            amount={`${tokenAmount(inUi)} ${from.symbol}`}
            usd={formatUsd(quote.amountInUsd)}
          />
          <div className="relative h-px bg-line">
            <span className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-linestrong bg-surface">
              <KitArrowDown />
            </span>
          </div>
          <Leg
            caption={$t("Eline geçecek net")}
            asset={to}
            amount={`${tokenAmount(outUi)} ${to.symbol}`}
            usd={formatUsd(quote.amountOutUsd)}
            highlight
          />
        </div>

        {securityCheck && <SecurityNotice legs={[from, to]} risks={risks} scanning={scanning} />}

        <div className="divide-line divide-y overflow-hidden rounded-card border border-line">
          <Line label={$t("Kayma sonrası garanti")} value={`≥ ${tokenAmount(minUi)} ${to.symbol}`} />
          <Line
            label={$t("Ortalama süre")}
            value={formatEta(quote.etaSeconds)}
            hint={etaRange(quote.etaLow, quote.etaHigh, formatEta)}
          />
          <Line
            label={$t("Fiyat etkisi")}
            value={`${formatPercent(quote.priceImpactPct, 2)}%`}
            tone={quote.priceImpactPct <= -1.5 ? "text-warn" : "text-textsoft"}
          />
          <Line
            label={`Vexaris Wallet komisyonu · %${formatAmount(FEE_PERCENT, 2)}`}
            value={`− ${tokenAmount(unitsToNumber(quote.feeUnits, to.decimals))} ${to.symbol}`}
            hint={`${quote.feeRecipient} adresine gider`}
            tone="text-warn"
          />
          {quote.protocolFeeBps > 0 && (
            <Line
              label={$t("NEAR Intents protokol payı · %{0}", [formatAmount(quote.protocolFeeBps / 100, 2)])}
              value={`− ${formatUsd(quote.protocolFeeUsd)}`}
              tone="text-violet"
            />
          )}
          <Line
            label={$t("Ağ / teslim ücreti")}
            value={quote.networkFeeUsd > 0 ? `− ${formatUsd(quote.networkFeeUsd)}` : "—"}
          />
          <Line label={$t("Kayma toleransı")} value={`%${formatAmount(slippagePct, 2)}`} />
        </div>

        {quote.engine === "intents" && (
          <div className="divide-line divide-y overflow-hidden rounded-card border border-violet/25 bg-violet/5">
            <Line
              label={$t("İade adresi · {0}", [chainLabel(from.chainId)])}
              value={refundTo}
              monoHint
              hint={$t("Takas gerçekleşmezse fon bu adrese döner")}
            />
            <Line
              label={$t("Alıcı adresi · {0}", [chainLabel(to.chainId)])}
              value={recipient}
              monoHint
              hint={crossChain ? $t("Hedef zincirde teslim alınacak adres") : $t("Teslim alınacak adres")}
            />
          </div>
        )}

        {quote.priceImpactPct <= -1.5 && (
          <KitAlert tone="warning">
            {$t("Fiyat etkisi")} {formatPercent(quote.priceImpactPct, 2)}{$t("%. Bu tutarı bölmek daha iyi bir kur verebilir.")}
          </KitAlert>
        )}

        <div className="flex gap-2 pt-0.5">
          <Button variant="soft" className="flex-1" onClick={onClose} disabled={busy}>
            {$t("Vazgeç")}
          </Button>
          <Button className="flex-[1.6]" onClick={onConfirm} disabled={busy || blocked || scanning}>
            {busy ? (
              <>
                <Loader size={14} className="animate-spin" />
                {$t("Başlatılıyor…")}
              </>
            ) : blocked ? (
              <>
                <ShieldWarningIcon />
                {$t("Güvenlik engeli")}
              </>
            ) : scanning ? (
              <>
                <Loader size={14} className="animate-spin" />
                {$t("Denetleniyor…")}
              </>
            ) : (
              <>
                <Shield size={15} />
                {$t("Onayla ve takas et")}
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-muted">
          %{formatAmount(FEE_PERCENT, 2)} {$t("VexarisWallet komisyonu içerir.")}
        </p>
      </div>
    </Modal>
  );
}

function KitArrowDown() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14m0 0-6-6m6 6 6-6" />
    </svg>
  );
}

function ShieldWarningIcon() {
  return <AlertTriangle size={15} />;
}

function SecurityNotice({
  legs,
  risks,
  scanning,
}: {
  legs: SwapAsset[];
  risks: TokenRisk[] | null;
  scanning: boolean;
}) {
  if (scanning) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-line bg-surface2 px-3 py-2.5 text-[11px] text-textsoft">
        <Loader size={13} className="shrink-0 animate-spin" />
        {$t("GoPlus ile token sözleşmeleri denetleniyor…")}
      </div>
    );
  }
  if (!risks) return null;

  const rows = legs.map((leg, index) => ({ leg, risk: risks[index] }));
  const clean = rows.filter((row) => row.risk && row.risk.level === "safe");
  const unknown = rows.filter((row) => row.risk?.missing && row.leg.address);

  return (
    <div className="space-y-2">
      {rows
        .filter((row) => row.risk?.blocked)
        .map((row) => (
          <KitAlert key={`b-${row.leg.id}`} tone="danger" title={`${row.leg.symbol} · ${chainLabel(row.leg.chainId)} · ${$t("takas engellendi")}`}>
            {row.risk?.reasons.map((reason) => (
              <span key={reason} className="mt-0.5 block">
                {reason}
              </span>
            ))}
            <span className="mt-0.5 block text-[10px] text-danger/70">
              {$t("Vexaris Wallet bu tokenla fon hareketine izin vermez.")}
            </span>
          </KitAlert>
        ))}

      {rows
        .filter((row) => row.risk && !row.risk.blocked && row.risk.level === "warning")
        .map((row) => (
          <KitAlert key={`w-${row.leg.id}`} tone="warning" title={`${row.leg.symbol} · ${$t("dikkat")}`}>
            {row.risk?.reasons.map((reason) => (
              <span key={reason} className="mt-0.5 block">
                {reason}
              </span>
            ))}
          </KitAlert>
        ))}

      {(clean.length > 0 || unknown.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[10px] text-muted">
          {clean.length > 0 && (
            <span className="flex items-center gap-1 text-ok">
              <Check size={11} />
              {clean.map((row) => row.leg.symbol).join(", ")} {$t(": honeypot ve satış kilidi temiz")}
            </span>
          )}
          {unknown.map((row) => (
            <span key={`u-${row.leg.id}`} className="flex items-center gap-1">
              <AlertTriangle size={11} />
              {row.leg.symbol} {$t("için güvenlik verisi yok")}
            </span>
          ))}
          <span className="text-muted">GoPlus Labs</span>
        </div>
      )}
    </div>
  );
}

function Leg({
  caption,
  asset,
  amount,
  usd,
  highlight,
}: {
  caption: string;
  asset: SwapAsset;
  amount: string;
  usd: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5 py-3", highlight && "bg-ok/5")}>
      <TokenIcon symbol={asset.symbol} chainId={asset.chainId} address={asset.address} size={34} badge />
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">{caption}</span>
        <span
          className={cn(
            "tabular block truncate font-display text-[17px] font-semibold leading-tight",
            highlight ? "text-ok" : "text-text",
          )}
        >
          {amount}
        </span>
        <span className="block truncate text-[10px] text-muted">
          {chainLabel(asset.chainId)} · {usd}
        </span>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  hint,
  tone = "text-textsoft",
  monoHint,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  monoHint?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="min-w-0 shrink">
        <span className="block text-[11px] text-textsoft">{label}</span>
        {hint && <span className="block truncate text-[10px] text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          "tabular max-w-[52%] break-all text-right text-[11px]",
          monoHint && "font-mono text-[10px]",
          tone,
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
