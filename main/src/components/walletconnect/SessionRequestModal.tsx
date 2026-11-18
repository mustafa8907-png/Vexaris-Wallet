import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Alert, Button, Loader, Modal } from "@/kit";
import { OriginHeader } from "@/components/walletconnect/OriginHeader";
import { WcExecutionError } from "@/lib/walletconnect/execute";
import { executeBrowserRequest } from "@/lib/browser/execute";
import { useBrowserCover } from "@/lib/browser/cover";
import { previewRequest, type RequestPreview } from "@/lib/walletconnect/preview";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore, type WcRequest } from "@/stores/walletConnectStore";

export function SessionRequestModal() {
  const request = useWalletConnectStore((s) => s.request);
  const waiting = useWalletConnectStore((s) => s.queue.length);
  useBrowserCover(Boolean(request));
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
      open
      onClose={() => void onReject()}
      title={request.source ? $t("Site onay istiyor") : $t("Uygulama imza istiyor")}
      description={
        waiting > 0
          ? $t("Bu onaydan sonra sırada {0} talep daha var.", [waiting])
          : $t("Onaylamadan önce aşağıdaki alanları oku.")
      }
      size="md"
    >
      <OriginHeader origin={request} />

      <div className="mt-4 space-y-3.5">
        {readError && (
          <Alert tone="danger" className="!p-3">
            <p className="text-[11px] leading-relaxed">{readError}</p>
          </Alert>
        )}

        {!preview && !readError && (
          <div className="flex items-center gap-2 rounded-card border border-line bg-surface2 p-3 text-[11px] text-muted">
            <Loader size={13} className="animate-spin" />
            {$t("İstek okunuyor…")}
          </div>
        )}

        {preview && (
          <>
            <div className="rounded-card border border-line bg-surface2 p-3">
              <div className="text-[13px] font-medium text-text">{preview.headline}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-textsoft">{preview.intent}</p>
              <dl className="mt-2.5 space-y-2">
                {preview.rows.map((row, index) => (
                  <div key={`${index}-${row.label}`} className="grid grid-cols-[110px_1fr] gap-2 text-[11px]">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="break-all text-textsoft">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {preview.raw && (
                <pre className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-ctrl bg-bg/60 p-2.5 text-[10px] leading-relaxed text-muted">
                  {preview.raw}
                </pre>
              )}
            </div>

            {preview.warnings.length > 0 && (
              <Alert tone="warning" className="!p-3">
                <div className="space-y-1.5">
                  {preview.warnings.map((warning, index) => (
                    <p key={`${index}-${warning}`} className="text-[11px] leading-relaxed">
                      {warning}
                    </p>
                  ))}
                </div>
              </Alert>
            )}
          </>
        )}

        {preview?.blockers.length ? (
          <Alert tone="danger" className="!p-3">
            <div className="space-y-1 text-[11px] leading-relaxed">
              {preview.blockers.map((blocker, index) => (
                <p key={`${index}-${blocker}`}>{blocker}</p>
              ))}
            </div>
          </Alert>
        ) : !blocked && preview ? (
          <p className="text-[11px] leading-relaxed text-muted">
            {$t("Onayladığın anda bu imza cüzdanının anahtarıyla üretilir ve geri alınamaz.")}
          </p>
        ) : null}

        {request.isScam && (
          <Alert tone="danger" className="!p-3">
            <p className="text-[11px] leading-relaxed">
              {$t("Reown bu siteyi dolandırıcı olarak işaretlemiş. İmzalamayı reddet ve sekmeyi kapat.")}
            </p>
          </Alert>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="soft" className="flex-1" onClick={() => void onReject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked || busy || !preview} onClick={() => void onApprove()}>
          {busy && <Loader size={14} className="animate-spin" />}
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
