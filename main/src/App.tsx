import { t as $t } from "@/lib/i18n";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { ThemeProvider, ToastProvider } from "@/kit";
import { ToastBridge } from "@/components/shell/ToastBridge";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyLocale } from "@/lib/utils";

const WelcomePage = lazy(() =>
  import("@/pages/WelcomePage").then((m) => ({ default: m.WelcomePage })),
);
const UnlockPage = lazy(() => import("@/pages/UnlockPage").then((m) => ({ default: m.UnlockPage })));
const TokenDetailPage = lazy(() =>
  import("@/pages/TokenDetailPage").then((m) => ({ default: m.TokenDetailPage })),
);
const ActivityPage = lazy(() =>
  import("@/pages/ActivityPage").then((m) => ({ default: m.ActivityPage })),
);
const SendPage = lazy(() => import("@/pages/SendPage").then((m) => ({ default: m.SendPage })));
const ReceivePage = lazy(() =>
  import("@/pages/ReceivePage").then((m) => ({ default: m.ReceivePage })),
);
const SwapPage = lazy(() => import("@/pages/SwapPage").then((m) => ({ default: m.SwapPage })));
const NftsPage = lazy(() => import("@/pages/NftsPage").then((m) => ({ default: m.NftsPage })));
const BrowserPage = lazy(() =>
  import("@/pages/BrowserPage").then((m) => ({ default: m.BrowserPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ConnectionsPage = lazy(() =>
  import("@/pages/ConnectionsPage").then((m) => ({ default: m.ConnectionsPage })),
);

function Splash() {
  return (
    <div className="screen-center">
      <div className="flex animate-fade-in flex-col items-center gap-4">
        <ProfileAvatar size={52} />
        <span className="text-xs text-muted">{$t("Cüzdan yükleniyor…")}</span>
      </div>
    </div>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { unlocked, initialized } = useWalletStore();
  const isSetUp = useSettingsStore((s) => s.isSetUp);

  if (!initialized) return <Splash />;
  if (!isSetUp) return <Navigate to="/welcome" replace />;
  if (!unlocked) return <Navigate to="/unlock" replace />;
  return <>{children}</>;
}

function Guest({ children }: { children: ReactNode }) {
  const initialized = useWalletStore((s) => s.initialized);
  if (!initialized) return <Splash />;
  return <>{children}</>;
}

export default function App() {
  const init = useWalletStore((s) => s.init);
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <ToastBridge />
        <HashRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/welcome" element={<Guest><WelcomePage /></Guest>} />
          <Route path="/unlock" element={<Guest><UnlockPage /></Guest>} />

          <Route
            element={
              <Guard>
                <AppLayout />
              </Guard>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/token/gecko/:id" element={<TokenDetailPage />} />
            <Route path="/token/:chainId/:asset" element={<TokenDetailPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/receive" element={<ReceivePage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/nfts" element={<NftsPage />} />
            <Route path="/browser" element={<BrowserPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
