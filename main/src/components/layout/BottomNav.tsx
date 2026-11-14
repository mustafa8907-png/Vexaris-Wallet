import { NavLink } from "react-router-dom";
import { ClockCounterClockwise, Image, MagnifyingGlass, SquaresFour } from "@phosphor-icons/react";
import { t as $t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: $t("Portföy"), icon: SquaresFour },
  { to: "/activity", label: $t("İşlemler"), icon: ClockCounterClockwise },
  { to: "/nfts", label: $t("Koleksiyon"), icon: Image },
  { to: "/browser", label: $t("Tarayıcı"), icon: MagnifyingGlass },
];

export function BottomNav() {
  return (
    <nav
      className="shrink-0 border-t border-white/[0.07] bg-surface-900/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={$t("Ana menü")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "focus-ring flex h-[52px] flex-col items-center justify-center gap-1 rounded-b-none transition-colors",
                  isActive ? "text-accent" : "text-zinc-500 hover:text-zinc-300",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} weight={isActive ? "fill" : "bold"} />
                  <span className="text-[10px] font-medium leading-none">{$t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
