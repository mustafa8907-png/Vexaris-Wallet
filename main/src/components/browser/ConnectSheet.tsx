import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import {
  Check,
  Copy,
  Eye,
  Key,
  Prohibit,
  ShieldCheck,
  ShieldWarning,
  SpinnerGap,
  Signature,
} from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChainIcon } from "@/components/TokenIcon";
import { getChain } from "@/lib/chains/registry";
import { hostOf } from "@/lib/browser/address";
import { copyText, shortAddress } from "@/lib/utils";
import { useBrowserStore, type ConnectPrompt } from "@/stores/browserStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";

export function ConnectSheet() {
  const prompt = useBrowserStore((s) => s.connectPrompt);
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
    ? { tone: "danger", icon: ShieldWarning, label: $t("Oltalama listesinde") }
    : risk === false
      ? { tone: "ok", icon: ShieldCheck, label: $t("Oltalama taraması temiz") }
      : { tone: "warn", icon: ShieldWarning, label: $t("Site taraması sonuçlanmadı") };
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
      title={$t("Siteye bağlan")}
      description={$t("Bu site cüzdan adresini görmek istiyor.")}
      onClose={() => void reject()}
    >
      <div className="flex items-start gap-3">
        {prompt.favicon ? (
          <img
            src={prompt.favicon}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl border border-white/[0.08] bg-surface-800 object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-surface-800 text-sm font-semibold text-zinc-300">
            {(prompt.name || host).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{prompt.name || host}</div>
          <div className="truncate font-mono text-[11px] text-zinc-500">{host}</div>
          <span
            className={
              screening.tone === "danger"
                ? "mt-1.5 inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-danger"
                : screening.tone === "ok"
                  ? "mt-1.5 inline-flex items-center gap-1 rounded-md border border-success/25 bg-success/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-success"
                  : "mt-1.5 inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-warning"
            }
          >
            <ScreenIcon size={11} />
            {screening.label}
          </span>
        </div>
      </div>

      {prompt.phishing && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/[0.1] p-3 text-[11px] leading-relaxed text-danger">
          {$t("Bu adres oltalama listesinde. Bağlanma — site cüzdanını boşaltmaya çalışıyor olabilir.")}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-surface-800 p-3">
          <ProfileAvatar size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              {$t("Paylaşılacak hesap")}
            </div>
            <div className="truncate font-mono text-[12px] text-zinc-100">
              {address ? shortAddress(address, 6) : $t("Cüzdan kilitli")}
            </div>
          </div>
          <button
            onClick={() => void copyAddress()}
            disabled={!address}
            title={$t("Adresi kopyala")}
            aria-label={$t("Adresi kopyala")}
            className="focus-ring shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:text-white disabled:opacity-40"
          >
            <Copy size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-surface-800 p-3">
          <ChainIcon chainId={prompt.chainKey} size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{$t("Ağ")}</div>
            <div className="truncate text-[12px] text-zinc-100">{chain?.name ?? prompt.chainKey}</div>
          </div>
          <span className="chip shrink-0 font-mono">{chain?.chainId ?? "—"}</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-[11px] leading-relaxed">
        <li className="flex gap-2 text-zinc-300">
          <Eye size={14} className="mt-0.5 shrink-0 text-info" />
          {$t("Adresini ve bakiyeni okuyabilir.")}
        </li>
        <li className="flex gap-2 text-zinc-300">
          <Signature size={14} className="mt-0.5 shrink-0 text-warning" />
          {$t("İşlem ve imza önerebilir — her biri ayrı onay ekranına düşer.")}
        </li>
        <li className="flex gap-2 text-zinc-500">
          <Key size={14} className="mt-0.5 shrink-0 text-zinc-600" />
          {$t("Anahtarlarına ve kurtarma cümlene erişemez.")}
        </li>
        <li className="flex gap-2 text-zinc-500">
          <Prohibit size={14} className="mt-0.5 shrink-0 text-zinc-600" />
          {$t("Onaysız hiçbir varlık hareket etmez.")}
        </li>
      </ul>

      {!unlocked && (
        <p className="mt-3 rounded-lg border border-warning/25 bg-warning/[0.07] p-2.5 text-[11px] text-warning">
          {$t("Cüzdan kilitli — önce parolanla aç.")}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void reject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked || busy} onClick={() => void onApprove()}>
          {busy ? <SpinnerGap size={14} className="animate-spin" /> : <Check size={15} />}
          {$t("Bağlan")}
        </Button>
      </div>
    </Modal>
  );
}