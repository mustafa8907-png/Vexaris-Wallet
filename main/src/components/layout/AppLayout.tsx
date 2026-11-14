import { lazy, Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { ToastHost } from "@/components/ui/ToastHost";
import { ConnectSheet } from "@/components/browser/ConnectSheet";

// sign-client + core paketleri ağır; ilk çizimi bekletmemek için katman
// ayrı chunk'ta, boş fallback'le yüklenir.
const WalletConnectLayer = lazy(() =>
  import("@/components/walletconnect/WalletConnectLayer").then((m) => ({
    default: m.WalletConnectLayer,
  })),
);

export function AppLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <Sidebar open={navOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={() => setNavOpen((v) => !v)} />
        <main className="min-h-0 flex-1">
          <div key={location.pathname} className="h-full animate-fade-up">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
      <ToastHost />
      {/* Site bağlantı isteği, kullanıcı hangi sekmede olursa olsun görünür. */}
      <ConnectSheet />
      {/* Onay pencereleri gezinmenin üstünde: sekme değişse de açık kalırlar. */}
      <Suspense fallback={null}>
        <WalletConnectLayer />
      </Suspense>
    </div>
  );
}
