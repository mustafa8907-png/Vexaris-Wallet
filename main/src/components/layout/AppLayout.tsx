import { lazy, Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomDock } from "@/components/shell/BottomDock";
import { ConnectSheet } from "@/components/browser/ConnectSheet";

const WalletConnectLayer = lazy(() =>
  import("@/components/walletconnect/WalletConnectLayer").then((m) => ({
    default: m.WalletConnectLayer,
  })),
);

export function AppLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg text-text">
      <Sidebar open={navOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={() => setNavOpen((v) => !v)} />
        <main className="min-h-0 flex-1">
          <div key={location.pathname} className="h-full animate-fade-up">
            <Outlet />
          </div>
        </main>
        <BottomDock />
      </div>
      <ConnectSheet />
      <Suspense fallback={null}>
        <WalletConnectLayer />
      </Suspense>
    </div>
  );
}
