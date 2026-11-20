import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { Button, Plus, Trash, X, cn } from "@/kit";
import { ChainIcon } from "@/components/TokenIcon";
import { SiteIcon } from "@/components/SiteIcon";
import { hostOf, titleFor } from "@/lib/browser/address";
import { MAX_TABS, useBrowserStore, type BrowserTab } from "@/stores/browserStore";

function TabCard({
  tab,
  active,
  onPick,
  onClose,
}: {
  tab: BrowserTab;
  active: boolean;
  onPick: () => void;
  onClose: () => void;
}) {
  const title = tab.url ? titleFor(tab.url, tab.title) : $t("Yeni sekme");
  const host = hostOf(tab.url);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card border bg-surface transition-all duration-150",
        active ? "border-brand/60" : "border-line hover:border-linestrong",
      )}
    >
      <button onClick={onPick} className="block w-full text-left">
        <span className="relative block h-28 overflow-hidden border-b border-line bg-bg">
          {tab.image ? (
            <img src={tab.image} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-surface2">
              <SiteIcon url={tab.url} name={tab.title} size={36} override={tab.favicon} />
            </span>
          )}
          {tab.loading && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand to-info" />
          )}
          {active && (
            <span className="absolute left-2 top-2 rounded-ctrl bg-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-bg">
              {$t("Etkin")}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 px-2.5 py-2.5 pr-8">
          <ChainIcon chainId={tab.chainKey} size={16} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-text">{title}</span>
            <span className="block truncate text-[10px] text-muted">{host || $t("Adres yazılmadı")}</span>
          </span>
        </span>
      </button>
      <button
        onClick={onClose}
        title={$t("Sekmeyi kapat")}
        aria-label={$t("{0} sekmesini kapat", [title])}
        className="absolute bottom-2 right-1.5 grid h-6 w-6 place-items-center rounded-ctrl text-muted transition-colors hover:bg-danger/15 hover:text-danger"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function TabSwitcher({ onClose }: { onClose: () => void }) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeId = useBrowserStore((s) => s.activeId);
  const activate = useBrowserStore((s) => s.activate);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const closeAll = useBrowserStore((s) => s.closeAll);
  const openTab = useBrowserStore((s) => s.openTab);
  const [confirming, setConfirming] = useState(false);

  const full = tabs.length >= MAX_TABS;
  const empty = tabs.length === 1 && !tabs[0].url;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text">{$t("Sekmeler")}</h2>
          <p className="text-[11px] text-muted">
            {$t("{0} / {1} sekme açık", [tabs.length, MAX_TABS])}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={$t("Kapat")}
          className="grid size-8 place-items-center rounded-ctrl border border-line bg-surface text-muted transition-colors hover:bg-surface2 hover:text-text"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              onPick={() => {
                void activate(tab.id);
                onClose();
              }}
              onClose={() => void closeTab(tab.id)}
            />
          ))}
          {!full && (
            <button
              onClick={() => {
                void openTab();
                onClose();
              }}
              className="flex min-h-[152px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-linestrong bg-bg/60 text-muted transition-colors hover:border-brand/45 hover:text-brand"
            >
              <Plus size={22} />
              <span className="text-[12px] font-medium">{$t("Yeni sekme")}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-line bg-bg/80 p-3">
        <Button
          variant="soft"
          className="flex-1"
          disabled={full}
          iconLeft={<Plus size={15} />}
          onClick={() => {
            void openTab();
            onClose();
          }}
        >
          {$t("Yeni sekme")}
        </Button>
        <Button
          variant="soft"
          tone="danger"
          className="flex-1"
          disabled={empty}
          iconLeft={<Trash size={15} />}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            void closeAll();
            onClose();
          }}
        >
          {confirming ? $t("Emin misin?") : $t("Tüm sekmeleri kapat")}
        </Button>
      </div>
    </div>
  );
}
