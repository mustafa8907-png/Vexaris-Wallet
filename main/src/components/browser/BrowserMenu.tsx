import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  BookmarkSimple,
  ClockCounterClockwise,
  Copy,
  Desktop,
  DeviceMobile,
  House,
  LinkBreak,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { ChainIcon } from "@/components/TokenIcon";
import { getChain } from "@/lib/chains/registry";
import { hostOf, titleFor } from "@/lib/browser/address";
import { cn, copyText, shortAddress } from "@/lib/utils";
import { localeTag } from "@/lib/i18n";
import { useBrowserStore } from "@/stores/browserStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

type Pane = "marks" | "history" | "sites";

function Action({
  label,
  icon: Icon,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-surface-850 px-1 py-2.5 transition-colors hover:border-accent/35 hover:bg-surface-800 disabled:opacity-35"
    >
      <Icon size={17} className={tone ?? "text-zinc-300"} />
      <span className="line-clamp-2 text-center text-[10px] leading-tight text-zinc-400">{label}</span>
    </button>
  );
}

export function BrowserMenu({ onClose }: { onClose: () => void }) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeId = useBrowserStore((s) => s.activeId);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const history = useBrowserStore((s) => s.history);
  const connections = useBrowserStore((s) => s.connections);
  const supported = useBrowserStore((s) => s.supported);
  const openTab = useBrowserStore((s) => s.openTab);
  const go = useBrowserStore((s) => s.go);
  const goHome = useBrowserStore((s) => s.goHome);
  const reload = useBrowserStore((s) => s.reload);
  const toggleDesktop = useBrowserStore((s) => s.toggleDesktop);
  const toggleBookmark = useBrowserStore((s) => s.toggleBookmark);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const clearHistory = useBrowserStore((s) => s.clearHistory);
  const clearSiteData = useBrowserStore((s) => s.clearSiteData);
  const disconnect = useBrowserStore((s) => s.disconnect);
  const locale = useSettingsStore((s) => s.locale);

  const [pane, setPane] = useState<Pane>("marks");
  const [wiping, setWiping] = useState(false);

  const tab = tabs.find((item) => item.id === activeId);
  const url = tab?.url ?? "";
  const marked = bookmarks.some((mark) => mark.url === url);
  const sites = Object.values(connections).sort((a, b) => b.connectedAt - a.connectedAt);

  const stamp = (value: number) =>
    new Date(value).toLocaleString(localeTag(locale), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function copyLink() {
    const ok = await copyText(url);
    toast(ok ? $t("Adres kopyalandı") : $t("Kopyalanamadı — panoya erişim kapalı"), ok ? "success" : "info");
  }

  const panes: { key: Pane; label: string; count: number }[] = [
    { key: "marks", label: $t("Yer imleri"), count: bookmarks.length },
    { key: "history", label: $t("Geçmiş"), count: history.length },
    { key: "sites", label: $t("Bağlı siteler"), count: sites.length },
  ];

  return (
    <div className="absolute inset-0 z-40 flex animate-fade-in flex-col bg-canvas/95 backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{$t("Tarayıcı")}</h2>
          <p className="truncate text-[11px] text-zinc-600">
            {url ? hostOf(url) : $t("Başlangıç sayfası")}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={$t("Kapat")}
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-surface-850 text-zinc-400 transition-colors hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-4 gap-2 pt-3">
            <Action
              label={$t("Yeni sekme")}
              icon={Plus}
              onClick={() => {
                void openTab();
                onClose();
              }}
            />
            <Action
              label={marked ? $t("Yer iminden çıkar") : $t("Yer imlerine ekle")}
              icon={BookmarkSimple}
              tone={marked ? "text-warning" : undefined}
              disabled={!url}
              onClick={() => toggleBookmark(url, tab?.title ?? "", tab?.favicon ?? "")}
            />
            <Action
              label={tab?.desktop ? $t("Mobil görünüm") : $t("Masaüstü görünümü")}
              icon={tab?.desktop ? DeviceMobile : Desktop}
              tone={tab?.desktop ? "text-info" : undefined}
              disabled={!url || !supported}
              onClick={() => void toggleDesktop()}
            />
            <Action
              label={$t("Yenile")}
              icon={ArrowsClockwise}
              disabled={!url}
              onClick={() => {
                void reload();
                onClose();
              }}
            />
            <Action
              label={$t("Adresi kopyala")}
              icon={Copy}
              disabled={!url}
              onClick={() => void copyLink()}
            />
            <Action
              label={$t("Başlangıç sayfası")}
              icon={House}
              onClick={() => {
                void goHome();
                onClose();
              }}
            />
            <Action
              label={wiping ? $t("Emin misin?") : $t("Site verilerini temizle")}
              icon={Trash}
              tone="text-danger"
              onClick={() => {
                if (!wiping) {
                  setWiping(true);
                  return;
                }
                setWiping(false);
                void clearSiteData();
                onClose();
              }}
            />
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-surface-900 py-2 text-[11px] text-zinc-400 transition-colors hover:border-accent/35 hover:text-white"
            >
              <ArrowSquareOut size={13} /> {$t("Cihazın tarayıcısında aç")}
            </a>
          )}

          <div className="mt-4 flex gap-1 rounded-xl border border-white/[0.07] bg-surface-900 p-1">
            {panes.map((item) => (
              <button
                key={item.key}
                onClick={() => setPane(item.key)}
                className={cn(
                  "focus-ring flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                  pane === item.key ? "bg-accent-soft text-white" : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                {item.label}
                <span className="ml-1 text-zinc-600">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-3">
            {pane === "marks" &&
              (bookmarks.length === 0 ? (
                <Empty
                  text={$t("Yer imi yok")}
                  hint={$t("Beğendiğin sayfayı yıldızla buraya ekle.")}
                />
              ) : (
                <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-850">
                  {bookmarks.map((mark) => (
                    <li key={mark.id} className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 last:border-0">
                      <button
                        onClick={() => {
                          void go(mark.url);
                          onClose();
                        }}
                        className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
                      >
                        <BookmarkSimple size={14} className="shrink-0 text-warning" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-zinc-100">{mark.title}</span>
                          <span className="block truncate text-[10px] text-zinc-600">{hostOf(mark.url)}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => removeBookmark(mark.id)}
                        aria-label={$t("Yer iminden çıkar")}
                        className="focus-ring shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ))}

            {pane === "history" &&
              (history.length === 0 ? (
                <Empty text={$t("Geçmiş boş")} hint={$t("Gezdiğin sayfalar burada birikir.")} />
              ) : (
                <>
                  <button
                    onClick={clearHistory}
                    className="focus-ring mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-850 py-2 text-[11px] text-zinc-400 transition-colors hover:border-danger/35 hover:text-danger"
                  >
                    <Trash size={12} /> {$t("Geçmişi temizle")}
                  </button>
                  <ul className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-850">
                    {history.slice(0, 60).map((entry) => (
                      <li key={entry.id} className="border-b border-white/[0.04] last:border-0">
                        <button
                          onClick={() => {
                            void go(entry.url);
                            onClose();
                          }}
                          className="row-hover focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                        >
                          <ClockCounterClockwise size={13} className="shrink-0 text-zinc-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] text-zinc-200">
                              {titleFor(entry.url, entry.title)}
                            </span>
                            <span className="block truncate text-[10px] text-zinc-600">{hostOf(entry.url)}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-zinc-700">{stamp(entry.visitedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ))}

            {pane === "sites" &&
              (sites.length === 0 ? (
                <Empty
                  text={$t("Bağlı site yok")}
                  hint={$t("Bir site aç ve sitenin kendi bağlan düğmesini kullan.")}
                />
              ) : (
                <ul className="space-y-2">
                  {sites.map((site) => (
                    <li
                      key={site.origin}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-surface-850 p-3"
                    >
                      <ChainIcon chainId={site.chainKey} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-zinc-100">{site.name}</div>
                        <div className="truncate text-[10px] text-zinc-600">
                          {hostOf(site.origin)} · {getChain(site.chainKey)?.shortName ?? site.chainKey}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-success/80">
                          {shortAddress(site.address, 5)} · {stamp(site.connectedAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => void disconnect(site.origin)}
                        title={$t("Bağlantıyı kes")}
                        aria-label={$t("{0} bağlantısını kes", [site.name])}
                        className="focus-ring shrink-0 rounded-lg border border-white/[0.07] p-2 text-zinc-500 transition-colors hover:border-danger/35 hover:text-danger"
                      >
                        <LinkBreak size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
      <p className="text-[12px] text-zinc-400">{text}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-zinc-600">{hint}</p>
    </div>
  );
}