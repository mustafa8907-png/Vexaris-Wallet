import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Drawer } from "@/kit";
import { ArrowDownLeft } from "@/kit/ext";
import { TokenIcon } from "@/components/TokenIcon";
import { getChain } from "@/lib/chains/registry";
import { t as $t } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useHistoryStore } from "@/stores/historyStore";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  send: $t("Gönderim"),
  receive: $t("Alım"),
  swap: $t("Takas"),
  approve: $t("Onay"),
  contract: $t("Sözleşme"),
  self: $t("Kendine"),
};

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const records = useHistoryStore((s) => s.records);
  const locale = useSettingsStore((s) => s.locale);
  const tag = locale === "tr" ? "tr-TR" : "en-US";

  const items = records.slice(0, 12);

  return (
    <Drawer open={open} onClose={onClose} title={$t("Bildirimler")}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface2 text-muted">
            <ArrowUpRight size={20} />
          </span>
          <p className="text-[13px] text-muted">{$t("Henüz bildirim yok — işlemleriniz burada görünür.")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((r) => {
            const incoming = r.direction === "in";
            const chain = getChain(r.chainId);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/activity");
                  }}
                  className="flex w-full items-center gap-3 rounded-ctrl px-2.5 py-2.5 text-left transition-colors hover:bg-surface2"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      incoming ? "bg-oksoft text-ok" : "bg-surface2 text-muted",
                    )}
                  >
                    {incoming ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">
                      {KIND_LABEL[r.kind] ?? r.kind} · {r.symbol}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {chain?.shortName ?? r.chainId} · {new Date(r.timestamp).toLocaleString(tag, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <TokenIcon symbol={r.symbol} chainId={r.chainId} address={r.tokenAddress} size={22} badge={Boolean(r.tokenAddress)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
