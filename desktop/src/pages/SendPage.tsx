import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Warning, ArrowLeft, CheckCircle, Copy, ArrowSquareOut, SpinnerGap, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TokenIcon } from "@/components/TokenIcon";
import { useChainStore } from "@/stores/chainStore";
import { getChain } from "@/lib/chains/registry";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";
import { txExplorerUrl } from "@/lib/api/history";
import { resolveEnsName, looksLikeEnsName } from "@/lib/api/ens";
import { estimateTransferCost, sendTransfer, waitReceipt } from "@/lib/swap/execute";
import { formatUnits, parseUnits, plainNumber, sanitizeAmount, unitsToNumber } from "@/lib/swap/units";
import { cn, copyText, formatAmount, formatUsd, shortAddress } from "@/lib/utils";
import type { Chain, TokenAmount } from "@/types/chain";

const EMPTY: TokenAmount[] = [];

/** Gönderilebilir varlık: yerel coin veya cüzdanda bakiyesi olan bir ERC-20. */
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

  const [assetKey, setAssetKey] = useState("native");
  const asset = assets.find((a) => a.key === assetKey) ?? assets[0];

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});
  const [busy, setBusy] = useState(false);
  const [feeUnits, setFeeUnits] = useState<bigint | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [status, setStatus] = useState<TxStatus>("pending");

  /* ENS: alıcı alanına yazılan ad ana ağdan zincir üstü okunur (anahtar yok). */
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

  const feeNative = feeUnits == null ? null : unitsToNumber(feeUnits, 18);
  const amountUnits = useMemo(
    () => parseUnits(amount, asset?.decimals ?? 18),
    [amount, asset?.decimals],
  );

  /* Ücret önizlemesi: imzalanan işlemin gaz yolundan gelir, elle yazılmaz. */
  useEffect(() => {
    setFeeUnits(null);
    if (!sendable || !wallet?.address || !asset) return;
    if (amountUnits <= 0n || !isEvmAddress(target)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      estimateTransferCost({
        chainId: activeChainId,
        sender: wallet.address,
        to: target,
        amountUnits,
        token: asset.address,
      })
        .then((cost) => {
          if (!cancelled) setFeeUnits(cost.feeUnits);
        })
        .catch(() => {
          /* tahmin uçtan gelmiyorsa ücret satırı boş kalır */
          if (!cancelled) setFeeUnits(null);
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

  async function submit() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !chain || !wallet?.address || amountUnits <= 0n) return;

    setBusy(true);
    try {
      const txHash = await sendTransfer({
        chainId: activeChainId,
        sender: wallet.address,
        to: target,
        amountUnits,
        token: asset?.address,
      });
      setHash(txHash);
      setStatus("pending");
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

  return (
    <div className="page">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={13} /> {$t("Portföy")}
        </button>

        <h1 className="mb-5 text-lg font-semibold text-white">{$t("Gönder")}</h1>

        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-surface-800 px-3 py-2.5">
            <span className="text-xs text-zinc-500">{$t("Ağ")}</span>
            <span className="flex items-center gap-2 text-[13px] text-zinc-100">
              <TokenIcon symbol={chain?.iconSymbol ?? "ETH"} size={18} />
              {chain?.name}
            </span>
          </div>

          {!sendable && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-warning">
              <Warning size={13} className="mt-0.5 shrink-0" />
              <span>
                {$t("{0} ağında doğrudan gönderim henüz açık değil.", [chain?.name ?? ""])}{" "}
                <button
                  onClick={() => navigate("/swap")}
                  className="underline underline-offset-2 hover:text-white"
                >
                  {$t("Takas ekranını kullan.")}
                </button>
              </span>
            </div>
          )}

          {assets.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {assets.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAssetKey(a.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] transition-colors",
                    a.key === asset?.key
                      ? "border-accent/45 bg-accent/[0.10] text-white"
                      : "border-white/[0.06] bg-surface-800 text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  <TokenIcon symbol={a.iconSymbol} chainId={activeChainId} address={a.address} size={16} />
                  {a.symbol}
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
            />
            {ensName && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                {ensResolving ? (
                  <>
                    <SpinnerGap size={11} className="animate-spin" />
                    {$t("adres çözülüyor…")}
                  </>
                ) : ensAddress ? (
                  <>
                    <CheckCircle size={11} className="shrink-0 text-success" />
                    <span className="truncate font-mono text-[10px] text-zinc-400">{ensAddress}</span>
                    <span className="shrink-0 text-zinc-600">· {$t("ENS, ana ağdan okundu")}</span>
                  </>
                ) : (
                  <>
                    <Warning size={11} className="shrink-0 text-warning" />
                    {$t("bu ad için kayıtlı adres yok")}
                  </>
                )}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">{$t("Miktar")}</span>
              {asset && (
                <button
                  onClick={applyMax}
                  disabled={!sendable}
                  className="text-[11px] text-accent transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {$t("Maks")}
                </button>
              )}
            </div>
            <Input
              placeholder="0.0"
              inputMode="decimal"
              suffix={asset?.symbol}
              value={amount}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value, asset?.decimals ?? 18))}
              error={errors.amount}
              disabled={!sendable}
            />
          </div>

          <div className="space-y-1.5 rounded-lg bg-surface-800 px-3 py-2.5 text-[11px]">
            <div className="flex justify-between text-zinc-500">
              <span>{$t("Tahmini ağ ücreti")}</span>
              <span className="tabular text-zinc-300">
                {feeNative != null
                  ? `~${formatAmount(feeNative, 6)} ${chain?.nativeSymbol}`
                  : amountUnits > 0n
                    ? $t("Hesaplanıyor…")
                    : $t("Tutar girince görünür")}
              </span>
            </div>
            {asset && (
              <>
                <div className="flex justify-between text-zinc-500">
                  <span>{$t("Kullanılabilir bakiye")}</span>
                  <span className="tabular text-zinc-300">
                    {formatAmount(asset.amount, 6)} {asset.symbol}
                  </span>
                </div>
                {asset.price != null && asset.amount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>{$t("Karşılığı")}</span>
                    <span className="tabular">{formatUsd(asset.amount * asset.price)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {hash && (
            <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/[0.06] px-3 py-2.5">
              <span className="mt-0.5 shrink-0 text-success">
                {status === "confirmed" ? (
                  <CheckCircle size={13} />
                ) : status === "failed" ? (
                  <Warning size={13} className="text-danger" />
                ) : (
                  <SpinnerGap size={13} className="animate-spin" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-100">
                  {status === "confirmed"
                    ? $t("İşlem onaylandı")
                    : status === "failed"
                      ? $t("İşlem zincirde başarısız oldu")
                      : $t("Onay bekleniyor")}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                  {shortAddress(hash, 10)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={async () => (await copyText(hash)) && toast($t("Kopyalandı"), "success")}
                  aria-label={$t("İşlem karmasını kopyala")}
                  className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <Copy size={12} />
                </button>
                <a
                  href={txExplorerUrl(activeChainId, hash)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={$t("Gezginde aç")}
                  className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <ArrowSquareOut size={12} />
                </a>
                <button
                  onClick={() => {
                    setHash(null);
                    setAmount("");
                    setTo("");
                  }}
                  aria-label={$t("Kapat")}
                  className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {asset && !asset.address && amountUnits > 0n && feeUnits != null && !errors.amount && (
            <p className="text-center text-[11px] text-zinc-500">
              {$t("Ücret dahil toplam")}{" "}
              <span className="tabular text-zinc-300">
                {formatUnits(amountUnits + feeUnits, 18, 8)} {chain?.nativeSymbol}
              </span>
            </p>
          )}

          <Button onClick={submit} disabled={busy || !sendable} size="lg">
            {busy ? <SpinnerGap size={15} className="animate-spin" /> : <PaperPlaneTilt size={15} />}
            {$t("Gönder")}
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-zinc-600">
            {$t("İşlem senin anahtarınla bu cihazda imzalanır ve doğrudan ağa yayınlanır.")}
          </p>
        </Card>
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  const text = String(error).replace(/^Error: /, "");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
