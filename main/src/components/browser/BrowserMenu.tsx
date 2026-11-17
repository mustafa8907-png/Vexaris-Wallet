import { t as $t } from "@/lib/i18n";
import { useState, type ComponentType } from "react";
import {
  Box,
  Bookmark,
  Clock,
  Copy,
  Grid,
  Plus,
  Refresh,
  Segmented,
  Terminal,
  Trash,
  X,
} from "@/kit";
import { ExternalLink } from "@/kit/ext";
import { ChainIcon } from "@/components/TokenIcon";
import { getChain } from "@/lib/chains/registry";
import { hostOf, titleFor } from "@/lib/browser/address";
import { copyText, shortAddress } from "@/lib/utils";
import { localeTag } from "@/lib/i18n";
import { useBrowserStore } from "@/stores/browserStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

type Pane = "marks" | "history" | "sites";

type IconType = ComponentType<{ size?: number | string; className?: string }>;

function Action({
  label,
  icon: Icon,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  icon: IconType;
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface2 px-1 py-2.5 transition-colors hover:border-brand/35 hover:bg-surface3 disabled:opacity-35"
    >
      <Icon size={17} className={tone ?? "text-textsoft"} />
      <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted">{label}</span>
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

  const paneOptions: { value: Pane; label: string }[] = [
    { value: "marks", label: `${$t("Yer imleri")} ${bookmarks.length}` },
    { value: "history", label: `${$t("Geçmiş")} ${history.length}` },
    { value: "sites", label: `${$t("Bağlı siteler")} ${sites.length}` },
  ];

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{$t("Tarayıcı")}</h2>
          <p className="truncate text-[11px] text-muted">
            {url ? hostOf(url) : $t("Başlangıç sayfası")}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={$t("Kapat")}
          className="grid size-9 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition-colors hover:text-text"
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
              icon={Bookmark}
              tone={marked ? "text-warn" : undefined}
              disabled={!url}
              onClick={() => toggleBookmark(url, tab?.title ?? "", tab?.favicon ?? "")}
            />
            <Action
              label={tab?.desktop ? $t("Mobil görünüm") : $t("Masaüstü görünümü")}
              icon={tab?.desktop ? Box : Terminal}
              tone={tab?.desktop ? "text-info" : undefined}
              disabled={!url || !supported}
              onClick={() => void toggleDesktop()}
            />
            <Action
              label={$t("Yenile")}
              icon={Refresh}
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
              icon={Grid}
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
              className="mt-2 flex items-center justify-center gap-2 rounded-card border border-line bg-bg2 py-2 text-[11px] text-muted transition-colors hover:border-brand/35 hover:text-text"
            >
              <ExternalLink size={13} /> {$t("Cihazın tarayıcısında aç")}
            </a>
          )}

          <div className="mt-4">
            <Segmented
              ariaLabel={$t("Tarayıcı")}
              size="sm"
              fullWidth
              value={pane}
              onChange={(value) => setPane(value as Pane)}
              options={paneOptions}
            />
          </div>

          <div className="mt-3">
            {pane === "marks" &&
              (bookmarks.length === 0 ? (
                <Empty
                  text={$t("Yer imi yok")}
                  hint={$t("Beğendiğin sayfayı yıldızla buraya ekle.")}
                />
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface2">
                  {bookmarks.map((mark) => (
                    <li key={mark.id} className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        onClick={() => {
                          void go(mark.url);
                          onClose();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-ctrl text-left"
                      >
                        <Bookmark size={14} className="shrink-0 text-warn" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-text">{mark.title}</span>
                          <span className="block truncate text-[10px] text-muted">{hostOf(mark.url)}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => removeBookmark(mark.id)}
                        aria-label={$t("Yer iminden çıkar")}
                        className="shrink-0 rounded-ctrl p-1.5 text-muted transition-colors hover:text-danger"
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
                    className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-ctrl border border-line bg-surface2 py-2 text-[11px] text-muted transition-colors hover:border-danger/35 hover:text-danger"
                  >
                    <Trash size={12} /> {$t("Geçmişi temizle")}
                  </button>
                  <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface2">
                    {history.slice(0, 60).map((entry) => (
                      <li key={entry.id}>
                        <button
                          onClick={() => {
                            void go(entry.url);
                            onClose();
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface3"
                        >
                          <Clock size={13} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] text-textsoft">
                              {titleFor(entry.url, entry.title)}
                            </span>
                            <span className="block truncate text-[10px] text-muted">{hostOf(entry.url)}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-muted">{stamp(entry.visitedAt)}</span>
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
                      className="flex items-center gap-2.5 rounded-card border border-line bg-surface2 p-3"
                    >
                      <ChainIcon chainId={site.chainKey} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-text">{site.name}</div>
                        <div className="truncate text-[10px] text-muted">
                          {hostOf(site.origin)} · {getChain(site.chainKey)?.shortName ?? site.chainKey}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-ok/80">
                          {shortAddress(site.address, 5)} · {stamp(site.connectedAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => void disconnect(site.origin)}
                        title={$t("Bağlantıyı kes")}
                        aria-label={$t("{0} bağlantısını kes", [site.name])}
                        className="shrink-0 rounded-ctrl border border-line p-2 text-muted transition-colors hover:border-danger/35 hover:text-danger"
                      >
                        <X size={14} />
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
    <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
      <p className="text-[12px] text-textsoft">{text}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
}
