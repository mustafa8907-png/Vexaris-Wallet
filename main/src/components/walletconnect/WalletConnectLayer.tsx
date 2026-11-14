/**
 * WalletConnect'in uygulama iskeletine takıldığı yer.
 *
 * Onay ekranları sayfa değişimlerinden bağımsız olmalı: dApp talebi
 * kullanıcı hangi sekmede olursa olsun geldiği yerde karşısına çıkmalı.
 */
import { t as $t } from "@/lib/i18n";
import { useEffect } from "react";
import { SessionProposalModal } from "@/components/walletconnect/SessionProposalModal";
import { SessionRequestModal } from "@/components/walletconnect/SessionRequestModal";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore } from "@/stores/walletConnectStore";

export function WalletConnectLayer() {
  const start = useWalletConnectStore((s) => s.start);

  useEffect(() => {
    void start().catch((error: unknown) => {
      console.warn($t("WalletConnect başlatılamadı"), error);
      toast($t("WalletConnect başlatılamadı"), "error");
    });
  }, [start]);

  return (
    <>
      <SessionProposalModal />
      <SessionRequestModal />
    </>
  );
}
