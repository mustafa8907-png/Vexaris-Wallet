import { t as $t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Check, CaretDown, Copy, PencilSimple, Plus, Star } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { ChainIcon } from "@/components/TokenIcon";
import { addressHint, isEvmChain, isValidAddress } from "@/lib/chains/address";
import { chainLabel } from "@/lib/swap/assets";
import { accountChains, useAccountStore } from "@/stores/accountStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";
import { cn, copyText, shortAddress } from "@/lib/utils";


const PREVIEW_ROWS = 5;

export function AccountModal({ onClose }: { onClose: () => void }) {
  const walletName = useSettingsStore((s) => s.walletName);
  const walletAddress = useWalletStore((s) => s.wallet?.address ?? "");
  const custom = useAccountStore((s) => s.custom);
  const defaultChainId = useAccountStore((s) => s.defaultChainId);
  const setDefaultChain = useAccountStore((s) => s.setDefaultChain);
  const saveAddress = useAccountStore((s) => s.saveAddress);

  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const chains = useMemo(() => accountChains(), [walletAddress, custom]);
  const rows = showAll ? chains : chains.slice(0, PREVIEW_ROWS);

  async function copy(value: string) {
    if (!value) return;
    const ok = await copyText(value);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  return (
    <Modal title={walletName} description={$t("Hesabının ağlardaki adresleri.")} onClose={onClose}>
      <div className="space-y-1.5">
        {rows.map((chainId) => {
          const address = isEvmChain(chainId) ? walletAddress : (custom[chainId] ?? "");
          const isDefault = chainId === defaultChainId;
          if (editing === chainId) {
            return (
              <AddressEditor
                key={chainId}
                chainId={chainId}
                initial={address}
                onCancel={() => setEditing(null)}
                onSave={(value) => {
                  if (!saveAddress(chainId, value)) {
                    toast($t("Geçersiz adres — {0}", [addressHint(chainId)]), "info");
                    return;
                  }
                  setEditing(null);
                  toast($t("Adres kaydedildi"), "success");
                }}
              />
            );
          }
          return (
            <div
              key={chainId}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
                isDefault ? "border-accent/25 bg-accent/[0.04]" : "border-white/[0.06] bg-surface-800/45",
              )}
            >
              <ChainIcon chainId={chainId} size={22} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-medium text-white">
                    {chainLabel(chainId)}
                  </span>
                  {isDefault && (
                    <span className="chip shrink-0 border-accent/30 bg-accent-soft text-accent">
                      <Star size={9} className="fill-current" /> {$t("varsayılan")}
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-[10px] text-zinc-500">
                  {address ? shortAddress(address, 7) : $t("adres kaydedilmemiş")}
                </div>
              </div>

              {address ? (
                <button
                  onClick={() => void copy(address)}
                  className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
                  title={$t("Adresi kopyala")}
                >
                  <Copy size={12} />
                </button>
              ) : null}

              {!isEvmChain(chainId) && (
                <button
                  onClick={() => setEditing(chainId)}
                  className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
                  title={address ? $t("Adresi düzenle") : $t("Adresini ekle")}
                >
                  {address ? <PencilSimple size={12} /> : <Plus size={12} />}
                </button>
              )}

              {!isDefault && (
                <button
                  onClick={() => setDefaultChain(chainId)}
                  className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] text-zinc-500 transition-colors hover:border-accent/40 hover:text-accent"
                  title={$t("Varsayılan adres olarak seç")}
                >
                  <Star size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {chains.length > PREVIEW_ROWS && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="focus-ring mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-surface-800/60 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
        >
          <CaretDown size={13} className={cn("transition-transform", showAll && "rotate-180")} />
          {showAll ? $t("Daha az göster") : $t("Tümünü görüntüle ({0})", [chains.length])}
        </button>
      )}

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[11px] text-zinc-300">{$t("Varsayılan adresi göster")}</span>
            <span className="block truncate text-[10px] text-zinc-600">
              {$t("Varsayılan:")} {chainLabel(defaultChainId)}
            </span>
          </span>
          <select
            value={defaultChainId}
            onChange={(e) => setDefaultChain(e.target.value)}
            aria-label={$t("Varsayılan adres ağını seç")}
            className="focus-ring h-8 shrink-0 rounded-lg border border-white/[0.07] bg-surface-800 px-2 text-[11px] text-zinc-200 outline-none"
          >
            {chains.map((chainId) => (
              <option key={chainId} value={chainId} className="bg-surface-800">
                {chainLabel(chainId)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}

function AddressEditor({
  chainId,
  initial,
  onCancel,
  onSave,
}: {
  chainId: string;
  initial: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ok = value.trim() === "" || isValidAddress(chainId, value);

  return (
    <div className="rounded-xl border border-accent/25 bg-surface-800/60 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <ChainIcon chainId={chainId} size={18} />
        <span className="text-[12px] font-medium text-white">{chainLabel(chainId)} adresin</span>
      </div>
      <input
        autoFocus
        value={value}
        spellCheck={false}
        onChange={(e) => setValue(e.target.value.trim())}
        placeholder={addressHint(chainId)}
        className={cn(
          "w-full rounded-lg border bg-surface-850 px-2.5 py-2 font-mono text-[11px] text-white outline-none transition-colors placeholder:text-zinc-600",
          ok ? "border-white/[0.08] focus:border-accent/45" : "border-danger/45",
        )}
      />
      {!ok && <p className="mt-1 text-[10px] text-danger/90">{$t("Bu ağ için geçerli bir adres değil.")}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={onCancel}
          className="focus-ring flex-1 rounded-lg border border-white/[0.07] py-1.5 text-[11px] text-zinc-400 transition-colors hover:text-white"
        >
          {$t("Vazgeç")}
        </button>
        <button
          onClick={() => onSave(value)}
          className="focus-ring flex flex-[1.4] items-center justify-center gap-1.5 rounded-lg bg-accent py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Check size={12} /> {$t("Kaydet")}
        </button>
      </div>
    </div>
  );
}
