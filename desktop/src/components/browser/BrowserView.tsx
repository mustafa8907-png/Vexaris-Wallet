/**
 * Sitenin çizildiği alan.
 *
 * Android'de bu dikdörtgenin üstüne native WebView yerleştirilir; React
 * yalnızca boşluğu ölçüp bildirir. Ölçü klavye açılınca, pencere yeniden
 * boyutlanınca ve sayfa kaydırılınca tazelenir. Site yokken, çöktüğünde ya
 * da masaüstünde aynı alan uygulamanın kendi ekranlarını gösterir.
 */
import { t as $t } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowSquareOut,
  Desktop,
  House,
  PlugsConnected,
  SpinnerGap,
  Warning,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StartPage } from "@/components/browser/StartPage";
import { hostOf } from "@/lib/browser/address";
import { useBrowserStore } from "@/stores/browserStore";

export function BrowserView() {
  const ref = useRef<HTMLDivElement>(null);
  const supported = useBrowserStore((s) => s.supported);
  const tabs = useBrowserStore((s) => s.tabs);
  const activeId = useBrowserStore((s) => s.activeId);
  const covers = useBrowserStore((s) => s.covers);
  const setViewport = useBrowserStore((s) => s.setViewport);
  const reload = useBrowserStore((s) => s.reload);
  const goHome = useBrowserStore((s) => s.goHome);

  const tab = tabs.find((item) => item.id === activeId);
  const covered = covers > 0;

  useEffect(() => {
    const node = ref.current;
    if (!node || !supported) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setViewport({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
    };
  }, [supported, setViewport]);

  // Örtü altında sitenin son karesi gösterilir; kareyi mağaza örtü açarken alır.
  const showSite = supported && Boolean(tab?.url) && !tab?.error && !tab?.crashed;

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-canvas">
      {showSite ? (
        <>
          {covered && tab?.image && (
            <img
              src={tab.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top opacity-35 blur-[2px]"
              draggable={false}
            />
          )}
          {!tab?.mounted && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 text-[11px] text-zinc-600">
                <SpinnerGap size={14} className="animate-spin" />
                {$t("Sekme hazırlanıyor…")}
              </span>
            </div>
          )}
        </>
      ) : !tab?.url ? (
        <StartPage />
      ) : !supported ? (
        <ExternalNotice url={tab.url} onHome={() => void goHome()} />
      ) : (
        <FailurePanel
          crashed={Boolean(tab?.crashed)}
          error={tab?.error ?? ""}
          host={hostOf(tab.url)}
          onRetry={() => void reload()}
          onHome={() => void goHome()}
        />
      )}
    </div>
  );
}

function FailurePanel({
  crashed,
  error,
  host,
  onRetry,
  onHome,
}: {
  crashed: boolean;
  error: string;
  host: string;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-sm animate-fade-up rounded-xl2 border border-white/[0.07] bg-surface-850 p-5 text-center shadow-panel">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-danger/25 bg-danger/[0.08]">
          <Warning size={22} className="text-danger" />
        </div>
        <h2 className="mt-3 text-[15px] font-semibold text-white">
          {crashed ? $t("Sekme çöktü") : $t("Sayfa açılamadı")}
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
          {crashed
            ? $t("{0} beklenmedik şekilde kapandı. Yeniden yükleyebilirsin.", [host])
            : error || $t("{0} yanıt vermedi. Bağlantını denetleyip yeniden dene.", [host])}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onHome}>
            <House size={15} /> {$t("Başlangıç")}
          </Button>
          <Button className="flex-1" onClick={onRetry}>
            <ArrowsClockwise size={15} /> {$t("Yeniden dene")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExternalNotice({ url, onHome }: { url: string; onHome: () => void }) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-md animate-fade-up rounded-xl2 border border-white/[0.07] bg-surface-850 p-5 shadow-panel">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-info/25 bg-info/[0.08]">
            <Desktop size={20} className="text-info" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-white">{$t("Tarayıcı mobilde çalışır")}</h2>
            <p className="truncate text-[11px] text-zinc-500">{hostOf(url)}</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">
          {$t("Siteleri uygulama içinde açma ve cüzdanı tek dokunuşla bağlama Android sürümünde var. Masaüstünde siteyi kendi tarayıcında aç, oradan WalletConnect ile bağlan.")}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <ArrowSquareOut size={15} /> {$t("Tarayıcıda aç")}
          </a>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onHome}>
              <House size={15} /> {$t("Başlangıç")}
            </Button>
            <Link
              to="/connections"
              className="focus-ring inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-800 px-3 text-sm font-medium text-zinc-100 transition-colors hover:border-white/[0.14] hover:bg-surface-700"
            >
              <PlugsConnected size={15} /> {$t("Bağlantılar")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}