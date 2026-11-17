import { useMemo, useState } from "react";
import { Button, Check, ChevronDown, Copy, Input, Lock, Modal, Plus, Star } from "@/kit";
import { Sliders } from "@/kit/ext";
import { ChainIcon } from "@/components/TokenIcon";
import { addressHint, isEvmChain, isValidAddress } from "@/lib/chains/address";
import { chainLabel } from "@/lib/swap/assets";
import { accountChains, useAccountStore } from "@/stores/accountStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWalletStore } from "@/stores/walletStore";
import { toast } from "@/stores/toastStore";
import { t as $t } from "@/lib/i18n";
import { cn, copyText, shortAddress } from "@/lib/utils";

const PREVIEW_ROWS = 5;

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const walletName = useSettingsStore((s) => s.walletName);
  const walletAddress = useWalletStore((s) => s.wallet?.address ?? "");
  const lock = useWalletStore((s) => s.lock);
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
    <Modal open={open} onClose={onClose} title={walletName} description={$t("Hesabının ağlardaki adresleri.")}>
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
                "flex items-center gap-2.5 rounded-ctrl border px-2.5 py-2 transition-colors",
                isDefault ? "border-brand/40 bg-brandsoft" : "border-line bg-surface2/60",
              )}
            >
              <button
                type="button"
                disabled={isDefault}
                onClick={() => {
                  setDefaultChain(chainId);
                  if (address) toast($t("Varsayılan adres: {0}", [chainLabel(chainId)]), "success");
                }}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                title={isDefault ? $t("Varsayılan adres") : $t("Bu adresi varsayılan yap")}
              >
                <ChainIcon chainId={chainId} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-text">{chainLabel(chainId)}</span>
                    {isDefault && (
                      <span className="flex shrink-0 items-center gap-1 rounded-xs bg-brand px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-bg">
                        <Star size={9} fill="currentColor" /> {$t("varsayılan")}
                      </span>
                    )}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-muted">
                    {address ? shortAddress(address, 7) : $t("adres kaydedilmemiş")}
                  </span>
                </span>
              </button>

              {address ? (
                <button
                  type="button"
                  onClick={() => void copy(address)}
                  className="grid size-8 shrink-0 place-items-center rounded-ctrl border border-line text-muted transition-colors hover:border-linestrong hover:text-text"
                  title={$t("Adresi kopyala")}
                  aria-label={$t("Adresi kopyala")}
                >
                  <Copy size={13} />
                </button>
              ) : null}

              {!isEvmChain(chainId) && (
                <button
                  type="button"
                  onClick={() => setEditing(chainId)}
                  className="grid size-8 shrink-0 place-items-center rounded-ctrl border border-line text-muted transition-colors hover:border-linestrong hover:text-text"
                  title={address ? $t("Adresi düzenle") : $t("Adresini ekle")}
                  aria-label={address ? $t("Adresi düzenle") : $t("Adresini ekle")}
                >
                  {address ? <Sliders size={13} /> : <Plus size={13} />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {chains.length > PREVIEW_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-ctrl border border-line bg-surface2/60 text-[11.5px] font-medium text-textsoft transition-colors hover:border-linestrong hover:text-text"
        >
          <ChevronDown size={13} className={cn("transition-transform", showAll && "rotate-180")} />
          {showAll ? $t("Daha az göster") : $t("Tümünü görüntüle ({0})", [chains.length])}
        </button>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-textsoft">{$t("Varsayılan adresi göster")}</span>
            <span className="block truncate text-[10.5px] text-muted">
              {$t("Varsayılan:")} {chainLabel(defaultChainId)}
            </span>
          </span>
          <select
            value={defaultChainId}
            onChange={(e) => setDefaultChain(e.target.value)}
            aria-label={$t("Varsayılan adres ağını seç")}
            className="h-9 shrink-0 rounded-ctrl border border-line bg-surface2 px-2 text-[12px] text-text outline-none focus:border-brand/50"
          >
            {chains.map((chainId) => (
              <option key={chainId} value={chainId} className="bg-surface">
                {chainLabel(chainId)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="soft"
          tone="danger"
          fullWidth
          className="mt-3"
          iconLeft={<Lock size={14} />}
          onClick={() => {
            void lock();
            onClose();
          }}
        >
          {$t("Cüzdanı kilitle")}
        </Button>
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
  const invalid = value.trim() !== "" && !isValidAddress(chainId, value);

  return (
    <div className="rounded-ctrl border border-brand/35 bg-surface2/70 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <ChainIcon chainId={chainId} size={18} />
        <span className="text-[12.5px] font-semibold text-text">{chainLabel(chainId)} {$t("adresin")}</span>
      </div>
      <Input
        autoFocus
        value={value}
        spellCheck={false}
        tone={invalid ? "error" : "default"}
        onChange={(e) => setValue(e.target.value.trim())}
        placeholder={addressHint(chainId)}
        className="font-mono text-[11.5px]"
      />
      {invalid && <p className="mt-1 text-[10.5px] text-danger">{$t("Bu ağ için geçerli bir adres değil.")}</p>}
      <div className="mt-2 flex gap-2">
        <Button variant="outline" fullWidth onClick={onCancel}>
          {$t("Vazgeç")}
        </Button>
        <Button tone="brand" className="flex-[1.4]" onClick={() => onSave(value)} iconLeft={<Check size={13} />}>
          {$t("Kaydet")}
        </Button>
      </div>
    </div>
  );
}
