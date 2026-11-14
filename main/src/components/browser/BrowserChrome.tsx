import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  BookmarkSimple,
  CaretDown,
  Check,
  ClockCounterClockwise,
  DotsThreeVertical,
  Globe,
  House,
  Lock,
  MagnifyingGlass,
  PlugsConnected,
  ShieldWarning,
  SquaresFour,
  Warning,
  X,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { ChainIcon } from "@/components/TokenIcon";
import { getChain, allChains } from "@/lib/chains/registry";
import { hostOf, isSecure, originOf, prettyUrl, resolveAddress, titleFor } from "@/lib/browser/address";
import { CATEGORY_TONE, searchDapps } from "@/lib/browser/dapps";
import { cn } from "@/lib/utils";
import { useBrowserStore } from "@/stores/browserStore";
import { useChainStore } from "@/stores/chainStore";

interface Props {
  onOpenTabs: () => void;
  onOpenMenu: () => void;
}

interface Row {
  key: string;
  label: string;
  sub: string;
  icon: typeof Globe;
  tone?: string;
  run: () => void;
}

function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-30",
        active ? "bg-accent-soft text-accent" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function BrowserChrome({ onOpenTabs, onOpenMenu }: Props) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeId = useBrowserStore((s) => s.activeId);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const history = useBrowserStore((s) => s.history);
  const flagged = useBrowserStore((s) => s.flagged);
  const navigate = useBrowserStore((s) => s.navigate);
  const go = useBrowserStore((s) => s.go);
  const goHome = useBrowserStore((s) => s.goHome);
  const back = useBrowserStore((s) => s.back);
  const forward = useBrowserStore((s) => s.forward);
  const reload = useBrowserStore((s) => s.reload);
  const stop = useBrowserStore((s) => s.stop);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const toggleBookmark = useBrowserStore((s) => s.toggleBookmark);
  const setTabChain = useBrowserStore((s) => s.setTabChain);
  const enabled = useChainStore((s) => s.enabledChainIds);

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const cancelBlur = () => {
    if (blurTimer.current === null) return;
    window.clearTimeout(blurTimer.current);
    blurTimer.current = null;
  };

  useEffect(() => cancelBlur, []);

  const tab = tabs.find((item) => item.id === activeId);
  const url = tab?.url ?? "";
  const origin = originOf(url);
  const marked = bookmarks.some((mark) => mark.url === url);
  const phishing = Boolean(origin && flagged[origin]);
  const chainKey = tab?.chainKey ?? "ethereum";
  const chain = getChain(chainKey);
  const chains = allChains().filter((item) => item.kind === "evm" && enabled.includes(item.id));

  const overlay = editing || chainOpen;
  useEffect(() => {
    if (!overlay) return;
    return useBrowserStore.getState().cover();
  }, [overlay]);

  useEffect(() => {
    if (!editing) setDraft("");
  }, [editing]);

  const rows = useMemo<Row[]>(() => {
    const value = draft.trim();
    const close = () => {
      cancelBlur();
      setEditing(false);
      setCursor(-1);
      inputRef.current?.blur();
    };
    const open = (target: string) => {
      close();
      void go(target);
    };

    if (!value) {
      return history.slice(0, 5).map((entry) => ({
        key: `h-${entry.id}`,
        label: titleFor(entry.url, entry.title),
        sub: hostOf(entry.url),
        icon: ClockCounterClockwise,
        run: () => open(entry.url),
      }));
    }

    const list: Row[] = [];
    const resolved = resolveAddress(value);
    if (/^wc:/i.test(value)) {
      list.push({
        key: "wc",
        label: $t("WalletConnect ile bağlan"),
        sub: $t("Bağlantı adresini kullan"),
        icon: PlugsConnected,
        tone: "text-success",
        run: () => {
          close();
          void navigate(value);
        },
      });
    } else if (resolved) {
      list.push({
        key: "go",
        label: resolved.search ? $t("“{0}” için ara", [value]) : prettyUrl(resolved.url),
        sub: resolved.search ? "DuckDuckGo" : $t("Adrese git"),
        icon: resolved.search ? MagnifyingGlass : Globe,
        tone: resolved.search ? "text-info" : "text-success",
        run: () => open(resolved.url),
      });
    }

    for (const dapp of searchDapps(value)) {
      list.push({
        key: `d-${dapp.url}`,
        label: dapp.name,
        sub: `${hostOf(dapp.url)} · ${dapp.blurb}`,
        icon: ArrowSquareOut,
        tone: CATEGORY_TONE[dapp.category],
        run: () => open(dapp.url),
      });
    }

    const needle = value.toLowerCase();
    const seen = new Set(list.map((row) => row.key));
    const places = [
      ...bookmarks.map((mark) => ({ ...mark, bookmarked: true })),
      ...history.map((entry) => ({ ...entry, bookmarked: false })),
    ];
    for (const place of places) {
      if (list.length >= 9) break;
      const key = `p-${place.url}`;
      if (seen.has(key) || seen.has(`d-${place.url}`)) continue;
      if (!place.url.toLowerCase().includes(needle) && !place.title.toLowerCase().includes(needle)) continue;
      seen.add(key);
      list.push({
        key,
        label: titleFor(place.url, place.title),
        sub: hostOf(place.url),
        icon: place.bookmarked ? BookmarkSimple : ClockCounterClockwise,
        tone: place.bookmarked ? "text-warning" : undefined,
        run: () => open(place.url),
      });
    }
    return list;
  }, [draft, history, bookmarks, go, navigate]);

  function submit(index: number) {
    const row = rows[index] ?? rows[0];
    if (row) row.run();
    else {
      setEditing(false);
      inputRef.current?.blur();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (rows.length ? (value + 1) % rows.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (rows.length ? (value <= 0 ? rows.length - 1 : value - 1) : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      submit(cursor);
    } else if (event.key === "Escape") {
      setEditing(false);
      setCursor(-1);
      inputRef.current?.blur();
    }
  }

  const secure = isSecure(url);
  const StateIcon = !url ? MagnifyingGlass : phishing ? ShieldWarning : secure ? Lock : Warning;

  return (
    <div className="relative z-30 shrink-0 border-b border-white/[0.07] bg-surface-900">
      <div className="flex items-center gap-1.5 px-2 py-2 sm:px-3">
        <div className="relative min-w-0 flex-1">
          <div
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl border bg-surface-850 px-2.5 transition-colors",
              editing
                ? "border-accent/50"
                : phishing
                  ? "border-danger/40"
                  : "border-white/[0.08] hover:border-white/[0.14]",
            )}
          >
            <StateIcon
              size={14}
              className={cn(
                "shrink-0",
                !url ? "text-zinc-600" : phishing ? "text-danger" : secure ? "text-success" : "text-warning",
              )}
            />
            <input
              ref={inputRef}
              value={editing ? draft : prettyUrl(url)}
              onChange={(event) => {
                setDraft(event.target.value);
                setCursor(-1);
              }}
              onFocus={(event) => {
                cancelBlur();
                setDraft(url);
                setEditing(true);
                event.currentTarget.select();
              }}
              onBlur={() => {
                cancelBlur();
                blurTimer.current = window.setTimeout(() => {
                  blurTimer.current = null;
                  setEditing(false);
                  setCursor(-1);
                }, 160);
              }}
              onKeyDown={onKeyDown}
              placeholder={$t("Ara veya adres yaz")}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-label={$t("Adres çubuğu")}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            {editing ? (
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setDraft("");
                  inputRef.current?.focus();
                }}
                aria-label={$t("Temizle")}
                className="focus-ring shrink-0 rounded p-1 text-zinc-600 hover:text-white"
              >
                <X size={13} />
              </button>
            ) : url ? (
              <button
                onClick={() => toggleBookmark(url, tab?.title ?? "", tab?.favicon ?? "")}
                title={marked ? $t("Yer iminden çıkar") : $t("Yer imlerine ekle")}
                aria-label={marked ? $t("Yer iminden çıkar") : $t("Yer imlerine ekle")}
                className={cn(
                  "focus-ring shrink-0 rounded p-1 transition-colors",
                  marked ? "text-warning" : "text-zinc-600 hover:text-white",
                )}
              >
                <BookmarkSimple size={14} weight={marked ? "fill" : "regular"} />
              </button>
            ) : null}
          </div>

          {editing && rows.length > 0 && (
            <div className="absolute inset-x-0 top-12 z-40 max-h-[52vh] animate-fade-in overflow-y-auto rounded-xl border border-white/[0.09] bg-surface-800 p-1 shadow-lift">
              {rows.map((row, index) => {
                const Icon = row.icon;
                return (
                  <button
                    key={row.key}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => submit(index)}
                    onMouseEnter={() => setCursor(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      cursor === index ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon size={14} className={cn("shrink-0", row.tone ?? "text-zinc-500")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-zinc-100">{row.label}</span>
                      <span className="block truncate text-[10px] text-zinc-600">{row.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onOpenTabs}
          title={$t("Sekmeler")}
          aria-label={$t("{0} sekme", [tabs.length])}
          className="focus-ring relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-surface-850 text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
        >
          <SquaresFour size={15} />
          <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
            {tabs.length}
          </span>
        </button>

        <button
          onClick={onOpenMenu}
          title={$t("Tarayıcı menüsü")}
          aria-label={$t("Tarayıcı menüsü")}
          className="focus-ring grid h-10 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <DotsThreeVertical size={17} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 pb-1.5 sm:px-3">
        <ToolButton label={$t("Geri")} onClick={() => void back()} disabled={!tab?.canGoBack}>
          <ArrowLeft size={16} />
        </ToolButton>
        <ToolButton label={$t("İleri")} onClick={() => void forward()} disabled={!tab?.canGoForward}>
          <ArrowRight size={16} />
        </ToolButton>
        <ToolButton
          label={tab?.loading ? $t("Yüklemeyi durdur") : $t("Yenile")}
          onClick={() => void (tab?.loading ? stop() : reload())}
        >
          {tab?.loading ? <X size={16} /> : <ArrowsClockwise size={16} />}
        </ToolButton>
        <ToolButton label={$t("Başlangıç sayfası")} onClick={() => void goHome()} active={!url}>
          <House size={16} />
        </ToolButton>

        <div className="relative ml-auto min-w-0">
          <button
            onClick={() => setChainOpen((value) => !value)}
            aria-expanded={chainOpen}
            title={$t("Sekmenin ağını değiştir")}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-850 pl-1.5 pr-2 text-[11px] text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
          >
            <ChainIcon chainId={chainKey} size={16} />
            <span className="max-w-[72px] truncate">{chain?.shortName ?? $t("Ağ")}</span>
            <CaretDown size={11} className={cn("text-zinc-600 transition-transform", chainOpen && "rotate-180")} />
          </button>

          {chainOpen && (
            <div className="absolute left-0 top-10 z-40 max-h-[50vh] w-56 animate-fade-in overflow-y-auto rounded-xl border border-white/[0.09] bg-surface-800 p-1 shadow-lift">
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                {$t("Sekme ağı")}
              </div>
              {chains.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    void setTabChain(activeId, item.id);
                    setChainOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[12px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
                >
                  <ChainIcon chainId={item.id} size={18} />
                  <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
                  {item.id === chainKey && <Check size={13} className="shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {phishing && (
        <div className="flex items-center gap-2 border-t border-danger/25 bg-danger/[0.12] px-3 py-2">
          <ShieldWarning size={14} className="shrink-0 text-danger" />
          <p className="min-w-0 flex-1 text-[11px] leading-tight text-danger">
            {$t("{0} oltalama listesinde. Adresini paylaşma.", [hostOf(url)])}
          </p>
          <button
            onClick={() => void closeTab(activeId)}
            className="focus-ring shrink-0 rounded-md border border-danger/35 px-2 py-1 text-[10px] font-medium text-danger transition-colors hover:bg-danger/20"
          >
            {$t("Sekmeyi kapat")}
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
        {tab?.loading && (
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-accent via-magenta to-info transition-[width] duration-200"
            style={{ width: `${Math.max(6, Math.min(100, tab.progress))}%` }}
          />
        )}
      </div>
    </div>
  );
}