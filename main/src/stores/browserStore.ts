import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t as $t } from "@/lib/i18n";
import type { Chain } from "@/types/chain";
import { findChainByNumber, getChain } from "@/lib/chains/registry";
import { siteRisk } from "@/lib/api/security";
import { toCaip2 } from "@/lib/walletconnect/chains";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";
import { useWalletConnectStore, type WcRequest } from "@/stores/walletConnectStore";
import { toast } from "@/stores/toastStore";
import { faviconGuess, hostOf, originOf, resolveAddress, titleFor } from "@/lib/browser/address";
import { hasNativeBrowser, listenBrowser, nativeBrowser, type NativeTabState } from "@/lib/browser/native";
import { routeProviderRequest } from "@/lib/browser/provider";

export const MAX_TABS = 12;
const MAX_HISTORY = 240;

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  progress: number;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  desktop: boolean;
  crashed: boolean;
  error: string;
  image: string;
  chainKey: string;
  mounted: boolean;
}

export interface DappConnection {
  origin: string;
  name: string;
  favicon: string;
  chainKey: string;
  address: string;
  connectedAt: number;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon: string;
  addedAt: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon: string;
  visitedAt: number;
}

export interface ConnectPrompt {
  tabId: string;
  requestId: number;
  kind: "accounts" | "permissions";
  origin: string;
  name: string;
  favicon: string;
  chainKey: string;
  phishing: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserState {
  supported: boolean;
  ready: boolean;
  tabs: BrowserTab[];
  activeId: string;
  connections: Record<string, DappConnection>;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  connectPrompt: ConnectPrompt | null;
  flagged: Record<string, boolean>;
  viewport: Viewport;
  present: boolean;
  covers: number;

  init: () => Promise<void>;
  setPresent: (present: boolean) => void;
  setViewport: (viewport: Viewport) => void;
  cover: () => () => void;

  openTab: (url?: string, chainKey?: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  closeAll: () => Promise<void>;
  navigate: (input: string) => Promise<void>;
  go: (url: string) => Promise<void>;
  goHome: () => Promise<void>;
  back: () => Promise<void>;
  forward: () => Promise<void>;
  reload: () => Promise<void>;
  stop: () => Promise<void>;
  toggleDesktop: () => Promise<void>;
  setTabChain: (id: string, chainKey: string) => Promise<void>;
  requestConnect: (tabId?: string) => void;
  snapshotActive: () => Promise<void>;

  approveConnect: () => Promise<void>;
  rejectConnect: () => Promise<void>;
  disconnect: (origin: string) => Promise<void>;
  toggleBookmark: (url: string, title: string, favicon: string) => void;
  removeBookmark: (id: string) => void;
  clearHistory: () => void;
  clearSiteData: () => Promise<void>;
}

let tabCounter = 0;
let queueCounter = 1_000_000_000;
let stopListening: (() => void) | null = null;
let booting: Promise<void> | null = null;
const lastOrigin = new Map<string, string>();

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(tabCounter++).toString(36)}`;

function browserChainKey(chainKey: string): string {
  return getChain(chainKey)?.kind === "evm" ? chainKey : "ethereum";
}

function newTab(url: string, chainKey: string): BrowserTab {
  return {
    id: uid("t"),
    url,
    title: "",
    favicon: url ? faviconGuess(url) : "",
    progress: 0,
    loading: Boolean(url),
    canGoBack: false,
    canGoForward: false,
    desktop: false,
    crashed: false,
    error: "",
    image: "",
    chainKey: browserChainKey(chainKey),
    mounted: false,
  };
}

function chainHex(chain: Chain): string {
  return `0x${(chain.chainId ?? 1).toString(16)}`;
}

function tabChain(tab: BrowserTab): Chain {
  return getChain(tab.chainKey) ?? getChain(useChainStore.getState().activeChainId) ?? getChain("ethereum")!;
}

function currentAddress(): string {
  const state = useWalletStore.getState();
  return state.unlocked ? (state.wallet?.address ?? "") : "";
}

export const useBrowserStore = create<BrowserState>()(
  persist(
    (set, get) => {
      const patchTab = (id: string, patch: Partial<BrowserTab>) =>
        set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)) }));

      const activeTab = () => get().tabs.find((tab) => tab.id === get().activeId);

      let lastVisible: boolean | null = null;

      const applyVisibility = () => {
        if (!get().ready) return;
        const tab = activeTab();
        const show =
          get().present &&
          get().covers === 0 &&
          useWalletStore.getState().unlocked &&
          Boolean(tab?.mounted && tab.url && !tab.crashed && !tab.error);
        if (show === lastVisible) return;
        lastVisible = show;
        void nativeBrowser.setVisible(show).catch(() => undefined);
      };

      const pushBounds = () => {
        if (!get().ready) return;
        void nativeBrowser.setBounds(get().viewport).catch(() => undefined);
      };

      const syncTab = (tab: BrowserTab) => {
        if (!tab.mounted) return;
        const origin = originOf(tab.url);
        const address = currentAddress();
        const connection = origin ? get().connections[origin] : undefined;
        const linked = Boolean(connection && address && connection.address === address);
        void nativeBrowser
          .setProvider(tab.id, {
            chainId: chainHex(tabChain(tab)),
            accounts: linked ? [address] : [],
            connected: linked,
          })
          .catch(() => undefined);
      };

      const syncAll = () => get().tabs.forEach(syncTab);

      const remember = (tab: BrowserTab) => {
        if (!tab.url || !originOf(tab.url)) return;
        const entry: HistoryEntry = {
          id: uid("h"),
          url: tab.url,
          title: titleFor(tab.url, tab.title),
          favicon: tab.favicon,
          visitedAt: Date.now(),
        };
        set((state) => {
          const head = state.history[0];
          if (head && head.url === entry.url) {
            return { history: [{ ...entry, id: head.id }, ...state.history.slice(1)] };
          }
          return { history: [entry, ...state.history].slice(0, MAX_HISTORY) };
        });
      };

      const mount = async (tab: BrowserTab, url?: string) => {
        const target = url ?? tab.url;
        const chain = tabChain(tab);
        const origin = originOf(target);
        const address = currentAddress();
        const connection = origin ? get().connections[origin] : undefined;
        const linked = Boolean(connection && address && connection.address === address);

        if (!tab.mounted) {
          await nativeBrowser.create({
            id: tab.id,
            url: target || undefined,
            chainId: chainHex(chain),
            accounts: linked ? [address] : [],
            connected: linked,
            desktop: tab.desktop,
          });
          patchTab(tab.id, { mounted: true, url: target });
        } else if (url !== undefined && url !== tab.url) {
          patchTab(tab.id, { url, error: "", crashed: false, loading: true, progress: 0 });
          await nativeBrowser.loadUrl(tab.id, url);
        }
        if (target) void checkSite(target);
      };

      const checkSite = async (url: string) => {
        const origin = originOf(url);
        if (!origin || get().flagged[origin] !== undefined) return;
        const risk = await siteRisk(url);
        if (risk.unknown) return;
        set((state) => ({ flagged: { ...state.flagged, [origin]: risk.phishing } }));
        if (risk.phishing) {
          toast($t("{0} oltalama listesinde — bağlanma", [hostOf(url)]), "error");
        }
      };

      const respond = (tabId: string, requestId: number, method: string, result: unknown) =>
        nativeBrowser.respond({ id: tabId, requestId, method, result }).catch(() => undefined);

      const fail = (tabId: string, requestId: number, code: number, message: string) =>
        nativeBrowser.respond({ id: tabId, requestId, error: { code, message } }).catch(() => undefined);

      const onState = (state: NativeTabState) => {
        const tab = get().tabs.find((item) => item.id === state.id);
        if (!tab) return;
        const url = state.url === "about:blank" ? "" : state.url;
        const patch: Partial<BrowserTab> = {
          url,
          title: state.title ?? "",
          favicon: state.favicon || tab.favicon || faviconGuess(url),
          progress: state.progress ?? 0,
          loading: Boolean(state.loading),
          canGoBack: Boolean(state.canGoBack),
          canGoForward: Boolean(state.canGoForward),
          crashed: Boolean(state.crashed),
          error: state.error ?? "",
          mounted: true,
        };
        patchTab(state.id, patch);

        const origin = originOf(url);
        if (origin !== lastOrigin.get(state.id)) {
          lastOrigin.set(state.id, origin);
          syncTab({ ...tab, ...patch });
          if (origin) void checkSite(url);
        }
        if (!state.loading && url) remember({ ...tab, ...patch });
        if (state.id === get().activeId) applyVisibility();
      };

      const onProviderRequest = (event: {
        id: string;
        requestId: number;
        method: string;
        params: unknown[];
        origin: string;
        url: string;
      }) => {
        const tab = get().tabs.find((item) => item.id === event.id);
        if (!tab) return;
        const origin = originOf(event.origin) || originOf(event.url) || originOf(tab.url);
        if (!origin) {
          void fail(event.id, event.requestId, 4900, $t("Bu sayfada cüzdan kullanılamaz."));
          return;
        }
        if (get().flagged[origin]) {
          void fail(event.id, event.requestId, 4001, $t("Bu site oltalama listesinde — istek reddedildi."));
          return;
        }

        const address = currentAddress();
        const connection = get().connections[origin];
        const chain = tabChain(tab);
        const name = tab.title.trim() || hostOf(origin);

        void routeProviderRequest(event, {
          chain,
          chainHex: chainHex(chain),
          address,
          connected: Boolean(connection && address && connection.address === address),
          origin,
          respond: (result) => void respond(event.id, event.requestId, event.method, result),
          fail: (code, message) => void fail(event.id, event.requestId, code, message),
          revoke: () => void get().disconnect(origin),
          askConnection: (kind) => {
            set({
              connectPrompt: {
                tabId: event.id,
                requestId: event.requestId,
                kind,
                origin,
                name,
                favicon: tab.favicon,
                chainKey: tab.chainKey,
                phishing: Boolean(get().flagged[origin]),
              },
            });
          },
          switchChain: (target) => {
            const known = findChainByNumber(target);
            if (!known || known.kind !== "evm") return false;
            void get().setTabChain(tab.id, known.id);
            return true;
          },
          askApproval: (method, params) => {
            const request: WcRequest = {
              name,
              url: origin,
              description: $t("Uygulama içi tarayıcı sekmesi"),
              icons: tab.favicon ? [tab.favicon] : [],
              origin,
              validation: "UNKNOWN",
              isScam: false,
              id: queueCounter++,
              topic: `browser:${tab.id}`,
              chainId: toCaip2(tab.chainKey) ?? `eip155:${chain.chainId ?? 1}`,
              method,
              params,
              address,
              source: { kind: "browser", tabId: tab.id, requestId: event.requestId },
            };
            useWalletConnectStore.getState().enqueueBrowserRequest(request);
          },
        });
      };

      const bootstrap = async () => {
        stopListening?.();
        stopListening = await listenBrowser({
          onState,
          onProviderRequest,
          onPairUri: ({ uri }) => {
            void useWalletConnectStore
              .getState()
              .connect(uri)
              .then(() => toast($t("Bağlantı isteği gönderildi"), "success"))
              .catch((error: unknown) =>
                toast(error instanceof Error ? error.message : $t("Bağlantı kurulamadı"), "error"),
              );
          },
          onExternal: ({ url, opened }) => {
            const host = hostOf(url) || url;
            toast(
              opened ? $t("{0} başka uygulamada açıldı", [host]) : $t("Bu bağlantıyı açacak uygulama yok"),
              "info",
            );
          },
          onClosed: ({ id }) => {
            lastOrigin.delete(id);
            useWalletConnectStore.getState().dropBrowserTab(id);
          },
        });

        useWalletStore.subscribe((state, previous) => {
          if (state.wallet?.address !== previous.wallet?.address || state.unlocked !== previous.unlocked) {
            syncAll();
            applyVisibility();
          }
        });
        useChainStore.subscribe((state, previous) => {
          if (state.customChains !== previous.customChains) syncAll();
        });

        set({ ready: true });

        const stored = get().tabs;
        const fixed = stored.map((tab) =>
          browserChainKey(tab.chainKey) === tab.chainKey ? tab : { ...tab, chainKey: "ethereum" },
        );
        if (fixed.some((tab, index) => tab !== stored[index])) set({ tabs: fixed });

        if (!get().tabs.length) {
          const tab = newTab("", useChainStore.getState().activeChainId);
          set({ tabs: [tab], activeId: tab.id });
        }
        const tab = activeTab();
        if (tab?.url) {
          try {
            await mount(tab);
            await nativeBrowser.show(tab.id);
          } catch (error) {
            console.warn($t("Sekme geri yüklenemedi"), error);
          }
        }
        pushBounds();
        applyVisibility();
      };

      return {
        supported: hasNativeBrowser(),
        ready: false,
        tabs: [],
        activeId: "",
        connections: {},
        bookmarks: [],
        history: [],
        connectPrompt: null,
        flagged: {},
        viewport: { x: 0, y: 0, width: 0, height: 0 },
        present: false,
        covers: 0,

        init: async () => {
          if (!get().supported) return;
          if (get().ready) {
            applyVisibility();
            return;
          }
          booting ??= bootstrap().finally(() => {
            booting = null;
          });
          await booting;
        },

        setPresent: (present) => {
          set({ present });
          applyVisibility();
        },

        setViewport: (viewport) => {
          const current = get().viewport;
          if (
            current.x === viewport.x &&
            current.y === viewport.y &&
            current.width === viewport.width &&
            current.height === viewport.height
          ) {
            return;
          }
          set({ viewport });
          pushBounds();
        },

        cover: () => {
          set((state) => ({ covers: state.covers + 1 }));
          applyVisibility();
          let released = false;
          return () => {
            if (released) return;
            released = true;
            set((state) => ({ covers: Math.max(0, state.covers - 1) }));
            applyVisibility();
          };
        },

        openTab: async (url = "", chainKey) => {
          if (get().tabs.length >= MAX_TABS) {
            toast($t("En fazla {0} sekme açılabilir", [MAX_TABS]), "info");
            return;
          }
          const tab = newTab(url, chainKey ?? useChainStore.getState().activeChainId);
          set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
          applyVisibility();
          if (!get().supported) return;
          try {
            await mount(tab, url);
            await nativeBrowser.show(tab.id);
          } catch (error) {
            toast(error instanceof Error ? error.message : $t("Sekme açılamadı"), "error");
          }
          applyVisibility();
        },

        activate: async (id) => {
          if (id === get().activeId) return;
          const tab = get().tabs.find((item) => item.id === id);
          if (!tab) return;
          set({ activeId: id });
          applyVisibility();
          if (!get().supported) return;
          try {
            await mount(tab);
            const result = await nativeBrowser.show(id);
            if (result.previousId && result.previousImage) {
              patchTab(result.previousId, { image: result.previousImage });
            }
            syncTab(tab);
          } catch (error) {
            toast(error instanceof Error ? error.message : $t("Sekme açılamadı"), "error");
          }
          applyVisibility();
        },

        closeTab: async (id) => {
          const { tabs, activeId } = get();
          const index = tabs.findIndex((tab) => tab.id === id);
          if (index < 0) return;
          const tab = tabs[index];
          if (tab.mounted) await nativeBrowser.close(id).catch(() => undefined);
          useWalletConnectStore.getState().dropBrowserTab(id);
          lastOrigin.delete(id);

          const rest = tabs.filter((item) => item.id !== id);
          if (!rest.length) {
            const fresh = newTab("", useChainStore.getState().activeChainId);
            set({ tabs: [fresh], activeId: fresh.id });
            applyVisibility();
            return;
          }
          const next = activeId === id ? rest[Math.min(index, rest.length - 1)] : rest.find((t) => t.id === activeId)!;
          set({ tabs: rest, activeId: next.id });
          if (activeId === id && get().supported) {
            try {
              await mount(next);
              await nativeBrowser.show(next.id);
            } catch {
              toast($t("Sekme açılamadı"), "error");
            }
          }
          applyVisibility();
        },

        closeAll: async () => {
          if (get().supported) await nativeBrowser.closeAll().catch(() => undefined);
          for (const tab of get().tabs) {
            useWalletConnectStore.getState().dropBrowserTab(tab.id);
            lastOrigin.delete(tab.id);
          }
          const fresh = newTab("", useChainStore.getState().activeChainId);
          set({ tabs: [fresh], activeId: fresh.id });
          applyVisibility();
        },

        navigate: async (input) => {
          const value = input.trim();
          if (/^wc:/i.test(value)) {
            try {
              await useWalletConnectStore.getState().connect(value);
              toast($t("Bağlantı isteği gönderildi"), "success");
            } catch (error) {
              toast(error instanceof Error ? error.message : $t("Bağlantı kurulamadı"), "error");
            }
            return;
          }
          const resolved = resolveAddress(value);
          if (!resolved) {
            toast($t("Bu adres açılamıyor"), "error");
            return;
          }
          await get().go(resolved.url);
        },

        go: async (url) => {
          const tab = activeTab();
          if (!tab) return;
          patchTab(tab.id, { url, error: "", crashed: false, loading: true, progress: 0 });
          applyVisibility();
          if (!get().supported) {
            patchTab(tab.id, { loading: false, progress: 100 });
            return;
          }
          try {
            if (tab.mounted && url === tab.url) await nativeBrowser.reload(tab.id);
            else await mount(tab, url);
            await nativeBrowser.show(tab.id);
          } catch (error) {
            patchTab(tab.id, {
              loading: false,
              error: error instanceof Error ? error.message : $t("Sayfa açılamadı"),
            });
          }
          applyVisibility();
        },

        goHome: async () => {
          const tab = activeTab();
          if (!tab) return;
          patchTab(tab.id, {
            url: "",
            title: "",
            favicon: "",
            progress: 0,
            loading: false,
            error: "",
            crashed: false,
            canGoBack: false,
            canGoForward: false,
          });
          lastOrigin.delete(tab.id);
          applyVisibility();
          if (get().supported && tab.mounted) {
            await nativeBrowser.loadUrl(tab.id, "about:blank").catch(() => undefined);
          }
        },

        back: async () => {
          const tab = activeTab();
          if (tab?.mounted) await nativeBrowser.goBack(tab.id).catch(() => undefined);
        },
        forward: async () => {
          const tab = activeTab();
          if (tab?.mounted) await nativeBrowser.goForward(tab.id).catch(() => undefined);
        },
        reload: async () => {
          const tab = activeTab();
          if (!tab) return;
          patchTab(tab.id, { error: "", crashed: false });
          if (!tab.mounted) await mount(tab);
          else await nativeBrowser.reload(tab.id).catch(() => undefined);
          applyVisibility();
        },
        stop: async () => {
          const tab = activeTab();
          if (tab?.mounted) await nativeBrowser.stopLoading(tab.id).catch(() => undefined);
        },

        toggleDesktop: async () => {
          const tab = activeTab();
          if (!tab) return;
          const enabled = !tab.desktop;
          patchTab(tab.id, { desktop: enabled });
          if (tab.mounted) await nativeBrowser.setDesktopMode(tab.id, enabled).catch(() => undefined);
          toast(enabled ? $t("Masaüstü görünümü açık") : $t("Mobil görünüm açık"), "info");
        },

        setTabChain: async (id, chainKey) => {
          const tab = get().tabs.find((item) => item.id === id);
          if (!tab || tab.chainKey === chainKey) return;
          patchTab(id, { chainKey });
          const origin = originOf(tab.url);
          if (origin && get().connections[origin]) {
            set((state) => ({
              connections: { ...state.connections, [origin]: { ...state.connections[origin], chainKey } },
            }));
          }
          syncTab({ ...tab, chainKey });
        },

        requestConnect: (tabId) => {
          const tab = get().tabs.find((item) => item.id === (tabId ?? get().activeId));
          const origin = originOf(tab?.url ?? "");
          if (!tab || !origin) {
            toast($t("Önce bir site aç."), "info");
            return;
          }
          if (get().flagged[origin]) {
            toast($t("Bu site oltalama listesinde — bağlanma"), "error");
            return;
          }
          set({
            connectPrompt: {
              tabId: tab.id,
              requestId: 0,
              kind: "accounts",
              origin,
              name: tab.title.trim() || hostOf(origin),
              favicon: tab.favicon,
              chainKey: tab.chainKey,
              phishing: false,
            },
          });
        },

        snapshotActive: async () => {
          const tab = activeTab();
          if (!get().supported || !tab?.mounted || !tab.url) return;
          const result = await nativeBrowser.snapshot(tab.id, 320).catch(() => null);
          if (result?.image) patchTab(tab.id, { image: result.image });
        },

        approveConnect: async () => {
          const prompt = get().connectPrompt;
          if (!prompt) return;
          const address = currentAddress();
          if (!address) {
            toast($t("Cüzdan kilitli — önce parolanla aç."), "error");
            return;
          }
          const tab = get().tabs.find((item) => item.id === prompt.tabId);
          const connection: DappConnection = {
            origin: prompt.origin,
            name: prompt.name || hostOf(prompt.origin),
            favicon: prompt.favicon,
            chainKey: tab?.chainKey ?? prompt.chainKey,
            address,
            connectedAt: Date.now(),
          };
          set((state) => ({
            connections: { ...state.connections, [prompt.origin]: connection },
            connectPrompt: null,
          }));
          if (tab) syncTab({ ...tab, chainKey: connection.chainKey });
          const result =
            prompt.kind === "permissions"
              ? [
                  {
                    id: `vex-${prompt.origin}`,
                    parentCapability: "eth_accounts",
                    invoker: prompt.origin,
                    date: connection.connectedAt,
                    caveats: [{ type: "restrictReturnedAccounts", value: [address] }],
                  },
                ]
              : [address];
          await respond(
            prompt.tabId,
            prompt.requestId,
            prompt.kind === "permissions" ? "wallet_requestPermissions" : "eth_requestAccounts",
            result,
          );
          toast($t("{0} bağlandı", [connection.name]), "success");
        },

        rejectConnect: async () => {
          const prompt = get().connectPrompt;
          if (!prompt) return;
          set({ connectPrompt: null });
          await fail(prompt.tabId, prompt.requestId, 4001, $t("Bağlantı reddedildi"));
        },

        disconnect: async (origin) => {
          set((state) => {
            const next = { ...state.connections };
            delete next[origin];
            return { connections: next };
          });
          syncAll();
        },

        toggleBookmark: (url, title, favicon) => {
          const existing = get().bookmarks.find((mark) => mark.url === url);
          if (existing) {
            set((state) => ({ bookmarks: state.bookmarks.filter((mark) => mark.id !== existing.id) }));
            toast($t("Yer iminden çıkarıldı"), "info");
            return;
          }
          set((state) => ({
            bookmarks: [
              { id: uid("b"), url, title: titleFor(url, title), favicon, addedAt: Date.now() },
              ...state.bookmarks,
            ].slice(0, 120),
          }));
          toast($t("Yer imlerine eklendi"), "success");
        },

        removeBookmark: (id) =>
          set((state) => ({ bookmarks: state.bookmarks.filter((mark) => mark.id !== id) })),

        clearHistory: () => set({ history: [] }),

        clearSiteData: async () => {
          if (get().supported) await nativeBrowser.clearData().catch(() => undefined);
          set({ connections: {}, flagged: {} });
          syncAll();
          toast($t("Site verileri ve bağlantılar temizlendi"), "success");
        },
      };
    },
    {
      name: "vexaris.browser.v1",
      version: 1,
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          mounted: false,
          loading: false,
          progress: 0,
          error: "",
          crashed: false,
          image: "",
          canGoBack: false,
          canGoForward: false,
        })),
        activeId: state.activeId,
        connections: state.connections,
        bookmarks: state.bookmarks,
        history: state.history,
      }),
    },
  ),
);