/**
 * Tarayıcının başlangıç sayfası: cüzdan durumu + uygulama dizini.
 *
 * Adres yazmak zorunda kalmadan takasa, köprüye, NFT pazarına tek dokunuşla
 * gidilir. Uygulamanın desteklediği ağ listede varsa sekme o ağa çevrilir;
 * böylece site açıldığında "yanlış ağ" uyarısıyla karşılaşılmaz.
 */
import { t as $t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ArrowUpRight,
  Bookmark,
  ClockCounterClockwise,
  MagnifyingGlass,
  PlugsConnected,
  ShieldCheck,
  Trash,
  X,
} from "@phosphor-icons/react";
import { ChainIcon } from "@/components/TokenIcon";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getChain } from "@/lib/chains/registry";
import { hostOf, originOf, titleFor } from "@/lib/browser/address";
import { CATEGORY_LABEL, CATEGORY_TONE, DAPPS, type DappCategory, type DappEntry } from "@/lib/browser/dapps";
import { cn, shortAddress } from "@/lib/utils";
import { useBrowserStore } from "@/stores/browserStore";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as DappCategory[];

/** Sitenin çalıştığı ağlardan cüzdanda etkin olan ilkini seçer. */
function preferredChain(dapp: DappEntry, current: string, enabled: string[]): string {
  if (!dapp.chains.length || dapp.chains.includes(current)) return current;
  return dapp.chains.find((id) => enabled.includes(id)) ?? current;
}

function SiteFavicon({ url, name, size = 34 }: { url: string; name: string; size?: number }) {
  const [dead, setDead] = useState(false);
  const src = url.startsWith("data:") ? url : `${originOf(url)}/favicon.ico`;
  if (dead || !originOf(url)) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-surface-800 text-[12px] font-semibold text-zinc-400"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setDead(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl border border-white/[0.08] bg-surface-800 object-cover"
    />
  );
}

function DappCard({ dapp, onOpen }: { dapp: DappEntry; onOpen: (dapp: DappEntry) => void }) {
  const supported = useBrowserStore((s) => s.supported);
  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <SiteFavicon url={dapp.url} name={dapp.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{dapp.name}</div>
          <div className="truncate text-[10px] text-zinc-600">{hostOf(dapp.url)}</div>
        </div>
        {supported ? (
          <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-zinc-600 transition-colors group-hover:text-accent" />
        ) : (
          <ArrowSquareOut size={14} className="mt-0.5 shrink-0 text-zinc-600 transition-colors group-hover:text-accent" />
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{dapp.blurb}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-medium", CATEGORY_TONE[dapp.category])}>
          {CATEGORY_LABEL[dapp.category]}
        </span>
        <span className="flex shrink-0 -space-x-1.5">
          {dapp.chains.slice(0, 3).map((id) => (
            <span key={id} className="grid place-items-center rounded-full bg-surface-900">
              <ChainIcon chainId={id} size={15} />
            </span>
          ))}
          {dapp.chains.length > 3 && (
            <span className="grid h-[15px] w-[15px] place-items-center rounded-full bg-surface-700 text-[7px] font-semibold text-zinc-400 ring-1 ring-white/10">
              +{dapp.chains.length - 3}
            </span>
          )}
        </span>
      </div>
    </>
  );

  const classes =
    "focus-ring group rounded-xl border border-white/[0.06] bg-surface-850 p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/35 hover:bg-surface-800";

  return supported ? (
    <button onClick={() => onOpen(dapp)} className={classes}>
      {body}
    </button>
  ) : (
    <a href={dapp.url} target="_blank" rel="noreferrer" className={cn(classes, "block")}>
      {body}
    </a>
  );
}

export function StartPage() {
  const supported = useBrowserStore((s) => s.supported);
  const go = useBrowserStore((s) => s.go);
  const setTabChain = useBrowserStore((s) => s.setTabChain);
  const activeId = useBrowserStore((s) => s.activeId);
  const tabs = useBrowserStore((s) => s.tabs);
  const connections = useBrowserStore((s) => s.connections);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const history = useBrowserStore((s) => s.history);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const disconnect = useBrowserStore((s) => s.disconnect);
  const clearHistory = useBrowserStore((s) => s.clearHistory);
  const enabled = useChainStore((s) => s.enabledChainIds);
  const activeChainId = useChainStore((s) => s.activeChainId);
  const address = useWalletStore((s) => s.wallet?.address ?? "");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DappCategory | "all">("all");

  const tab = tabs.find((item) => item.id === activeId);
  const chainKey = tab?.chainKey ?? activeChainId;
  const chain = getChain(chainKey);
  const sites = Object.values(connections).sort((a, b) => b.connectedAt - a.connectedAt);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DAPPS.filter((dapp) => {
      if (category !== "all" && dapp.category !== category) return false;
      if (!needle) return true;
      return (
        dapp.name.toLowerCase().includes(needle) ||
        dapp.url.toLowerCase().includes(needle) ||
        dapp.blurb.toLowerCase().includes(needle)
      );
    });
  }, [query, category]);

  function openDapp(dapp: DappEntry) {
    const next = preferredChain(dapp, chainKey, enabled);
    if (next !== chainKey) void setTabChain(activeId, next);
    void go(dapp.url);
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <section className="relative overflow-hidden rounded-xl3 border border-white/[0.07] bg-surface-900 p-4 shadow-panel sm:p-5">
          <div className="pointer-events-none absolute inset-0 animate-drift bg-mesh-brand opacity-90" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/85">
              <span className="live-dot" />
              {$t("Cüzdan hazır")}
            </div>
            <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-gradient-brand sm:text-[26px]">
              {$t("Uygulamaları keşfet")}
            </h1>
            <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-zinc-400">
              {$t("Bir uygulama seç, adresini paylaş ve işlem yap. Her imza senden onay ister.")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-850/90 py-1 pl-1 pr-3">
                <ProfileAvatar size={22} />
                <span className="font-mono text-[11px] text-zinc-300">
                  {address ? shortAddress(address, 4) : $t("adres yok")}
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface-850/90 py-1 pl-1.5 pr-3 text-[11px] text-zinc-300">
                <ChainIcon chainId={chainKey} size={17} />
                {chain?.name ?? chainKey}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-success/25 bg-success/[0.08] px-2.5 py-1 text-[11px] text-success">
                <PlugsConnected size={13} />
                {$t("{0} bağlı site", [sites.length])}
              </span>
            </div>
          </div>
        </section>

        {sites.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">{$t("Bağlı siteler")}</h2>
              <span className="text-[10px] text-zinc-600">{$t("Adresin paylaşıldı")}</span>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sites.map((site) => (
                <div
                  key={site.origin}
                  className="group flex shrink-0 items-center gap-2 rounded-xl border border-success/20 bg-success/[0.05] py-2 pl-2 pr-1.5"
                >
                  <button
                    onClick={() => void go(site.origin)}
                    className="focus-ring flex min-w-0 items-center gap-2 rounded-lg text-left"
                  >
                    <SiteFavicon url={site.favicon || site.origin} name={site.name} size={26} />
                    <span className="min-w-0">
                      <span className="block max-w-[120px] truncate text-[12px] text-zinc-100">{site.name}</span>
                      <span className="block max-w-[120px] truncate text-[10px] text-success/80">
                        {getChain(site.chainKey)?.shortName ?? hostOf(site.origin)}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => void disconnect(site.origin)}
                    title={$t("Bağlantıyı kes")}
                    aria-label={$t("{0} bağlantısını kes", [site.name])}
                    className="focus-ring shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {bookmarks.length > 0 && (
          <section className="mt-5">
            <h2 className="section-title mb-2">{$t("Yer imleri")}</h2>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {bookmarks.slice(0, 12).map((mark) => (
                <div
                  key={mark.id}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-surface-850 py-2 pl-2 pr-1.5 transition-colors hover:border-accent/35"
                >
                  <button
                    onClick={() => void go(mark.url)}
                    className="focus-ring flex min-w-0 items-center gap-2 rounded-lg text-left"
                  >
                    <SiteFavicon url={mark.favicon || mark.url} name={mark.title} size={24} />
                    <span className="max-w-[130px] truncate text-[12px] text-zinc-200">{mark.title}</span>
                  </button>
                  <button
                    onClick={() => removeBookmark(mark.id)}
                    title={$t("Yer iminden çıkar")}
                    aria-label={$t("Yer iminden çıkar")}
                    className="focus-ring shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="section-title">{$t("Uygulama dizini")}</h2>
            <label className="relative flex h-9 items-center sm:w-64">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 text-zinc-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={$t("Uygulama ara")}
                spellCheck={false}
                className="focus-ring h-9 w-full rounded-lg border border-white/[0.08] bg-surface-850 pl-9 pr-8 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/50"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={$t("Aramayı temizle")}
                  className="focus-ring absolute right-2 rounded p-1 text-zinc-600 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setCategory("all")}
              className={cn(
                "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                category === "all"
                  ? "border-accent/45 bg-accent-soft text-white"
                  : "border-white/[0.07] bg-surface-850 text-zinc-400 hover:text-zinc-200",
              )}
            >
              {$t("Tümü")} · {DAPPS.length}
            </button>
            {CATEGORIES.map((key) => {
              const count = DAPPS.filter((dapp) => dapp.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    category === key
                      ? "border-accent/45 bg-accent-soft text-white"
                      : "border-white/[0.07] bg-surface-850 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  <span className={category === key ? "" : CATEGORY_TONE[key]}>{CATEGORY_LABEL[key]}</span>
                  <span className="ml-1.5 text-zinc-600">{count}</span>
                </button>
              );
            })}
          </div>

          {list.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
              <p className="text-[12px] text-zinc-400">{$t("Bu aramada uygulama yok")}</p>
              <p className="mt-1 text-[11px] text-zinc-600">
                {$t("Adres çubuğuna sitenin adresini yazarak da açabilirsin.")}
              </p>
            </div>
          ) : (
            <div className="stagger mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((dapp) => (
                <DappCard key={dapp.url} dapp={dapp} onOpen={openDapp} />
              ))}
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">{$t("Son gezilenler")}</h2>
              <button
                onClick={clearHistory}
                className="focus-ring flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-600 transition-colors hover:text-danger"
              >
                <Trash size={11} /> {$t("Geçmişi temizle")}
              </button>
            </div>
            <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-850">
              {history.slice(0, 6).map((entry) => (
                <li key={entry.id} className="border-b border-white/[0.04] last:border-0">
                  <button
                    onClick={() => void go(entry.url)}
                    className="row-hover focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <ClockCounterClockwise size={13} className="shrink-0 text-zinc-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-zinc-200">
                        {titleFor(entry.url, entry.title)}
                      </span>
                      <span className="block truncate text-[10px] text-zinc-600">{hostOf(entry.url)}</span>
                    </span>
                    <Bookmark size={12} className="shrink-0 text-zinc-700" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-surface-900/70 p-3 text-[11px] leading-relaxed text-zinc-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
          {supported
            ? $t("Siteler anahtarlarını göremez. Adres paylaşımı, ağ değişimi, işlem ve imzalar ayrı onay ekranından geçer.")
            : $t("Uygulama içi tarayıcı Android sürümünde çalışır. Buradaki bağlantılar cihazının tarayıcısında açılır; onları WalletConnect ile bağlayabilirsin.")}
        </p>
      </div>
    </div>
  );
}