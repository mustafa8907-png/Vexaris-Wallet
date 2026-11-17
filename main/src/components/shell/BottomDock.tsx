import { NavLink } from "react-router-dom";
import { Box, Clock, Grid } from "@/kit";
import { Globe, Send } from "@/kit/ext";
import { t as $t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: $t("Portföy"), icon: Grid },
  { to: "/activity", label: $t("İşlemler"), icon: Clock },
  { to: "/nfts", label: $t("Koleksiyon"), icon: Box },
  { to: "/browser", label: $t("Tarayıcı"), icon: Globe },
];

export function BottomDock() {
  return (
    <nav
      className="relative z-30 shrink-0 border-t border-line bg-bg/92 backdrop-blur-xs lg:hidden"
      aria-label={$t("Ana menü")}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-center px-1.5 pb-[env(safe-area-inset-bottom)] pt-1">
        {TABS.slice(0, 2).map((tab) => (
          <DockTab key={tab.to} {...tab} />
        ))}
        <li className="flex justify-center">
          <NavLink
            to="/send"
            title={$t("Gönder")}
            aria-label={$t("Gönder")}
            className={({ isActive }) =>
              cn(
                "-mt-3 grid h-[60px] w-[60px] place-items-center rounded-full bg-brand text-white shadow-2 transition-transform duration-150 active:scale-95",
                isActive && "ring-2 ring-text/30 ring-offset-2 ring-offset-bg",
              )
            }
          >
            <Send size={24} />
          </NavLink>
        </li>
        {TABS.slice(2).map((tab) => (
          <DockTab key={tab.to} {...tab} />
        ))}
      </ul>
    </nav>
  );
}

function DockTab({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Grid }) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === "/"}
        className="flex min-h-12 items-center justify-center"
      >
        {({ isActive }) => (
          <span
            className={cn(
              "flex min-w-[64px] flex-col items-center gap-1 rounded-ctrl px-3 py-1.5 transition-colors duration-150",
              isActive ? "bg-text text-bg" : "text-muted",
            )}
          >
            <Icon size={19} strokeWidth={isActive ? 2.3 : 1.7} />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </span>
        )}
      </NavLink>
    </li>
  );
}
