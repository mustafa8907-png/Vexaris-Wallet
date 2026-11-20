import { t as $t } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import { SessionProposalModal } from "@/components/walletconnect/SessionProposalModal";
import { SessionRequestModal } from "@/components/walletconnect/SessionRequestModal";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore } from "@/stores/walletConnectStore";

let warned = false;

export function WalletConnectLayer() {
  const start = useWalletConnectStore((s) => s.start);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void start().catch((error: unknown) => {
      if (warned) return;
      warned = true;
      const message = error instanceof Error ? error.message : String(error);
      toast($t("WalletConnect başlatılamadı: {0}", [message]), "error");
    });
  }, [start]);

  return (
    <>
      <SessionProposalModal />
      <SessionRequestModal />
    </>
  );
}
