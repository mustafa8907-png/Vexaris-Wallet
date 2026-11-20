import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import {
  AlertTriangle,
  Button,
  Check,
  Copy,
  Eye,
  Loader,
  Lock,
  Modal,
  Shield,
  X,
  cn,
} from "@/kit";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChainIcon } from "@/components/TokenIcon";
import { SiteIcon } from "@/components/SiteIcon";
import { getChain } from "@/lib/chains/registry";
import { hostOf } from "@/lib/browser/address";
import { useBrowserCover } from "@/lib/browser/cover";
import { copyText, shortAddress } from "@/lib/utils";
import { useBrowserStore, type ConnectPrompt } from "@/stores/browserStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";

export function ConnectSheet() {
  const prompt = useBrowserStore((s) => s.connectPrompt);
  useBrowserCover(Boolean(prompt));
  if (!prompt) return null;
  return <ConnectDialog key={`${prompt.origin}:${prompt.requestId}`} prompt={prompt} />;
}

function ConnectDialog({ prompt }: { prompt: ConnectPrompt }) {
  const approve = useBrowserStore((s) => s.approveConnect);
  const reject = useBrowserStore((s) => s.rejectConnect);
  const risk = useBrowserStore((s) => s.flagged[prompt.origin]);
  const address = useWalletStore((s) => s.wallet?.address ?? "");
  const unlocked = useWalletStore((s) => s.unlocked);
  const [busy, setBusy] = useState(false);
  const chain = getChain(prompt.chainKey);
  const host = hostOf(prompt.origin);

  const screening = prompt.phishing
    ? { tone: "danger", icon: AlertTriangle, label: $t("Oltalama listesinde") }
    : risk === false
      ? { tone: "ok", icon: Shield, label: $t("Oltalama taraması temiz") }
      : { tone: "warn", icon: AlertTriangle, label: $t("Site taraması sonuçlanmadı") };
  const ScreenIcon = screening.icon;
  const blocked = prompt.phishing || !unlocked || !address;

  async function onApprove() {
    setBusy(true);
    await approve();
    setBusy(false);
  }

  async function copyAddress() {
    const ok = await copyText(address);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  return (
    <Modal
      open
      title={$t("Siteye bağlan")}
      description={$t("Bu site cüzdan adresini görmek istiyor.")}
      onClose={() => void reject()}
      size="md"
    >
      <div className="flex items-start gap-3">
        <SiteIcon url={prompt.origin} name={prompt.name || host} size={44} override={prompt.favicon} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-text">{prompt.name || host}</div>
          <div className="truncate font-mono text-[11px] text-muted">{host}</div>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-ctrl border px-1.5 py-0.5 text-[10px] font-medium",
              screening.tone === "danger"
                ? "border-danger/30 bg-danger/10 text-danger"
                : screening.tone === "ok"
                  ? "border-ok/25 bg-ok/10 text-ok"
                  : "border-warn/25 bg-warn/10 text-warn",
            )}
          >
            <ScreenIcon size={11} />
            {screening.label}
          </span>
        </div>
      </div>

      {prompt.phishing && (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 p-3 text-[11px] leading-relaxed text-danger">
          {$t("Bu adres oltalama listesinde. Bağlanma — site cüzdanını boşaltmaya çalışıyor olabilir.")}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface2 p-3">
          <ProfileAvatar size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {$t("Paylaşılacak hesap")}
            </div>
            <div className="truncate font-mono text-[12px] text-text">
              {address ? shortAddress(address, 6) : $t("Cüzdan kilitli")}
            </div>
          </div>
          <button
            onClick={() => void copyAddress()}
            disabled={!address}
            title={$t("Adresi kopyala")}
            aria-label={$t("Adresi kopyala")}
            className="shrink-0 rounded-ctrl p-1.5 text-muted transition-colors hover:bg-surface3 hover:text-text disabled:opacity-40"
          >
            <Copy size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-card border border-line bg-surface2 p-3">
          <ChainIcon chainId={prompt.chainKey} size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">{$t("Ağ")}</div>
            <div className="truncate text-[12px] text-text">{chain?.name ?? prompt.chainKey}</div>
          </div>
          <span className="tabular shrink-0 rounded-ctrl border border-line bg-surface3 px-1.5 py-0.5 text-[10px] text-muted">
            {chain?.chainId ?? "—"}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-[11px] leading-relaxed">
        <li className="flex gap-2 text-textsoft">
          <Eye size={14} className="mt-0.5 shrink-0 text-info" />
          {$t("Adresini ve bakiyeni okuyabilir.")}
        </li>
        <li className="flex gap-2 text-textsoft">
          <Shield size={14} className="mt-0.5 shrink-0 text-warn" />
          {$t("İşlem ve imza önerebilir — her biri ayrı onay ekranına düşer.")}
        </li>
        <li className="flex gap-2 text-muted">
          <Lock size={14} className="mt-0.5 shrink-0" />
          {$t("Anahtarlarına ve kurtarma cümlene erişemez.")}
        </li>
        <li className="flex gap-2 text-muted">
          <X size={14} className="mt-0.5 shrink-0" />
          {$t("Onaysız hiçbir varlık hareket etmez.")}
        </li>
      </ul>

      {!unlocked && (
        <p className="mt-3 rounded-card border border-warn/25 bg-warn/10 p-2.5 text-[11px] text-warn">
          {$t("Cüzdan kilitli — önce parolanla aç.")}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="soft" className="flex-1" onClick={() => void reject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked || busy} onClick={() => void onApprove()}>
          {busy ? <Loader size={14} className="animate-spin" /> : <Check size={15} />}
          {$t("Bağlan")}
        </Button>
      </div>
    </Modal>
  );
}
