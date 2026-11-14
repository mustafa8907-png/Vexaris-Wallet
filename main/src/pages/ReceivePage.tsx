import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenIcon } from "@/components/TokenIcon";
import { useWalletStore } from "@/stores/walletStore";
import { useChainStore } from "@/stores/chainStore";
import { getChain } from "@/lib/chains/registry";
import { toast } from "@/stores/toastStore";

function receiveUri(address: string, chainId = 1): string {
  if (!address) return "";
  return `ethereum:${address}@${chainId}`;
}

export function ReceivePage() {
  const navigate = useNavigate();
  const wallet = useWalletStore((s) => s.wallet);
  const activeChainId = useChainStore((s) => s.activeChainId);
  const chain = getChain(activeChainId);
  const [copied, setCopied] = useState(false);
  const address = wallet?.address ?? "";
  const uri = receiveUri(address, chain?.chainId ?? 1);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast($t("Adres kopyalandı"), "success");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="page">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={13} /> {$t("Portföy")}
        </button>

        <h1 className="mb-5 text-lg font-semibold text-white">{$t("Para al")}</h1>

        <div className="max-w-md">
          <Card className="flex flex-col items-center gap-4 p-6">
            <div className="flex items-center gap-2 text-[13px] text-zinc-400">
              <TokenIcon symbol={chain?.iconSymbol ?? "ETH"} size={18} />
              {chain?.name} {$t("ağı")}
            </div>

            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={uri} size={176} level="M" bgColor="#ffffff" fgColor="#09090a" />
            </div>

            <div className="w-full">
              <div className="mb-1 text-xs text-zinc-500">{$t("Adresin")}</div>
              <button
                onClick={copy}
                className="focus-ring flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-surface-800 px-3 py-2.5 text-left transition-colors hover:border-white/[0.16]"
              >
                <span className="flex-1 break-all font-mono text-[11px] text-zinc-300">{address}</span>
                {copied ? (
                  <Check size={14} className="shrink-0 text-success" />
                ) : (
                  <Copy size={14} className="shrink-0 text-zinc-500" />
                )}
              </button>
            </div>

            <p className="text-center text-[11px] leading-relaxed text-zinc-600">
              {$t("Yalnızca")} {chain?.name} {$t("ağından gönderim yap. Farklı ağdan gelen varlıklar kaybolabilir.")}
            </p>
          </Card>

          <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate("/")}>
            {$t("Tamam")}
          </Button>
        </div>
      </div>
    </div>
  );
}
