import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CaretDown, Copy, Lock, List, Plus, MagnifyingGlass, GearSix } from "@phosphor-icons/react";
import { AccountModal } from "./AccountModal";
import { CoinSearch } from "./CoinSearch";
import { ChainIcon } from "@/components/TokenIcon";
import { allChains, getChain } from "@/lib/chains/registry";
import { addressKind } from "@/lib/chains/address";
import { useAccountStore } from "@/stores/accountStore";
import { useChainStore } from "@/stores/chainStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWalletStore } from "@/stores/walletStore";
import { copyText, shortAddress, cn } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";
import { toast } from "@/stores/toastStore";

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

  async function copy() {
    if (!address) {
      onOpen();
      return;
    }
    const ok = await copyText(address);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button
        onClick={onOpen}
        className="focus-ring group flex min-w-0 flex-col items-start gap-1 rounded-lg px-1 py-0.5 text-left"
        title={$t("Hesap ve adresler")}
      >
        <span className="hidden min-w-0 max-w-full items-center gap-1 text-[11px] font-medium text-zinc-400 transition-colors group-hover:text-white sm:flex">
          <span className="max-w-[160px] truncate">{walletName}</span>
          <CaretDown size={12} className="shrink-0 text-zinc-600 transition-transform group-hover:rotate-180" />
        </span>
        <span className="flex h-7 min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-full border border-white/[0.07] bg-surface-850 pl-1 pr-2.5 transition-colors group-hover:border-accent/40">
          <span className="hidden shrink-0 -space-x-1.5 sm:flex">
            {preview.slice(0, 3).map((id) => (
              <span key={id} className="grid h-[18px] w-[18px] place-items-center rounded-full bg-surface-900">
                <ChainIcon chainId={id} size={16} />
              </span>
            ))}
            {preview.length > 3 && (
              <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-surface-700 text-[8px] font-semibold text-zinc-300 ring-1 ring-white/10">
                +{preview.length - 3}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-mono text-[11px] text-zinc-300">
            {address ? shortAddress(address, 5) : $t("adres ekle")}
          </span>
        </span>
      </button>

      <button
        onClick={() => void copy()}
        title={$t("Adresi kopyala")}
        aria-label={$t("Adresi kopyala")}
        className="focus-ring hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.07] bg-surface-850 text-zinc-400 transition-colors hover:border-accent/40 hover:text-white sm:grid"
      >
        <Copy size={12} />
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
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={$t("Ağ seç")}
        className="focus-ring flex h-9 max-w-[136px] items-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-850 px-2.5 text-[12px] text-zinc-300 transition-colors hover:border-accent/40 hover:text-white sm:max-w-none"
      >
        <ChainIcon chainId={activeChainId} size={17} />
        <span className="min-w-0 truncate">{active?.shortName ?? $t("Ağ")}</span>
        <CaretDown size={12} className={cn("shrink-0 text-zinc-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 max-h-[60vh] w-56 animate-fade-in overflow-y-auto rounded-xl border border-white/[0.08] bg-surface-800 p-1 shadow-lift">
          {chains.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActive(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
            >
              <ChainIcon chainId={c.id} size={18} />
              <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
              {c.custom && <span className="chip shrink-0 text-violet">{$t("özel")}</span>}
              {c.id === activeChainId && <Check size={14} className="shrink-0 text-accent" />}
            </button>
          ))}
          <div className="hairline my-1 h-px" />
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <Plus size={15} /> {$t("Ağ ekle / yönet")}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuButton({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate();
  const lock = useWalletStore((s) => s.lock);
  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={$t("Menü")}
        className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-surface-850 text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
      >
        <List size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 animate-fade-in rounded-xl border border-white/[0.08] bg-surface-800 p-1 shadow-lift">
          {[
            { label: $t("Kenar çubuğu"), icon: List, onClick: onToggleSidebar },
            { label: $t("Ayarlar"), icon: GearSix, onClick: () => navigate("/settings") },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={() => {
                onClick();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
            >
              <Icon size={15} /> {label}
            </button>
          ))}
          <div className="hairline my-1 h-px" />
          <button
            onClick={() => {
              setOpen(false);
              void lock();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <Lock size={15} /> {$t("Cüzdanı kilitle")}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-surface-900 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
        <AccountButton onOpen={() => setAccountOpen(true)} />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NetworkChip />
          <button
            onClick={() => setSearchOpen(true)}
            title={$t("Coin ara")}
            aria-label={$t("Coin ara")}
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-surface-850 text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
          >
            <MagnifyingGlass size={15} />
          </button>
          <Link
            to="/settings"
            title={$t("Ayarlar")}
            aria-label={$t("Ayarlar")}
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-surface-850 text-zinc-400 transition-colors hover:border-accent/40 hover:text-white lg:hidden"
          >
            <GearSix size={15} />
          </Link>
          <MenuButton onToggleSidebar={onToggleSidebar} />
        </div>
      </header>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
      {searchOpen && <CoinSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}
