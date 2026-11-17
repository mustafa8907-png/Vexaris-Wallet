import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Button,
  Card,
  Check,
  Copy,
  Info,
  Input,
  Loader,
  Segmented,
  cn,
} from "@/kit";
import { ExternalLink, HighlightedAddress, Send } from "@/kit/ext";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import { useChainStore } from "@/stores/chainStore";
import { getChain } from "@/lib/chains/registry";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";
import { txExplorerUrl } from "@/lib/api/history";
import { resolveEnsName, looksLikeEnsName } from "@/lib/api/ens";
import {
  estimateTransferTiers,
  sendTransfer,
  waitReceipt,
  type TransferTiers,
} from "@/lib/swap/execute";
import { parseUnits, plainNumber, sanitizeAmount, unitsToNumber } from "@/lib/swap/units";
import { formatAmount, formatUsd, shortAddress } from "@/lib/utils";
import type { Chain, TokenAmount } from "@/types/chain";

const EMPTY: TokenAmount[] = [];

interface AssetOption {
  key: string;
  symbol: string;
  name: string;
  decimals: number;
  amount: number;
  price?: number;
  address?: string;
  iconSymbol: string;
}

type TxStatus = "pending" | "confirmed" | "failed";
type Step = "form" | "review" | "result";
type TierKey = "slow" | "normal" | "fast";

const TIER_LABELS: Record<TierKey, string> = {
  slow: $t("Yavaş"),
  normal: $t("Normal"),
  fast: $t("Hızlı"),
};

function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function assetsFor(chain: Chain | undefined, balances: TokenAmount[]): AssetOption[] {
  if (!chain) return [];
  const native = balances.find((b) => !b.address);
  const list: AssetOption[] = [
    {
      key: "native",
      symbol: chain.nativeSymbol,
      name: chain.name,
      decimals: native?.decimals ?? 18,
      amount: native?.amount ?? 0,
      price: native?.price,
      iconSymbol: chain.iconSymbol,
    },
  ];
  for (const b of balances) {
    if (!b.address || b.amount <= 0) continue;
    list.push({
      key: b.address.toLowerCase(),
      symbol: b.tokenSymbol,
      name: b.name ?? b.tokenSymbol,
      decimals: b.decimals ?? 18,
      amount: b.amount,
      price: b.price,
      address: b.address,
      iconSymbol: b.tokenSymbol,
    });
  }
  return list;
}

export function SendPage() {
  const navigate = useNavigate();
  const activeChainId = useChainStore((s) => s.activeChainId);
  const wallet = useWalletStore((s) => s.wallet);
  const chain = getChain(activeChainId);
  const balances = usePortfolioStore((s) => s.balances[activeChainId] ?? EMPTY);

  const sendable = chain?.kind === "evm";
  const assets = useMemo(() => assetsFor(chain, balances), [chain, balances]);

  const [step, setStep] = useState<Step>("form");
  const [assetKey, setAssetKey] = useState("native");
  const asset = assets.find((a) => a.key === assetKey) ?? assets[0];

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});
  const [busy, setBusy] = useState(false);
  const [tiers, setTiers] = useState<TransferTiers | null>(null);
  const [tierKey, setTierKey] = useState<TierKey>("normal");
  const [hash, setHash] = useState<string | null>(null);
  const [status, setStatus] = useState<TxStatus>("pending");

  const tier = tiers?.tiers.find((t) => t.key === tierKey) ?? tiers?.tiers[1] ?? null;
  const feeUnits = tier?.feeUnits ?? null;
  const feeNative = feeUnits == null ? null : unitsToNumber(feeUnits, 18);
  const nativePrice = balances.find((b) => !b.address)?.price;

  const typed = to.trim();
  const ensName = sendable && looksLikeEnsName(typed) ? typed.toLowerCase() : "";
  const [ensAddress, setEnsAddress] = useState<string | null>(null);
  const [ensResolving, setEnsResolving] = useState(false);
  const target = ensName ? (ensAddress ?? "") : typed;

  useEffect(() => {
    if (!ensName) {
      setEnsAddress(null);
      setEnsResolving(false);
      return;
    }
    let cancelled = false;
    setEnsResolving(true);
    setEnsAddress(null);
    const timer = setTimeout(() => {
      void resolveEnsName(ensName).then((address) => {
        if (cancelled) return;
        setEnsAddress(address);
        setEnsResolving(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ensName]);

  const amountUnits = useMemo(
    () => parseUnits(amount, asset?.decimals ?? 18),
    [amount, asset?.decimals],
  );

  useEffect(() => {
    setTiers(null);
    if (!sendable || !wallet?.address || !asset) return;
    if (amountUnits <= 0n || !isEvmAddress(target)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      estimateTransferTiers({
        chainId: activeChainId,
        sender: wallet.address,
        to: target,
        amountUnits,
        token: asset.address,
      })
        .then((next) => {
          if (!cancelled) setTiers(next);
        })
        .catch(() => {
          if (!cancelled) setTiers(null);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sendable, activeChainId, wallet?.address, asset, amountUnits, target]);

  function validate() {
    const errs: typeof errors = {};
    if (sendable && !isEvmAddress(target))
      errs.to = ensName
        ? ensResolving
          ? $t("Ad çözümleniyor…")
          : $t("{0} için kayıtlı adres bulunamadı", [ensName])
        : $t("Geçerli bir adres gir (0x…)");
    if (amountUnits <= 0n) errs.amount = $t("Sıfırdan büyük bir miktar gir");
    else if (!asset) errs.amount = $t("Gönderilecek varlığı seç");
    else {
      const value = unitsToNumber(amountUnits, asset.decimals);
      if (value > asset.amount) errs.amount = $t("Bakiye yetersiz");
      else if (!asset.address && feeUnits != null && value + unitsToNumber(feeUnits, 18) > asset.amount)
        errs.amount = $t("Ağ ücreti için yeterli {0} kalmıyor", [asset.symbol]);
    }
    return errs;
  }

  function applyMax() {
    if (!asset) return;
    const reserve: bigint = asset.address ? 0n : (feeUnits ?? 0n);
    const room = Math.max(0, asset.amount - unitsToNumber(reserve, 18));
    setAmount(plainNumber(room, asset.decimals));
    setErrors((e) => ({ ...e, amount: undefined }));
  }

  function continueToReview() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep("review");
  }

  async function submit() {
    if (!chain || !wallet?.address || !asset || amountUnits <= 0n) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setStep("form");
      return;
    }

    setBusy(true);
    try {
      const txHash = await sendTransfer(
        {
          chainId: activeChainId,
          sender: wallet.address,
          to: target,
          amountUnits,
          token: asset.address,
        },
        tier ? { maxFeePerGasHex: tier.maxFeePerGasHex, maxPriorityFeeHex: tier.maxPriorityFeeHex } : undefined,
      );
      setHash(txHash);
      setStatus("pending");
      setStep("result");
      toast($t("İşlem gönderildi"), "success");

      const outcome = await waitReceipt(chain, txHash, 120_000).catch(() => null);
      if (outcome) {
        setStatus(outcome);
        toast(
          outcome === "confirmed" ? $t("İşlem onaylandı") : $t("İşlem zincirde başarısız oldu"),
          outcome === "confirmed" ? "success" : "error",
        );
      }
    } catch (e) {
      toast(messageOf(e), "error");
      setBusy(false);
      return;
    }
    setBusy(false);
    void usePortfolioStore.getState().refresh(wallet.address, true);
  }

  function reset() {
    setStep("form");
    setHash(null);
    setAmount("");
    setTo("");
    setTiers(null);
    setTierKey("normal");
    setErrors({});
  }

  const amountNumber = asset ? unitsToNumber(amountUnits, asset.decimals) : 0;
  const amountUsd = asset?.price != null && amountNumber > 0 ? amountNumber * asset.price : null;
  const feeUsd = feeNative != null && nativePrice != null ? feeNative * nativePrice : null;
  const totalNative =
    asset && !asset.address && feeNative != null ? amountNumber + feeNative : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-md px-3 pb-10 pt-4 sm:px-5">
        {step !== "result" && (
          <button
            onClick={() => (step === "review" ? setStep("form") : navigate("/"))}
            className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-xs text-muted transition-colors hover:text-text"
          >
            <ArrowLeft size={13} /> {step === "review" ? $t("Forma dön") : $t("Portföy")}
          </button>
        )}

        <h1 className="mb-1 font-display text-lg font-semibold tracking-tight text-text">
          {step === "review" ? $t("Gönderimi onayla") : $t("Gönder")}
        </h1>
        <p className="mb-4 text-[11px] text-muted">
          {step === "form" && $t("Adım 1 — varlık, alıcı ve tutar")}
          {step === "review" && $t("Adım 2 — detayları kontrol et")}
          {step === "result" && $t("Adım 3 — sonuç")}
        </p>

        {step === "form" && (
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between rounded-card border border-line bg-surface2/60 px-3 py-2.5">
              <span className="text-xs text-muted">{$t("Ağ")}</span>
              <span className="flex items-center gap-2 text-[13px] text-textsoft">
                <ChainIcon chainId={activeChainId} size={18} />
                {chain?.name}
              </span>
            </div>

            {!sendable && (
              <Alert tone="warning" title={$t("Bu ağda doğrudan gönderim kapalı")}>
                {$t("{0} ağında doğrudan gönderim henüz açık değil.", [chain?.name ?? ""])}{" "}
                <button
                  onClick={() => navigate("/swap")}
                  className="focus-ring rounded underline underline-offset-2 transition-colors hover:text-text"
                >
                  {$t("Takas ekranını kullan.")}
                </button>
              </Alert>
            )}

            {assets.length > 1 && (
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {assets.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAssetKey(a.key)}
                    className={cn(
                      "focus-ring flex shrink-0 items-center gap-1.5 rounded-ctrl border px-2.5 py-2 text-[12px] transition-colors",
                      a.key === asset?.key
                        ? "border-brand/45 bg-brandsoft text-text"
                        : "border-line bg-surface2/60 text-muted hover:border-linestrong hover:text-text",
                    )}
                  >
                    <TokenIcon symbol={a.iconSymbol} chainId={activeChainId} address={a.address} size={16} />
                    {a.symbol}
                    <span className="tabular text-[10px] opacity-70">{formatAmount(a.amount, 4)}</span>
                  </button>
                ))}
              </div>
            )}

            <div>
              <Input
                label={$t("Alıcı adresi")}
                placeholder={$t("0x… veya ad.eth")}
                spellCheck={false}
                autoComplete="off"
                inputMode="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                error={errors.to}
                disabled={!sendable}
                iconLeft={<Send size={13} />}
              />
              {ensName && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                  {ensResolving ? (
                    <>
                      <Loader size={11} className="animate-spin" />
                      {$t("adres çözülüyor…")}
                    </>
                  ) : ensAddress ? (
                    <>
                      <Check size={11} className="shrink-0 text-ok" />
                      <span className="truncate font-mono text-[10px] text-textsoft">{ensAddress}</span>
                      <span className="shrink-0">· {$t("ENS, ana ağdan okundu")}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={11} className="shrink-0 text-warn" />
                      {$t("bu ad için kayıtlı adres yok")}
                    </>
                  )}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-textsoft">
                  {$t("Miktar")}
                  {asset && (
                    <span className="ml-1.5 font-normal text-muted">
                      · {formatAmount(asset.amount, 6)} {asset.symbol}
                    </span>
                  )}
                </span>
                {asset && (
                  <button
                    onClick={applyMax}
                    disabled={!sendable}
                    className="focus-ring rounded text-[11px] font-medium text-brand transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {$t("Maks")}
                  </button>
                )}
              </div>
              <Input
                placeholder="0.0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmount(e.target.value, asset?.decimals ?? 18))}
                error={errors.amount}
                disabled={!sendable}
                iconRight={asset ? <span className="pr-0.5 text-[11px] font-medium text-muted">{asset.symbol}</span> : undefined}
              />
              {amountUsd != null && !errors.amount && (
                <p className="tabular mt-1.5 text-[11px] text-muted">≈ {formatUsd(amountUsd)}</p>
              )}
            </div>

            <div className="rounded-card border border-line bg-surface2/60 p-3">
              {tiers ? (
                <>
                  <Segmented
                    ariaLabel={$t("İşlem hızı")}
                    size="sm"
                    fullWidth
                    value={tierKey}
                    onChange={(v) => setTierKey(v as TierKey)}
                    options={(tiers.tiers ?? []).map((t) => ({ value: t.key, label: TIER_LABELS[t.key] }))}
                  />
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-muted">{$t("Tahmini ağ ücreti")}</span>
                    <span className="tabular text-textsoft">
                      ~{formatAmount(feeNative ?? 0, 6)} {chain?.nativeSymbol}
                      {feeUsd != null && <span className="ml-1.5 text-muted">≈ {formatUsd(feeUsd)}</span>}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{$t("Tahmini ağ ücreti")}</span>
                  <span className="text-textsoft">
                    {amountUnits > 0n && isEvmAddress(target) ? $t("Hesaplanıyor…") : $t("Tutar girince görünür")}
                  </span>
                </div>
              )}
            </div>

            <Button tone="brand" size="lg" fullWidth onClick={continueToReview} disabled={!sendable} iconRight={<ArrowRight size={14} />}>
              {$t("Devam")}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-muted">
              {$t("İşlem senin anahtarınla bu cihazda imzalanır ve doğrudan ağa yayınlanır.")}
            </p>
          </Card>
        )}

        {step === "review" && asset && (
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface2/60 p-5">
              <TokenIcon symbol={asset.iconSymbol} chainId={activeChainId} address={asset.address} size={44} />
              <div className="tabular mt-1 font-display text-[24px] font-semibold text-text">
                {formatAmount(amountNumber, 8)} {asset.symbol}
              </div>
              {amountUsd != null && <div className="tabular text-[12px] text-muted">{formatUsd(amountUsd)}</div>}
            </div>

            <div className="rounded-card border border-line bg-surface2/60 p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {$t("Alıcı")}
              </div>
              <HighlightedAddress address={target} className="break-all" />
              {ensName && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-info">
                  <Info size={10} /> {ensName} → {$t("ENS ile çözüldü")}
                </div>
              )}
            </div>

            <div className="space-y-1.5 rounded-card border border-line bg-surface2/60 p-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">{$t("Ağ")}</span>
                <span className="flex items-center gap-1.5 text-textsoft">
                  <ChainIcon chainId={activeChainId} size={13} /> {chain?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{$t("Varlık")}</span>
                <span className="text-textsoft">{asset.name} ({asset.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{$t("İşlem hızı")}</span>
                <span className="text-textsoft">{tier ? TIER_LABELS[tier.key] : TIER_LABELS.normal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{$t("Ağ ücreti")}</span>
                <span className="tabular text-textsoft">
                  ~{formatAmount(feeNative ?? 0, 6)} {chain?.nativeSymbol}
                  {feeUsd != null && <span className="ml-1.5 text-muted">≈ {formatUsd(feeUsd)}</span>}
                </span>
              </div>
              {totalNative != null && (
                <div className="flex justify-between border-t border-line pt-1.5">
                  <span className="font-medium text-textsoft">{$t("Ücret dahil toplam")}</span>
                  <span className="tabular font-medium text-text">
                    {formatAmount(totalNative, 8)} {chain?.nativeSymbol}
                  </span>
                </div>
              )}
            </div>

            <Alert tone="warning" title={$t("Bu işlem geri alınamaz")}>
              {$t("Alıcı adresini kontrol et; ilk ve son karakterler vurgulanmıştır. Yanlış adrese gönderilen varlıklar geri alınamaz.")}
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("form")} disabled={busy}>
                {$t("Geri")}
              </Button>
              <Button tone="brand" className="flex-1" onClick={() => void submit()} loading={busy} iconLeft={<Send size={14} />}>
                {$t("Onayla ve gönder")}
              </Button>
            </div>

            <p className="text-center text-[11px] leading-relaxed text-muted">
              {$t("İşlem senin anahtarınla bu cihazda imzalanır ve doğrudan ağa yayınlanır.")}
            </p>
          </Card>
        )}

        {step === "result" && hash && (
          <Card className="flex flex-col items-center gap-3 p-6">
            <span
              className={cn(
                "grid h-14 w-14 place-items-center rounded-full",
                status === "confirmed" && "bg-oksoft text-ok",
                status === "failed" && "bg-dangersoft text-danger",
                status === "pending" && "bg-infosoft text-info",
              )}
            >
              {status === "confirmed" ? (
                <Check size={26} />
              ) : status === "failed" ? (
                <AlertTriangle size={26} />
              ) : (
                <Loader size={26} className="animate-spin" />
              )}
            </span>
            <div className="text-center">
              <div className="font-display text-[16px] font-semibold text-text">
                {status === "confirmed"
                  ? $t("İşlem onaylandı")
                  : status === "failed"
                    ? $t("İşlem zincirde başarısız oldu")
                    : $t("Onay bekleniyor")}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {status === "pending"
                  ? $t("Zincir onayı bekleniyor — bu ekrandan çıksan bile işlem yayında.")
                  : formatAmount(amountNumber, 8) + " " + (asset?.symbol ?? "")}
              </div>
            </div>

            <div className="flex w-full items-center gap-2 rounded-card border border-line bg-surface2/60 p-2.5">
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(hash);
                  toast($t("Kopyalandı"), "success");
                }}
                className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded text-left"
                title={$t("İşlem karmasını kopyala")}
              >
                <span className="truncate font-mono text-[11px] text-textsoft">{hash}</span>
                <Copy size={12} className="shrink-0 text-muted" />
              </button>
              <a
                href={txExplorerUrl(activeChainId, hash)}
                target="_blank"
                rel="noreferrer"
                className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition-colors hover:border-linestrong hover:text-text"
                aria-label={$t("Gezginde aç")}
              >
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="mt-1 flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                {$t("Yeni gönderim")}
              </Button>
              <Button tone="brand" className="flex-1" onClick={() => navigate("/activity")}>
                {$t("Geçmişte gör")}
              </Button>
            </div>

            <p className="text-[10px] text-muted">{shortAddress(hash, 8)} · {chain?.name}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  const text = String(error).replace(/^Error: /, "");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
