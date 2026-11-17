import { t as $t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Clock,
  Search,
  Shield,
  Trash,
  X,
  cn,
} from "@/kit";
import { ExternalLink } from "@/kit/ext";
import { ChainIcon } from "@/components/TokenIcon";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getChain } from "@/lib/chains/registry";
import { hostOf, originOf, titleFor } from "@/lib/browser/address";
import { CATEGORY_LABEL, DAPPS, type DappCategory, type DappEntry } from "@/lib/browser/dapps";
import { shortAddress } from "@/lib/utils";
import { useBrowserStore } from "@/stores/browserStore";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as DappCategory[];

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
        className="grid shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-[12px] font-semibold text-muted"
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
      className="shrink-0 rounded-ctrl border border-line bg-surface2 object-cover"
    />
  );
}

function DappCard({ dapp, onOpen }: { dapp: DappEntry; onOpen: (dapp: DappEntry) => void }) {
  const supported = useBrowserStore((s) => s.supported);
  const body = (
    <div className="flex items-center gap-2.5">
      <SiteFavicon url={dapp.url} name={dapp.name} size={30} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-text">{dapp.name}</div>
        <div className="truncate text-[10px] text-muted">{hostOf(dapp.url)}</div>
      </div>
      {supported ? (
        <ArrowUpRight size={13} className="shrink-0 text-muted transition-colors group-hover:text-brand" />
      ) : (
        <ExternalLink size={13} className="shrink-0 text-muted transition-colors group-hover:text-brand" />
      )}
    </div>
  );

  const classes =
    "group flex items-center rounded-card border border-line bg-surface2 p-3 text-left transition-colors hover:border-brand/35 hover:bg-surface3";

  return supported ? (
    <button onClick={() => onOpen(dapp)} className={classes}>
      {body}
    </button>
  ) : (
    <a href={dapp.url} target="_blank" rel="noreferrer" className={classes}>
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
        <section className="rounded-card border border-line bg-surface2 p-4 sm:p-5">
          <h1 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text sm:text-[20px]">
            {$t("Uygulamalar")}
          </h1>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted">
            {$t("Bir uygulama seç; bağlantıyı sitenin kendi düğmesinden kur. Her imza senden onay ister.")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-ctrl border border-line bg-bg2 py-1 pl-1 pr-3">
              <ProfileAvatar size={22} />
              <span className="font-mono text-[11px] text-textsoft">
                {address ? shortAddress(address, 4) : $t("adres yok")}
              </span>
            </span>
            <span className="flex max-w-[160px] items-center gap-1.5 rounded-ctrl border border-line bg-bg2 px-2.5 py-1">
              <ChainIcon chainId={chainKey} size={17} />
              <span className="truncate text-[11px] text-textsoft">{chain?.shortName ?? chainKey}</span>
            </span>
          </div>
        </section>

        {sites.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {$t("Bağlı siteler")}
            </h2>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sites.map((site) => (
                <div
                  key={site.origin}
                  className="group flex shrink-0 items-center gap-2 rounded-card border border-ok/20 bg-ok/5 py-2 pl-2 pr-1.5"
                >
                  <button
                    onClick={() => void go(site.origin)}
                    className="flex min-w-0 items-center gap-2 rounded-ctrl text-left"
                  >
                    <SiteFavicon url={site.favicon || site.origin} name={site.name} size={26} />
                    <span className="min-w-0">
                      <span className="block max-w-[120px] truncate text-[12px] text-text">{site.name}</span>
                      <span className="block max-w-[120px] truncate text-[10px] text-ok/80">
                        {getChain(site.chainKey)?.shortName ?? hostOf(site.origin)}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => void disconnect(site.origin)}
                    title={$t("Bağlantıyı kes")}
                    aria-label={$t("{0} bağlantısını kes", [site.name])}
                    className="shrink-0 rounded-ctrl p-1 text-muted transition-colors hover:text-danger"
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
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {$t("Yer imleri")}
            </h2>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {bookmarks.slice(0, 12).map((mark) => (
                <div
                  key={mark.id}
                  className="flex shrink-0 items-center gap-2 rounded-card border border-line bg-surface2 py-2 pl-2 pr-1.5 transition-colors hover:border-brand/35"
                >
                  <button
                    onClick={() => void go(mark.url)}
                    className="flex min-w-0 items-center gap-2 rounded-ctrl text-left"
                  >
                    <SiteFavicon url={mark.favicon || mark.url} name={mark.title} size={24} />
                    <span className="max-w-[130px] truncate text-[12px] text-textsoft">{mark.title}</span>
                  </button>
                  <button
                    onClick={() => removeBookmark(mark.id)}
                    title={$t("Yer iminden çıkar")}
                    aria-label={$t("Yer iminden çıkar")}
                    className="shrink-0 rounded-ctrl p-1 text-muted transition-colors hover:text-danger"
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
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {$t("Uygulama dizini")}
            </h2>
            <label className="relative flex h-9 items-center sm:w-64">
              <Search size={14} className="pointer-events-none absolute left-3 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={$t("Uygulama ara")}
                spellCheck={false}
                className="h-9 w-full rounded-ctrl border border-line bg-surface2 pl-9 pr-8 text-[12px] text-text outline-none placeholder:text-muted focus:border-brand/50"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={$t("Aramayı temizle")}
                  className="absolute right-2 rounded p-1 text-muted hover:text-text"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
              {$t("Tümü")}
            </CategoryChip>
            {CATEGORIES.map((key) => (
              <CategoryChip key={key} active={category === key} onClick={() => setCategory(key)}>
                {CATEGORY_LABEL[key]}
              </CategoryChip>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-line px-4 py-10 text-center">
              <p className="text-[12px] text-textsoft">{$t("Bu aramada uygulama yok")}</p>
              <p className="mt-1 text-[11px] text-muted">
                {$t("Adres çubuğuna sitenin adresini yazarak da açabilirsin.")}
              </p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((dapp) => (
                <DappCard key={dapp.url} dapp={dapp} onOpen={openDapp} />
              ))}
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {$t("Son gezilenler")}
              </h2>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 rounded-ctrl px-1.5 py-1 text-[10px] text-muted transition-colors hover:text-danger"
              >
                <Trash size={11} /> {$t("Geçmişi temizle")}
              </button>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface2">
              {history.slice(0, 6).map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => void go(entry.url)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface3"
                  >
                    <Clock size={13} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-textsoft">
                        {titleFor(entry.url, entry.title)}
                      </span>
                      <span className="block truncate text-[10px] text-muted">{hostOf(entry.url)}</span>
                    </span>
                    <Bookmark size={12} className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 flex items-start gap-2 rounded-card border border-line bg-bg2/70 p-3 text-[11px] leading-relaxed text-muted">
          <Shield size={14} className="mt-0.5 shrink-0 text-ok" />
          {supported
            ? $t("Siteler anahtarlarını göremez. Adres paylaşımı, ağ değişimi, işlem ve imzalar ayrı onay ekranından geçer.")
            : $t("Uygulama içi tarayıcı Android sürümünde çalışır. Buradaki bağlantılar cihazının tarayıcısında açılır; onları WalletConnect ile bağlayabilirsin.")}
        </p>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-ctrl border px-3 text-[11px] font-medium transition-colors",
        active
          ? "border-brand/45 bg-brandsoft text-brand"
          : "border-line bg-surface2 text-muted hover:text-textsoft",
      )}
    >
      {children}
    </button>
  );
}
