import { NavLink } from "react-router-dom";
import { Link, Copy, ClockCounterClockwise, Image, MagnifyingGlass, SquaresFour, GearSix } from "@phosphor-icons/react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { t as $t } from "@/lib/i18n";
import { toast } from "@/stores/toastStore";
import { copyText, shortAddress, cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: $t("Portföy"), icon: SquaresFour },
  { to: "/activity", label: $t("İşlemler"), icon: ClockCounterClockwise },
  { to: "/nfts", label: $t("Koleksiyon"), icon: Image },
  { to: "/browser", label: $t("Tarayıcı"), icon: MagnifyingGlass },
  { to: "/connections", label: $t("Bağlantılar"), icon: Link },
  { to: "/settings", label: $t("Ayarlar"), icon: GearSix },
];

export function Sidebar({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-surface-900 lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <ProfileAvatar size={32} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight tracking-[0.02em] text-white">
            Vexaris
          </span>
          <span className="block text-[9px] font-medium uppercase tracking-[0.22em] text-accent/80">
            Wallet
          </span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-accent-soft text-white"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200",
              )
            }
          >
            <Icon size={16} className="shrink-0" />
            {$t(label)}
          </NavLink>
        ))}
      </nav>

      <WalletCopyButton />

      <div className="px-5 pb-4 text-[10px] text-zinc-600">v0.1.0</div>
    </aside>
  );
}

function WalletCopyButton() {
  const address = useWalletStore((s) => s.wallet?.address ?? "");
  const walletName = useSettingsStore((s) => s.walletName);

  async function copy() {
    if (!address) {
      toast($t("Önce bir cüzdan oluştur veya içe aktar"), "info");
      return;
    }
    const ok = await copyText(address);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  return (
    <button
      onClick={() => void copy()}
      className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-surface-850 p-2.5 text-left transition-colors hover:border-white/[0.12]"
      title={$t("Adresi kopyala")}
      aria-label={$t("Adresi kopyala")}
    >
      <ProfileAvatar size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-zinc-100">{walletName}</span>
        <span className="block truncate font-mono text-[10px] text-zinc-500">
          {address ? shortAddress(address, 4) : "—"}
        </span>
      </span>
      <Copy size={13} className="shrink-0 text-zinc-600" />
    </button>
  );
}
