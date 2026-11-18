import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Alert, Button, Chip, Modal } from "@/kit";
import { OriginHeader } from "@/components/walletconnect/OriginHeader";
import { chainLabel } from "@/lib/walletconnect/chains";
import { useBrowserCover } from "@/lib/browser/cover";
import { methodLabel } from "@/lib/walletconnect/labels";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore } from "@/stores/walletConnectStore";

export function SessionProposalModal() {
  const proposal = useWalletConnectStore((s) => s.proposal);
  const approve = useWalletConnectStore((s) => s.approveProposal);
  const reject = useWalletConnectStore((s) => s.rejectProposal);
  const [extra, setExtra] = useState<string[]>([]);

  useEffect(() => setExtra([]), [proposal?.id]);

  useBrowserCover(Boolean(proposal));

  if (!proposal) return null;
  const blocked = proposal.gaps.length > 0;

  async function onApprove() {
    try {
      await approve(extra);
    } catch (error) {
      toast(error instanceof Error ? error.message : $t("Bağlantı kurulamadı"), "error");
    }
  }

  return (
    <Modal open onClose={() => void reject()} title={$t("Uygulama bağlanmak istiyor")} size="md">
      <OriginHeader origin={proposal} />

      <div className="mt-4 space-y-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-textsoft">{$t("Ağlar")}</div>
          <div className="flex flex-wrap gap-1.5">
            {proposal.requiredChains.map((chain) => (
              <Chip key={chain} active disabled className="cursor-default">
                {chainLabel(chain)}
                <span className="ml-1 text-[9px] uppercase tracking-wide">{$t("zorunlu")}</span>
              </Chip>
            ))}
            {proposal.optionalChains.map((chain) => (
              <Chip
                key={chain}
                active={extra.includes(chain)}
                onClick={() =>
                  setExtra((current) =>
                    current.includes(chain)
                      ? current.filter((item) => item !== chain)
                      : [...current, chain],
                  )
                }
              >
                {chainLabel(chain)}
              </Chip>
            ))}
            {!proposal.requiredChains.length && !proposal.optionalChains.length && (
              <span className="text-[11px] text-muted">{$t("Ağ belirtilmedi")}</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-textsoft">{$t("İzin istedikleri")}</div>
          <ul className="space-y-1">
            {proposal.methods.map((method) => (
              <li key={method} className="flex items-center gap-2 text-[11px] text-textsoft">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                {methodLabel(method)}
              </li>
            ))}
            {!proposal.methods.length && (
              <li className="text-[11px] text-muted">
                {$t("Bu uygulama bizim desteklemediğimiz işlemler istiyor")}
              </li>
            )}
          </ul>
        </div>

        {blocked && (
          <Alert tone="danger" className="!p-3">
            <div className="space-y-1 text-[11px] leading-relaxed">
              {proposal.gaps.map((gap) => (
                <p key={gap}>{gap}</p>
              ))}
            </div>
          </Alert>
        )}

        {!blocked && proposal.validation !== "VALID" && (
          <Alert tone="warning" className="!p-3">
            <p className="text-[11px] leading-relaxed">
              {$t("Bu uygulamanın kimliği doğrulanmamış. Adresini yazdığın siteden geldiğinden eminsen devam et.")}
            </p>
          </Alert>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="soft" className="flex-1" onClick={() => void reject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked} onClick={() => void onApprove()}>
          {$t("Bağlan")}
        </Button>
      </div>
    </Modal>
  );
}
