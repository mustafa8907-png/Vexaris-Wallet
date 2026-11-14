import { useEffect, useRef, useState } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import type { PluginListener } from "@tauri-apps/api/core";
import { BrowserChrome } from "@/components/browser/BrowserChrome";
import { BrowserView } from "@/components/browser/BrowserView";
import { BrowserMenu } from "@/components/browser/BrowserMenu";
import { TabSwitcher } from "@/components/browser/TabSwitcher";
import { useBrowserStore } from "@/stores/browserStore";
import { useWalletConnectStore } from "@/stores/walletConnectStore";

type Overlay = "none" | "tabs" | "menu";

export function BrowserPage() {
  const init = useBrowserStore((s) => s.init);
  const setPresent = useBrowserStore((s) => s.setPresent);
  const supported = useBrowserStore((s) => s.supported);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const overlayRef = useRef<Overlay>("none");
  overlayRef.current = overlay;

  useEffect(() => {
    void init();
    setPresent(true);
    return () => setPresent(false);
  }, [init, setPresent]);

  useEffect(() => {
    if (overlay === "none") return;
    return useBrowserStore.getState().cover();
  }, [overlay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlay("none");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!supported) return;
    let listener: PluginListener | null = null;
    let disposed = false;

    void onBackButtonPress(() => {
      const state = useBrowserStore.getState();
      if (state.connectPrompt) {
        void state.rejectConnect();
        return;
      }
      const approval = useWalletConnectStore.getState();
      if (approval.queue.length) {
        void approval.rejectRequest();
        return;
      }
      if (overlayRef.current !== "none") {
        setOverlay("none");
        return;
      }
      const tab = state.tabs.find((item) => item.id === state.activeId);
      if (tab?.canGoBack) void state.back();
      else if (tab?.url) void state.goHome();
      else if (window.history.length > 1) window.history.back();
      else window.location.hash = "#/";
    }).then((handle) => {
      if (disposed) void handle.unregister();
      else listener = handle;
    });

    return () => {
      disposed = true;
      void listener?.unregister();
    };
  }, [supported]);

  return (
    <div className="relative z-10 flex h-full flex-col overflow-hidden">
      <BrowserChrome onOpenTabs={() => setOverlay("tabs")} onOpenMenu={() => setOverlay("menu")} />
      <BrowserView />
      {overlay === "tabs" && <TabSwitcher onClose={() => setOverlay("none")} />}
      {overlay === "menu" && <BrowserMenu onClose={() => setOverlay("none")} />}
    </div>
  );
}