import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Warning, Prohibit, SpinnerGap, ShieldSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { OriginHeader } from "@/components/walletconnect/OriginHeader";
import { WcExecutionError } from "@/lib/walletconnect/execute";
import { executeBrowserRequest } from "@/lib/browser/execute";
import { previewRequest, type RequestPreview } from "@/lib/walletconnect/preview";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore, type WcRequest } from "@/stores/walletConnectStore";

export function SessionRequestModal() {
  const request = useWalletConnectStore((s) => s.request);
  const waiting = useWalletConnectStore((s) => s.queue.length);
  if (!request) return null;
  return <RequestScreen key={request.id} request={request} waiting={Math.max(0, waiting - 1)} />;
}

function RequestScreen({ request, waiting }: { request: WcRequest; waiting: number }) {
  const resolve = useWalletConnectStore((s) => s.resolveRequest);
  const reject = useWalletConnectStore((s) => s.rejectRequest);
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  const [readError, setReadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    setReadError("");
    void previewRequest(request)
      .then((value) => {
        if (alive) setPreview(value);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setReadError(error instanceof WcExecutionError ? error.message : messageOf(error));
      });
    return () => {
      alive = false;
    };
  }, [request]);

  const blocked = Boolean(preview?.blockers.length) || request.isScam || Boolean(readError);

  async function onReject() {
    await reject();
  }

  async function onApprove() {
    setBusy(true);
    try {
      const result = await executeBrowserRequest(request);
      await resolve(result);
      toast(request.method === "eth_sendTransaction" ? $t("İşlem gönderildi") : $t("İmzalandı"), "success");
    } catch (error) {
      await reject();
      toast(error instanceof Error ? error.message : $t("İstek yürütülemedi"), "error");
      console.warn($t("WalletConnect talebi yürütülemedi"), error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={request.source ? $t("Site onay istiyor") : $t("Uygulama imza istiyor")}
      description={
        waiting > 0
          ? $t("Bu onaydan sonra sırada {0} talep daha var.", [waiting])
          : $t("Onaylamadan önce aşağıdaki alanları oku.")
      }
      onClose={() => void onReject()}
      width="md"
    >
      <OriginHeader origin={request} />

      <div className="mt-4 space-y-3.5">
        {readError && (
          <div className="flex gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] p-3">
            <ShieldSlash size={14} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[11px] leading-relaxed text-danger">{readError}</p>
          </div>
        )}

        {!preview && !readError && (
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-surface-800 p-3 text-[11px] text-zinc-500">
            <SpinnerGap size={13} className="animate-spin" />
            {$t("İstek okunuyor…")}
          </div>
        )}

        {preview && (
          <>
            <div className="rounded-xl border border-white/[0.07] bg-surface-800 p-3">
              <div className="text-[13px] font-medium text-white">{preview.headline}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{preview.intent}</p>
              <dl className="mt-2.5 space-y-2">
                {preview.rows.map((row, index) => (
                  <div key={`${index}-${row.label}`} className="grid grid-cols-[110px_1fr] gap-2 text-[11px]">
                    <dt className="text-zinc-500">{row.label}</dt>
                    <dd className="break-all text-zinc-200">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {preview.raw && (
                <pre className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2.5 text-[10px] leading-relaxed text-zinc-400">
                  {preview.raw}
                </pre>
              )}
            </div>

            {preview.warnings.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-warning/25 bg-warning/[0.07] p-3">
                {preview.warnings.map((warning, index) => (
                  <div key={`${index}-${warning}`} className="flex gap-2">
                    <Warning size={13} className="mt-0.5 shrink-0 text-warning" />
                    <p className="text-[11px] leading-relaxed text-zinc-300">{warning}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {preview?.blockers.length ? (
          <div className="flex gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] p-3">
            <Prohibit size={14} className="mt-0.5 shrink-0 text-danger" />
            <div className="space-y-1 text-[11px] leading-relaxed text-danger">
              {preview.blockers.map((blocker, index) => (
                <p key={`${index}-${blocker}`}>{blocker}</p>
              ))}
            </div>
          </div>
        ) : !blocked && preview ? (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {$t("Onayladığın anda bu imza cüzdanının anahtarıyla üretilir ve geri alınamaz.")}
          </p>
        ) : null}

        {request.isScam && (
          <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger/[0.1] p-3">
            <ShieldSlash size={14} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[11px] leading-relaxed text-danger">
              {$t("Reown bu siteyi dolandırıcı olarak işaretlemiş. İmzalamayı reddet ve sekmeyi kapat.")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void onReject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked || busy || !preview} onClick={() => void onApprove()}>
          {busy ? <SpinnerGap size={14} className="animate-spin" /> : null}
          {busy ? $t("İmzalanıyor…") : $t("Onayla")}
        </Button>
      </div>
    </Modal>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return $t("İstek çözümlenemedi — ne imzaladığın gösterilemiyor.");
}
