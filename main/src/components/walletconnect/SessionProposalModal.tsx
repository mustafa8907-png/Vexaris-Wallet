import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Warning, Prohibit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { OriginHeader } from "@/components/walletconnect/OriginHeader";
import { chainLabel } from "@/lib/walletconnect/chains";
import { methodLabel } from "@/lib/walletconnect/labels";
import { toast } from "@/stores/toastStore";
import { useWalletConnectStore } from "@/stores/walletConnectStore";
import { cn } from "@/lib/utils";

function Chip({
  label,
  locked,
  on,
  onClick,
}: {
  label: string;
  locked?: boolean;
  on: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={cn(
        "focus-ring rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
        locked && "cursor-default border-accent/30 bg-accent-soft text-white",
        !locked && on && "border-accent/40 bg-accent-soft text-white",
        !locked && !on && "border-white/[0.08] bg-surface-800 text-zinc-500 hover:text-zinc-300",
      )}
    >
      {label}
      {locked && <span className="ml-1 text-[9px] uppercase tracking-wide">{$t("zorunlu")}</span>}
    </button>
  );
}

export function SessionProposalModal() {
  const proposal = useWalletConnectStore((s) => s.proposal);
  const approve = useWalletConnectStore((s) => s.approveProposal);
  const reject = useWalletConnectStore((s) => s.rejectProposal);
  const [extra, setExtra] = useState<string[]>([]);

  useEffect(() => setExtra([]), [proposal?.id]);

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
    <Modal
      title={$t("Uygulama bağlanmak istiyor")}
      onClose={() => void reject()}
      width="md"
    >
      <OriginHeader origin={proposal} />

      <div className="mt-4 space-y-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-zinc-400">{$t("Ağlar")}</div>
          <div className="flex flex-wrap gap-1.5">
            {proposal.requiredChains.map((chain) => (
              <Chip key={chain} label={chainLabel(chain)} locked on />
            ))}
            {proposal.optionalChains.map((chain) => (
              <Chip
                key={chain}
                label={chainLabel(chain)}
                on={extra.includes(chain)}
                onClick={() =>
                  setExtra((current) =>
                    current.includes(chain)
                      ? current.filter((item) => item !== chain)
                      : [...current, chain],
                  )
                }
              />
            ))}
            {!proposal.requiredChains.length && !proposal.optionalChains.length && (
              <span className="text-[11px] text-zinc-600">{$t("Ağ belirtilmedi")}</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-zinc-400">
            {$t("İzin istedikleri")}
          </div>
          <ul className="space-y-1">
            {proposal.methods.map((method) => (
              <li key={method} className="flex items-center gap-2 text-[11px] text-zinc-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                {methodLabel(method)}
              </li>
            ))}
            {!proposal.methods.length && (
              <li className="text-[11px] text-zinc-600">
                {$t("Bu uygulama bizim desteklemediğimiz işlemler istiyor")}
              </li>
            )}
          </ul>
        </div>

        {blocked && (
          <div className="flex gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] p-3">
            <Prohibit size={14} className="mt-0.5 shrink-0 text-danger" />
            <div className="space-y-1 text-[11px] leading-relaxed text-danger">
              {proposal.gaps.map((gap) => (
                <p key={gap}>{gap}</p>
              ))}
            </div>
          </div>
        )}

        {!blocked && proposal.validation !== "VALID" && (
          <div className="flex gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] p-3">
            <Warning size={14} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[11px] leading-relaxed text-zinc-300">
              {$t("Bu uygulamanın kimliği doğrulanmamış. Adresini yazdığın siteden geldiğinden eminsen devam et.")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void reject()}>
          {$t("Reddet")}
        </Button>
        <Button className="flex-1" disabled={blocked} onClick={() => void onApprove()}>
          {$t("Bağlan")}
        </Button>
      </div>
    </Modal>
  );
}
