import { create } from "zustand";
import type { SessionTypes, SignClientTypes, Verify } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { t as $t } from "@/lib/i18n";
import { toast } from "@/stores/toastStore";
import { useWalletStore } from "@/stores/walletStore";
import {
  EIP155_NAMESPACE,
  SUPPORTED_EVENTS,
  SUPPORTED_METHODS,
  chainOfCaip10,
  evmChains,
  namespaceChains,
  toCaip10,
} from "@/lib/walletconnect/chains";
import { getSignClient, normalizePairingUri, openRelay, peekSignClient } from "@/lib/walletconnect/client";
import { nativeBrowser } from "@/lib/browser/native";

type Validation = Verify.Context["verified"]["validation"];

export interface WcOrigin {
  name: string;
  url: string;
  description: string;
  icons: string[];
  origin: string;
  validation: Validation;
  isScam: boolean;
}

export interface WcSession extends WcOrigin {
  topic: string;
  chains: string[];
  methods: string[];
  accounts: string[];
  nonEvmOnly: boolean;
  expiry: number;
}

export interface WcProposal extends WcOrigin {
  id: number;
  requiredChains: string[];
  optionalChains: string[];
  methods: string[];
  gaps: string[];
}

export interface WcRequest extends WcOrigin {
  id: number;
  topic: string;
  chainId: string;
  method: string;
  params: unknown;
  address: string;
  source?: BrowserSource;
}

export interface BrowserSource {
  kind: "browser";
  tabId: string;
  requestId: number;
}

interface WalletConnectState {
  ready: boolean;
  connecting: boolean;
  sessions: WcSession[];
  proposal: WcProposal | null;
  queue: WcRequest[];
  request: WcRequest | null;
  start: () => Promise<void>;
  connect: (uri: string) => Promise<void>;
  approveProposal: (chains: string[]) => Promise<void>;
  rejectProposal: () => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  resolveRequest: (result: unknown) => Promise<void>;
  rejectRequest: () => Promise<void>;
  enqueueBrowserRequest: (request: WcRequest) => void;
  dropBrowserTab: (tabId: string) => void;
  refresh: () => void;
}

const knownCaip2 = () => new Set(evmChains().map((chain) => `${EIP155_NAMESPACE}:${chain.chainId}`));

function originOf(
  metadata: Partial<SignClientTypes.Metadata> | undefined,
  verified?: Verify.Context["verified"],
): WcOrigin {
  return {
    name: metadata?.name?.trim() || $t("Bilinmeyen uygulama"),
    url: metadata?.url ?? "",
    description: metadata?.description ?? "",
    icons: metadata?.icons ?? [],
    origin: verified?.origin ?? metadata?.url ?? "",
    validation: verified?.validation ?? "UNKNOWN",
    isScam: verified?.isScam === true,
  };
}

function sessionOf(session: SessionTypes.Struct, known: Set<string>): WcSession | null {
  if (session.expiry * 1000 <= Date.now()) return null;
  const namespace = session.namespaces?.[EIP155_NAMESPACE];
  return {
    ...originOf(session.peer?.metadata),
    topic: session.topic,
    chains: namespace ? namespaceChains(namespace).filter((chain) => known.has(chain)) : [],
    methods: namespace?.methods ?? [],
    accounts: namespace?.accounts ?? [],
    expiry: session.expiry,
    nonEvmOnly: !namespace,
  };
}

function addressOf(session: SessionTypes.Struct | undefined, caip2: string): string {
  const accounts = session?.namespaces?.[EIP155_NAMESPACE]?.accounts ?? [];
  return accounts.find((account) => chainOfCaip10(account) === caip2)?.split(":").pop() ?? "";
}

export const useWalletConnectStore = create<WalletConnectState>()((set, get) => {
  let wired = false;
  const verified = new Map<string, Verify.Context["verified"]>();

  const client = () => peekSignClient();

  const listSessions = () => {
    const instance = client();
    if (!instance) return;
    const known = knownCaip2();
    const sessions: WcSession[] = [];
    for (const session of instance.session.getAll()) {
      const view = sessionOf(session, known);
      if (!view) continue;
      sessions.push({ ...view, ...originOf(session.peer?.metadata, verified.get(session.topic)) });
    }
    set({ sessions });
  };

  const setQueue = (queue: WcRequest[]) => set({ queue, request: queue[0] ?? null });

  const dropTopic = (topic: string) => {
    const pending = get().queue;
    if (pending.some((item) => item.topic === topic)) setQueue(pending.filter((item) => item.topic !== topic));
  };

  const answer = async (request: WcRequest, response: { result?: unknown; error?: { code: number; message: string } }) => {
    if (request.source?.kind === "browser") {
      const { tabId, requestId } = request.source;
      await nativeBrowser
        .respond({
          id: tabId,
          requestId,
          method: request.method,
          result: response.error ? undefined : response.result,
          error: response.error,
        })
        .catch((error: unknown) => console.warn($t("Tarayıcı yanıtı gönderilemedi"), error));
    } else {
      const instance = client();
      if (instance) {
        try {
          await instance.respond({
            topic: request.topic,
            response: response.error
              ? { id: request.id, jsonrpc: "2.0", error: response.error }
              : { id: request.id, jsonrpc: "2.0", result: response.result },
          });
        } catch (error) {
          console.warn($t("WalletConnect yanıtı gönderilemedi"), error);
        }
      }
    }
    const pending = get().queue;
    if (!pending.includes(request)) return;
    setQueue(pending.filter((item) => item !== request));
  };

  return {
    ready: false,
    connecting: false,
    sessions: [],
    proposal: null,
    queue: [],
    request: null,

    start: async () => {
      const instance = await getSignClient();
      if (!wired) {
        wired = true;

        instance.on("session_proposal", (args) => {
          const known = knownCaip2();
          const required = args.params.requiredNamespaces?.[EIP155_NAMESPACE];
          const optional = args.params.optionalNamespaces?.[EIP155_NAMESPACE];
          const requiredChains = [...new Set(namespaceChains(required ?? {}).filter((c) => known.has(c)))];
          const optionalChains = [
            ...new Set(namespaceChains(optional ?? {}).filter((c) => known.has(c) && !requiredChains.includes(c))),
          ];
          const wanted = new Set([...(required?.methods ?? []), ...(optional?.methods ?? [])]);
          const methods = SUPPORTED_METHODS.filter((method) => wanted.has(method));

          const gaps: string[] = [];
          if (!required && !optional) {
            gaps.push($t("Uygulama EVM ağı istemiyor — bu cüzdan bu oturum için imzalama yapamaz."));
          }
          for (const namespace of Object.keys(args.params.requiredNamespaces ?? {})) {
            if (namespace !== EIP155_NAMESPACE) gaps.push($t("{0} ağı desteklenmiyor", [namespace]));
          }
          const missingChains = [
            ...new Set(namespaceChains(required ?? {}).filter((c) => !known.has(c))),
          ];
          if (missingChains.length) {
            gaps.push($t("Bilinmeyen ağlar: {0}", [missingChains.join(", ")]));
          }
          const missingMethods = (required?.methods ?? []).filter((m) => !SUPPORTED_METHODS.includes(m));
          if (missingMethods.length) {
            gaps.push($t("Desteklenmeyen yöntemler: {0}", [missingMethods.join(", ")]));
          }

          set({
            proposal: {
              ...originOf(args.params.proposer?.metadata, args.verifyContext?.verified),
              id: args.id,
              requiredChains,
              optionalChains,
              methods,
              gaps,
            },
          });
        });

        instance.on("session_request", (args) => {
          const topic = args.topic;
          const context = args.verifyContext?.verified;
          if (context) verified.set(topic, context);
          let session: SessionTypes.Struct | undefined;
          try {
            session = instance.session.get(topic);
          } catch {
            session = undefined;
          }
          const request: WcRequest = {
            ...originOf(session?.peer?.metadata, context),
            id: args.id,
            topic,
            chainId: args.params.chainId,
            method: args.params.request.method,
            params: args.params.request.params,
            address: addressOf(session, args.params.chainId),
          };
          const unsupported = !SUPPORTED_METHODS.includes(request.method);
          if (unsupported || !request.address || !useWalletStore.getState().unlocked) {
            if (!unsupported && !useWalletStore.getState().unlocked) {
              toast($t("Cüzdan kilitli — dApp talebi reddedildi"), "error");
            }
            void answer(request, { error: getSdkError("USER_REJECTED_METHODS") });
            return;
          }
          setQueue([...get().queue, request]);
        });

        instance.on("session_authenticate", (args) => {
          toast($t("Bu uygulama giriş (SIWE) istiyor — henüz desteklenmiyor"), "error");
          void instance
            .rejectSessionAuthenticate({ id: args.id, reason: getSdkError("USER_REJECTED_METHODS") })
            .catch(() => undefined);
        });

        instance.on("session_delete", (args) => {
          verified.delete(args.topic);
          set((state) => ({
            sessions: state.sessions.filter((s) => s.topic !== args.topic),
          }));
          dropTopic(args.topic);
        });

        instance.on("session_expire", (args) => {
          verified.delete(args.topic);
          set((state) => ({ sessions: state.sessions.filter((s) => s.topic !== args.topic) }));
        });

        instance.on("session_update", ({ topic, params }) => {
          const namespace = params.namespaces?.[EIP155_NAMESPACE];
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.topic === topic
                ? {
                    ...s,
                    chains: namespaceChains(namespace ?? {}),
                    methods: namespace?.methods ?? s.methods,
                    accounts: namespace?.accounts ?? s.accounts,
                  }
                : s,
            ),
          }));
        });
      }

      set({ ready: await openRelay(instance) });
      listSessions();
    },

    connect: async (uri) => {
      const target = normalizePairingUri(uri);
      set({ connecting: true });
      try {
        const instance = await getSignClient();
        if (!(await openRelay(instance))) throw new Error($t("Relay bağlantısı kurulamadı."));
        await instance.pair({ uri: target });
      } finally {
        set({ connecting: false });
      }
    },

    approveProposal: async (chains) => {
      const proposal = get().proposal;
      if (!proposal) return;
      const address = useWalletStore.getState().wallet?.address;
      if (!address) throw new Error($t("Cüzdan kilitli — önce parolanla aç."));
      if (proposal.gaps.length) throw new Error(proposal.gaps[0]);

      const instance = await getSignClient();
      const selected = [
        ...proposal.requiredChains,
        ...chains.filter((chain) => proposal.optionalChains.includes(chain)),
      ];
      if (!selected.length) throw new Error($t("En az bir ağ seçilmeli."));

      const namespaces: SessionTypes.Namespaces = {
        [EIP155_NAMESPACE]: {
          accounts: [...new Set(selected)].map((chain) => toCaip10(chain, address)),
          methods: proposal.methods,
          events: [...SUPPORTED_EVENTS],
        },
      };
      const { topic } = await instance.approve({ id: proposal.id, namespaces });
      verified.set(topic, {
        origin: proposal.origin,
        validation: proposal.validation,
        verifyUrl: "",
        isScam: proposal.isScam,
      });
      set({ proposal: null });
      listSessions();
      toast($t("Bağlantı kuruldu"), "success");
    },

    rejectProposal: async () => {
      const proposal = get().proposal;
      const instance = client();
      set({ proposal: null });
      if (!proposal || !instance) return;
      await instance
        .reject({ id: proposal.id, reason: getSdkError("USER_REJECTED") })
        .catch(() => undefined);
    },

    disconnect: async (topic) => {
      const instance = client();
      if (!instance) return;
      await instance.disconnect({ topic, reason: getSdkError("USER_DISCONNECTED") });
      verified.delete(topic);
      set((state) => ({ sessions: state.sessions.filter((s) => s.topic !== topic) }));
      dropTopic(topic);
    },

    resolveRequest: async (result) => {
      const request = get().request;
      if (request) await answer(request, { result });
    },

    rejectRequest: async () => {
      const request = get().request;
      if (request) await answer(request, { error: getSdkError("USER_REJECTED") });
    },

    enqueueBrowserRequest: (request) => {
      setQueue([...get().queue, request]);
    },

    dropBrowserTab: (tabId) => {
      const topic = `browser:${tabId}`;
      const pending = get().queue;
      const kept = pending.filter((item) => item.topic !== topic);
      if (kept.length === pending.length) return;
      for (const item of pending) {
        if (item.topic === topic && item.source?.kind === "browser") {
          void nativeBrowser
            .respond({
              id: tabId,
              requestId: item.source.requestId,
              method: item.method,
              error: { code: 4001, message: $t("Sekme kapatıldı") },
            })
            .catch(() => undefined);
        }
      }
      setQueue(kept);
    },

    refresh: listSessions,
  };
});
