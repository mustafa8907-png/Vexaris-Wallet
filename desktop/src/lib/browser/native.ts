/**
 * Native dApp tarayıcısına açılan tek kapı.
 *
 * Sekmeler Android tarafında gerçek `WebView` nesneleri; React yalnızca
 * dikdörtgen gönderir ve olayları dinler. Buradaki hiçbir fonksiyon mağaza
 * bilmez — böylece onay kuyruğu ile tarayıcı arasında döngü oluşmaz.
 *
 * Komut adları snake_case gönderilir: Tauri izin denetimini `allow-<kebab>`
 * üzerinden yapar, Kotlin tarafına lowerCamelCase olarak çevirir.
 */
import { addPluginListener, invoke as tauriInvoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri/ipc";

export interface NativeTabState {
  id: string;
  url: string;
  title: string;
  favicon?: string | null;
  progress: number;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  desktop: boolean;
  crashed: boolean;
  error?: string | null;
}

export interface NativeProviderRequest {
  id: string;
  requestId: number;
  method: string;
  params: unknown[];
  origin: string;
  url: string;
}

export interface NativePairUri {
  id: string;
  uri: string;
}

export interface NativeExternal {
  id: string;
  url: string;
  opened: boolean;
}

export interface NativeShowResult {
  id: string;
  previousId?: string | null;
  previousImage?: string | null;
}

export interface ProviderState {
  chainId: string | null;
  accounts: string[];
  connected: boolean;
}

export interface BrowserHandlers {
  onState: (state: NativeTabState) => void;
  onProviderRequest: (request: NativeProviderRequest) => void;
  onPairUri: (event: NativePairUri) => void;
  onExternal: (event: NativeExternal) => void;
  onClosed: (event: { id: string }) => void;
}

/** Uygulama içi tarayıcı yalnızca Android'de var; masaüstü kendi yolunu çizer. */
export function hasNativeBrowser(): boolean {
  return isTauri() && /android/i.test(navigator.userAgent);
}

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(`plugin:vexwebview|${command}`, args);
}

export const nativeBrowser = {
  create: (args: {
    id: string;
    url?: string;
    chainId?: string | null;
    accounts?: string[];
    connected?: boolean;
    desktop?: boolean;
  }) => call<{ id: string }>("create", args),

  setBounds: (rect: { x: number; y: number; width: number; height: number }) =>
    call<void>("set_bounds", rect),

  show: (id: string) => call<NativeShowResult>("show", { id }),
  hide: (id: string) => call<void>("hide", { id }),
  setVisible: (visible: boolean) => call<void>("set_visible", { visible }),

  loadUrl: (id: string, url: string) => call<void>("load_url", { id, url }),
  goBack: (id: string) => call<void>("go_back", { id }),
  goForward: (id: string) => call<void>("go_forward", { id }),
  reload: (id: string) => call<void>("reload", { id }),
  stopLoading: (id: string) => call<void>("stop_loading", { id }),
  setDesktopMode: (id: string, enabled: boolean) => call<void>("set_desktop_mode", { id, enabled }),

  close: (id: string) => call<void>("close", { id }),
  closeAll: () => call<void>("close_all"),

  respond: (args: {
    id: string;
    requestId: number;
    method?: string;
    result?: unknown;
    error?: { code: number; message: string };
  }) => call<void>("respond", args),

  setProvider: (id: string, state: ProviderState) => call<void>("set_provider", { id, ...state }),
  clearData: () => call<void>("clear_data"),
  snapshot: (id: string, width = 320) =>
    call<{ id: string; image?: string | null }>("snapshot", { id, width }),
};

/** Olay dinleyicilerini bağlar; dönen fonksiyon hepsini kaldırır. */
export async function listenBrowser(handlers: BrowserHandlers): Promise<() => void> {
  const listeners = await Promise.all([
    addPluginListener<NativeTabState>("vexwebview", "tabState", handlers.onState),
    addPluginListener<NativeProviderRequest>("vexwebview", "providerRequest", handlers.onProviderRequest),
    addPluginListener<NativePairUri>("vexwebview", "pairUri", handlers.onPairUri),
    addPluginListener<NativeExternal>("vexwebview", "external", handlers.onExternal),
    addPluginListener<{ id: string }>("vexwebview", "tabClosed", handlers.onClosed),
  ]);
  return () => {
    for (const listener of listeners) void listener.unregister().catch(() => undefined);
  };
}