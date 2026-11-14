import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { Globe, Plus, Trash, X } from "@phosphor-icons/react";
import { ChainIcon } from "@/components/TokenIcon";
import { Button } from "@/components/ui/Button";
import { hostOf, titleFor } from "@/lib/browser/address";
import { cn } from "@/lib/utils";
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
        "group relative overflow-hidden rounded-xl2 border bg-surface-850 transition-all duration-150",
        active ? "border-accent/60 shadow-glow" : "border-white/[0.07] hover:border-white/[0.16]",
      )}
    >
      <button onClick={onPick} className="focus-ring block w-full text-left">
        <span className="relative block h-28 overflow-hidden border-b border-white/[0.06] bg-surface-900">
          {tab.image ? (
            <img src={tab.image} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-mesh-brand">
              {tab.favicon ? (
                <img
                  src={tab.favicon}
                  alt=""
                  className="h-9 w-9 rounded-xl border border-white/[0.08] bg-surface-850 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
              ) : (
                <Globe size={26} className="text-zinc-600" />
              )}
            </span>
          )}
          {tab.loading && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-accent to-info" />
          )}
          {active && (
            <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
              {$t("Etkin")}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 px-2.5 py-2.5 pr-8">
          <ChainIcon chainId={tab.chainKey} size={16} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-zinc-100">{title}</span>
            <span className="block truncate text-[10px] text-zinc-600">{host || $t("Adres yazılmadı")}</span>
          </span>
        </span>
      </button>
      <button
        onClick={onClose}
        title={$t("Sekmeyi kapat")}
        aria-label={$t("{0} sekmesini kapat", [title])}
        className="focus-ring absolute bottom-2 right-1.5 grid h-6 w-6 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-danger/15 hover:text-danger"
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
    <div className="absolute inset-0 z-40 flex animate-fade-in flex-col bg-canvas/95 backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{$t("Sekmeler")}</h2>
          <p className="text-[11px] text-zinc-600">
            {$t("{0} / {1} sekme açık", [tabs.length, MAX_TABS])}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={$t("Kapat")}
          className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-surface-850 text-zinc-400 transition-colors hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="stagger mx-auto grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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
              className="focus-ring flex min-h-[152px] flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-white/[0.12] bg-surface-900/60 text-zinc-500 transition-colors hover:border-accent/45 hover:text-accent"
            >
              <Plus size={22} />
              <span className="text-[12px] font-medium">{$t("Yeni sekme")}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-white/[0.07] bg-surface-900/80 p-3">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={full}
          onClick={() => {
            void openTab();
            onClose();
          }}
        >
          <Plus size={15} /> {$t("Yeni sekme")}
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={empty}
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
          <Trash size={15} />
          {confirming ? $t("Emin misin?") : $t("Tüm sekmeleri kapat")}
        </Button>
      </div>
    </div>
  );
}