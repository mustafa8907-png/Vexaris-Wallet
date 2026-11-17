import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Alert, ArrowLeft, Button, Card, Check, Copy, Input, cn } from "@/kit";
import { QrCode } from "@/kit/ext";
import { ChainIcon } from "@/components/TokenIcon";
import { AccountModal } from "@/components/layout/AccountModal";
import { addressForChain, accountChains } from "@/stores/accountStore";
import { isEvmChain } from "@/lib/chains/address";
import { useChainStore } from "@/stores/chainStore";
import { getChain } from "@/lib/chains/registry";
import { toast } from "@/stores/toastStore";
import { copyText } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

export function ReceivePage() {
  const navigate = useNavigate();
  const activeChainId = useChainStore((s) => s.activeChainId);
  const setActive = useChainStore((s) => s.setActive);
  const [copied, setCopied] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const chains = useMemo(() => accountChains(), []);
  const chainId = chains.includes(activeChainId) ? activeChainId : chains[0] ?? "ethereum";
  const chain = getChain(chainId);
  const evm = isEvmChain(chainId);
  const address = addressForChain(chainId);
  const qrValue = address ? (evm ? `ethereum:${address}@${chain?.chainId ?? 1}` : address) : "";

  async function copy() {
    if (!address) return;
    const ok = await copyText(address);
    if (ok) {
      setCopied(true);
      toast($t("Adres kopyalandı"), "success");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast($t("Kopyalanamadı — panoya erişim kapalı"), "info");
    }
  }

  async function share() {
    if (!address) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: chain?.name ?? "Vexaris", text: address });
        return;
      } catch {
        return;
      }
    }
    void copy();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-3 pb-8 pt-4 sm:px-5">
        <button
          onClick={() => navigate("/")}
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-xs text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={13} /> {$t("Portföy")}
        </button>

        <h1 className="mb-4 font-display text-lg font-semibold tracking-tight text-text">{$t("Para al")}</h1>

        <div className="no-scrollbar -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 pb-1">
          {chains.map((id) => {
            const c = getChain(id);
            const active = id === chainId;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-ctrl border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-brand/45 bg-brandsoft text-text"
                    : "border-line bg-surface2/60 text-muted hover:border-linestrong hover:text-text",
                )}
              >
                <ChainIcon chainId={id} size={15} />
                {c?.shortName ?? id}
              </button>
            );
          })}
        </div>

        <Card className="flex flex-col items-center gap-4 p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-textsoft">
            <ChainIcon chainId={chainId} size={18} />
            {chain?.name} {$t("ağı")}
          </div>

          {address ? (
            <div className="relative rounded-card bg-white p-3.5 shadow-1">
              <QRCodeSVG value={qrValue} size={176} level="Q" bgColor="#ffffff" fgColor="#0b0b0c" />
              <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-ctrl border-2 border-white bg-white shadow-1">
                <ChainIcon chainId={chainId} size={30} />
              </span>
            </div>
          ) : (
            <div className="grid h-[206px] w-[206px] place-items-center rounded-card border border-dashed border-line bg-surface2/50 text-muted">
              <span className="flex flex-col items-center gap-2">
                <QrCode size={26} />
                <span className="text-[11px]">{$t("adres bekleniyor")}</span>
              </span>
            </div>
          )}

          <div className="w-full">
            <div className="mb-1 text-xs text-muted">{$t("Adresin")}</div>
            {address ? (
              <div className="flex items-stretch gap-2">
                <Input readOnly value={address} spellCheck={false} className="min-w-0 flex-1 font-mono text-[11px]" />
                <button
                  onClick={() => void copy()}
                  className={cn(
                    "grid w-11 shrink-0 place-items-center rounded-ctrl border transition-colors",
                    copied ? "border-ok/40 bg-oksoft text-ok" : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
                  )}
                  title={$t("Adresi kopyala")}
                  aria-label={$t("Adresi kopyala")}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-card border border-dashed border-line bg-surface2/50 p-3">
                <p className="text-[11px] leading-relaxed text-muted">
                  {evm
                    ? $t("Bu ağ için adres üretilemedi — cüzdanını yeniden aç.")
                    : $t("Bu ağda adresin henüz yok. Kendi adresini ekleyebilir veya hesabını yeniden içe aktarabilirsin.")}
                </p>
                {!evm && (
                  <Button variant="outline" size="sm" fullWidth onClick={() => setAccountOpen(true)}>
                    {$t("Adresini ekle")}
                  </Button>
                )}
              </div>
            )}

            {address && (
              <Button variant="soft" className="mt-2 w-full" onClick={() => void share()}>
                {$t("Paylaş")}
              </Button>
            )}
          </div>

          <Alert tone="warning" title={$t("Yalnızca {0} ağı", [chain?.shortName ?? $t("bu ağ")])}>
            {$t("Yalnızca")} {chain?.name} {$t("ağından gönderim yap. Farklı ağdan gelen varlıklar kaybolabilir.")}
          </Alert>
        </Card>

        <Button variant="outline" className="mt-4 w-full" onClick={() => navigate("/")}>
          {$t("Tamam")}
        </Button>
      </div>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
