import { NavLink } from "react-router-dom";
import { Button, Clock, Copy, Grid, Link, Settings, Box, cn } from "@/kit";
import { Globe, Send } from "@/kit/ext";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { t as $t } from "@/lib/i18n";
import { toast } from "@/stores/toastStore";
import { copyText, shortAddress } from "@/lib/utils";

export const NAV = [
  { to: "/", label: $t("Portföy"), icon: Grid },
  { to: "/activity", label: $t("İşlemler"), icon: Clock },
  { to: "/nfts", label: $t("Koleksiyon"), icon: Box },
  { to: "/browser", label: $t("Tarayıcı"), icon: Globe },
  { to: "/connections", label: $t("Bağlantılar"), icon: Link },
  { to: "/settings", label: $t("Ayarlar"), icon: Settings },
];

export function NavItems({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "focus-ring flex items-center gap-3 rounded-ctrl px-3 py-2 text-[13px] font-medium transition-colors duration-150",
              isActive ? "bg-text text-bg" : "text-muted hover:bg-surface2 hover:text-text",
            )
          }
        >
          <Icon size={16} className="shrink-0" />
          {$t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-bg xl:flex">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <ProfileAvatar size={34} />
        <span className="min-w-0">
          <span className="block truncate font-display text-[14px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Vexaris
          </span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-muted">Wallet</span>
        </span>
      </div>

      <div className="px-3 pb-3">
        <Button tone="brand" fullWidth href="#/send" iconLeft={<Send size={15} />}>
          {$t("Gönder")}
        </Button>
      </div>

      <NavItems className="flex-1 px-3" />

      <WalletCopyButton />

      <div className="px-4 pb-4 text-[10px] text-muted">v0.1.0</div>
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
      className="focus-ring mx-3 mb-3 flex items-center gap-2.5 rounded-card border border-line bg-surface2/60 p-2.5 text-left transition-colors hover:border-linestrong"
      title={$t("Adresi kopyala")}
      aria-label={$t("Adresi kopyala")}
    >
      <ProfileAvatar size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-text">{walletName}</span>
        <span className="block truncate font-mono text-[10px] text-muted">
          {address ? shortAddress(address, 4) : "—"}
        </span>
      </span>
      <Copy size={13} className="shrink-0 text-muted" />
    </button>
  );
}
