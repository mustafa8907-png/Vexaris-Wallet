import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dropdown, IconButton, type MenuItem, Bell, Check, ChevronDown, Copy, Lock, Menu, Plus, Search, Settings as SettingsIcon } from "@/kit";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChainIcon } from "@/components/TokenIcon";
import { AccountModal } from "./AccountModal";
import { CoinSearch } from "./CoinSearch";
import { NotificationDrawer } from "@/components/shell/NotificationDrawer";
import { allChains, getChain } from "@/lib/chains/registry";
import { addressKind } from "@/lib/chains/address";
import { useAccountStore } from "@/stores/accountStore";
import { useChainStore } from "@/stores/chainStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWalletStore } from "@/stores/walletStore";
import { shortAddress, cn, copyText } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { t as $t } from "@/lib/i18n";

function useDismiss<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { ref, open, setOpen };
}

function AccountButton({ onOpen }: { onOpen: () => void }) {
  const walletName = useSettingsStore((s) => s.walletName);
  const wallet = useWalletStore((s) => s.wallet);
  const defaultChainId = useAccountStore((s) => s.defaultChainId);
  const custom = useAccountStore((s) => s.custom);
  const enabled = useChainStore((s) => s.enabledChainIds);

  const kindOf = addressKind(defaultChainId);
  const preview = [
    ...allChains().filter((c) => enabled.includes(c.id) && addressKind(c.id) === "evm").map((c) => c.id),
    "bitcoin",
    "solana",
    "tron",
  ].filter((id, i, list) => list.indexOf(id) === i);

  const address = kindOf === "evm" ? (wallet?.address ?? "") : (custom[defaultChainId] ?? "");

  async function copyAddress() {
    if (!address) {
      toast($t("adres ekle"), "info");
      return;
    }
    const ok = await copyText(address);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        title={$t("Hesap ve adresler")}
        className="group flex min-w-0 items-center gap-2 rounded-ctrl p-0.5 text-left"
      >
        <ProfileAvatar size={36} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-[11.5px] font-semibold tracking-tight text-text">
            <span className="max-w-[150px] truncate">{walletName}</span>
            <ChevronDown size={12} className="shrink-0 text-muted transition-transform group-hover:rotate-180" />
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="flex shrink-0 -space-x-1">
              {preview.slice(0, 3).map((id) => (
                <span key={id} className="grid size-[17px] place-items-center rounded-full bg-surface2 ring-1 ring-line">
                  <ChainIcon chainId={id} size={13} />
                </span>
              ))}
              {preview.length > 3 && (
                <span className="grid size-[17px] place-items-center rounded-full bg-surface3 text-[8px] font-semibold text-textsoft ring-1 ring-line">
                  +{preview.length - 3}
                </span>
              )}
            </span>
            <span className="min-w-0 truncate font-mono text-[11px] text-muted">
              {address ? shortAddress(address, 5) : $t("adres ekle")}
            </span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => void copyAddress()}
        title={$t("Adresi kopyala")}
        aria-label={$t("Adresi kopyala")}
        className="focus-ring hidden size-7 shrink-0 place-items-center rounded-ctrl text-muted transition-colors hover:bg-surface2 hover:text-text sm:grid"
      >
        <Copy size={13} />
      </button>
    </div>
  );
}

function NetworkChip() {
  const navigate = useNavigate();
  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const activeChainId = useChainStore((s) => s.activeChainId);
  const enabledChainIds = useChainStore((s) => s.enabledChainIds);
  const setActive = useChainStore((s) => s.setActive);
  const active = getChain(activeChainId);
  const chains = allChains().filter((c) => enabledChainIds.includes(c.id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={$t("Ağ seç")}
        className="flex h-10 max-w-[130px] items-center gap-1.5 rounded-ctrl border border-line bg-surface px-2.5 text-[12px] font-medium tracking-tight text-text transition-colors duration-150 hover:border-linestrong active:scale-[0.98] sm:max-w-none"
      >
        <ChainIcon chainId={activeChainId} size={17} />
        <span className="min-w-0 truncate">{active?.shortName ?? $t("Ağ")}</span>
        <ChevronDown size={12} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="anim-pop absolute right-0 top-12 z-50 max-h-[60vh] w-60 overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-2">
          {chains.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActive(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-ctrl px-2 py-2 text-[13px] text-textsoft transition-colors hover:bg-surface2 hover:text-text"
            >
              <ChainIcon chainId={c.id} size={18} />
              <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
              {c.custom && <span className="shrink-0 rounded-xs bg-surface3 px-1.5 py-0.5 text-[10px] font-medium text-muted">{$t("özel")}</span>}
              {c.id === activeChainId && <Check size={14} className="shrink-0 text-brand" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2.5 rounded-ctrl px-2 py-2 text-[12px] text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <Plus size={15} /> {$t("Ağ ekle / yönet")}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  onOpenNav,
  onToggleSidebar,
}: {
  onOpenNav: () => void;
  onToggleSidebar: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const lock = useWalletStore((s) => s.lock);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const menuItems: MenuItem[] = [
    { label: $t("Kenar çubuğu"), icon: <Menu size={15} />, onSelect: onToggleSidebar },
    { label: $t("Ayarlar"), icon: <SettingsIcon size={15} />, onSelect: () => navigate("/settings") },
    { separator: true },
    { label: $t("Cüzdanı kilitle"), icon: <Lock size={15} />, danger: true, onSelect: () => void lock() },
  ];

  return (
    <>
      <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line bg-bg/92 px-3 backdrop-blur-xs sm:gap-3 sm:px-4 lg:px-6">
        <span className="hidden shrink-0 flex-col leading-none sm:flex lg:hidden">
          <span className="font-display text-[13px] font-semibold tracking-tight text-text">Vexaris</span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-muted">Wallet</span>
        </span>
        <AccountButton onOpen={() => setAccountOpen(true)} />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <IconButton
            variant="outline"
            size="sm"
            label={$t("Menü")}
            className="hidden lg:inline-flex xl:hidden"
            onClick={onOpenNav}
          >
            <Menu size={16} />
          </IconButton>
          <NetworkChip />
          <IconButton
            variant="outline"
            size="sm"
            label={$t("Coin ara")}
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} />
          </IconButton>
          <IconButton variant="outline" size="sm" label={$t("Bildirimler")} onClick={() => setNotificationsOpen(true)}>
            <Bell size={16} />
          </IconButton>
          <IconButton variant="outline" size="sm" label={$t("Ayarlar")} className="lg:hidden" onClick={() => navigate("/settings")}>
            <SettingsIcon size={16} />
          </IconButton>
          <span className="hidden xl:block">
            <Dropdown
              align="end"
              items={menuItems}
              trigger={({ toggle }) => (
                <IconButton variant="outline" size="sm" label={$t("Menü")} onClick={toggle}>
                  <Menu size={16} />
                </IconButton>
              )}
            />
          </span>
        </div>
      </header>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <CoinSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  );
}
