import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Warning, ArrowDown, Flask, ShieldWarning, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TokenIcon } from "@/components/TokenIcon";
import { ENGINE_META, FEE_PERCENT } from "@/lib/swap/config";
import { formatEta } from "@/lib/swap/intents";
import { chainLabel, type SwapAsset } from "@/lib/swap/assets";
import { screenPair, type TokenRisk } from "@/lib/api/security";
import type { SwapQuote } from "@/lib/swap/types";
import { unitsToNumber } from "@/lib/swap/units";
import { cn, formatAmount, formatPercent, formatUsd } from "@/lib/utils";
import { etaRange, tokenAmount } from "./format";

/**
 * Takas onayı.
 *
 * Kullanıcı imzalamadan önce tam olarak ne vereceğini, eline net ne
 * geçeceğini, komisyonun hangi adrese gideceğini ve işlemin ne kadar süreceğini
 * tek ekranda görür. İki bacak da GoPlus ile honeypot, satış kilidi ve vergi
 * açısından denetlenir; denetim takasın yapılamaz olduğunu söylerse onay
 * düğmesi kilitlenir.
 */

interface Props {
  quote: SwapQuote;
  from: SwapAsset;
  to: SwapAsset;
  refundTo: string;
  recipient: string;
  slippagePct: number;
  testMode: boolean;
  /** Kapalıyken GoPlus denetimi atlanır; yürütme kapısı da devre dışı kalır. */
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
  testMode,
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
      title={testMode ? $t("Test takasını onayla") : $t("Takası onayla")}
      description={`${meta.name} · ${meta.blurb}`}
      onClose={busy ? () => undefined : onClose}
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-surface-800/60">
          <Leg
            caption="Veriyorsun"
            asset={from}
            amount={`${tokenAmount(inUi)} ${from.symbol}`}
            usd={formatUsd(quote.amountInUsd)}
          />
          <div className="relative h-px bg-white/[0.06]">
            <span className="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/[0.09] bg-surface-700">
              <ArrowDown size={12} className={meta.text} />
            </span>
          </div>
          <Leg
            caption="Eline geçecek net"
            asset={to}
            amount={`${tokenAmount(outUi)} ${to.symbol}`}
            usd={formatUsd(quote.amountOutUsd)}
            highlight
          />
        </div>

        {securityCheck && <SecurityNotice legs={[from, to]} risks={risks} scanning={scanning} />}

        <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
          <Line label={$t("Kayma sonrası garanti")} value={`≥ ${tokenAmount(minUi)} ${to.symbol}`} />
          <Line
            label={$t("Ortalama süre")}
            value={formatEta(quote.etaSeconds)}
            hint={etaRange(quote.etaLow, quote.etaHigh, formatEta)}
          />
          <Line
            label={$t("Fiyat etkisi")}
            value={`${formatPercent(quote.priceImpactPct, 2)}%`}
            tone={quote.priceImpactPct <= -1.5 ? "text-warning" : "text-zinc-200"}
          />
          <Line
            label={`Vexaris Wallet komisyonu · %${formatAmount(FEE_PERCENT, 2)}`}
            value={`− ${tokenAmount(unitsToNumber(quote.feeUnits, to.decimals))} ${to.symbol}`}
            hint={`${quote.feeRecipient} adresine gider`}
            tone="text-warning"
            monoHint
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
          <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-violet/20 bg-violet/[0.04]">
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
          <Alert tone="warning">
            {$t("Fiyat etkisi")} {formatPercent(quote.priceImpactPct, 2)}{$t("%. Bu tutarı bölmek daha iyi bir kur verebilir.")}
          </Alert>
        )}
        {testMode && (
          <Alert tone="warning" icon={<Flask size={13} />}>
            {$t("Test yürütmesi açık: fiyat ve rota gerçek, imza ve fon hareketi yok. Emir “test” olarak kaydedilir.")}
          </Alert>
        )}

        <div className="flex gap-2 pt-0.5">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {$t("Vazgeç")}
          </Button>
          <Button className="flex-[1.6]" onClick={onConfirm} disabled={busy || blocked || scanning}>
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {$t("Başlatılıyor…")}
              </>
            ) : blocked ? (
              <>
                <ShieldWarning size={15} />
                {$t("Güvenlik engeli")}
              </>
            ) : scanning ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {$t("Denetleniyor…")}
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                {testMode ? $t("Test takasını başlat") : $t("Onayla ve takas et")}
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-zinc-500/60">
          %{formatAmount(FEE_PERCENT, 2)} {$t("VexarisWallet komisyonu içerir.")}
        </p>
      </div>
    </Modal>
  );
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
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-surface-800/60 px-3 py-2.5 text-[11px] text-zinc-400">
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
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
          <Alert key={`b-${row.leg.id}`} tone="danger" icon={<ShieldWarning size={13} />}>
            <span className="block font-semibold">
              {row.leg.symbol} · {chainLabel(row.leg.chainId)} · {$t("takas engellendi")}
            </span>
            {row.risk?.reasons.map((reason) => (
              <span key={reason} className="mt-0.5 block">
                {reason}
              </span>
            ))}
            <span className="mt-0.5 block text-[10px] text-danger/70">
              {$t("Vexaris Wallet bu tokenla fon hareketine izin vermez.")}
            </span>
          </Alert>
        ))}

      {rows
        .filter((row) => row.risk && !row.risk.blocked && row.risk.level === "warning")
        .map((row) => (
          <Alert key={`w-${row.leg.id}`} tone="warning" icon={<ShieldWarning size={13} />}>
            <span className="block font-semibold">
              {row.leg.symbol} · {$t("dikkat")}
            </span>
            {row.risk?.reasons.map((reason) => (
              <span key={reason} className="mt-0.5 block">
                {reason}
              </span>
            ))}
          </Alert>
        ))}

      {(clean.length > 0 || unknown.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[10px] text-zinc-500">
          {clean.length > 0 && (
            <span className="flex items-center gap-1 text-success/80">
              <ShieldCheck size={11} />
              {clean.map((row) => row.leg.symbol).join(", ")} {$t(": honeypot ve satış kilidi temiz")}
            </span>
          )}
          {unknown.map((row) => (
            <span key={`u-${row.leg.id}`} className="flex items-center gap-1">
              <ShieldWarning size={11} />
              {row.leg.symbol} {$t("için güvenlik verisi yok")}
            </span>
          ))}
          <span>GoPlus Labs</span>
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
    <div className={cn("flex items-center gap-3 px-3.5 py-3", highlight && "bg-success/[0.05]")}>
      <TokenIcon symbol={asset.symbol} chainId={asset.chainId} address={asset.address} size={34} badge />
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">{caption}</span>
        <span
          className={cn(
            "tabular block truncate text-[17px] font-semibold leading-tight",
            highlight ? "text-success" : "text-white",
          )}
        >
          {amount}
        </span>
        <span className="block truncate text-[10px] text-zinc-600">
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
  tone = "text-zinc-200",
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
        <span className="block text-[11px] text-zinc-400">{label}</span>
        {hint && <span className="block truncate text-[10px] text-zinc-600">{hint}</span>}
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

function Alert({
  tone,
  icon = <Warning size={13} />,
  children,
}: {
  tone: "warning" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
        tone === "warning"
          ? "border-warning/25 bg-warning/[0.07] text-warning/90"
          : "border-danger/25 bg-danger/[0.07] text-danger/90",
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
